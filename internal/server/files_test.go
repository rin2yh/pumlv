package server

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestRegistryDiscoversFilesAndRejectsOthers(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "seq.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	other := filepath.Join(dir, "notes.txt")
	if err := os.WriteFile(other, []byte("hi"), 0o600); err != nil {
		t.Fatal(err)
	}

	r, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	files := r.List()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d (%v)", len(files), files)
	}
	if files[0].Name != "seq.puml" {
		t.Errorf("unexpected file name: %q", files[0].Name)
	}
	if !r.Allowed(puml) {
		t.Error("expected the .puml file to be allowed")
	}
	if r.Allowed(other) {
		t.Error("expected the .txt file to be rejected")
	}
}

func TestRegistryHandlesSingleFile(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "diagram.plantuml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	r, err := NewRegistry([]string{puml}, []string{".puml", ".plantuml"})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	files := r.List()
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	if !r.Allowed(puml) {
		t.Error("expected the single file to be allowed")
	}
}

func TestRegistryRefreshPicksUpNewFiles(t *testing.T) {
	dir := t.TempDir()
	r, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	if got := len(r.List()); got != 0 {
		t.Fatalf("expected empty, got %d", got)
	}
	puml := filepath.Join(dir, "new.puml")
	if err := os.WriteFile(puml, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := r.Refresh(); err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if got := len(r.List()); got != 1 {
		t.Fatalf("expected 1, got %d", got)
	}
}

func TestRegistryUpdateUsesOnlyTheChangedFile(t *testing.T) {
	for _, tt := range []struct {
		name                string
		inputs              []string
		wantRel, wantSource string
	}{
		{"directory", []string{"."}, "nested/diagram.md", "."},
		{"single file", []string{"nested/diagram.md", "other.md"}, "diagram.md", "nested"},
		{"overlapping sources", []string{".", "nested/diagram.md"}, "diagram.md", "nested"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			nested := filepath.Join(dir, "nested")
			if err := os.Mkdir(nested, 0o700); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(nested, "diagram.md")
			other := filepath.Join(dir, "other.md")
			for _, file := range []string{path, other} {
				if err := os.WriteFile(file, []byte("# Notes"), 0o600); err != nil {
					t.Fatal(err)
				}
			}
			var inputs []string
			for _, input := range tt.inputs {
				inputs = append(inputs, filepath.Join(dir, input))
			}
			reg, err := NewRegistry(inputs, []string{".md"})
			if err != nil {
				t.Fatal(err)
			}
			var reads []string
			reg.readFile = func(name string) ([]byte, error) {
				reads = append(reads, name)
				return os.ReadFile(name)
			}
			for _, step := range []struct {
				source           string
				changed, allowed bool
			}{
				{"```puml\nAlice -> Bob\n```", true, true},
				{"```puml\nBob -> Alice\n```", false, true},
				{"# Notes", true, false},
				{"# Still notes", false, false},
			} {
				if err := os.WriteFile(path, []byte(step.source), 0o600); err != nil {
					t.Fatal(err)
				}
				reads = nil
				if changed, err := reg.Update(path); err != nil || changed != step.changed {
					t.Fatalf("Update = %v, %v; want %v, nil", changed, err, step.changed)
				}
				if reg.Allowed(path) != step.allowed {
					t.Fatalf("Allowed = %v, want %v", reg.Allowed(path), step.allowed)
				}
				if len(reads) != 1 || reads[0] != path {
					t.Fatalf("read files %v, want only %s", reads, path)
				}
				if step.allowed {
					want := FileEntry{Path: path, Rel: filepath.FromSlash(tt.wantRel), Name: "diagram.md", Source: filepath.Join(dir, tt.wantSource)}
					if got := reg.List(); len(got) != 1 || got[0] != want {
						t.Fatalf("entries = %+v, want %+v", got, want)
					}
				}
			}
		})
	}
}

func TestRegistryUpdateRejectsUnwatchedPaths(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(dir, "watched")
	if err := os.Mkdir(source, 0o700); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{source}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	reg.readFile = func(path string) ([]byte, error) { t.Fatalf("unexpected read: %s", path); return nil, nil }
	for _, path := range []string{filepath.Join(dir, "outside.md"), filepath.Join(dir, "watched-other", "diagram.md"), filepath.Join(source, "notes.txt")} {
		if changed, err := reg.Update(path); err != nil || changed || reg.Allowed(path) {
			t.Fatalf("unwatched path allowed: %s", path)
		}
	}
}

func TestRegistryRefreshesMarkdownVisibility(t *testing.T) {
	for _, tt := range []struct {
		name     string
		getInput func(string) string
	}{
		{"directory input", filepath.Dir},
		{"single file input", func(path string) string { return path }},
	} {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "diagram.MD")
			if err := os.WriteFile(path, []byte("# Notes"), 0o600); err != nil {
				t.Fatal(err)
			}
			reg, err := NewRegistry([]string{tt.getInput(path)}, []string{".md"})
			if err != nil {
				t.Fatal(err)
			}
			if len(reg.List()) != 0 {
				t.Fatal("Markdown without a block is visible")
			}
			for _, step := range []struct {
				source      string
				wantAllowed bool
			}{
				{"# Diagram\n```puml\nAlice -> Bob\n```\nprose", true},
				{"# Notes again", false},
			} {
				if err := os.WriteFile(path, []byte(step.source), 0o600); err != nil {
					t.Fatal(err)
				}
				if err := reg.Refresh(); err != nil {
					t.Fatal(err)
				}
				if got := reg.Allowed(path); got != step.wantAllowed {
					t.Fatalf("Allowed = %v, want %v", got, step.wantAllowed)
				}
			}
		})
	}
}

func writeRegistryFile(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("@startuml\n@enduml\n"), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestRegistryIncrementalSourceRules(t *testing.T) {
	tests := []struct {
		name             string
		input            string
		wantOtherAllowed bool
	}{
		{name: "directory source", input: ".", wantOtherAllowed: true},
		{name: "single file source", input: "diagram.PUML", wantOtherAllowed: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			file := filepath.Join(dir, "diagram.PUML")
			writeRegistryFile(t, file)
			source := filepath.Join(dir, tt.input)
			r, err := NewRegistry([]string{source}, []string{"puml"})
			if err != nil {
				t.Fatal(err)
			}
			want := r.List()
			if !r.removePath(file) {
				t.Fatal("removing a registered file reported no change")
			}
			if r.removePath(file) {
				t.Fatal("duplicate removal reported a change")
			}
			if r.Allowed(file) {
				t.Fatal("file still allowed after removal")
			}
			if changed, err := r.addPath(file, nil); err != nil || !changed {
				t.Fatalf("re-registering file: changed=%v, err=%v", changed, err)
			}
			if changed, err := r.addPath(file, nil); err != nil || changed {
				t.Fatalf("duplicate addition: changed=%v, err=%v", changed, err)
			}
			if !reflect.DeepEqual(r.List(), want) {
				t.Fatalf("metadata changed: %v", r.List())
			}
			other := filepath.Join(dir, "other.puml")
			ignored := filepath.Join(dir, "notes.txt")
			outside := filepath.Join(t.TempDir(), "outside.puml")
			for _, path := range []string{other, ignored, outside} {
				writeRegistryFile(t, path)
				if _, err := r.addPath(path, nil); err != nil {
					t.Fatal(err)
				}
			}
			if got := r.Allowed(other); got != tt.wantOtherAllowed {
				t.Errorf("sibling file Allowed(%q) = %v, want %v", other, got, tt.wantOtherAllowed)
			}
			if r.Allowed(ignored) {
				t.Errorf("file with unmatched extension was allowed: %q", ignored)
			}
			if r.Allowed(outside) {
				t.Errorf("file outside source root was allowed: %q", outside)
			}
		})
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
	changed, err := r.addPath(subtree, func(path string) error {
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
	if changed {
		t.Fatal("failed walk reported a Registry change")
	}
	if !errors.Is(err, watchErr) || !strings.Contains(err.Error(), filepath.Dir(last)) {
		t.Fatalf("expected watch error with failed directory path, got %v", err)
	}
	if !reflect.DeepEqual(visited, []string{subtree, filepath.Dir(last)}) {
		t.Fatalf("unexpected walk order: %v", visited)
	}
	if !reflect.DeepEqual(r.List(), before) {
		t.Fatalf("failed walk changed Registry: %v", r.List())
	}
	if _, err := r.addPath(subtree, nil); err != nil {
		t.Fatal(err)
	}
	if !r.Allowed(first) || !r.Allowed(last) || !r.Allowed(existing) || len(r.List()) != 3 {
		t.Fatalf("successful retry did not commit all entries: %v", r.List())
	}
}

func TestRegistryUpdatePreservesEntriesOnReadError(t *testing.T) {
	for _, tt := range []struct {
		name  string
		input error
	}{
		{"permission denied", os.ErrPermission},
		{"temporarily missing", os.ErrNotExist},
	} {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "diagram.md")
			if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
				t.Fatal(err)
			}
			reg, err := NewRegistry([]string{path}, []string{".md"})
			if err != nil {
				t.Fatal(err)
			}
			before := reg.List()
			reg.readFile = func(string) ([]byte, error) { return nil, tt.input }
			changed, err := reg.Update(path)
			if changed || !errors.Is(err, tt.input) {
				t.Fatalf("Update = %v, %v; want false, %v", changed, err, tt.input)
			}
			if got := reg.List(); !reflect.DeepEqual(got, before) {
				t.Fatalf("read error changed entries: %v", got)
			}

			// A later successful read still applies a real block removal.
			reg.readFile = os.ReadFile
			if err := os.WriteFile(path, []byte("# Notes"), 0o600); err != nil {
				t.Fatal(err)
			}
			if changed, err := reg.Update(path); err != nil || !changed {
				t.Fatalf("retry = %v, %v; want true, nil", changed, err)
			}
			if reg.Allowed(path) {
				t.Fatal("readable Markdown without a diagram stayed registered")
			}
		})
	}
}

func TestRegistryRefreshReadFailureSkipsUnreadableFile(t *testing.T) {
	for _, tt := range []struct {
		name, input string
		want        error
	}{
		{"directory source", ".", os.ErrPermission},
		{"single file source", "diagram.md", os.ErrPermission},
	} {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "diagram.md")
			if err := os.WriteFile(path, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
				t.Fatal(err)
			}
			reg, err := NewRegistry([]string{filepath.Join(dir, tt.input)}, []string{".md"})
			if err != nil {
				t.Fatal(err)
			}
			added := filepath.Join(dir, "a-new.md")
			if err := os.WriteFile(added, []byte("```puml\nBob -> Alice\n```"), 0o600); err != nil {
				t.Fatal(err)
			}
			reg.readFile = func(name string) ([]byte, error) {
				if name == path {
					return nil, tt.want
				}
				return os.ReadFile(name)
			}
			if err := reg.Refresh(); err != nil {
				t.Fatalf("Refresh: %v", err)
			}
			if reg.Allowed(path) {
				t.Fatal("unreadable file was registered")
			}
			if !reg.Allowed(added) {
				t.Fatal("refresh did not continue with readable file")
			}
			reg.readFile = os.ReadFile
			if err := reg.Refresh(); err != nil {
				t.Fatal(err)
			}
			if !reg.Allowed(path) || !reg.Allowed(added) {
				t.Fatal("readable files missing after recovery")
			}
		})
	}
}

func TestRegistryDirectoryReadFailureDoesNotCommitCandidates(t *testing.T) {
	dir := t.TempDir()
	subtree := filepath.Join(dir, "added")
	if err := os.MkdirAll(subtree, 0o700); err != nil {
		t.Fatal(err)
	}
	existing := filepath.Join(subtree, "z-existing.md")
	if err := os.WriteFile(existing, []byte("```puml\nAlice -> Bob\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		t.Fatal(err)
	}
	before := reg.List()
	added := filepath.Join(subtree, "a-new.md")
	if err := os.WriteFile(added, []byte("```puml\nBob -> Alice\n```"), 0o600); err != nil {
		t.Fatal(err)
	}
	reg.readFile = func(path string) ([]byte, error) {
		if path == existing {
			return nil, os.ErrPermission
		}
		return os.ReadFile(path)
	}
	changed, err := reg.addPath(subtree, nil)
	if changed || !errors.Is(err, os.ErrPermission) || !strings.Contains(err.Error(), existing) {
		t.Fatalf("addPath = %v, %v; want unchanged and path-specific read error", changed, err)
	}
	if got := reg.List(); !reflect.DeepEqual(got, before) {
		t.Fatalf("read failure changed snapshot: %v", got)
	}
	reg.readFile = os.ReadFile
	if changed, err := reg.addPath(subtree, nil); err != nil || !changed {
		t.Fatalf("recovery = %v, %v", changed, err)
	}
	if !reg.Allowed(existing) || !reg.Allowed(added) || len(reg.List()) != 2 {
		t.Fatalf("recovery did not commit both files: %v", reg.List())
	}
	if changed, err := reg.addPath(subtree, nil); err != nil || changed {
		t.Fatalf("unchanged retry = %v, %v", changed, err)
	}
}

func TestRegistryDirectoryScanDiscardsCandidatesAfterConcurrentRemoval(t *testing.T) {
	dir := t.TempDir()
	reg, err := NewRegistry([]string{dir}, []string{".puml"})
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "a-diagram.puml")
	writeRegistryFile(t, path)
	pause := filepath.Join(dir, "z-pause")
	if err := os.Mkdir(pause, 0o700); err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	release := make(chan struct{})
	releaseScan := sync.OnceFunc(func() { close(release) })
	t.Cleanup(releaseScan)
	result := make(chan error, 1)
	go func() {
		_, err := reg.addPath(dir, func(path string) error {
			if path == pause {
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
		t.Fatal("directory scan did not reach pause")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	removed := make(chan bool, 1)
	go func() { removed <- reg.removePath(path) }()
	select {
	case changed := <-removed:
		if changed {
			t.Fatal("unregistered file removal changed the tree")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("removal blocked on directory scan")
	}
	releaseScan()
	select {
	case err := <-result:
		if err == nil {
			t.Fatal("stale scan succeeded instead of requesting a retry")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("scan did not finish")
	}
	if reg.Allowed(path) {
		t.Fatal("stale scan resurrected removed file")
	}
	if changed, err := reg.addPath(dir, nil); changed || err != nil {
		t.Fatalf("retry = %v, %v; want false, nil", changed, err)
	}
}
