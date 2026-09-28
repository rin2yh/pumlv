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

// measureText supplies canvas text metrics when the browser API is unavailable.
// The embedded Go font keeps layout independent of installed system fonts.
func (r *Renderer) measureText(text, cssFont string) float64 {
	size := parseFontSize(cssFont)
	face := r.getFontFace(size)
	if face == nil {
		return float64(len([]rune(text))) * size * 0.6
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

func parseFontSize(cssFont string) float64 {
	if match := fontSizePattern.FindStringSubmatch(cssFont); len(match) > 1 {
		if size, err := strconv.ParseFloat(match[1], 64); err == nil && size > 0 {
			return size
		}
	}
	return 12
}

func (r *Renderer) getFontFace(size float64) font.Face {
	if r.faces == nil {
		r.faces = make(map[int]font.Face)
	}
	key := int(math.Round(size * 10))
	if face := r.faces[key]; face != nil {
		return face
	}
	if embeddedFont == nil {
		return nil
	}
	face, err := opentype.NewFace(embeddedFont, &opentype.FaceOptions{Size: size, DPI: 72})
	if err != nil {
		return nil
	}
	r.faces[key] = face
	return face
}
