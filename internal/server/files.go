package server

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/rin2yh/pumlv/internal/fileformat"
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
	filesMu        sync.RWMutex // protects files and revision
	updateSerialMu sync.Mutex   // serializes updates; not held during recovery directory scans
	revision       uint64       // invalidates directory candidates when a concurrent update occurs
	sources        []sourceRoot // resolved input arguments
	exts           map[string]struct{}
	files          map[string]FileEntry // key: absolute path
	readFile       func(string) ([]byte, error)
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
		exts:     extMap,
		files:    map[string]FileEntry{},
		readFile: os.ReadFile,
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

// Refresh replaces the snapshot only after every source was read successfully.
func (r *Registry) Refresh() error {
	r.updateSerialMu.Lock()
	defer r.updateSerialMu.Unlock()
	next := map[string]FileEntry{}
	for _, s := range r.sources {
		if s.isDir {
			err := filepath.WalkDir(s.path, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return fmt.Errorf("scan %q: %w", path, err)
				}
				if d.IsDir() {
					return nil
				}
				entry, ok, err := r.getFileEntry(path)
				if err != nil {
					return err
				}
				if ok {
					next[path] = entry
				}
				return nil
			})
			if err != nil {
				return err
			}
		} else {
			entry, ok, err := r.getFileEntry(s.path)
			if err != nil {
				return err
			}
			if ok {
				next[s.path] = entry
			}
		}
	}
	r.filesMu.Lock()
	r.files = next
	r.revision++
	r.filesMu.Unlock()
	return nil
}

// List returns a sorted snapshot of the current file entries.
func (r *Registry) List() []FileEntry {
	r.filesMu.RLock()
	defer r.filesMu.RUnlock()
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
	r.filesMu.RLock()
	defer r.filesMu.RUnlock()
	_, ok := r.files[path]
	return ok
}

func (r *Registry) matchExt(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	_, ok := r.exts[ext]
	return ok
}

func (r *Registry) isDiscoverable(path string) (bool, error) {
	if !r.matchExt(path) {
		return false, nil
	}
	if !fileformat.IsMarkdown(path) {
		return true, nil
	}
	data, err := r.readFile(path)
	if err != nil {
		return false, fmt.Errorf("read Markdown %q: %w", path, err)
	}
	return len(extractMarkdownPlantUML(data)) > 0, nil
}

// Update rechecks only path and reports whether its tree entry changed.
// Source order matches Refresh: the last matching source determines the entry.
// Read errors leave the previous entry intact; removal events handle missing paths.
func (r *Registry) Update(path string) (bool, error) {
	return r.updatePath(context.Background(), path)
}

func (r *Registry) updatePath(ctx context.Context, path string) (bool, error) {
	r.updateSerialMu.Lock()
	defer r.updateSerialMu.Unlock()

	entry, isAllowed, err := r.getFileEntry(path)
	if err != nil {
		return false, err
	}
	r.filesMu.Lock()
	defer r.filesMu.Unlock()
	if err := ctx.Err(); err != nil {
		return false, err
	}
	r.revision++
	previous, wasAllowed := r.files[path]
	if !isAllowed {
		delete(r.files, path)
		return wasAllowed, nil
	}
	r.files[path] = entry
	return !wasAllowed || previous != entry, nil
}

func createFileEntry(path, source string) FileEntry {
	rel, _ := filepath.Rel(source, path)
	return FileEntry{Path: path, Rel: rel, Name: filepath.Base(path), Source: source}
}

// containsPath compares path components, so sibling prefixes do not match.
func containsPath(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// addPath commits files under path only after all reads and watch registrations succeed.
func (r *Registry) addPath(path string, onDir func(string) error) (bool, error) {
	return r.addPathContext(context.Background(), path, onDir)
}

func (r *Registry) addPathContext(ctx context.Context, path string, onDir func(string) error) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
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
		return false, nil
	}
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false, nil // a later remove event will handle a short-lived creation
	}
	if err != nil {
		return false, err
	}
	if !info.IsDir() {
		return r.updatePath(ctx, path)
	}
	if !directorySource {
		return false, nil
	}

	// Scan without holding updateSerialMu so recovery cannot stall ordinary events.
	// Reject candidates if an update (even removal of an unregistered file) ran
	// during the scan, rather than publishing stale eligibility or metadata.
	r.filesMu.RLock()
	revision := r.revision
	r.filesMu.RUnlock()
	next := map[string]FileEntry{}
	err = filepath.WalkDir(path, func(child string, d fs.DirEntry, err error) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err != nil {
			return fmt.Errorf("scan %q: %w", child, err)
		}
		if d.IsDir() {
			if onDir != nil {
				if err := onDir(child); err != nil {
					return fmt.Errorf("watch directory %q: %w", child, err)
				}
			}
			return nil
		}
		entry, ok, err := r.getFileEntry(child)
		if err != nil {
			return err
		}
		if ok {
			next[child] = entry
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	r.updateSerialMu.Lock()
	defer r.updateSerialMu.Unlock()
	r.filesMu.Lock()
	defer r.filesMu.Unlock()
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if revision != r.revision {
		return false, fmt.Errorf("registry changed while scanning %q; retry required", path)
	}
	changed := false
	for path, entry := range next {
		if old, ok := r.files[path]; !ok || old != entry {
			r.files[path] = entry
			changed = true
		}
	}
	if changed {
		r.revision++
	}
	return changed, nil
}

// getFileEntry resolves eligibility and metadata without mutating the Registry.
func (r *Registry) getFileEntry(path string) (FileEntry, bool, error) {
	var entry FileEntry
	found := false
	for _, s := range r.sources {
		if s.isDir && containsPath(s.path, path) {
			entry = createFileEntry(path, s.path)
			found = true
		} else if !s.isDir && s.path == path {
			entry = createFileEntry(path, filepath.Dir(path))
			found = true
		}
	}
	if !found {
		return FileEntry{}, false, nil
	}
	allowed, err := r.isDiscoverable(path)
	return entry, allowed, err
}

// removePath needs no filesystem access: rename/remove events name the old path.
func (r *Registry) removePath(path string) bool {
	r.updateSerialMu.Lock()
	defer r.updateSerialMu.Unlock()
	r.filesMu.Lock()
	defer r.filesMu.Unlock()
	r.revision++
	if _, ok := r.files[path]; ok {
		delete(r.files, path)
		return true
	}
	changed := false
	for child := range r.files {
		if containsPath(path, child) {
			delete(r.files, child)
			changed = true
		}
	}
	return changed
}
