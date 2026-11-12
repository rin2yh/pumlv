//go:build darwin

package gui

import (
	"fmt"
	"path"
	"slices"
	"strings"

	"github.com/rin2yh/pumlv/internal/server"
)

type fileEntry = server.FileEntry
type treeRow struct {
	key, label, selection string
	depth                 int
}
type treeNode struct {
	row       treeRow
	directory bool
	children  []*treeNode
}

func diagramSelection(file string, line int) string {
	return fmt.Sprintf("markdown:%s:%d", encodeURIComponent(file), line)
}

func encodeURIComponent(value string) string {
	const hex = "0123456789ABCDEF"
	var encoded strings.Builder
	encoded.Grow(len(value))
	for i := 0; i < len(value); i++ {
		b := value[i]
		if isUnescapedURIComponentByte(b) {
			encoded.WriteByte(b)
			continue
		}
		encoded.WriteByte('%')
		encoded.WriteByte(hex[b>>4])
		encoded.WriteByte(hex[b&0x0f])
	}
	return encoded.String()
}

func isUnescapedURIComponentByte(b byte) bool {
	return b >= 'a' && b <= 'z' ||
		b >= 'A' && b <= 'Z' ||
		b >= '0' && b <= '9' ||
		strings.ContainsRune("-_.!~*'()", rune(b))
}
func firstSelection(f fileEntry) string {
	if len(f.Diagrams) > 0 {
		return diagramSelection(f.Path, f.Diagrams[0].Line)
	}
	return f.Path
}
func reconcileSelection(files []fileEntry, selected string) string {
	for _, file := range files {
		if len(file.Diagrams) == 0 && file.Path == selected {
			return selected
		}
		for _, d := range file.Diagrams {
			if diagramSelection(file.Path, d.Line) == selected {
				return selected
			}
		}
	}
	if len(files) > 0 {
		return firstSelection(files[0])
	}
	return ""
}
func buildRows(files []fileEntry) []treeRow {
	return flattenRows(buildTree(files))
}

func buildTree(files []fileEntry) []*treeNode {
	var roots []*treeNode
	directories := map[string]*treeNode{}
	for _, file := range files {
		appendFile(&roots, directories, file)
	}
	return roots
}

func appendFile(roots *[]*treeNode, directories map[string]*treeNode, file fileEntry) {
	source := strings.ReplaceAll(file.Source, "\\", "/")
	if source == "" {
		source = "files"
	}
	directory := directories[source]
	if directory == nil {
		directory = &treeNode{row: treeRow{key: "dir:" + source, label: path.Base(source)}, directory: true}
		directories[source] = directory
		*roots = append(*roots, directory)
	}

	segments := strings.Split(strings.ReplaceAll(file.Rel, "\\", "/"), "/")
	key := source
	for _, part := range segments[:len(segments)-1] {
		key += "/" + part
		child := directories[key]
		if child == nil {
			child = &treeNode{row: treeRow{key: "dir:" + key, label: part}, directory: true}
			directories[key] = child
			directory.children = append(directory.children, child)
		}
		directory = child
	}

	node := &treeNode{row: treeRow{key: file.Path, label: segments[len(segments)-1], selection: firstSelection(file)}}
	for _, diagram := range file.Diagrams {
		key := diagramSelection(file.Path, diagram.Line)
		label := fmt.Sprintf("L%d", diagram.Line)
		if diagram.Title != "" {
			label += ": " + diagram.Title
		}
		node.children = append(node.children, &treeNode{row: treeRow{key: key, label: label, selection: key}})
	}
	directory.children = append(directory.children, node)
}

func flattenRows(roots []*treeNode) []treeRow {
	var rows []treeRow
	var visit func(*treeNode, int)
	visit = func(node *treeNode, depth int) {
		row := node.row
		row.depth = depth
		rows = append(rows, row)
		if node.directory {
			sortTreeNodes(node.children)
		}
		for _, child := range node.children {
			visit(child, depth+1)
		}
	}
	for _, root := range roots {
		visit(root, 1)
	}
	return rows
}

func sortTreeNodes(nodes []*treeNode) {
	slices.SortStableFunc(nodes, func(a, b *treeNode) int {
		if a.directory != b.directory {
			if a.directory {
				return -1
			}
			return 1
		}
		return strings.Compare(a.row.label, b.row.label)
	})
}
