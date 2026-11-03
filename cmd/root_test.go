package cmd

import (
	"reflect"
	"testing"

	"github.com/rin2yh/pumlv/internal/fileformat"
)

func TestExtFlagUsesDefaultFileExtensions(t *testing.T) {
	got, err := rootCmd.Flags().GetStringSlice("ext")
	if err != nil {
		t.Fatal(err)
	}
	want := fileformat.GetPlantUMLExtensions()
	want = append(want, fileformat.MarkdownExtension)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("--ext default = %v, want %v", got, want)
	}
}
