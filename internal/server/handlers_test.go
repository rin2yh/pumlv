package server

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"
)

func closeResponseBody(t *testing.T, resp *http.Response) {
	t.Helper()
	t.Cleanup(func() {
		if err := resp.Body.Close(); err != nil {
			t.Errorf("close response body: %v", err)
		}
	})
}

func newTestServer(t *testing.T, paths []string, exts []string) (*Server, *httptest.Server) {
	t.Helper()
	reg, err := NewRegistry(paths, exts)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	hub := NewHub()
	s := &Server{core: &Core{registry: reg, hub: hub}}
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("unexpected content-type: %q", ct)
	}

	br := bufio.NewReader(resp.Body)
	gotHello := waitForEvent(t, br, sseEventWait{name: "hello", timeout: 2 * time.Second})
	if !gotHello {
		t.Fatal("did not receive hello event")
	}

	// Give the subscriber a tick to register before broadcasting; the handler
	// subscribes before writing hello so by here it is already registered.
	s.core.hub.Broadcast(Event{Name: "changed", Data: map[string]string{"path": "/x.puml"}})
	gotChanged := waitForEvent(t, br, sseEventWait{name: "changed", timeout: 2 * time.Second})
	if !gotChanged {
		t.Fatal("did not receive changed event")
	}
}

type sseEventWait struct {
	name    string
	timeout time.Duration
}

func waitForEvent(t *testing.T, br *bufio.Reader, want sseEventWait) bool {
	t.Helper()
	deadline := time.Now().Add(want.timeout)
	for time.Now().Before(deadline) {
		line, err := br.ReadString('\n')
		if err != nil {
			return false
		}
		if strings.TrimSpace(line) == "event: "+want.name {
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
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
	closeResponseBody(t, resp)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 (SPA fallback), got %d", resp.StatusCode)
	}
}

func TestHandleFileServesExtractedMarkdownDiagram(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.MD")
	if err := os.WriteFile(path, []byte("# Diagram\n```puml\nAlice -> Bob\n```\n```wsd\nBob -> Alice\n```\nprose"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, ts := newTestServer(t, []string{path}, []string{".md"})
	resp, err := http.Get(ts.URL + "/api/file?path=" + url.QueryEscape(path))
	if err != nil {
		t.Fatal(err)
	}
	closeResponseBody(t, resp)
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK || string(data) != "@startuml\nAlice -> Bob\n@enduml\n" {
		t.Fatalf("status %d, body %q", resp.StatusCode, data)
	}
}

func TestMarkdownDiagramAPI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagrams.md")
	if err := os.WriteFile(path, []byte("```puml\ntitle First\nAlice -> Bob: First\n```\n\n```puml\nBob -> Alice: Second\n```\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, ts := newTestServer(t, []string{path}, []string{".md"})
	resp, err := http.Get(ts.URL + "/api/files")
	if err != nil {
		t.Fatal(err)
	}
	closeResponseBody(t, resp)
	var files []struct {
		Diagrams []MarkdownDiagram `json:"diagrams"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&files); err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || len(files[0].Diagrams) != 2 {
		t.Fatalf("files=%+v", files)
	}
	if files[0].Diagrams[0].Line != 1 || files[0].Diagrams[0].Title != "First" || files[0].Diagrams[1].Line != 6 {
		t.Fatalf("diagrams=%+v", files[0].Diagrams)
	}
	for _, tt := range []struct {
		query    string
		status   int
		contains string
	}{
		{"", 200, "First"}, {"&line=1", 200, "First"}, {"&line=6", 200, "Second"}, {"&line=2", 404, ""}, {"&line=-1", 400, ""}, {"&line=no", 400, ""}, {"&line=", 400, ""},
	} {
		t.Run(tt.query, func(t *testing.T) {
			resp, err := http.Get(ts.URL + "/api/file?path=" + url.QueryEscape(path) + tt.query)
			if err != nil {
				t.Fatal(err)
			}
			closeResponseBody(t, resp)
			data, _ := io.ReadAll(resp.Body)
			if resp.StatusCode != tt.status || !strings.Contains(string(data), tt.contains) {
				t.Fatalf("status=%d body=%q", resp.StatusCode, data)
			}
			if tt.status == 200 && strings.Contains(string(data), "First") && strings.Contains(string(data), "Second") {
				t.Fatal("returned multiple diagrams")
			}
		})
	}
}

func TestMarkdownAPIsUseRegistrySnapshotAndOnlyUpdateChangedFile(t *testing.T) {
	dir := t.TempDir()
	first, other := filepath.Join(dir, "first.md"), filepath.Join(dir, "other.md")
	write := func(path, content string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write(first, "```puml\ntitle Initial\nAlice -> Bob: Initial\n```\n")
	write(other, "```puml\ntitle Other\nBob -> Alice: Other\n```\n")
	s, ts := newTestServer(t, []string{dir}, []string{".md"})
	var reads []string
	s.core.registry.readFile = func(path string) ([]byte, error) { reads = append(reads, path); return os.ReadFile(path) }
	get := func(path string, status int) string {
		t.Helper()
		resp, err := http.Get(ts.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		closeResponseBody(t, resp)
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != status {
			t.Fatalf("GET %s: status=%d body=%s", path, resp.StatusCode, data)
		}
		return string(data)
	}
	list := func() []FileEntry {
		t.Helper()
		var entries []FileEntry
		if err := json.Unmarshal([]byte(get("/api/files", 200)), &entries); err != nil {
			t.Fatal(err)
		}
		return entries
	}
	source := func(path string, line int) string {
		t.Helper()
		return get("/api/file?"+url.Values{"path": {path}, "line": {strconv.Itoa(line)}}.Encode(), 200)
	}
	// Even if the disk has already changed, both APIs serve the same committed snapshot.
	write(first, "# Moved\n\n```puml\ntitle Updated\nAlice -> Bob: Updated\n```\n")
	write(other, "```puml\ntitle Unpublished\nBob -> Alice: Unpublished\n```\n")
	for range 3 {
		entries := list()
		if len(entries) != 2 || entries[0].Diagrams[0].Line != 1 || entries[0].Diagrams[0].Title != "Initial" {
			t.Fatalf("unexpected snapshot: %+v", entries)
		}
		if got := source(first, 1); !strings.Contains(got, "Initial") {
			t.Fatalf("source=%q", got)
		}
	}
	if len(reads) != 0 {
		t.Fatalf("API requests read Markdown: %v", reads)
	}
	changed, err := s.core.registry.Update(first)
	if err != nil || !changed {
		t.Fatalf("Update=%v,%v", changed, err)
	}
	if !reflect.DeepEqual(reads, []string{first}) {
		t.Fatalf("read %v, want only %s", reads, first)
	}
	entries := list()
	if entries[0].Diagrams[0].Line != 3 || entries[0].Diagrams[0].Title != "Updated" || entries[1].Diagrams[0].Title != "Other" {
		t.Fatalf("unexpected updated snapshot: %+v", entries)
	}
	if got := source(first, 3); !strings.Contains(got, "Updated") {
		t.Fatalf("source=%q", got)
	}
	if got := source(other, 1); !strings.Contains(got, "Other") {
		t.Fatalf("unrelated source changed: %q", got)
	}
	get("/api/file?path="+url.QueryEscape(first)+"&line=1", 404)
	if !reflect.DeepEqual(reads, []string{first}) {
		t.Fatalf("API reparsed Markdown: %v", reads)
	}

	// A failed update keeps both labels and sources from the previous snapshot.
	before, _ := s.core.registry.lookup(first)
	s.core.registry.readFile = func(string) ([]byte, error) { return nil, os.ErrPermission }
	if _, err := s.core.registry.Update(first); !errors.Is(err, os.ErrPermission) {
		t.Fatalf("Update=%v", err)
	}
	after, _ := s.core.registry.lookup(first)
	if !reflect.DeepEqual(before, after) {
		t.Fatal("failed update replaced the cached entry")
	}
	if list()[0].Diagrams[0].Title != "Updated" || !strings.Contains(source(first, 3), "Updated") {
		t.Fatal("APIs diverged after read failure")
	}
	s.core.registry.readFile = os.ReadFile

	// Eligibility changes and removal discard the parsed diagrams with the entry.
	write(first, "# No diagrams\n")
	if changed, err := s.core.registry.Update(first); err != nil || !changed {
		t.Fatalf("Update=%v,%v", changed, err)
	}
	if len(list()) != 1 {
		t.Fatal("removed diagrams remain listed")
	}
	get("/api/file?path="+url.QueryEscape(first), 403)
	write(first, "```puml\nAlice -> Bob: Restored\n```\n")
	if changed, err := s.core.registry.addPath(first, nil); err != nil || !changed {
		t.Fatalf("addPath=%v,%v", changed, err)
	}
	if len(list()) != 2 || !strings.Contains(source(first, 1), "Restored") {
		t.Fatal("restored diagrams missing")
	}
	s.core.registry.removePath(first)
	get("/api/file?path="+url.QueryEscape(first), 403)
	if len(list()) != 1 {
		t.Fatal("deleted file remains listed")
	}
}
