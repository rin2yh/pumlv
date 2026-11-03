package server

import (
	"bytes"
	"strings"

	"github.com/rin2yh/pumlv/internal/fileformat"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

// MarkdownDiagram identifies one fenced diagram by its opening fence line.
type MarkdownDiagram struct {
	Line   int    `json:"line"`
	Title  string `json:"title,omitempty"`
	Source []byte `json:"-"`
}

// extractMarkdownPlantUML extracts normalized sources in document order.
func extractMarkdownPlantUML(data []byte) [][]byte {
	var sources [][]byte
	for _, diagram := range markdownDiagrams(data) {
		sources = append(sources, diagram.Source)
	}
	return sources
}

// markdownDiagrams uses goldmark for Markdown syntax and normalizes PlantUML.
func markdownDiagrams(data []byte) []MarkdownDiagram {
	document := goldmark.DefaultParser().Parse(text.NewReader(data))
	var diagrams []MarkdownDiagram
	_ = ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		block, ok := node.(*ast.FencedCodeBlock)
		if !entering || !ok {
			return ast.WalkContinue, nil
		}
		if !fileformat.IsPlantUMLLanguage(string(block.Language(data))) {
			return ast.WalkContinue, nil
		}

		source := strings.TrimSpace(strings.ReplaceAll(string(block.Lines().Value(data)), "\r\n", "\n"))
		sourceLines := strings.Split(source, "\n")
		if !strings.HasPrefix(strings.TrimSpace(sourceLines[0]), "@startuml") {
			source = "@startuml\n" + source
		}
		if strings.TrimSpace(sourceLines[len(sourceLines)-1]) != "@enduml" {
			source += "\n@enduml"
		}
		line := bytes.Count(data[:block.Info.Segment.Start], []byte("\n")) + 1
		diagrams = append(diagrams, MarkdownDiagram{Line: line, Title: diagramTitle(source), Source: []byte(source + "\n")})
		return ast.WalkContinue, nil
	})
	return diagrams
}

// Only a single-line title is suitable for the compact tree label.
func diagramTitle(source string) string {
	var title string
	for line := range strings.SplitSeq(source, "\n") {
		line = strings.TrimSpace(line)
		if line == "title" {
			return ""
		}
		if strings.HasPrefix(line, "title ") || strings.HasPrefix(line, "title\t") || strings.HasPrefix(line, "title:") {
			title = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(strings.TrimPrefix(line, "title")), ":"))
		}
	}
	return title
}
