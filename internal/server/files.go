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

// containsPath compares path components, so sibling prefixes do not match.
func containsPath(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// addPath inspects only the created path (and its descendants for a directory).
// onDir installs watches before reading children, including moved-in subtrees.
func (r *Registry) addPath(path string, onDir func(string) error) error {
	var directorySource bool
	var relevant bool
	for _, s := range r.sources {
		if s.isDir && containsPath(s.path, path) {
			directorySource = true
			relevant = true
		} else if !s.isDir && s.path == path {
			relevant = true
		}
	}
	if !relevant {
		return nil
	}
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return nil // a later remove event will handle a short-lived creation
	}
	if err != nil {
		return err
	}
	if !info.IsDir() {
		r.addFile(path)
		return nil
	}
	if !directorySource {
		return nil
	}
	return filepath.WalkDir(path, func(child string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // same unreadable-entry policy as Refresh
		}
		if d.IsDir() {
			if onDir != nil {
				return onDir(child)
			}
			return nil
		}
		r.addFile(child)
		return nil
	})
}

func (r *Registry) addFile(path string) {
	if !r.matchExt(path) {
		return
	}
	var entry FileEntry
	found := false
	for _, s := range r.sources {
		if s.isDir && containsPath(s.path, path) {
			rel, _ := filepath.Rel(s.path, path)
			entry = FileEntry{Path: path, Rel: rel, Name: filepath.Base(path), Source: s.path}
			found = true
		} else if !s.isDir && s.path == path {
			entry = FileEntry{Path: path, Rel: filepath.Base(path), Name: filepath.Base(path), Source: filepath.Dir(path)}
			found = true
		}
	}
	if found {
		r.mu.Lock()
		r.files[path] = entry
		r.mu.Unlock()
	}
}

// removePath needs no filesystem access: rename/remove events name the old path.
func (r *Registry) removePath(path string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.files[path]; ok {
		delete(r.files, path)
		return
	}
	for child := range r.files {
		if containsPath(path, child) {
			delete(r.files, child)
		}
	}
}
