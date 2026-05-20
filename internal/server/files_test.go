package server

import (
	"os"
	"path/filepath"
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
