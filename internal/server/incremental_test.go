package server

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/fsnotify/fsnotify"
)

func writeRegistryFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
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

func TestRegistryIncrementalSourceRules(t *testing.T) {
	for _, single := range []bool{false, true} {
		t.Run(fmt.Sprintf("single=%v", single), func(t *testing.T) {
			dir := t.TempDir()
			file := filepath.Join(dir, "diagram.PUML")
			writeRegistryFile(t, file)
			source := dir
			if single {
				source = file
			}
			r, err := NewRegistry([]string{source}, []string{"puml"})
			if err != nil {
				t.Fatal(err)
			}
			want := r.List()
			r.removePath(file)
			if r.Allowed(file) {
				t.Fatal("file still allowed after removal")
			}
			if err := r.addPath(file, nil); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(r.List(), want) {
				t.Fatalf("metadata changed: %v", r.List())
			}
			other := filepath.Join(dir, "other.puml")
			ignored := filepath.Join(dir, "notes.txt")
			outside := filepath.Join(t.TempDir(), "outside.puml")
			for _, path := range []string{other, ignored, outside} {
				writeRegistryFile(t, path)
				if err := r.addPath(path, nil); err != nil {
					t.Fatal(err)
				}
			}
			if r.Allowed(other) == single || r.Allowed(ignored) || r.Allowed(outside) {
				t.Fatal("source or extension filter violated")
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

// A late watch failure must not publish files visited earlier in the walk.
func TestRegistryDirectoryAddCommitsOnlyOnSuccess(t *testing.T) {
	dir := t.TempDir()
	existing := filepath.Join(dir, "existing.puml")
	writeRegistryFile(t, existing)
	r, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	before := r.List()
	subtree := filepath.Join(dir, "added")
	first := filepath.Join(subtree, "a.puml")
	last := filepath.Join(subtree, "z-nested", "b.puml")
	writeRegistryFile(t, first)
	writeRegistryFile(t, last)
	watchErr := errors.New("watch registration failed")
	var visited []string
	err = r.addPath(subtree, func(path string) error {
		visited = append(visited, path)
		// Readers must see the previous snapshot even after a.puml was visited.
		if !reflect.DeepEqual(r.List(), before) {
			t.Fatal("Registry exposed a partial directory update")
		}
		if path == filepath.Dir(last) {
			return watchErr
		}
		return nil
	})
	if !errors.Is(err, watchErr) {
		t.Fatalf("expected watch error, got %v", err)
	}
	if !reflect.DeepEqual(visited, []string{subtree, filepath.Dir(last)}) {
		t.Fatalf("unexpected walk order: %v", visited)
	}
	if !reflect.DeepEqual(r.List(), before) {
		t.Fatalf("failed walk changed Registry: %v", r.List())
	}
	if err := r.addPath(subtree, nil); err != nil {
		t.Fatal(err)
	}
	if !r.Allowed(first) || !r.Allowed(last) || !r.Allowed(existing) || len(r.List()) != 3 {
		t.Fatalf("successful retry did not commit all entries: %v", r.List())
	}
}
