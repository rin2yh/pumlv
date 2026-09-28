package render

import (
	"math"
	"regexp"
	"strconv"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
)

var fontSizePattern = regexp.MustCompile(`([0-9]+(?:\.[0-9]+)?)px`)
var embeddedFont, _ = opentype.Parse(goregular.TTF)

// textWidth supplies canvas text metrics when the browser API is unavailable.
// The embedded Go font keeps layout independent of installed system fonts.
func (r *Renderer) textWidth(text, cssFont string) float64 {
	size := 12.0
	if match := fontSizePattern.FindStringSubmatch(cssFont); len(match) > 1 {
		if parsed, err := strconv.ParseFloat(match[1], 64); err == nil && parsed > 0 {
			size = parsed
		}
	}
	if r.faces == nil {
		r.faces = make(map[int]font.Face)
	}
	key := int(math.Round(size * 10))
	face := r.faces[key]
	if face == nil {
		if embeddedFont == nil {
			return float64(len([]rune(text))) * size * 0.6
		}
		var err error
		face, err = opentype.NewFace(embeddedFont, &opentype.FaceOptions{Size: size, DPI: 72})
		if err != nil {
			return float64(len([]rune(text))) * size * 0.6
		}
		r.faces[key] = face
	}
	var width float64
	for _, ch := range text {
		advance, ok := face.GlyphAdvance(ch)
		if ok {
			width += float64(advance) / 64
		} else {
			width += size
		}
	}
	return width
}
