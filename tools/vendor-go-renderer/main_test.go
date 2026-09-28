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

func writeFixture(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestRun(t *testing.T) {
	root := t.TempDir()
	frontend := filepath.Join(root, "frontend")
	assets := filepath.Join(root, "assets")
	writeFixture(t, filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"),
		"const D=()=>{};export{C as render,D as renderToString};")
	writeFixture(t, filepath.Join(root, "js", "buffer.js"),
		"globalThis.bufferReady = true;")
	writeFixture(t, filepath.Join(root, "js", "shared.js"),
		"export const value = 42;")
	writeFixture(t, filepath.Join(root, "js", "dom.js"),
		"import { value } from './shared.js'; globalThis.domReady = value;")

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
	root := t.TempDir()
	frontend := filepath.Join(root, "frontend")
	writeFixture(t, filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"), "export{changed};")
	if err := run(frontend, filepath.Join(root, "assets")); err == nil || !strings.Contains(err.Error(), "exports changed") {
		t.Fatalf("expected changed exports error, got %v", err)
	}
}

func TestRunReportsBundleErrors(t *testing.T) {
	root := t.TempDir()
	frontend := filepath.Join(root, "frontend")
	assets := filepath.Join(root, "assets")
	writeFixture(t, filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"),
		"export{C as render,D as renderToString};")
	writeFixture(t, filepath.Join(root, "js", "buffer.js"),
		"import './missing.js';")
	if err := run(frontend, assets); err == nil || !strings.Contains(err.Error(), "bundle buffer.js") {
		t.Fatalf("expected bundle error, got %v", err)
	}
}
