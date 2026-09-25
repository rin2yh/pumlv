package cmd

import (
	"bytes"
	"strings"
	"testing"
)

func TestCompletion(t *testing.T) {
	for _, shell := range []string{"bash", "zsh", "fish", "powershell"} {
		t.Run(shell, func(t *testing.T) {
			var out bytes.Buffer
			rootCmd.SetArgs([]string{"completion", shell})
			rootCmd.SetOut(&out)
			defer rootCmd.SetOut(nil)

			if err := rootCmd.Execute(); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(out.String(), "pumlv") {
				t.Fatalf("generated %s completion script does not mention pumlv", shell)
			}
		})
	}
}

func TestCompletionRejectsInvalidShell(t *testing.T) {
	rootCmd.SetArgs([]string{"completion", "unknown"})
	defer rootCmd.SetArgs(nil)
	if err := rootCmd.Execute(); err == nil || !strings.Contains(err.Error(), "unsupported shell") {
		t.Fatalf("expected unsupported shell error, got %v", err)
	}
}
