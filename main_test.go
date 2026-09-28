package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestMainCredits(t *testing.T) {
	out, err := os.Create(filepath.Join(t.TempDir(), "credits.txt"))
	if err != nil {
		t.Fatal(err)
	}
	args, stdout := os.Args, os.Stdout
	t.Cleanup(func() {
		os.Args, os.Stdout = args, stdout
	})
	os.Args = []string{"pumlv", "credits"}
	os.Stdout = out

	main()
	if err := out.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(out.Name())
	if err != nil {
		t.Fatal(err)
	}
	var want strings.Builder
	for _, name := range []string{"frontend.txt", "go.txt", "vendored.txt"} {
		part, err := os.ReadFile(filepath.Join("credits", name))
		if err != nil {
			t.Fatal(err)
		}
		want.Write(part)
		want.WriteByte('\n')
	}
	if diff := cmp.Diff(want.String(), string(data)); diff != "" {
		t.Errorf("credits output mismatch (-want +got):\n%s", diff)
	}
}
