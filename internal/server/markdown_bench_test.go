package server

import (
	"fmt"
	"strings"
	"testing"
)

// benchmarkMarkdown generates small sequence diagrams with prose and single-line
// titles. Keeping each diagram's size fixed isolates the effect of diagram count.
func benchmarkMarkdown(diagrams int) []byte {
	var source strings.Builder
	source.WriteString("# Benchmark diagrams\n\n")
	for i := 0; i < diagrams; i++ {
		fmt.Fprintf(&source, "## Diagram %05d\n\nText before the diagram.\n\n```plantuml\ntitle Diagram %05d\nAlice -> Bob: request\nBob --> Alice: response\n```\n\n", i, i)
	}
	return []byte(source.String())
}

func BenchmarkMarkdownDiagrams(b *testing.B) {
	for _, diagrams := range []int{100, 1000, 10000} {
		b.Run(fmt.Sprintf("diagrams=%d", diagrams), func(b *testing.B) {
			source := benchmarkMarkdown(diagrams)
			if got := len(markdownDiagrams(source)); got != diagrams {
				b.Fatalf("got %d diagrams, want %d", got, diagrams)
			}
			b.ReportAllocs()
			b.SetBytes(int64(len(source)))
			// B.Loop excludes source generation and the initial validation from timing.
			for b.Loop() {
				markdownDiagrams(source)
			}
		})
	}
}
