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

// An unreported file must stay undiscovered. A full Refresh would pick it up,
// making this a deterministic regression check rather than a timing assertion.
func TestWatcherSingleFileEventsDoNotRescanSources(t *testing.T) {
	tests := []struct {
		name             string
		op               fsnotify.Op
		initiallyPresent bool
		change           func(*testing.T, string)
		wantAllowed      bool
	}{
		{
			name:             "create",
			op:               fsnotify.Create,
			initiallyPresent: false,
			change:           writeRegistryFile,
			wantAllowed:      true,
		},
		{
			name:             "remove",
			op:               fsnotify.Remove,
			initiallyPresent: true,
			change: func(t *testing.T, path string) {
				t.Helper()
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
			},
			wantAllowed: false,
		},
		{
			name:             "rename",
			op:               fsnotify.Rename,
			initiallyPresent: true,
			change: func(t *testing.T, path string) {
				t.Helper()
				if err := os.Rename(path, path+".renamed"); err != nil {
					t.Fatal(err)
				}
			},
			wantAllowed: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			existing := filepath.Join(dir, "existing", "keep.puml")
			writeRegistryFile(t, existing)
			target := filepath.Join(dir, "target.puml")
			if tt.initiallyPresent {
				writeRegistryFile(t, target)
			}
			reg, err := NewRegistry([]string{dir}, []string{".puml"})
			if err != nil {
				t.Fatal(err)
			}
			w, err := NewWatcher(reg, NewHub())
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				_ = w.Close()
				w.hub.Close()
			})
			sub := w.hub.Subscribe()
			defer w.hub.Unsubscribe(sub)
			hidden := filepath.Join(dir, "unreported.puml")
			writeRegistryFile(t, hidden)
			tt.change(t, target)
			w.handleEvent(fsnotify.Event{Name: target, Op: tt.op})
			if reg.Allowed(hidden) {
				t.Fatal("event rescanned unrelated files")
			}
			if !reg.Allowed(existing) {
				t.Fatal("unrelated registered file was removed")
			}
			if reg.Allowed(target) != tt.wantAllowed {
				t.Fatal("target membership was not updated")
			}
			select {
			case ev := <-sub:
				if ev.Name != "tree" {
					t.Fatalf("expected tree, got %s", ev.Name)
				}
			default:
				t.Fatal("missing tree notification")
			}
		})
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
	if err := r.addPath(sibling, nil); err != nil {
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
