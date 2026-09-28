package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupInput(t *testing.T) (string, string, string) {
	t.Helper()
	root := t.TempDir()
	if err := os.CopyFS(root, os.DirFS(filepath.Join("testdata", "input"))); err != nil {
		t.Fatal(err)
	}
	frontend := filepath.Join(root, "frontend")
	plantumlPath := filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js")
	if err := os.MkdirAll(filepath.Dir(plantumlPath), 0o755); err != nil {
		t.Fatal(err)
	}
	plantuml, err := os.ReadFile(filepath.Join("testdata", "plantuml-input.js"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(plantumlPath, plantuml, 0o644); err != nil {
		t.Fatal(err)
	}
	return root, frontend, filepath.Join(root, "assets")
}

func TestRun(t *testing.T) {
	_, frontend, assets := setupInput(t)

	if err := run(frontend, assets); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"plantuml.js", "buffer.js", "dom.js"} {
		got, err := os.ReadFile(filepath.Join(assets, name))
		if err != nil {
			t.Fatal(err)
		}
		path := filepath.Join("testdata", name)
		want, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got, want) {
			t.Errorf("%s differs from %s", name, path)
		}
	}
}

func TestRunRejectsChangedExports(t *testing.T) {
	_, frontend, assets := setupInput(t)
	if err := os.WriteFile(filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"), []byte("export{changed};"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := run(frontend, assets); err == nil || !strings.Contains(err.Error(), "exports changed") {
		t.Fatalf("expected changed exports error, got %v", err)
	}
}

func TestRunReportsBundleErrors(t *testing.T) {
	root, frontend, assets := setupInput(t)
	if err := os.WriteFile(filepath.Join(root, "js", "buffer.js"), []byte("import './missing.js';"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := run(frontend, assets); err == nil || !strings.Contains(err.Error(), "bundle buffer.js") {
		t.Fatalf("expected bundle error, got %v", err)
	}
}
