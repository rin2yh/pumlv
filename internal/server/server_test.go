package server

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/k1LoW/donegroup"
)

func TestNewFillsDefaultHostAndBuildsRegistry(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "a.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := donegroup.WithCancel(context.Background())
	defer cancel()

	srv, err := New(ctx, Options{Paths: []string{dir}, Exts: []string{".puml"}})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if srv.opts.Host != "127.0.0.1" {
		t.Errorf("default host: got %q want 127.0.0.1", srv.opts.Host)
	}
	if srv.registry == nil || srv.watcher == nil || srv.hub == nil || srv.httpd == nil {
		t.Errorf("expected all internal fields populated")
	}
	if got := len(srv.registry.List()); got != 1 {
		t.Errorf("expected 1 registered file, got %d", got)
	}
}

func TestNewReturnsErrorForMissingPath(t *testing.T) {
	ctx, cancel := donegroup.WithCancel(context.Background())
	defer cancel()
	_, err := New(ctx, Options{Paths: []string{filepath.Join(t.TempDir(), "nope")}, Exts: []string{".puml"}})
	if err == nil {
		t.Fatal("expected error for missing path")
	}
}

func TestServerStartAndShutdown(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "a.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := donegroup.WithCancel(context.Background())
	srv, err := New(ctx, Options{Paths: []string{dir}, Host: "127.0.0.1", Port: 0, Exts: []string{".puml"}})
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	addr, err := srv.Start(ctx)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if !strings.HasPrefix(addr, "127.0.0.1:") {
		t.Errorf("unexpected addr: %q", addr)
	}

	// /api/files should return the registered file.
	resp, err := httpGetWithRetry(t, "http://"+addr+"/api/files", 2*time.Second)
	if err != nil {
		t.Fatalf("GET /api/files: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", resp.StatusCode)
	}
	var entries []FileEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("expected 1 entry, got %d", len(entries))
	}

	cancel()
	if err := donegroup.Wait(ctx); err != nil {
		t.Fatalf("Wait: %v", err)
	}

	// After shutdown the server should refuse new connections.
	client := &http.Client{Timeout: 200 * time.Millisecond}
	if _, err := client.Get("http://" + addr + "/api/files"); err == nil {
		t.Error("expected connection to fail after shutdown")
	}
}

func httpGetWithRetry(t *testing.T, url string, total time.Duration) (*http.Response, error) {
	t.Helper()
	deadline := time.Now().Add(total)
	var lastErr error
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		time.Sleep(20 * time.Millisecond)
	}
	return nil, lastErr
}
