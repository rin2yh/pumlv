// Package fileformat defines the file types supported by pumlv.
package fileformat

import (
	"path/filepath"
	"strings"
)

const MarkdownExtension = ".md"

var plantUMLExtensions = []string{".puml", ".plantuml", ".iuml", ".wsd"}

// GetPlantUMLExtensions returns a copy of the supported PlantUML file extensions.
func GetPlantUMLExtensions() []string {
	return append([]string(nil), plantUMLExtensions...)
}

// IsPlantUMLLanguage reports whether language names a supported Markdown diagram block.
func IsPlantUMLLanguage(language string) bool {
	for _, ext := range plantUMLExtensions {
		if strings.TrimPrefix(ext, ".") == language {
			return true
		}
	}
	return false
}

// IsMarkdown reports whether path has the Markdown extension.
func IsMarkdown(path string) bool {
	return strings.EqualFold(filepath.Ext(path), MarkdownExtension)
}
