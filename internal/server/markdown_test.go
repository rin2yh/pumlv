package server

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestExtractMarkdownPlantUML(t *testing.T) {
	// input and want are paths relative to testdata/markdown.
	for _, tt := range []struct{ name, input, want string }{
		{"puml with backticks adds both tags", "puml-backticks-no-tags.md", "sequence.puml"},
		{"puml with backticks adds the end tag", "puml-backticks-start-only.md", "sequence.puml"},
		{"puml with backticks adds the start tag", "puml-backticks-end-only.md", "sequence.puml"},
		{"puml with backticks preserves both tags", "puml-backticks-both-tags.md", "sequence.puml"},
		{"puml with tildes adds both tags", "puml-tildes-no-tags.md", "sequence.puml"},
		{"puml with tildes adds the end tag", "puml-tildes-start-only.md", "sequence.puml"},
		{"puml with tildes adds the start tag", "puml-tildes-end-only.md", "sequence.puml"},
		{"puml with tildes preserves both tags", "puml-tildes-both-tags.md", "sequence.puml"},
		{"puml with long-backticks adds both tags", "puml-long-backticks-no-tags.md", "sequence.puml"},
		{"puml with long-backticks adds the end tag", "puml-long-backticks-start-only.md", "sequence.puml"},
		{"puml with long-backticks adds the start tag", "puml-long-backticks-end-only.md", "sequence.puml"},
		{"puml with long-backticks preserves both tags", "puml-long-backticks-both-tags.md", "sequence.puml"},
		{"plantuml with backticks adds both tags", "plantuml-backticks-no-tags.md", "sequence.puml"},
		{"plantuml with backticks adds the end tag", "plantuml-backticks-start-only.md", "sequence.puml"},
		{"plantuml with backticks adds the start tag", "plantuml-backticks-end-only.md", "sequence.puml"},
		{"plantuml with backticks preserves both tags", "plantuml-backticks-both-tags.md", "sequence.puml"},
		{"plantuml with tildes adds both tags", "plantuml-tildes-no-tags.md", "sequence.puml"},
		{"plantuml with tildes adds the end tag", "plantuml-tildes-start-only.md", "sequence.puml"},
		{"plantuml with tildes adds the start tag", "plantuml-tildes-end-only.md", "sequence.puml"},
		{"plantuml with tildes preserves both tags", "plantuml-tildes-both-tags.md", "sequence.puml"},
		{"plantuml with long-backticks adds both tags", "plantuml-long-backticks-no-tags.md", "sequence.puml"},
		{"plantuml with long-backticks adds the end tag", "plantuml-long-backticks-start-only.md", "sequence.puml"},
		{"plantuml with long-backticks adds the start tag", "plantuml-long-backticks-end-only.md", "sequence.puml"},
		{"plantuml with long-backticks preserves both tags", "plantuml-long-backticks-both-tags.md", "sequence.puml"},
		{"iuml with backticks adds both tags", "iuml-backticks-no-tags.md", "sequence.puml"},
		{"iuml with backticks adds the end tag", "iuml-backticks-start-only.md", "sequence.puml"},
		{"iuml with backticks adds the start tag", "iuml-backticks-end-only.md", "sequence.puml"},
		{"iuml with backticks preserves both tags", "iuml-backticks-both-tags.md", "sequence.puml"},
		{"iuml with tildes adds both tags", "iuml-tildes-no-tags.md", "sequence.puml"},
		{"iuml with tildes adds the end tag", "iuml-tildes-start-only.md", "sequence.puml"},
		{"iuml with tildes adds the start tag", "iuml-tildes-end-only.md", "sequence.puml"},
		{"iuml with tildes preserves both tags", "iuml-tildes-both-tags.md", "sequence.puml"},
		{"iuml with long-backticks adds both tags", "iuml-long-backticks-no-tags.md", "sequence.puml"},
		{"iuml with long-backticks adds the end tag", "iuml-long-backticks-start-only.md", "sequence.puml"},
		{"iuml with long-backticks adds the start tag", "iuml-long-backticks-end-only.md", "sequence.puml"},
		{"iuml with long-backticks preserves both tags", "iuml-long-backticks-both-tags.md", "sequence.puml"},
		{"wsd with backticks adds both tags", "wsd-backticks-no-tags.md", "sequence.puml"},
		{"wsd with backticks adds the end tag", "wsd-backticks-start-only.md", "sequence.puml"},
		{"wsd with backticks adds the start tag", "wsd-backticks-end-only.md", "sequence.puml"},
		{"wsd with backticks preserves both tags", "wsd-backticks-both-tags.md", "sequence.puml"},
		{"wsd with tildes adds both tags", "wsd-tildes-no-tags.md", "sequence.puml"},
		{"wsd with tildes adds the end tag", "wsd-tildes-start-only.md", "sequence.puml"},
		{"wsd with tildes adds the start tag", "wsd-tildes-end-only.md", "sequence.puml"},
		{"wsd with tildes preserves both tags", "wsd-tildes-both-tags.md", "sequence.puml"},
		{"wsd with long-backticks adds both tags", "wsd-long-backticks-no-tags.md", "sequence.puml"},
		{"wsd with long-backticks adds the end tag", "wsd-long-backticks-start-only.md", "sequence.puml"},
		{"wsd with long-backticks adds the start tag", "wsd-long-backticks-end-only.md", "sequence.puml"},
		{"wsd with long-backticks preserves both tags", "wsd-long-backticks-both-tags.md", "sequence.puml"},
		{"rejects prose without a code block", "no-block.md", "no-block.puml"},
		{"rejects an unsupported language", "other-language.md", "no-block.puml"},
		{"rejects a fence shorter than three characters", "short-fence.md", "no-block.puml"},
		{"ignores a PlantUML example inside another code block", "nested-example.md", "no-block.puml"},
		{"rejects backticks in a backtick fence info string", "backtick-in-info.md", "no-block.puml"},
		{"accepts indented fences and normalizes CRLF", "indented-crlf.md", "sequence.puml"},
		{"extracts a code block inside a blockquote", "blockquote.md", "sequence.puml"},
		{"extracts a code block inside a list item", "list-item.md", "sequence.puml"},
		{"ignores fences inside indented code", "indented-code.md", "no-block.puml"},
		{"ignores fences inside an HTML comment", "html-comment.md", "no-block.puml"},
		{"accepts metadata after the language", "info-metadata.md", "sequence.puml"},
		{"wraps an empty supported block", "empty-block.md", "empty-block.puml"},
		{"extracts an unclosed fence through end of file", "unclosed-block.md", "sequence.puml"},
		{"selects the first supported block", "first-matching-block.md", "sequence.puml"},
		{"preserves a mismatched closing fence as source", "mismatched-fence.md", "mismatched-fence.puml"},
		{"preserves a short closing fence as source", "short-closing-fence.md", "short-closing-fence.puml"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			input, err := os.ReadFile(filepath.Join("testdata", "markdown", tt.input))
			if err != nil {
				t.Fatal(err)
			}
			want, err := os.ReadFile(filepath.Join("testdata", "markdown", tt.want))
			if err != nil {
				t.Fatal(err)
			}
			diagrams := extractMarkdownPlantUML(input)
			// An empty golden explicitly represents no matching block, not an empty block.
			if wantFound := len(want) != 0; (len(diagrams) > 0) != wantFound {
				t.Fatalf("found = %v, want %v (%s)", len(diagrams) > 0, wantFound, tt.want)
			}
			if wantFound := len(want) != 0; wantFound && !bytes.Equal(diagrams[0], want) {
				t.Fatalf("PlantUML differs from %s\ngot:\n%s\nwant:\n%s", tt.want, diagrams[0], want)
			}
		})
	}
}

func TestExtractMarkdownPlantUMLLanguagePreservesCaseSensitivity(t *testing.T) {
	for _, tt := range []struct {
		language string
		want     bool
	}{
		{"puml", true},
		{"plantuml", true},
		{"iuml", true},
		{"wsd", true},
		{"PUML", false},
	} {
		t.Run(tt.language, func(t *testing.T) {
			input := []byte("```" + tt.language + "\nAlice -> Bob\n```")
			got := len(extractMarkdownPlantUML(input)) > 0
			if got != tt.want {
				t.Errorf("extractMarkdownPlantUML found = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractMarkdownPlantUMLPreservesBlockOrder(t *testing.T) {
	input, err := os.ReadFile(filepath.Join("testdata", "markdown", "first-matching-block.md"))
	if err != nil {
		t.Fatal(err)
	}
	got := extractMarkdownPlantUML(input)
	if len(got) != 2 {
		t.Fatalf("extracted %d blocks, want 2", len(got))
	}
	for i, name := range []string{"sequence.puml", "sequence-reverse.puml"} {
		want, err := os.ReadFile(filepath.Join("testdata", "markdown", name))
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got[i], want) {
			t.Errorf("block %d = %q, want %q from %s", i, got[i], want, name)
		}
	}
}
