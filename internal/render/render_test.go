package render

import (
	"context"
	"encoding/xml"
	"io"
	"os"
	"regexp"
	"strconv"
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
			decoder := xml.NewDecoder(strings.NewReader(svg))
			for {
				_, err := decoder.Token()
				if err == io.EOF {
					break
				}
				if err != nil {
					t.Fatalf("invalid SVG XML: %v", err)
				}
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
	match := regexp.MustCompile(`(?:width|height)="(\d+)"`).FindAllStringSubmatch(svg[:min(len(svg), 250)], -1)
	large := false
	for _, m := range match {
		n, _ := strconv.Atoi(m[1])
		if n > 4096 {
			large = true
		}
	}
	if !large {
		t.Fatalf("expected axis greater than 4096px: %.200s", svg)
	}
}
