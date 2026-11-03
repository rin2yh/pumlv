package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

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
	s.registry.readFile = func(path string) ([]byte, error) { reads = append(reads, path); return os.ReadFile(path) }
	get := func(path string, status int) string {
		t.Helper()
		resp, err := http.Get(ts.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
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
	changed, err := s.registry.Update(first)
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
	before, _ := s.registry.lookup(first)
	s.registry.readFile = func(string) ([]byte, error) { return nil, os.ErrPermission }
	if _, err := s.registry.Update(first); !errors.Is(err, os.ErrPermission) {
		t.Fatalf("Update=%v", err)
	}
	after, _ := s.registry.lookup(first)
	if !reflect.DeepEqual(before, after) {
		t.Fatal("failed update replaced the cached entry")
	}
	if list()[0].Diagrams[0].Title != "Updated" || !strings.Contains(source(first, 3), "Updated") {
		t.Fatal("APIs diverged after read failure")
	}
	s.registry.readFile = os.ReadFile

	// Eligibility changes and removal discard the parsed diagrams with the entry.
	write(first, "# No diagrams\n")
	if changed, err := s.registry.Update(first); err != nil || !changed {
		t.Fatalf("Update=%v,%v", changed, err)
	}
	if len(list()) != 1 {
		t.Fatal("removed diagrams remain listed")
	}
	get("/api/file?path="+url.QueryEscape(first), 403)
	write(first, "```puml\nAlice -> Bob: Restored\n```\n")
	if changed, err := s.registry.addPath(first, nil); err != nil || !changed {
		t.Fatalf("addPath=%v,%v", changed, err)
	}
	if len(list()) != 2 || !strings.Contains(source(first, 1), "Restored") {
		t.Fatal("restored diagrams missing")
	}
	s.registry.removePath(first)
	get("/api/file?path="+url.QueryEscape(first), 403)
	if len(list()) != 1 {
		t.Fatal("deleted file remains listed")
	}
}

func TestRegistryMarkdownSnapshotsDoNotShareMutableData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.md")
	if err := os.WriteFile(path, []byte("```puml\ntitle Original\nAlice -> Bob\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{path}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	entries := reg.List()
	if entries[0].Diagrams[0].Source != nil {
		t.Fatal("List exposes cached sources")
	}
	entries[0].Diagrams[0].Title = "mutated"
	entry, _ := reg.lookup(path)
	entry.Diagrams[0].Title = "mutated"
	entry.Diagrams[0].Source[0] = '!'
	next, _ := reg.lookup(path)
	if next.Diagrams[0].Title != "Original" || next.Diagrams[0].Source[0] != '@' {
		t.Fatal("caller mutated Registry snapshot")
	}
}

func TestRegistrySubtreeRefreshesSourceOnlyEdits(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "diagram.md")
	write := func(message string) {
		t.Helper()
		if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob: "+message+"\n```"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("Before")
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	write("After")
	if changed, err := reg.addPath(dir, nil); err != nil || changed {
		t.Fatalf("source-only update changed tree: %v,%v", changed, err)
	}
	entry, _ := reg.lookup(path)
	if !strings.Contains(string(entry.Diagrams[0].Source), "After") {
		t.Fatal("subtree retained stale source")
	}
}

func TestRegistryDirectoryScanDiscardsStaleMarkdownSources(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "a-diagram.md")
	write := func(label string) {
		t.Helper()
		if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob: "+label+"\n```"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write("Before")
	pause := filepath.Join(dir, "z-pause")
	if err := os.Mkdir(pause, 0o700); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	started, release := make(chan struct{}), make(chan struct{})
	unblock := sync.OnceFunc(func() { close(release) })
	t.Cleanup(unblock)
	result := make(chan error, 1)
	go func() {
		_, err := reg.addPath(dir, func(child string) error {
			if child == pause {
				close(started)
				<-release
			}
			return nil
		})
		result <- err
	}()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("scan did not pause")
	}
	write("After")
	// The labels are unchanged, but publishing a new source must invalidate the scan.
	if changed, err := reg.Update(path); err != nil || changed {
		t.Fatalf("Update=%v,%v", changed, err)
	}
	unblock()
	select {
	case err := <-result:
		if err == nil {
			t.Fatal("stale scan was committed")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("scan did not finish")
	}
	entry, _ := reg.lookup(path)
	if !strings.Contains(string(entry.Diagrams[0].Source), "After") {
		t.Fatal("stale scan replaced current source")
	}
}
