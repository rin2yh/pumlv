package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/evanw/esbuild/pkg/api"
)

//go:generate go -C ../.. run ./tools/vendor-go-renderer

func main() {
	frontend := filepath.Join("internal", "frontend")
	if err := run(
		filepath.Join(frontend, "node_modules", "@plantuml", "core", "plantuml.js"),
		filepath.Join("internal", "render", "js"),
		filepath.Join(frontend, "node_modules"),
		filepath.Join("internal", "render", "assets"),
	); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(plantumlPath, jsDir, nodeModules, assets string) error {
	plantuml, err := os.ReadFile(plantumlPath)
	if err != nil {
		return err
	}
	const exports = "export{C as render,D as renderToString};"
	if !bytes.HasSuffix(plantuml, []byte(exports)) {
		return fmt.Errorf("PlantUML exports changed; review the integration")
	}
	plantuml = append(bytes.TrimSuffix(plantuml, []byte(exports)), []byte("globalThis.renderToString=D;")...)
	if err := os.MkdirAll(assets, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(assets, "plantuml.js"), plantuml, 0o644); err != nil {
		return err
	}
	for _, name := range []string{"buffer", "dom"} {
		result := api.Build(api.BuildOptions{
			EntryPoints:      []string{filepath.Join(jsDir, name+".js")},
			Outfile:          filepath.Join(assets, name+".js"),
			NodePaths:        []string{nodeModules},
			Bundle:           true,
			MinifyWhitespace: true,
			Platform:         api.PlatformBrowser,
			Format:           api.FormatIIFE,
			Banner:           map[string]string{"js": `"use strict";`},
			Write:            true,
		})
		if len(result.Errors) > 0 {
			return fmt.Errorf("bundle %s.js: %s", name, result.Errors[0].Text)
		}
	}
	return nil
}
