package main

import (
	"bytes"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var update = flag.Bool("update", false, "update renderer asset golden files")

func setupInput(t *testing.T) (string, string, string) {
	t.Helper()
	root := t.TempDir()
	if err := os.CopyFS(root, os.DirFS(filepath.Join("testdata", "input"))); err != nil {
		t.Fatal(err)
	}
	return root, filepath.Join(root, "frontend"), filepath.Join(root, "assets")
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
		if *update {
			if err := os.WriteFile(path, got, 0o644); err != nil {
				t.Fatal(err)
			}
		}
		want, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got, want) {
			t.Errorf("%s differs from %s; regenerate with go test ./tools/vendor-go-renderer -run TestRun -update", name, path)
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
