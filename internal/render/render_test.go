package render

import (
	"context"
	"encoding/xml"
	"os"
	"strings"
	"testing"
)

func TestRender(t *testing.T) {
	var renderer Renderer
	defer renderer.Close()
	for _, tc := range []struct{ name, source, want string }{
		{"sequence", "@startuml\nAlice -> Bob: hello\n@enduml", "hello"},
		{"class with Graphviz", "@startuml\nclass Alice\nclass Bob\nAlice --> Bob\n@enduml", "Alice"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svg, err := renderer.Render(context.Background(), tc.source)
			if err != nil {
				t.Fatal(err)
			}
			if !strings.HasPrefix(svg, "<svg") || !strings.Contains(svg, tc.want) || strings.Contains(svg, "has crashed") {
				t.Fatalf("unexpected SVG: %.300s", svg)
			}
			if err := xml.Unmarshal([]byte(svg), new(struct{})); err != nil {
				t.Fatalf("invalid SVG XML: %v", err)
			}
		})
	}
}

func TestLargeER(t *testing.T) {
	source, err := os.ReadFile("../../examples/large-er.puml")
	if err != nil {
		t.Fatal(err)
	}
	var renderer Renderer
	defer renderer.Close()
	svg, err := renderer.Render(context.Background(), string(source))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(svg, "has crashed") {
		t.Fatal("PlantUML returned a crash diagram")
	}
	var dimensions struct {
		Width  int `xml:"width,attr"`
		Height int `xml:"height,attr"`
	}
	if err := xml.Unmarshal([]byte(svg), &dimensions); err != nil {
		t.Fatalf("invalid large SVG XML: %v", err)
	}
	if dimensions.Width <= 4096 && dimensions.Height <= 4096 {
		t.Fatalf("expected axis greater than 4096px: %.200s", svg)
	}
}
