package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/rin2yh/pumlv/internal/static"
)

func (s *Server) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/files", s.handleFiles)
	mux.HandleFunc("/api/file", s.handleFile)
	mux.HandleFunc("/api/events", s.handleEvents)
	mux.Handle("/", s.handleStatic())
}

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(s.core.List()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (s *Server) handleFile(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	if p == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	var line *int
	if value, present := r.URL.Query()["line"]; present {
		parsed, err := strconv.Atoi(value[0])
		if err != nil || parsed < 1 {
			http.Error(w, "invalid diagram line", http.StatusBadRequest)
			return
		}
		line = &parsed
	}
	data, err := s.core.ReadFile(p, line)
	if err != nil {
		status := http.StatusNotFound
		if errors.Is(err, ErrFileNotAllowed) {
			status = http.StatusForbidden
		}
		http.Error(w, err.Error(), status)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write(data)
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	client := s.core.Subscribe()
	defer s.core.Unsubscribe(client)

	// Initial hello so the client can flag the connection as open.
	if _, err := fmt.Fprintf(w, "event: hello\ndata: {}\n\n"); err != nil {
		return
	}
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case ev, open := <-client:
			if !open {
				return
			}
			payload, err := json.Marshal(ev.Data)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, payload); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (s *Server) handleStatic() http.Handler {
	sub, err := fs.Sub(static.Frontend, "dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "static assets unavailable: "+err.Error(), http.StatusInternalServerError)
		})
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if _, err := fs.Stat(sub, path); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
			// Asset-like requests (anything with an extension) must 404
			// instead of falling through to the SPA's index.html — otherwise
			// the browser would parse HTML as JS / SVG / image and produce
			// confusing failures downstream.
			if filepath.Ext(path) != "" {
				http.NotFound(w, r)
				return
			}
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
