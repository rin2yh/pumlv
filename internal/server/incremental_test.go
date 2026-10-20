package server

import (
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
	for _, op := range []fsnotify.Op{fsnotify.Create, fsnotify.Remove, fsnotify.Rename} {
		t.Run(op.String(), func(t *testing.T) {
			dir := t.TempDir()
			for i := range 1000 {
				writeRegistryFile(t, filepath.Join(dir, "existing", fmt.Sprintf("%d.puml", i)))
			}
			target := filepath.Join(dir, "target.puml")
			writeRegistryFile(t, target)
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
			if op == fsnotify.Create {
				target = filepath.Join(dir, "created.puml")
				writeRegistryFile(t, target)
			} else if err := os.Remove(target); err != nil {
				t.Fatal(err)
			}
			w.handleEvent(fsnotify.Event{Name: target, Op: op})
			if reg.Allowed(hidden) {
				t.Fatal("event rescanned unrelated files")
			}
			if reg.Allowed(target) != (op == fsnotify.Create) {
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
