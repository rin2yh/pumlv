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
	largeER, err := os.ReadFile("../../examples/large-er.puml")
	if err != nil {
		t.Fatal(err)
	}
	var renderer Renderer
	defer renderer.Close()
	for _, tc := range []struct {
		name   string
		source string
		large  bool
	}{
		{"sequence", "@startuml\nAlice -> Bob: hello\n@enduml", false},
		{"class", "@startuml\nclass Alice\nclass Bob\nAlice --> Bob\n@enduml", false},
		{"large-er", string(largeER), true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svg, err := renderer.Render(context.Background(), tc.source)
			if err != nil {
				t.Fatal(err)
			}
			var dimensions struct {
				Width  int `xml:"width,attr"`
				Height int `xml:"height,attr"`
			}
			if err := xml.Unmarshal([]byte(svg), &dimensions); err != nil {
				t.Fatalf("invalid SVG XML: %v", err)
			}
			if tc.large && dimensions.Width <= 4096 && dimensions.Height <= 4096 {
				t.Fatalf("expected axis greater than 4096px: %.200s", svg)
			}
			if tc.large {
				return
			}
			path := filepath.Join("testdata", tc.name+".svg")
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
