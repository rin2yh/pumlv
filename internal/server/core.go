package server

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/rin2yh/pumlv/internal/fileformat"
)

var (
	ErrFileNotAllowed  = errors.New("file not allowed")
	ErrNoPlantUMLBlock = errors.New("no PlantUML block")
	ErrDiagramNotFound = errors.New("PlantUML block not found")
)

// Core owns file discovery and watching independently of the HTTP transport.
type Core struct {
	registry *Registry
	watcher  *Watcher
	hub      *Hub
	close    sync.Once
	closeErr error
}

// NewCore constructs the shared file registry and watcher without opening a network listener.
func NewCore(paths, exts []string) (*Core, error) {
	registry, err := NewRegistry(paths, exts)
	if err != nil {
		return nil, err
	}
	hub := NewHub()
	watcher, err := NewWatcher(registry, hub)
	if err != nil {
		return nil, err
	}
	return &Core{registry: registry, watcher: watcher, hub: hub}, nil
}

// Start begins filesystem monitoring.
func (c *Core) Start(ctx context.Context) error {
	return c.watcher.Start(ctx)
}

// Close stops monitoring and releases event subscribers.
func (c *Core) Close() error {
	c.close.Do(func() {
		c.hub.Close()
		c.closeErr = c.watcher.Close()
	})
	return c.closeErr
}

// List returns the current registered file metadata.
func (c *Core) List() []FileEntry {
	return c.registry.List()
}

// ReadFile returns the source for a registered file or Markdown diagram.
func (c *Core) ReadFile(path string, line *int) ([]byte, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	entry, allowed := c.registry.lookup(abs)
	if !allowed {
		return nil, ErrFileNotAllowed
	}
	if fileformat.IsMarkdown(abs) {
		if len(entry.Diagrams) == 0 {
			return nil, ErrNoPlantUMLBlock
		}
		selected := 0
		if line != nil {
			selected = -1
			for i, diagram := range entry.Diagrams {
				if diagram.Line == *line {
					selected = i
					break
				}
			}
			if selected < 0 {
				return nil, ErrDiagramNotFound
			}
		}
		return entry.Diagrams[selected].Source, nil
	}
	return os.ReadFile(abs)
}

// Subscribe receives filesystem events emitted by the shared watcher.
func (c *Core) Subscribe() chan Event {
	return c.hub.Subscribe()
}

// Unsubscribe releases a filesystem event subscription.
func (c *Core) Unsubscribe(ch chan Event) {
	c.hub.Unsubscribe(ch)
}
