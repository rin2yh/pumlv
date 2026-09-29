package render

import (
	"encoding/xml"
	"os"
	"testing"
)

func TestRender(t *testing.T) {
	var renderer Renderer
	defer renderer.Close()
	for _, tc := range []struct {
		name  string
		input string
		want  string
	}{
		{"sequence", "../../examples/seq.puml", "testdata/sequence.svg"},
		{"class", "../../examples/class.puml", "testdata/class.svg"},
		{"large-er", "../../examples/large-er.puml", "testdata/large-er.svg"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			source, err := os.ReadFile(tc.input)
			if err != nil {
				t.Fatal(err)
			}
			svg, err := renderer.Render(t.Context(), string(source))
			if err != nil {
				t.Fatal(err)
			}
			if err := xml.Unmarshal([]byte(svg), new(struct{})); err != nil {
				t.Fatalf("invalid SVG XML: %v", err)
			}
			want, err := os.ReadFile(tc.want)
			if err != nil {
				t.Fatal(err)
			}
			if svg != string(want) {
				t.Fatalf("SVG differs from %s (got %d bytes, want %d bytes)", tc.want, len(svg), len(want))
			}
		})
	}
}
