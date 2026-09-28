package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
	if err := os.Mkdir(assets, 0o755); err != nil {
		t.Fatal(err)
	}
	writeFixture(t, filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"),
		"const D=()=>{};export{C as render,D as renderToString};")
	writeFixture(t, filepath.Join(frontend, "scripts", "render", "buffer.mjs"),
		"globalThis.bufferReady = true;")
	writeFixture(t, filepath.Join(frontend, "scripts", "render", "shared.mjs"),
		"export const value = 42;")
	writeFixture(t, filepath.Join(frontend, "scripts", "render", "dom.mjs"),
		"import { value } from './shared.mjs'; globalThis.domReady = value;")

	if err := run(frontend, assets); err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]string{
		"plantuml.js": "const D=()=>{};globalThis.renderToString=D;",
		"buffer.js":   "globalThis.bufferReady = true",
		"dom.js":      "var value = 42",
	} {
		got, err := os.ReadFile(filepath.Join(assets, name))
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(got), want) {
			t.Errorf("%s does not contain %q: %s", name, want, got)
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
	if err := os.Mkdir(assets, 0o755); err != nil {
		t.Fatal(err)
	}
	writeFixture(t, filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"),
		"export{C as render,D as renderToString};")
	writeFixture(t, filepath.Join(frontend, "scripts", "render", "buffer.mjs"),
		"import './missing.mjs';")
	if err := run(frontend, assets); err == nil || !strings.Contains(err.Error(), "bundle buffer.js") {
		t.Fatalf("expected bundle error, got %v", err)
	}
}
