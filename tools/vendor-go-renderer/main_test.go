package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRun(t *testing.T) {
	assets := t.TempDir()
	if err := run(filepath.Join("testdata", "plantuml-input.js"), filepath.Join("testdata", "input", "js"), "", assets); err != nil {
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

func TestRunErrors(t *testing.T) {
	for _, tc := range []struct {
		name  string
		input string
		jsDir string
		want  string
	}{
		{"changed exports", "changed-exports.js", "input/js", "exports changed"},
		{"invalid bundle", "plantuml-input.js", "broken-js", "bundle buffer.js"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := run(filepath.Join("testdata", tc.input), filepath.Join("testdata", tc.jsDir), "", t.TempDir())
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected %q error, got %v", tc.want, err)
			}
		})
	}
}
