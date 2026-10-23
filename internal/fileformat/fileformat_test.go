package fileformat

import (
	"strings"
	"testing"
)

func TestPlantUMLExtensionsMatchMarkdownLanguages(t *testing.T) {
	for _, ext := range GetPlantUMLExtensions() {
		language := strings.TrimPrefix(ext, ".")
		if !IsPlantUMLLanguage(language) {
			t.Errorf("extension %q has no matching Markdown language %q", ext, language)
		}
	}
}

func TestIsPlantUMLLanguagePreservesCaseSensitivity(t *testing.T) {
	for _, tt := range []struct {
		language string
		want     bool
	}{
		{"puml", true},
		{"plantuml", true},
		{"iuml", true},
		{"wsd", true},
		{"PUML", false},
		{"PlantUML", false},
	} {
		t.Run(tt.language, func(t *testing.T) {
			if got := IsPlantUMLLanguage(tt.language); got != tt.want {
				t.Errorf("IsPlantUMLLanguage(%q) = %v, want %v", tt.language, got, tt.want)
			}
		})
	}
}

func TestGetPlantUMLExtensionsReturnsCopy(t *testing.T) {
	extensions := GetPlantUMLExtensions()
	extensions[0] = ".changed"
	if got := GetPlantUMLExtensions()[0]; got != ".puml" {
		t.Fatalf("extension list changed through returned slice: %q", got)
	}
}

func TestIsMarkdownIgnoresCase(t *testing.T) {
	for _, tt := range []struct {
		path string
		want bool
	}{
		{"diagram.md", true},
		{"diagram.MD", true},
		{"diagram.Md", true},
		{"diagram.markdown", false},
	} {
		t.Run(tt.path, func(t *testing.T) {
			if got := IsMarkdown(tt.path); got != tt.want {
				t.Errorf("IsMarkdown(%q) = %v, want %v", tt.path, got, tt.want)
			}
		})
	}
}
