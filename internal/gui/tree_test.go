//go:build darwin

package gui

import (
	"path"
	"reflect"
	"testing"

	"github.com/rin2yh/pumlv/internal/server"
)

func TestBuildRows(t *testing.T) {
	const source = "/project/examples"
	const nestedFile = "/project/examples/docs/nested/flow.puml"
	const markdownPath = "/project/examples/sequence diagram #1.md"
	cases := []struct {
		name  string
		files []fileEntry
		want  []treeRow
	}{
		{name: "nested directories", files: []fileEntry{testFile(nestedFile, "docs/nested/flow.puml", source), testFile("/project/examples/docs/overview.puml", "docs/overview.puml", source)}, want: []treeRow{{key: "dir:" + source, label: "examples", depth: 1}, {key: "dir:" + source + "/docs", label: "docs", depth: 2}, {key: "dir:" + source + "/docs/nested", label: "nested", depth: 3}, {key: nestedFile, label: "flow.puml", selection: nestedFile, depth: 4}, {key: "/project/examples/docs/overview.puml", label: "overview.puml", selection: "/project/examples/docs/overview.puml", depth: 3}}},
		{name: "Markdown diagrams", files: []fileEntry{{Path: markdownPath, Rel: "sequence diagram #1.md", Name: "sequence diagram #1.md", Source: source, Diagrams: []server.MarkdownDiagram{{Line: 8, Title: "First"}, {Line: 24}}}}, want: []treeRow{{key: "dir:" + source, label: "examples", depth: 1}, {key: markdownPath, label: "sequence diagram #1.md", selection: diagramSelection(markdownPath, 8), depth: 2}, {key: diagramSelection(markdownPath, 8), label: "L8: First", selection: diagramSelection(markdownPath, 8), depth: 3}, {key: diagramSelection(markdownPath, 24), label: "L24", selection: diagramSelection(markdownPath, 24), depth: 3}}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := buildRows(tc.files); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("buildRows() = %#v, want %#v", got, tc.want)
			}
		})
	}
}

func TestBuildRowsSortsDirectoriesBeforeFiles(t *testing.T) {
	const source = "/project/examples"
	for _, tc := range []struct {
		name  string
		files []fileEntry
		want  []string
	}{
		{name: "mixed order", files: []fileEntry{testFile("/project/examples/zeta/second.puml", "zeta/second.puml", source), testFile("/project/examples/zulu.puml", "zulu.puml", source), testFile("/project/examples/beta/nested.puml", "beta/nested.puml", source), testFile("/project/examples/alpha.puml", "alpha.puml", source), testFile("/project/examples/aardvark/file.puml", "aardvark/file.puml", source), testFile("/project/examples/zeta/first.puml", "zeta/first.puml", source)}, want: []string{"examples", "aardvark", "file.puml", "beta", "nested.puml", "zeta", "first.puml", "second.puml", "alpha.puml", "zulu.puml"}},
		{name: "reverse order", files: []fileEntry{testFile("/project/examples/zeta/first.puml", "zeta/first.puml", source), testFile("/project/examples/aardvark/file.puml", "aardvark/file.puml", source), testFile("/project/examples/alpha.puml", "alpha.puml", source), testFile("/project/examples/beta/nested.puml", "beta/nested.puml", source), testFile("/project/examples/zulu.puml", "zulu.puml", source), testFile("/project/examples/zeta/second.puml", "zeta/second.puml", source)}, want: []string{"examples", "aardvark", "file.puml", "beta", "nested.puml", "zeta", "first.puml", "second.puml", "alpha.puml", "zulu.puml"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rows := buildRows(tc.files)
			gotLabels := make([]string, len(rows))
			for i, row := range rows {
				gotLabels[i] = row.label
			}
			if !reflect.DeepEqual(gotLabels, tc.want) {
				t.Fatalf("buildRows() labels = %v, want %v", gotLabels, tc.want)
			}
		})
	}
}

func TestDiagramSelectionMatchesEncodeURIComponent(t *testing.T) {
	cases := []struct {
		name, path, want string
		line             int
	}{
		{name: "ASCII punctuation", path: "/tmp/a b!~*'().md", line: 12, want: "markdown:%2Ftmp%2Fa%20b!~*'().md:12"},
		{name: "Unicode", path: "/tmp/日本語.md", line: 8, want: "markdown:%2Ftmp%2F%E6%97%A5%E6%9C%AC%E8%AA%9E.md:8"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := diagramSelection(tc.path, tc.line); got != tc.want {
				t.Fatalf("diagramSelection() = %q, want %q", got, tc.want)
			}
		})
	}
}

func testFile(filePath, rel, source string) fileEntry {
	return fileEntry{
		Path:   filePath,
		Rel:    rel,
		Name:   path.Base(filePath),
		Source: source,
	}
}
