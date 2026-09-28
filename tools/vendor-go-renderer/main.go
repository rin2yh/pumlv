package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/evanw/esbuild/pkg/api"
)

func main() {
	if err := run(filepath.Join("internal", "frontend"), filepath.Join("internal", "render", "assets")); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(frontend, assets string) error {
	plantuml, err := os.ReadFile(filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"))
	if err != nil {
		return err
	}
	const exports = "export{C as render,D as renderToString};"
	if !bytes.HasSuffix(plantuml, []byte(exports)) {
		return fmt.Errorf("PlantUML exports changed; review the integration")
	}
	plantuml = append(bytes.TrimSuffix(plantuml, []byte(exports)), []byte("globalThis.renderToString=D;")...)
	if err := os.WriteFile(filepath.Join(assets, "plantuml.js"), plantuml, 0o644); err != nil {
		return err
	}
	for _, name := range []string{"buffer", "dom"} {
		result := api.Build(api.BuildOptions{
			EntryPoints: []string{filepath.Join(filepath.Dir(assets), "js", name+".mjs")},
			Outfile:     filepath.Join(assets, name+".js"),
			NodePaths:   []string{filepath.Join(frontend, "node_modules")},
			Bundle:      true,
			Platform:    api.PlatformBrowser,
			Format:      api.FormatIIFE,
			Banner:      map[string]string{"js": `"use strict";`},
			Write:       true,
		})
		if len(result.Errors) > 0 {
			return fmt.Errorf("bundle %s.js: %s", name, result.Errors[0].Text)
		}
	}
	return nil
}
