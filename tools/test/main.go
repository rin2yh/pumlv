// Run from the repository root: go run ./tools/test <native|browser>
package main

import (
	"os"
	"os/exec"

	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{Use: "pumlv-test", Short: "Run pumlv browser and native integration tests"}
	root.AddCommand(&cobra.Command{Use: "native", Short: "Exercise the native tree and WKWebView together", Args: cobra.NoArgs, RunE: func(*cobra.Command, []string) error { return runNative() }})
	root.AddCommand(&cobra.Command{Use: "browser", Short: "Run Playwright browser integration tests", Args: cobra.NoArgs, RunE: func(*cobra.Command, []string) error {
		command := exec.Command("pnpm", "--dir", "internal/frontend", "test:e2e")
		command.Stdout = os.Stdout
		command.Stderr = os.Stderr
		command.Stdin = os.Stdin
		return command.Run()
	}})
	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}
