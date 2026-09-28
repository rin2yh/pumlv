package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMainCredits(t *testing.T) {
	out, err := os.Create(filepath.Join(t.TempDir(), "credits.txt"))
	if err != nil {
		t.Fatal(err)
	}
	args, stdout := os.Args, os.Stdout
	t.Cleanup(func() {
		os.Args, os.Stdout = args, stdout
	})
	os.Args = []string{"pumlv", "credits"}
	os.Stdout = out

	main()
	if err := out.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(out.Name())
	if err != nil {
		t.Fatal(err)
	}
	credits := string(data)
	previous := -1
	for _, name := range []string{"@shikijs/core", "Go (the standard library)", "PlantUML (bundled as plantuml.js)"} {
		index := strings.Index(credits, name)
		if index <= previous {
			t.Fatalf("missing or out-of-order credit %q", name)
		}
		previous = index
	}
}
