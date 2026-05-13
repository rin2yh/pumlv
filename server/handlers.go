package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/yuukibarns/pumlv/static"
)

func (s *Server) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/files", s.handleFiles)
	mux.HandleFunc("/api/file", s.handleFile)
	mux.HandleFunc("/api/events", s.handleEvents)
	mux.Handle("/", s.handleStatic())
}

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(s.registry.List()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (s *Server) handleFile(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("path")
	if p == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !s.registry.Allowed(abs) {
		http.Error(w, "file not allowed", http.StatusForbidden)
		return
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
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

	client := s.hub.Subscribe()
	defer s.hub.Unsubscribe(client)

	// Initial hello so the client can flag the connection as open.
	fmt.Fprintf(w, "event: hello\ndata: {}\n\n")
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
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, payload)
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
			// Asset extensions must 404 so CheerpJ can detect missing classpath
			// entries instead of receiving index.html as a JAR / class file.
			if filepath.Ext(path) != "" {
				http.NotFound(w, r)
				return
			}
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
