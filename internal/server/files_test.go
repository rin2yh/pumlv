package server

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
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
