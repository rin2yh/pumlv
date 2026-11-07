package cmd

import (
	"bytes"
	"reflect"
	"testing"

	"github.com/rin2yh/pumlv/internal/fileformat"
)

func TestExecuteCredits(t *testing.T) {
	previousCredits := Credits
	previousOutput := rootCmd.OutOrStdout()
	t.Cleanup(func() {
		Credits = previousCredits
		rootCmd.SetOut(previousOutput)
		rootCmd.SetArgs(nil)
	})
	Credits = "Example dependency\nCopyright Example\nMIT License\n"
	var output bytes.Buffer
	rootCmd.SetOut(&output)
	rootCmd.SetArgs([]string{"credits"})
	if err := Execute(); err != nil {
		t.Fatalf("Execute() = %v", err)
	}
	if got := output.String(); got != Credits {
		t.Fatalf("credits output = %q, want %q", got, Credits)
	}
}

func TestExtFlagUsesDefaultFileExtensions(t *testing.T) {
	got, err := rootCmd.PersistentFlags().GetStringSlice("ext")
	if err != nil {
		t.Fatal(err)
	}
	want := fileformat.GetPlantUMLExtensions()
	want = append(want, fileformat.MarkdownExtension)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("--ext default = %v, want %v", got, want)
	}
}

func TestGUIIsSubcommand(t *testing.T) {
	if guiCmd.Parent() != rootCmd {
		t.Fatal("gui command is not attached to root")
	}
	if err := guiCmd.Args(guiCmd, nil); err == nil {
		t.Fatal("gui command accepted no paths")
	}
	if err := guiCmd.Args(guiCmd, []string{"./examples"}); err != nil {
		t.Fatalf("gui command rejected a path: %v", err)
	}
	if rootCmd.Flags().Lookup("gui") != nil {
		t.Fatal("legacy --gui flag is still registered")
	}
}
