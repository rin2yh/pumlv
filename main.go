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

// CREDITS はGoの依存から gocredits が自動生成し go generate のたびに上書きされる
// ため、vendoring したブラウザ同梱物（plantuml.js / viz-global.js）のライセンスは
// 手書きの別ファイルで管理する。
//
//go:embed CREDITS-vendored
var creditsVendored string

func main() {
	cmd.Credits = credits + "\n" + creditsVendored
	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
