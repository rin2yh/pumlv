package server

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// Use one directory source, as in `pumlv ./docs`, to vary the number of watched
// files independently of the number of command-line source roots.
func benchmarkRegistry(b *testing.B, files, diagrams int) (*Registry, string) {
	b.Helper()
	dir := b.TempDir()
	source := benchmarkMarkdown(diagrams)
	for i := 0; i < files; i++ {
		path := filepath.Join(dir, fmt.Sprintf("diagram-%05d.md", i))
		if err := os.WriteFile(path, source, 0o600); err != nil {
			b.Fatal(err)
		}
	}
	registry, err := NewRegistry([]string{dir}, []string{".md"})
	if err != nil {
		b.Fatal(err)
	}
	if got := len(registry.List()); got != files {
		b.Fatalf("registered %d files, want %d", got, files)
	}
	return registry, filepath.Join(dir, "diagram-00000.md")
}

func BenchmarkRegistryUpdate(b *testing.B) {
	for _, files := range []int{100, 1000, 10000} {
		b.Run(fmt.Sprintf("files=%d/diagrams=10", files), func(b *testing.B) {
			registry, path := benchmarkRegistry(b, files, 10)
			updated := bytes.ReplaceAll(benchmarkMarkdown(10), []byte("request"), []byte("updated"))
			if err := os.WriteFile(path, updated, 0o600); err != nil {
				b.Fatal(err)
			}
			b.ReportAllocs()
			// Measure only Update: cached filesystem reads, parsing, locks and publication.
			// Repeated notifications for this one path still perform the full update;
			// fixture writes and initial registration are outside the measured loop.
			for b.Loop() {
				if _, err := registry.Update(path); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkRegistryList(b *testing.B) {
	for _, files := range []int{100, 1000, 10000} {
		b.Run(fmt.Sprintf("files=%d/diagrams=10", files), func(b *testing.B) {
			registry, _ := benchmarkRegistry(b, files, 10)
			b.ReportAllocs()
			// List copies and sorts metadata; HTTP/JSON encoding is not measured here.
			for b.Loop() {
				registry.List()
			}
		})
	}
}
