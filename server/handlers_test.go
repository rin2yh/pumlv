package server

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestServer(t *testing.T, paths []string, exts []string) (*Server, *httptest.Server) {
	t.Helper()
	reg, err := NewRegistry(paths, exts)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	hub := NewHub()
	s := &Server{registry: reg, hub: hub}
	mux := http.NewServeMux()
	s.registerRoutes(mux)
	ts := httptest.NewServer(mux)
	t.Cleanup(func() {
		ts.Close()
		hub.Close()
	})
	return s, ts
}

func TestHandleFilesReturnsRegistryList(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "a.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	resp, err := http.Get(ts.URL + "/api/files")
	if err != nil {
		t.Fatalf("GET /api/files: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("unexpected content-type: %q", ct)
	}
	var entries []FileEntry
	if err := json.NewDecoder(resp.Body).Decode(&entries); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(entries) != 1 || entries[0].Name != "a.puml" {
		t.Errorf("unexpected entries: %+v", entries)
	}
}

func TestHandleFileServesAllowedFile(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "ok.puml")
	body := []byte("@startuml\nAlice -> Bob\n@enduml\n")
	if err := os.WriteFile(puml, body, 0o600); err != nil {
		t.Fatal(err)
	}
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	resp, err := http.Get(ts.URL + "/api/file?path=" + puml)
	if err != nil {
		t.Fatalf("GET /api/file: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: %d", resp.StatusCode)
	}
	got, _ := io.ReadAll(resp.Body)
	if string(got) != string(body) {
		t.Errorf("body mismatch: got %q", got)
	}
}

func TestHandleFileMissingPathReturns400(t *testing.T) {
	dir := t.TempDir()
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})
	resp, err := http.Get(ts.URL + "/api/file")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestHandleFileRejectsUnregisteredPath(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "in.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "out.puml")
	if err := os.WriteFile(outside, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	resp, err := http.Get(ts.URL + "/api/file?path=" + outside)
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestHandleFileMissingFileReturns404(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "ghost.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})
	if err := os.Remove(puml); err != nil {
		t.Fatal(err)
	}
	resp, err := http.Get(ts.URL + "/api/file?path=" + puml)
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHandleEventsStreamsHelloAndBroadcasts(t *testing.T) {
	dir := t.TempDir()
	s, ts := newTestServer(t, []string{dir}, []string{".puml"})

	resp, err := http.Get(ts.URL + "/api/events")
	if err != nil {
		t.Fatalf("GET /api/events: %v", err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("unexpected content-type: %q", ct)
	}

	br := bufio.NewReader(resp.Body)
	gotHello := waitForEvent(t, br, "hello", 2*time.Second)
	if !gotHello {
		t.Fatal("did not receive hello event")
	}

	// Give the subscriber a tick to register before broadcasting; the handler
	// subscribes before writing hello so by here it is already registered.
	s.hub.Broadcast(Event{Name: "changed", Data: map[string]string{"path": "/x.puml"}})
	gotChanged := waitForEvent(t, br, "changed", 2*time.Second)
	if !gotChanged {
		t.Fatal("did not receive changed event")
	}
}

func waitForEvent(t *testing.T, br *bufio.Reader, name string, timeout time.Duration) bool {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		line, err := br.ReadString('\n')
		if err != nil {
			return false
		}
		if strings.TrimSpace(line) == "event: "+name {
			return true
		}
	}
	return false
}

func TestHandleStaticServesIndex(t *testing.T) {
	dir := t.TempDir()
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("GET /: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	lower := strings.ToLower(string(body))
	if !strings.Contains(lower, "<!doctype html") && !strings.Contains(lower, "<html") {
		snippet := string(body)
		if len(snippet) > 200 {
			snippet = snippet[:200] + "..."
		}
		t.Errorf("expected HTML body, got: %q", snippet)
	}
}

func TestHandleStaticMissingAssetReturns404(t *testing.T) {
	dir := t.TempDir()
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	resp, err := http.Get(ts.URL + "/assets/does-not-exist.js")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for missing asset, got %d", resp.StatusCode)
	}
}

func TestHandleStaticSpaFallback(t *testing.T) {
	dir := t.TempDir()
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	// Path with no extension and no matching asset should fall back to index.html.
	resp, err := http.Get(ts.URL + "/some/spa/route")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 (SPA fallback), got %d", resp.StatusCode)
	}
}

func TestStaticResponseHasCrossOriginIsolationHeaders(t *testing.T) {
	dir := t.TempDir()
	_, ts := newTestServer(t, []string{dir}, []string{".puml"})

	for _, path := range []string{"/", "/some/spa/route"} {
		resp, err := http.Get(ts.URL + path)
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		resp.Body.Close()

		if got := resp.Header.Get("Cross-Origin-Opener-Policy"); got != "same-origin" {
			t.Errorf("GET %s: COOP = %q, want same-origin", path, got)
		}
		if got := resp.Header.Get("Cross-Origin-Embedder-Policy"); got != "credentialless" {
			t.Errorf("GET %s: COEP = %q, want credentialless", path, got)
		}
	}
}
