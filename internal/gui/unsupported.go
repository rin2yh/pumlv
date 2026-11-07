//go:build !darwin

package gui

import (
	"context"
	"fmt"

	"github.com/rin2yh/pumlv/internal/server"
)

// Run opens the native preview window on supported platforms.
func Run(_ context.Context, _ *server.Core) error {
	return fmt.Errorf("native GUI is currently supported on macOS only")
}
