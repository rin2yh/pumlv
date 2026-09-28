package render

import "testing"

func TestParseFontSize(t *testing.T) {
	for _, tc := range []struct {
		name, font string
		want       float64
	}{
		{"default", "sans-serif", 12},
		{"integer", "bold 20px Arial", 20},
		{"fraction", "italic 13.5px sans-serif", 13.5},
		{"zero", "0px sans-serif", 12},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := parseFontSize(tc.font); got != tc.want {
				t.Errorf("parseFontSize(%q) = %v, want %v", tc.font, got, tc.want)
			}
		})
	}
}

func TestMeasureText(t *testing.T) {
	var renderer Renderer
	defer renderer.Close()
	if got := renderer.measureText("", "12px sans-serif"); got != 0 {
		t.Errorf("empty text width = %v, want 0", got)
	}
	wide := renderer.measureText("WWW", "12px sans-serif")
	narrow := renderer.measureText("iii", "12px sans-serif")
	if wide <= narrow || narrow <= 0 {
		t.Errorf("expected proportional glyph widths, got WWW=%v and iii=%v", wide, narrow)
	}
	if got := renderer.measureText("WWW", "24px sans-serif"); got <= wide {
		t.Errorf("larger font width = %v, want greater than %v", got, wide)
	}
	if got, want := renderer.measureText("WWW", "sans-serif"), wide; got != want {
		t.Errorf("default font width = %v, want %v", got, want)
	}
	if got := renderer.measureText("界", "12px sans-serif"); got != 12 {
		t.Errorf("missing glyph width = %v, want 12", got)
	}
}

func TestGetFontFaceCachesBySize(t *testing.T) {
	var renderer Renderer
	first := renderer.getFontFace(12)
	if first == nil {
		t.Fatal("embedded font is unavailable")
	}
	if second := renderer.getFontFace(12); second != first {
		t.Error("expected to reuse the face for the same size")
	}
	if second := renderer.getFontFace(24); second == first {
		t.Error("expected a different face for a different size")
	}
	renderer.Close()
	if renderer.faces != nil {
		t.Error("Close did not clear the face cache")
	}
}
