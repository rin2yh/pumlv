package server

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/k1LoW/donegroup"
)

const corePlantUML = "@startuml\nAlice -> Bob\n@enduml\n"
const coreMarkdown = "# Diagrams\n~~~puml\nAlice -> Bob: first\n~~~\n\n~~~puml\nBob -> Alice: second\n~~~\n"

func TestCoreList(t *testing.T) {
	dir := t.TempDir()
	writeCoreFile(t, filepath.Join(dir, "diagram.puml"), corePlantUML)
	writeCoreFile(t, filepath.Join(dir, "diagrams.md"), coreMarkdown)
	core := newCoreForTest(t, dir)
	want := []FileEntry{
		{Path: filepath.Join(dir, "diagram.puml"), Rel: "diagram.puml", Name: "diagram.puml", Source: dir},
		{Path: filepath.Join(dir, "diagrams.md"), Rel: "diagrams.md", Name: "diagrams.md", Source: dir, Diagrams: []MarkdownDiagram{{Line: 2}, {Line: 6}}},
	}
	if got := core.List(); !reflect.DeepEqual(got, want) {
		t.Fatalf("List() = %+v, want %+v", got, want)
	}
}

func TestCoreReadFile(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "diagram.puml")
	markdown := filepath.Join(dir, "diagrams.md")
	outside := filepath.Join(t.TempDir(), "outside.puml")
	writeCoreFile(t, puml, corePlantUML)
	writeCoreFile(t, markdown, coreMarkdown)
	writeCoreFile(t, outside, corePlantUML)
	core := newCoreForTest(t, dir)
	secondLine, missingLine := 6, 7
	cases := []struct {
		name, path, want string
		line             *int
		wantErr          error
	}{
		{name: "PlantUML file", path: puml, want: "@startuml\nAlice -> Bob\n@enduml\n"},
		{name: "first Markdown diagram", path: markdown, want: "@startuml\nAlice -> Bob: first\n@enduml\n"},
		{name: "selected Markdown diagram", path: markdown, line: &secondLine, want: "@startuml\nBob -> Alice: second\n@enduml\n"},
		{name: "missing Markdown diagram", path: markdown, line: &missingLine, wantErr: ErrDiagramNotFound},
		{name: "file outside watched directory", path: outside, wantErr: ErrFileNotAllowed},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := core.ReadFile(tc.path, tc.line)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("ReadFile() error = %v, want %v", err, tc.wantErr)
			}
			if string(got) != tc.want {
				t.Fatalf("ReadFile() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNewCoreRejectsMissingPath(t *testing.T) {
	_, err := NewCore([]string{filepath.Join(t.TempDir(), "missing")}, []string{".puml"})
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("NewCore() error = %v, want os.ErrNotExist", err)
	}
}

func TestCorePublishesFileChanges(t *testing.T) {
	dir := t.TempDir()
	puml := filepath.Join(dir, "diagram.puml")
	writeCoreFile(t, puml, "@startuml\n@enduml\n")
	core := newCoreForTest(t, dir)
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(func() {
		cancel()
		if err := core.Close(); err != nil {
			t.Error(err)
		}
		if err := donegroup.Wait(ctx); err != nil {
			t.Error(err)
		}
	})
	ch := core.Subscribe()
	if err := core.Start(ctx); err != nil {
		t.Fatal(err)
	}
	writeCoreFile(t, puml, corePlantUML)
	waitCoreChange(t, ch, puml)
}

func TestCoreUnsubscribe(t *testing.T) {
	core := newCoreForTest(t, t.TempDir())
	ch := core.Subscribe()
	core.Unsubscribe(ch)
	expectCoreSubscriptionClosed(t, ch)
}

func TestCoreClose(t *testing.T) {
	core := newCoreForTest(t, t.TempDir())
	ch := core.Subscribe()
	for i := 0; i < 2; i++ {
		if err := core.Close(); err != nil {
			t.Fatalf("Close() call %d: %v", i+1, err)
		}
	}
	expectCoreSubscriptionClosed(t, ch)
}

func newCoreForTest(t *testing.T, dir string) *Core {
	t.Helper()
	core, err := NewCore([]string{dir}, []string{".puml", ".md"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := core.Close(); err != nil {
			t.Error(err)
		}
	})
	return core
}

func writeCoreFile(t *testing.T, path, source string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(source), 0o600); err != nil {
		t.Fatal(err)
	}
}

func waitCoreChange(t *testing.T, ch <-chan Event, path string) {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case event, ok := <-ch:
			if !ok {
				t.Fatal("subscription closed before file change")
			}
			if data, ok := event.Data.(map[string]string); event.Name == "changed" && ok && data["path"] == path {
				return
			}
		case <-deadline:
			t.Fatalf("Core did not publish a change for %s", path)
		}
	}
}

func expectCoreSubscriptionClosed(t *testing.T, ch <-chan Event) {
	t.Helper()
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("expected closed subscription, received an event")
		}
	case <-time.After(time.Second):
		t.Fatal("subscription was not closed")
	}
}
