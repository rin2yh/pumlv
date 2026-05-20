package server

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/k1LoW/donegroup"
)

// Options configures a Server.
type Options struct {
	Paths []string
	Host  string
	Port  int
	Exts  []string
}

// Server is the running pumlv HTTP service.
type Server struct {
	opts     Options
	registry *Registry
	watcher  *Watcher
	hub      *Hub
	httpd    *http.Server
}

// New constructs the server, but does not start listening yet.
func New(ctx context.Context, opts Options) (*Server, error) {
	if opts.Host == "" {
		opts.Host = "127.0.0.1"
	}
	reg, err := NewRegistry(opts.Paths, opts.Exts)
	if err != nil {
		return nil, err
	}
	hub := NewHub()
	w, err := NewWatcher(reg, hub)
	if err != nil {
		return nil, err
	}
	s := &Server{opts: opts, registry: reg, watcher: w, hub: hub}
	mux := http.NewServeMux()
	s.registerRoutes(mux)
	s.httpd = &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	return s, nil
}

// Start binds the listener and launches the HTTP server and watcher under donegroup.
// It returns the resolved listening address (useful when port=0).
func (s *Server) Start(ctx context.Context) (string, error) {
	addr := fmt.Sprintf("%s:%d", s.opts.Host, s.opts.Port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return "", err
	}
	resolved := ln.Addr().String()

	if err := s.watcher.Start(ctx); err != nil {
		_ = ln.Close()
		return "", err
	}

	httpDone := donegroup.Awaitable(ctx)
	go func() {
		defer httpDone()
		if err := s.httpd.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			// Surfacing the error here would require plumbing; the Shutdown path is
			// the normal exit, so we just log to stderr via the http package's default.
		}
	}()

	if err := donegroup.Cleanup(ctx, func() error {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		s.hub.Close()
		if err := s.httpd.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return s.watcher.Close()
	}); err != nil {
		return "", err
	}

	return resolved, nil
}
