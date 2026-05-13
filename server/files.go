package server

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// FileEntry represents a discoverable PlantUML file.
type FileEntry struct {
	Path   string `json:"path"`   // absolute path
	Rel    string `json:"rel"`    // relative to its source root
	Name   string `json:"name"`   // basename
	Source string `json:"source"` // absolute source root
}

// Registry holds the set of files served and lets the watcher refresh it.
type Registry struct {
	mu      sync.RWMutex
	sources []sourceRoot // resolved input arguments
	exts    map[string]struct{}
	files   map[string]FileEntry // key: absolute path
}

type sourceRoot struct {
	path  string // absolute path
	isDir bool
}

// NewRegistry resolves the user-provided paths and builds the initial file list.
func NewRegistry(inputs []string, exts []string) (*Registry, error) {
	extMap := make(map[string]struct{}, len(exts))
	for _, e := range exts {
		if e == "" {
			continue
		}
		if !strings.HasPrefix(e, ".") {
			e = "." + e
		}
		extMap[strings.ToLower(e)] = struct{}{}
	}

	r := &Registry{
		exts:  extMap,
		files: map[string]FileEntry{},
	}
	for _, in := range inputs {
		abs, err := filepath.Abs(in)
		if err != nil {
			return nil, err
		}
		info, err := os.Stat(abs)
		if err != nil {
			return nil, err
		}
		r.sources = append(r.sources, sourceRoot{path: abs, isDir: info.IsDir()})
	}
	if err := r.Refresh(); err != nil {
		return nil, err
	}
	return r, nil
}

// Refresh rescans every source root and rebuilds the file map.
func (r *Registry) Refresh() error {
	next := map[string]FileEntry{}
	for _, s := range r.sources {
		if s.isDir {
			err := filepath.WalkDir(s.path, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return nil // skip unreadable entries instead of aborting
				}
				if d.IsDir() {
					return nil
				}
				if !r.matchExt(path) {
					return nil
				}
				rel, _ := filepath.Rel(s.path, path)
				next[path] = FileEntry{
					Path:   path,
					Rel:    rel,
					Name:   filepath.Base(path),
					Source: s.path,
				}
				return nil
			})
			if err != nil {
				return err
			}
		} else {
			if !r.matchExt(s.path) {
				continue
			}
			next[s.path] = FileEntry{
				Path:   s.path,
				Rel:    filepath.Base(s.path),
				Name:   filepath.Base(s.path),
				Source: filepath.Dir(s.path),
			}
		}
	}
	r.mu.Lock()
	r.files = next
	r.mu.Unlock()
	return nil
}

// List returns a sorted snapshot of the current file entries.
func (r *Registry) List() []FileEntry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]FileEntry, 0, len(r.files))
	for _, f := range r.files {
		out = append(out, f)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Source != out[j].Source {
			return out[i].Source < out[j].Source
		}
		return out[i].Rel < out[j].Rel
	})
	return out
}

// Allowed reports whether the absolute path is in the served set.
func (r *Registry) Allowed(path string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.files[path]
	return ok
}

func (r *Registry) matchExt(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	_, ok := r.exts[ext]
	return ok
}
