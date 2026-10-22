package server

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/k1LoW/donegroup"
)

func newTestWatcher(t *testing.T, dir string, exts []string) (*Watcher, *Hub, context.CancelFunc) {
	t.Helper()
	reg, err := NewRegistry([]string{dir}, exts)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	hub := NewHub()
	w, err := NewWatcher(reg, hub)
	if err != nil {
		t.Fatalf("NewWatcher: %v", err)
	}
	ctx, cancel := donegroup.WithCancel(context.Background())
	if err := w.Start(ctx); err != nil {
		cancel()
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(func() {
		cancel()
		_ = w.Close()
		hub.Close()
	})
	return w, hub, cancel
}

func recv(t *testing.T, ch chan Event, want string, timeout time.Duration) (Event, bool) {
	t.Helper()
	deadline := time.After(timeout)
	for {
		select {
		case ev, ok := <-ch:
			if !ok {
				return Event{}, false
			}
			if ev.Name == want {
				return ev, true
			}
			// ignore other events while we wait for the named one
		case <-deadline:
			return Event{}, false
		}
	}
}

func TestWatcherEmitsTreeOnFileCreate(t *testing.T) {
	dir := t.TempDir()
	_, hub, _ := newTestWatcher(t, dir, []string{".puml"})
	sub := hub.Subscribe()
	defer hub.Unsubscribe(sub)

	puml := filepath.Join(dir, "new.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, ok := recv(t, sub, "tree", 2*time.Second); !ok {
		t.Fatal("expected tree event for new file")
	}
}

func TestWatcherEmitsChangedOnWrite(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "live.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, hub, _ := newTestWatcher(t, dir, []string{".puml"})
	sub := hub.Subscribe()
	defer hub.Unsubscribe(sub)

	if err := os.WriteFile(puml, []byte("@startuml\nA -> B\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	ev, ok := recv(t, sub, "changed", 2*time.Second)
	if !ok {
		t.Fatal("expected changed event after write")
	}
	data, ok := ev.Data.(map[string]string)
	if !ok {
		t.Fatalf("unexpected event payload type: %T", ev.Data)
	}
	if data["path"] != puml {
		t.Errorf("path mismatch: got %q want %q", data["path"], puml)
	}
}

func TestWatcherIgnoresUnmatchedExtensions(t *testing.T) {
	dir := t.TempDir()
	_, hub, _ := newTestWatcher(t, dir, []string{".puml"})
	sub := hub.Subscribe()
	defer hub.Unsubscribe(sub)

	other := filepath.Join(dir, "note.txt")
	if err := os.WriteFile(other, []byte("hi"), 0o600); err != nil {
		t.Fatal(err)
	}
	// Wait long enough for the tree event window; we should NOT receive a "changed" event.
	select {
	case ev := <-sub:
		if ev.Name == "changed" {
			t.Fatalf("did not expect changed event for unmatched extension: %+v", ev)
		}
	case <-time.After(300 * time.Millisecond):
		// success
	}
}

func TestWatcherRefreshesOnDelete(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "gone.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	w, hub, _ := newTestWatcher(t, dir, []string{".puml"})
	sub := hub.Subscribe()
	defer hub.Unsubscribe(sub)

	if err := os.Remove(puml); err != nil {
		t.Fatal(err)
	}
	if _, ok := recv(t, sub, "tree", 2*time.Second); !ok {
		t.Fatal("expected tree event after deletion")
	}
	if w.registry.Allowed(puml) {
		t.Error("expected deleted file to be removed from the registry")
	}
}

func TestWatcherCloseStopsLoop(t *testing.T) {
	dir := t.TempDir()
	w, _, _ := newTestWatcher(t, dir, []string{".puml"})
	if err := w.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	// Calling Close twice would call w.fsw.Close() again — fsnotify returns an
	// error on the second close, which is fine; we just don't want a panic.
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("panic on double close: %v", r)
		}
	}()
	_ = w.Close()
}

func TestWatcherFileCreateDoesNotRescanSources(t *testing.T) {
	dir := t.TempDir()
	w, sub := newTestWatcherForFileEvent(t, dir)
	target := filepath.Join(dir, "target.puml")
	writeRegistryFile(t, target)

	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Create})

	if !w.registry.Allowed(target) {
		t.Fatal("created file was not registered")
	}
	assertWatcherDidNotRescanSources(t, w, sub, dir)
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)
}

func TestWatcherFileRemoveDoesNotRescanSources(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target.puml")
	writeRegistryFile(t, target)
	w, sub := newTestWatcherForFileEvent(t, dir)
	if err := os.Remove(target); err != nil {
		t.Fatal(err)
	}

	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Remove})

	if w.registry.Allowed(target) {
		t.Fatal("removed file is still registered")
	}
	assertWatcherDidNotRescanSources(t, w, sub, dir)
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Remove})
	assertNoTreeEvent(t, sub)
}

func TestWatcherFileRenameDoesNotRescanSources(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target.puml")
	writeRegistryFile(t, target)
	w, sub := newTestWatcherForFileEvent(t, dir)
	if err := os.Rename(target, target+".renamed"); err != nil {
		t.Fatal(err)
	}

	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Rename})

	if w.registry.Allowed(target) {
		t.Fatal("renamed file is still registered at its old path")
	}
	assertWatcherDidNotRescanSources(t, w, sub, dir)
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Rename})
	assertNoTreeEvent(t, sub)
}

func newTestWatcherForFileEvent(t *testing.T, dir string) (*Watcher, chan Event) {
	t.Helper()
	writeRegistryFile(t, filepath.Join(dir, "existing", "keep.puml"))
	reg, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	sub := w.hub.Subscribe()
	t.Cleanup(func() {
		_ = w.Close()
		w.hub.Unsubscribe(sub)
		w.hub.Close()
	})
	writeRegistryFile(t, filepath.Join(dir, "unreported.puml"))
	return w, sub
}

// An unreported file must stay undiscovered; Refresh would pick it up.
func assertWatcherDidNotRescanSources(t *testing.T, w *Watcher, sub chan Event, dir string) {
	t.Helper()
	if w.registry.Allowed(filepath.Join(dir, "unreported.puml")) {
		t.Error("event rescanned unrelated files")
	}
	if !w.registry.Allowed(filepath.Join(dir, "existing", "keep.puml")) {
		t.Error("unrelated registered file was removed")
	}
	select {
	case ev := <-sub:
		if ev.Name != "tree" {
			t.Errorf("expected tree, got %s", ev.Name)
		}
	default:
		t.Error("missing tree notification")
	}
}

func TestWatcherMovedInDirectoryRegistersDescendants(t *testing.T) {
	dir := t.TempDir()
	r, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(r, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = w.Close()
		w.hub.Close()
	})
	subtree := filepath.Join(dir, "added")
	deep := filepath.Join(subtree, "nested", "diagram.puml")
	writeRegistryFile(t, deep)
	writeRegistryFile(t, filepath.Join(subtree, "notes.txt"))
	sibling := filepath.Join(dir, "added-other", "keep.puml")
	writeRegistryFile(t, sibling)
	if _, err := r.addPath(sibling, nil); err != nil {
		t.Fatal(err)
	}
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
	if !r.Allowed(deep) || len(r.List()) != 2 {
		t.Fatalf("unexpected files: %v", r.List())
	}
	watched := map[string]bool{}
	for _, path := range w.fsw.WatchList() {
		watched[path] = true
	}
	if !watched[subtree] || !watched[filepath.Dir(deep)] {
		t.Fatal("missing recursive watches")
	}
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Rename})
	if r.Allowed(deep) || !r.Allowed(sibling) {
		t.Fatal("subtree removal crossed path boundary")
	}
}

func assertNoTreeEvent(t *testing.T, sub chan Event) {
	t.Helper()
	for {
		select {
		case ev, ok := <-sub:
			if !ok {
				return
			}
			if ev.Name == "tree" {
				t.Fatal("unexpected tree notification without a Registry change")
			}
		default:
			return
		}
	}
}

func TestWatcherExistingFileCreateDoesNotEmitTree(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target.puml")
	writeRegistryFile(t, target)
	w, sub := newTestWatcherForFileEvent(t, dir)

	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)

	if _, ok := recv(t, sub, "changed", 2*time.Second); !ok {
		t.Fatal("expected changed notification for existing file")
	}
	assertNoTreeEvent(t, sub)
}

func TestWatcherUnmatchedFileEventsDoNotEmitTree(t *testing.T) {
	dir := t.TempDir()
	w, sub := newTestWatcherForFileEvent(t, dir)
	target := filepath.Join(dir, "notes.txt")
	writeRegistryFile(t, target)
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)

	if err := os.Remove(target); err != nil {
		t.Fatal(err)
	}
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Remove})
	assertNoTreeEvent(t, sub)
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Rename})
	assertNoTreeEvent(t, sub)
}

func TestWatcherSingleFileSourceIgnoresSiblingEvents(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "target.puml")
	writeRegistryFile(t, target)
	r, err := NewRegistry([]string{target}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(r, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	sub := w.hub.Subscribe()
	t.Cleanup(func() {
		_ = w.Close()
		w.hub.Unsubscribe(sub)
		w.hub.Close()
	})
	sibling := filepath.Join(dir, "other.puml")
	writeRegistryFile(t, sibling)
	for _, op := range []fsnotify.Op{fsnotify.Create, fsnotify.Remove, fsnotify.Rename} {
		w.handleEvent(fsnotify.Event{Name: sibling, Op: op})
		assertNoTreeEvent(t, sub)
	}
}

func TestWatcherEmptyDirectoryWatchesWithoutTreeNotification(t *testing.T) {
	dir := t.TempDir()
	w, sub := newTestWatcherForFileEvent(t, dir)
	subtree := filepath.Join(dir, "empty")
	if err := os.Mkdir(subtree, 0o700); err != nil {
		t.Fatal(err)
	}
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)
	watched := false
	for _, path := range w.fsw.WatchList() {
		if path == subtree {
			watched = true
		}
	}
	if !watched {
		t.Fatal("empty directory was not watched")
	}
	target := filepath.Join(subtree, "new.puml")
	writeRegistryFile(t, target)
	w.handleEvent(fsnotify.Event{Name: target, Op: fsnotify.Create})
	if !w.registry.Allowed(target) {
		t.Fatal("file in new directory was not registered")
	}
	assertWatcherDidNotRescanSources(t, w, sub, dir)
}
