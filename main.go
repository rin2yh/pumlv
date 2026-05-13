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

func main() {
	cmd.Credits = credits
	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
