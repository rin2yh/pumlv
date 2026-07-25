package main

import (
	"embed"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/rin2yh/pumlv/cmd"
)

//go:generate sh -c "go run github.com/Songmu/gocredits/cmd/gocredits@v0.4.0 -skip-missing . > credits/go.txt"

// go.txt and frontend.txt are generated (from go.sum and from the SPA's npm
// dependencies); vendored.txt is hand-written because it carries the
// modification notice for the patched PlantUML engine.
//
//go:embed credits
var creditsFS embed.FS

// readCredits concatenates credits/ in filename order. Errors are impossible:
// the tree is embedded at build time.
func readCredits() string {
	entries, err := creditsFS.ReadDir("credits")
	if err != nil {
		panic(err)
	}
	var b strings.Builder
	for _, entry := range entries {
		data, err := creditsFS.ReadFile(path.Join("credits", entry.Name()))
		if err != nil {
			panic(err)
		}
		b.Write(data)
		b.WriteString("\n")
	}
	return b.String()
}

func main() {
	cmd.Credits = readCredits()
	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
