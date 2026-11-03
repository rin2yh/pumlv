package server

import (
	"context"
	"errors"
	"io/fs"
	"log"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/k1LoW/donegroup"
	"github.com/rin2yh/pumlv/internal/fileformat"
)

const debounceInterval = 100 * time.Millisecond
const watchRetryInterval = 100 * time.Millisecond
const maxWatchRetryInterval = 5 * time.Second

var errWatchRegistrationInProgress = errors.New("watch registration already in progress")

type watchRetry struct {
	delay time.Duration
	next  time.Time
}

type pendingChange struct {
	timer *time.Timer
	op    fsnotify.Op
}

// Watcher observes the registered sources and emits events through the hub.
type Watcher struct {
	registry *Registry
	hub      *Hub
	fsw      *fsnotify.Watcher
	addWatch func(string) error

	mu       sync.Mutex
	pending  map[string]*pendingChange
	retries  map[string]watchRetry
	closed   bool
	running  map[string]bool
	ctx      context.Context
	cancel   context.CancelFunc
	activeWG sync.WaitGroup
	started  bool
}

// NewWatcher creates a Watcher and registers every source root on the underlying fsnotify watcher.
func NewWatcher(reg *Registry, hub *Hub) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	w := &Watcher{
		ctx:      ctx,
		cancel:   cancel,
		running:  map[string]bool{},
		registry: reg,
		hub:      hub,
		fsw:      fsw,
		addWatch: fsw.Add,
		pending:  map[string]*pendingChange{},
		retries:  map[string]watchRetry{},
	}
	for _, s := range reg.sources {
		if err := w.addSource(s); err != nil {
			cancel()
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
				return w.addWatch(path)
			}
			return nil
		})
	}
	return w.addWatch(filepath.Dir(s.path))
}

// Start launches the watch loop under the donegroup.
func (w *Watcher) Start(ctx context.Context) error {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return fsnotify.ErrClosed
	}
	if w.started {
		w.mu.Unlock()
		return nil
	}
	w.started = true
	w.activeWG.Add(1)
	w.mu.Unlock()
	stop := context.AfterFunc(ctx, w.cancel)
	done := donegroup.Awaitable(ctx)
	go func() {
		defer done()
		defer stop()
		defer w.cancel()
		w.loop(w.ctx)
	}()
	retryDone := donegroup.Awaitable(ctx)
	go func() {
		defer retryDone()
		defer w.activeWG.Done()
		ticker := time.NewTicker(watchRetryInterval)
		defer ticker.Stop()
		for {
			select {
			case <-w.ctx.Done():
				return
			case now := <-ticker.C:
				w.retryPaths(now)
			}
		}
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
	changed := false
	var addErr error
	if event.Op&(fsnotify.Remove|fsnotify.Rename) != 0 {
		changed = w.registry.removePath(event.Name)
		w.mu.Lock()
		for path := range w.retries {
			if containsPath(event.Name, path) {
				delete(w.retries, path)
			}
		}
		w.mu.Unlock()
	}
	if event.Op&fsnotify.Create != 0 {
		var added bool
		added, addErr = w.registerPath(event.Name)
		changed = changed || added
	}
	if changed {
		w.hub.Broadcast(Event{Name: "tree", Data: map[string]any{}})
	}
	if addErr == nil && w.registry.matchExt(event.Name) && event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) != 0 {
		w.debounce(event)
	}
}

// registerPath retries only the failed path. Existing watches are safe to add
// again; the Registry commits the subtree only after the whole attempt succeeds.
func (w *Watcher) registerPath(path string) (bool, error) {
	w.mu.Lock()
	if w.running[path] {
		w.mu.Unlock()
		return false, errWatchRegistrationInProgress
	}
	closed := w.closed
	if !closed {
		w.running[path] = true
		w.activeWG.Add(1)
	}
	w.mu.Unlock()
	if closed {
		return false, fsnotify.ErrClosed
	}
	defer w.activeWG.Done()
	changed, err := w.registry.addPathContext(w.ctx, path, w.addWatch)
	w.mu.Lock()
	delete(w.running, path)
	if err == nil {
		delete(w.retries, path)
		w.mu.Unlock()
		return changed, nil
	}
	if w.closed || w.ctx.Err() != nil {
		w.mu.Unlock()
		return false, err
	}
	delay := watchRetryInterval
	if previous, ok := w.retries[path]; ok {
		delay = min(previous.delay*2, maxWatchRetryInterval)
	}
	w.retries[path] = watchRetry{delay: delay, next: time.Now().Add(delay)}
	w.mu.Unlock()
	log.Printf("failed to register watched path %q: %v; retry in %s", path, err, delay)
	return false, err
}

// Repeated failures stay pending at a capped interval until success, removal or Close.
func (w *Watcher) retryPaths(now time.Time) {
	w.mu.Lock()
	var paths []string
	for path, retry := range w.retries {
		if !now.Before(retry.next) && !w.running[path] {
			paths = append(paths, path)
		}
	}
	w.mu.Unlock()
	for _, path := range paths {
		changed, err := w.registerPath(path)
		if err != nil {
			continue
		} // registerPath records the cause and schedules another attempt.
		if changed {
			w.hub.Broadcast(Event{Name: "tree", Data: map[string]any{}})
		}
		if w.registry.Allowed(path) {
			w.hub.Broadcast(Event{Name: "changed", Data: map[string]string{"path": path}})
		}
	}
}

func (w *Watcher) debounce(event fsnotify.Event) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return
	}
	path := event.Name
	if previous, ok := w.pending[path]; ok {
		previous.timer.Stop()
		event.Op |= previous.op
	}
	change := &pendingChange{op: event.Op}
	change.timer = time.AfterFunc(debounceInterval, func() {
		w.mu.Lock()
		// A stopped timer may already be running. Only the latest callback may apply the change.
		if w.pending[path] != change {
			w.mu.Unlock()
			return
		}
		delete(w.pending, path)
		w.mu.Unlock()
		if change.op&fsnotify.Write != 0 && fileformat.IsMarkdown(path) {
			changed, err := w.registry.Update(path)
			if err != nil {
				log.Printf("failed to update watched path %q: %v", path, err)
				return
			}
			if changed {
				w.hub.Broadcast(Event{Name: "tree", Data: map[string]any{}})
			}
		}
		// A newly eligible file may still be selected while the tree reloads.
		// Its source update is independent of the membership notification.
		if w.registry.Allowed(path) {
			w.hub.Broadcast(Event{Name: "changed", Data: map[string]string{"path": path}})
		}
	})
	w.pending[path] = change
}

// Close cancels recovery, closes fsnotify, and waits for registrations to finish.
// An in-flight filesystem read must return before its canceled attempt can exit.
func (w *Watcher) Close() error {
	w.mu.Lock()
	w.closed = true
	w.cancel()
	w.retries = map[string]watchRetry{}
	for _, change := range w.pending {
		change.timer.Stop()
	}
	w.pending = map[string]*pendingChange{}
	w.mu.Unlock()
	err := w.fsw.Close()
	w.activeWG.Wait()
	return err
}
