//go:build !darwin

package gui

import (
	"context"
	"testing"
)

func TestRunRejectsUnsupportedPlatform(t *testing.T) {
	err := Run(context.Background(), nil)
	const want = "native GUI is currently supported on macOS only"
	if err == nil || err.Error() != want {
		t.Fatalf("Run() error = %v, want %q", err, want)
	}
}
