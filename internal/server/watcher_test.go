package server

import (
	"bytes"
	"context"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
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

// Dispatch events directly so the write burst is deterministic; the E2E suite
// covers delivery through fsnotify and the browser's SSE connection.
func TestWatcherDebouncesMarkdownUpdates(t *testing.T) {
	const diagram = "```puml\nAlice -> Bob\n```"
	for _, tt := range []struct {
		name, before, after string
		getEvents           func(string) []Event
		wantAllowed         bool
	}{
		{"edit diagram", diagram, "```puml\nBob -> Alice\n```", func(path string) []Event { return []Event{{Name: "changed", Data: map[string]string{"path": path}}} }, true},
		{"add diagram", "# Notes", diagram, func(path string) []Event {
			return []Event{{Name: "tree", Data: map[string]any{}}, {Name: "changed", Data: map[string]string{"path": path}}}
		}, true},
		{"remove diagram", diagram, "# Notes", func(string) []Event { return []Event{{Name: "tree", Data: map[string]any{}}} }, false},
		{"edit notes", "# Notes", "# More notes", func(string) []Event { return nil }, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "changed.md")
			other := filepath.Join(dir, "other.md")
			hidden := filepath.Join(dir, "hidden.md")
			for name, body := range map[string]string{path: tt.before, other: diagram, hidden: "# Notes"} {
				if err := os.WriteFile(name, []byte(body), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			reg, err := NewRegistry([]string{dir}, []string{".md"})
			if err != nil {
				t.Fatal(err)
			}
			beforeOther := reg.files[other]
			var mu sync.Mutex
			var reads []string
			readCalls := make(chan struct{}, 100)
			reg.readFile = func(name string) ([]byte, error) {
				mu.Lock()
				reads = append(reads, name)
				mu.Unlock()
				readCalls <- struct{}{}
				return os.ReadFile(name)
			}
			hub := NewHub()
			w, err := NewWatcher(reg, hub)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = w.Close(); hub.Close() })
			sub := hub.Subscribe()
			defer hub.Unsubscribe(sub)
			if err := os.WriteFile(path, []byte(tt.after), 0o600); err != nil {
				t.Fatal(err)
			}

			for range 10 {
				w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Write})
			}
			select {
			case <-readCalls:
			case <-time.After(2 * time.Second):
				t.Fatal("write was not processed")
			}
			for _, want := range tt.getEvents(path) {
				select {
				case ev := <-sub:
					if !reflect.DeepEqual(ev, want) {
						t.Fatalf("event = %+v, want %+v", ev, want)
					}
				case <-time.After(2 * time.Second):
					t.Fatalf("missing %s event", want.Name)
				}
			}
			select {
			case ev := <-sub:
				t.Fatalf("unexpected extra event: %+v", ev)
			case <-time.After(3 * debounceInterval):
			}
			mu.Lock()
			defer mu.Unlock()
			if len(reads) != 1 || reads[0] != path {
				t.Fatalf("reads = %v, want only changed file once", reads)
			}
			if reg.Allowed(path) != tt.wantAllowed {
				t.Fatalf("Allowed = %v, want %v", reg.Allowed(path), tt.wantAllowed)
			}
			reg.filesMu.RLock()
			defer reg.filesMu.RUnlock()
			if reg.files[other] != beforeOther {
				t.Fatal("other diagram entry changed")
			}
			if _, ok := reg.files[hidden]; ok {
				t.Fatal("unrelated notes appeared in tree")
			}
		})
	}
}

func TestWatcherMarkdownCreatesUseSharedDiscoveryRules(t *testing.T) {
	const diagram = "```puml\nAlice -> Bob\n```"
	for _, tt := range []struct {
		name         string
		addDirectory bool
	}{
		{"single file creation", false},
		{"directory creation", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			existing := filepath.Join(dir, "existing.md")
			if err := os.WriteFile(existing, []byte(diagram), 0o600); err != nil {
				t.Fatal(err)
			}
			reg, err := NewRegistry([]string{dir}, []string{".md"})
			if err != nil {
				t.Fatal(err)
			}
			reads := map[string]int{}
			reg.readFile = func(path string) ([]byte, error) { reads[path]++; return os.ReadFile(path) }
			w, err := NewWatcher(reg, NewHub())
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
			subtree := filepath.Join(dir, "added")
			nested := filepath.Join(subtree, "nested")
			if err := os.MkdirAll(nested, 0o700); err != nil {
				t.Fatal(err)
			}
			visible := filepath.Join(nested, "diagram.MD")
			hidden := filepath.Join(nested, "notes.md")
			for path, body := range map[string]string{visible: diagram, hidden: "# Notes"} {
				if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			if tt.addDirectory {
				w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
			} else {
				w.handleEvent(fsnotify.Event{Name: visible, Op: fsnotify.Create})
				w.handleEvent(fsnotify.Event{Name: hidden, Op: fsnotify.Create})
			}
			if !reg.Allowed(existing) || !reg.Allowed(visible) || reg.Allowed(hidden) {
				t.Fatalf("unexpected Markdown entries: %v", reg.List())
			}
			if reads[existing] != 0 || reads[visible] != 1 || reads[hidden] != 1 {
				t.Fatalf("unexpected read counts: %v", reads)
			}
			// Directory additions must retain #214's recursive watch installation.
			if tt.addDirectory {
				watched := map[string]bool{}
				for _, path := range w.fsw.WatchList() {
					watched[path] = true
				}
				if !watched[subtree] || !watched[nested] {
					t.Fatal("missing directory watches")
				}
			}
		})
	}
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

func TestWatcherMarkdownWithoutDiagramDoesNotEmitTree(t *testing.T) {
	dir := t.TempDir()
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	path := filepath.Join(dir, "notes.md")
	if err := os.WriteFile(path, []byte("# Notes"), 0o600); err != nil {
		t.Fatal(err)
	}
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)
	if reg.Allowed(path) {
		t.Fatal("Markdown without a diagram was registered")
	}
}

func TestWatcherLogsDirectoryWatchFailure(t *testing.T) {
	dir := t.TempDir()
	reg, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	if err := w.fsw.Close(); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "added")
	writeRegistryFile(t, filepath.Join(path, "diagram.puml"))
	var output bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(previous) })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Create})
	if got := output.String(); !strings.Contains(got, strconv.Quote(path)) || !strings.Contains(got, fsnotify.ErrClosed.Error()) {
		t.Fatalf("watch failure missing path or cause: %q", got)
	}
	if len(reg.List()) != 0 {
		t.Fatal("failed directory registration changed Registry")
	}
	assertNoTreeEvent(t, sub)
}

func TestWatcherDoesNotHoldMutexDuringMarkdownRead(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "diagram.md")
	if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{dir}, []string{".md", ".puml"})
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	release := make(chan struct{})
	releaseRead := sync.OnceFunc(func() { close(release) })
	defer releaseRead()
	reg.readFile = func(path string) ([]byte, error) {
		close(started)
		<-release
		return os.ReadFile(path)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Write})
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("Markdown read did not start")
	}
	scheduled := make(chan struct{})
	go func() {
		w.handleEvent(fsnotify.Event{Name: filepath.Join(dir, "other.puml"), Op: fsnotify.Write})
		close(scheduled)
	}()
	select {
	case <-scheduled:
	case <-time.After(2 * time.Second):
		t.Fatal("another file's event blocked on Markdown I/O")
	}
	closed := make(chan error, 1)
	go func() { closed <- w.Close() }()
	select {
	case err := <-closed:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Close blocked on Markdown I/O")
	}
	releaseRead()
	if _, ok := recv(t, sub, "changed", 2*time.Second); !ok {
		t.Fatal("in-flight update did not finish after the read was released")
	}
}

func TestWatcherReadFailurePreservesMarkdownUntilNextWrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.md")
	if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{path}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	before := reg.List()
	read := make(chan struct{}, 1)
	reg.readFile = func(string) ([]byte, error) { read <- struct{}{}; return nil, os.ErrPermission }
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Write})
	select {
	case <-read:
	case <-time.After(2 * time.Second):
		t.Fatal("write was not processed")
	}
	select {
	case event := <-sub:
		t.Fatalf("read failure emitted an event: %+v", event)
	case <-time.After(2 * debounceInterval):
	}
	if !reflect.DeepEqual(reg.List(), before) {
		t.Fatal("read failure changed the file tree")
	}
	reg.updateSerialMu.Lock()
	reg.readFile = os.ReadFile
	reg.updateSerialMu.Unlock()
	if err := os.WriteFile(path, []byte("```puml\nBob -> Alice\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Write})
	select {
	case event := <-sub:
		want := Event{Name: "changed", Data: map[string]string{"path": path}}
		if !reflect.DeepEqual(event, want) {
			t.Fatalf("retry event = %+v, want %+v", event, want)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("next successful write did not update the preview")
	}
}

func TestWatcherRecoversPartialDirectoryWatchAndDetectsEdits(t *testing.T) {
	const diagram = "```puml\nAlice -> Bob\n```"
	dir := t.TempDir()
	existing := filepath.Join(dir, "existing.md")
	if err := os.WriteFile(existing, []byte(diagram), 0o600); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	var unrelatedReads atomic.Int32
	reg.readFile = func(path string) ([]byte, error) {
		if path == existing {
			unrelatedReads.Add(1)
		}
		return os.ReadFile(path)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	subtree := filepath.Join(dir, "added")
	deepDir := filepath.Join(subtree, "nested")
	first := filepath.Join(subtree, "first.md")
	deep := filepath.Join(deepDir, "diagram.md")
	staging := filepath.Join(t.TempDir(), "staging")
	if err := os.MkdirAll(filepath.Join(staging, "nested"), 0o700); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{filepath.Join(staging, "first.md"), filepath.Join(staging, "nested", "diagram.md")} {
		if err := os.WriteFile(path, []byte(diagram), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	var failWatch atomic.Bool
	failWatch.Store(true)
	failed := make(chan struct{}, 1)
	w.addWatch = func(path string) error {
		if path == deepDir && failWatch.Load() {
			select {
			case failed <- struct{}{}:
			default:
			}
			return os.ErrPermission
		}
		return w.fsw.Add(path)
	}
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(func() { cancel(); _ = w.Close(); w.hub.Close(); _ = donegroup.Wait(ctx) })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	if err := w.Start(ctx); err != nil {
		t.Fatal(err)
	}
	// Moving a populated subtree emits one create event; recovery must find files
	// without requiring further filesystem events in the failed directory.
	if err := os.Rename(staging, subtree); err != nil {
		t.Fatal(err)
	}
	select {
	case <-failed:
	case <-time.After(2 * time.Second):
		t.Fatal("watch registration failure did not occur")
	}
	if reg.Allowed(first) || reg.Allowed(deep) {
		t.Fatal("partial watch registration published files")
	}
	failWatch.Store(false)
	select {
	case event := <-sub:
		if event.Name != "tree" {
			t.Fatalf("recovery event = %s, want tree", event.Name)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("directory was not recovered automatically")
	}
	if !reg.Allowed(first) || !reg.Allowed(deep) {
		t.Fatal("recovery missed files in the subtree")
	}
	if got := unrelatedReads.Load(); got != 0 {
		t.Fatalf("recovery reread unrelated Markdown %d times", got)
	}
	// A successful retry is removed from the queue and duplicate creation is silent.
	w.retryPaths(time.Now().Add(time.Hour))
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)
	if err := os.WriteFile(deep, []byte("```puml\nBob -> Alice\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	select {
	case event := <-sub:
		want := Event{Name: "changed", Data: map[string]string{"path": deep}}
		if !reflect.DeepEqual(event, want) {
			t.Fatalf("edit event = %+v, want %+v", event, want)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("recovered directory did not detect the edit")
	}
	assertNoTreeEvent(t, sub)
}

func TestWatcherRecoveryBackoffIsCappedAndCloseCancelsIt(t *testing.T) {
	dir := t.TempDir()
	reg, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	path := filepath.Join(dir, "added")
	writeRegistryFile(t, filepath.Join(path, "diagram.puml"))
	attempts := 0
	w.addWatch = func(string) error { attempts++; return os.ErrPermission }
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Create})
	for _, want := range []time.Duration{100 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond, 800 * time.Millisecond, 1600 * time.Millisecond, 3200 * time.Millisecond, 5 * time.Second, 5 * time.Second} {
		if got := w.retries[path].delay; got != want {
			t.Fatalf("retry delay = %s, want %s", got, want)
		}
		before := attempts
		w.retryPaths(time.Time{})
		if attempts != before {
			t.Fatal("retry ran before its deadline")
		}
		w.retryPaths(time.Now().Add(time.Hour))
	}
	if len(reg.List()) != 0 {
		t.Fatal("repeated failures changed the Registry")
	}
	assertNoTreeEvent(t, sub)
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	before := attempts
	w.retryPaths(time.Now().Add(time.Hour))
	if attempts != before || len(w.retries) != 0 {
		t.Fatal("Close did not cancel recovery")
	}
}

func TestWatcherRemovalCancelsDirectoryRecovery(t *testing.T) {
	for _, tt := range []struct {
		name  string
		input fsnotify.Op
		want  int
	}{
		{"remove", fsnotify.Remove, 0},
		{"rename", fsnotify.Rename, 0},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			reg, err := NewRegistry([]string{dir}, []string{".puml"})
			if err != nil {
				t.Fatal(err)
			}
			w, err := NewWatcher(reg, NewHub())
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
			path := filepath.Join(dir, "added")
			writeRegistryFile(t, filepath.Join(path, "diagram.puml"))
			attempts := 0
			w.addWatch = func(string) error { attempts++; return os.ErrPermission }
			w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Create})
			w.handleEvent(fsnotify.Event{Name: path, Op: tt.input})
			before := attempts
			w.retryPaths(time.Now().Add(time.Hour))
			if len(w.retries) != tt.want || attempts != before {
				t.Fatal("removed subtree was retried")
			}
		})
	}
}

func TestWatcherWatchRecoveryWithoutRegistryChangeDoesNotEmitTree(t *testing.T) {
	dir := t.TempDir()
	subtree := filepath.Join(dir, "existing")
	writeRegistryFile(t, filepath.Join(subtree, "diagram.puml"))
	reg, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	before := reg.List()
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	w.addWatch = func(string) error { return os.ErrPermission }
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
	assertNoTreeEvent(t, sub)
	w.addWatch = w.fsw.Add
	w.retryPaths(time.Now().Add(time.Hour))
	if len(w.retries) != 0 {
		t.Fatal("successful recovery stayed pending")
	}
	if !reflect.DeepEqual(reg.List(), before) {
		t.Fatal("watch recovery changed existing entries")
	}
	assertNoTreeEvent(t, sub)
}

func TestWatcherFileReadRecoveryUpdatesPreviewWithoutTree(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.md")
	if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{path}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	reg.readFile = func(string) ([]byte, error) { return nil, os.ErrPermission }
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = w.Close(); w.hub.Close() })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	w.handleEvent(fsnotify.Event{Name: path, Op: fsnotify.Create})
	select {
	case event := <-sub:
		t.Fatalf("failed creation emitted an event: %+v", event)
	case <-time.After(2 * debounceInterval):
	}
	reg.readFile = os.ReadFile
	w.retryPaths(time.Now().Add(time.Hour))
	select {
	case event := <-sub:
		want := Event{Name: "changed", Data: map[string]string{"path": path}}
		if !reflect.DeepEqual(event, want) {
			t.Fatalf("recovery event = %+v, want %+v", event, want)
		}
	default:
		t.Fatal("successful read recovery did not update the preview")
	}
	assertNoTreeEvent(t, sub)
}

func TestWatcherProcessesMarkdownWritesDuringRecovery(t *testing.T) {
	const diagram = "```puml\nAlice -> Bob\n```"
	dir := t.TempDir()
	subtree := filepath.Join(dir, "recovering")
	slow := filepath.Join(subtree, "slow.md")
	other := filepath.Join(dir, "other.md")
	for _, path := range []string{slow, other} {
		writeRegistryFile(t, path)
		if err := os.WriteFile(path, []byte(diagram), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	release := make(chan struct{})
	releaseRead := sync.OnceFunc(func() { close(release) })
	var recoveryReads atomic.Int32
	reg.readFile = func(path string) ([]byte, error) {
		if path == slow && recoveryReads.Add(1) == 1 {
			close(started)
			<-release
		}
		return os.ReadFile(path)
	}
	var attempts atomic.Int32
	w.addWatch = func(path string) error {
		if attempts.Add(1) == 1 {
			return os.ErrPermission
		}
		return w.fsw.Add(path)
	}
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(func() { releaseRead(); cancel(); _ = w.Close(); w.hub.Close(); _ = donegroup.Wait(ctx) })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	if err := w.Start(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("recovery did not start")
	}
	// Duplicate creates must not start another scan while this attempt is blocked.
	duplicateHandled := make(chan struct{})
	go func() {
		w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
		close(duplicateHandled)
	}()
	select {
	case <-duplicateHandled:
	case <-time.After(2 * time.Second):
		t.Fatal("duplicate create blocked on recovery")
	}
	if err := os.WriteFile(other, []byte("```puml\nBob -> Alice\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	select {
	case event := <-sub:
		want := Event{Name: "changed", Data: map[string]string{"path": other}}
		if !reflect.DeepEqual(event, want) {
			t.Fatalf("event = %+v, want %+v", event, want)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("normal Markdown update blocked on recovery")
	}
	assertNoTreeEvent(t, sub)
	if got := recoveryReads.Load(); got != 1 {
		t.Fatalf("concurrent recovery reads = %d, want 1", got)
	}
	releaseRead()
	// The concurrent update invalidates the first scan. Wait for the next attempt
	// to finish; recovering existing watches must not change the tree.
	deadline := time.After(3 * time.Second)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		w.mu.Lock()
		pending := len(w.retries) + len(w.running)
		w.mu.Unlock()
		if pending == 0 {
			break
		}
		select {
		case <-ticker.C:
		case <-deadline:
			t.Fatal("recovery did not finish")
		}
	}
	assertNoTreeEvent(t, sub)
}

func TestWatcherCloseWaitsForRecoveryAndDiscardsCandidates(t *testing.T) {
	dir := t.TempDir()
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	subtree := filepath.Join(dir, "recovering")
	path := filepath.Join(subtree, "diagram.md")
	writeRegistryFile(t, path)
	if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	w, err := NewWatcher(reg, NewHub())
	if err != nil {
		t.Fatal(err)
	}
	var attempts atomic.Int32
	w.addWatch = func(path string) error {
		if attempts.Add(1) == 1 {
			return os.ErrPermission
		}
		return w.fsw.Add(path)
	}
	started := make(chan struct{})
	release := make(chan struct{})
	releaseRead := sync.OnceFunc(func() { close(release) })
	reg.readFile = func(path string) ([]byte, error) { close(started); <-release; return os.ReadFile(path) }
	w.handleEvent(fsnotify.Event{Name: subtree, Op: fsnotify.Create})
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(func() { releaseRead(); cancel(); _ = w.Close(); w.hub.Close(); _ = donegroup.Wait(ctx) })
	sub := w.hub.Subscribe()
	defer w.hub.Unsubscribe(sub)
	if err := w.Start(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("recovery did not start")
	}
	closed := make(chan error, 1)
	go func() { closed <- w.Close() }()
	select {
	case <-w.ctx.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("Close did not cancel recovery")
	}
	select {
	case <-closed:
		t.Fatal("Close returned before its recovery worker finished")
	default:
	}
	releaseRead()
	select {
	case err := <-closed:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Close did not join the recovery worker")
	}
	if reg.Allowed(path) {
		t.Fatal("canceled recovery published candidates")
	}
	w.mu.Lock()
	pending := len(w.retries) + len(w.running)
	w.mu.Unlock()
	if pending != 0 {
		t.Fatal("Close left recovery pending")
	}
	assertNoTreeEvent(t, sub)
}
