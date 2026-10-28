package server

import (
	"strings"

	"github.com/rin2yh/pumlv/internal/fileformat"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

// extractMarkdownPlantUML extracts supported fenced code blocks in document order.
// Markdown syntax is handled by goldmark; only PlantUML normalization happens here.
func extractMarkdownPlantUML(data []byte) [][]byte {
	document := goldmark.DefaultParser().Parse(text.NewReader(data))
	var diagrams [][]byte
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
		diagrams = append(diagrams, []byte(source+"\n"))
		return ast.WalkContinue, nil
	})
	return diagrams
}
