package server

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/k1LoW/donegroup"
)

const debounceInterval = 100 * time.Millisecond

// Watcher observes the registered sources and emits events through the hub.
type Watcher struct {
	registry *Registry
	hub      *Hub
	fsw      *fsnotify.Watcher

	mu      sync.Mutex
	pending map[string]*time.Timer
}

// NewWatcher creates a Watcher and registers every source root on the underlying fsnotify watcher.
func NewWatcher(reg *Registry, hub *Hub) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{
		registry: reg,
		hub:      hub,
		fsw:      fsw,
		pending:  map[string]*time.Timer{},
	}
	for _, s := range reg.sources {
		if err := w.addSource(s); err != nil {
			_ = fsw.Close()
			return nil, err
		}
	}
	return w, nil
}

func (w *Watcher) addSource(s sourceRoot) error {
	if s.isDir {
		return filepath.WalkDir(s.path, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				return w.fsw.Add(path)
			}
			return nil
		})
	}
	return w.fsw.Add(filepath.Dir(s.path))
}

// Start launches the watch loop under the donegroup.
func (w *Watcher) Start(ctx context.Context) error {
	done := donegroup.Awaitable(ctx)
	go func() {
		defer done()
		w.loop(ctx)
	}()
	return nil
}

func (w *Watcher) loop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			w.handleEvent(event)
		case _, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	// New directory under a watched dir: register it so deeper changes are reported.
	if event.Op&fsnotify.Create != 0 {
		if fi, err := os.Stat(event.Name); err == nil && fi.IsDir() {
			_ = w.fsw.Add(event.Name)
		}
	}

	if event.Op&(fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
		if err := w.registry.Refresh(); err == nil {
			w.hub.Broadcast(Event{Name: "tree", Data: map[string]any{}})
		}
	}

	if w.registry.matchExt(event.Name) && event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) != 0 {
		w.debounce(event.Name)
	}
}

func (w *Watcher) debounce(path string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if t, ok := w.pending[path]; ok {
		t.Stop()
	}
	w.pending[path] = time.AfterFunc(debounceInterval, func() {
		w.mu.Lock()
		delete(w.pending, path)
		w.mu.Unlock()
		if w.registry.Allowed(path) {
			w.hub.Broadcast(Event{Name: "changed", Data: map[string]string{"path": path}})
		}
	})
}

// Close shuts the underlying fsnotify watcher down.
func (w *Watcher) Close() error {
	w.mu.Lock()
	for _, t := range w.pending {
		t.Stop()
	}
	w.pending = map[string]*time.Timer{}
	w.mu.Unlock()
	return w.fsw.Close()
}
