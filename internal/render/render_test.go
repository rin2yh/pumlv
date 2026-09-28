package render

import (
	"context"
	"encoding/xml"
	"flag"
	"os"
	"path/filepath"
	"testing"
)

var update = flag.Bool("update", false, "update renderer golden files")

func TestRender(t *testing.T) {
	var renderer Renderer
	defer renderer.Close()
	for _, name := range []string{"sequence", "class", "large-er"} {
		t.Run(name, func(t *testing.T) {
			source, err := os.ReadFile(filepath.Join("testdata", name+".puml"))
			if err != nil {
				t.Fatal(err)
			}
			svg, err := renderer.Render(context.Background(), string(source))
			if err != nil {
				t.Fatal(err)
			}
			if err := xml.Unmarshal([]byte(svg), new(struct{})); err != nil {
				t.Fatalf("invalid SVG XML: %v", err)
			}
			path := filepath.Join("testdata", name+".svg")
			if *update {
				if err := os.WriteFile(path, []byte(svg), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			want, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if svg != string(want) {
				t.Fatalf("SVG differs from %s (got %d bytes, want %d bytes); regenerate with go test ./internal/render -run TestRender -update", path, len(svg), len(want))
			}
		})
	}
}
