package main

import (
	_ "embed"
	"fmt"
	"os"

	"github.com/rin2yh/pumlv/cmd"
)

//go:generate go run github.com/Songmu/gocredits/cmd/gocredits@v0.4.0 -skip-missing -w .

//go:embed CREDITS
var credits string

// CREDITS はGoの依存から gocredits が自動生成するため、ブラウザへ配信する
// 同梱物（plantuml.js / viz-global.js）のライセンスは別ファイルで管理する。
//
//go:embed CREDITS-frontend
var creditsFrontend string

func main() {
	cmd.Credits = credits + "\n" + creditsFrontend
	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
