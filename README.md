# pumlv

A Go-based local preview server for PlantUML. Just run `pumlv <path>` and the diagram opens in your browser, re-rendering automatically whenever you save the file. No Java, no Docker, no external server required.

- Fully local rendering via PlantUML's TeaVM build — your source never leaves your machine
- File-change detection → automatic re-render over SSE
- Browser UI with file tree, SVG preview, and syntax-highlighted source view
- Works with files and directories (recursive); multiple arguments allowed
- Configurable file extensions (`.puml`, `.plantuml`, `.iuml`, `.wsd` by default)
- Single binary — frontend assets embedded via `go:embed`

## Background

Existing PlantUML preview options have a few rough edges:

- Most tools are editor plugins (VSCode / IntelliJ / Vim, etc.) that stop working the moment you switch editors. pumlv runs as a standalone process, independent of any editor.
- Local rendering typically requires installing Java and Graphviz, or running Docker as separate infrastructure. pumlv has no runtime dependencies beyond the binary itself.
- Web-based tools (e.g. plantuml.com) send your diagram source to an external server. pumlv renders entirely in the browser via PlantUML's TeaVM build; your source never leaves your machine.
- Editor plugins can only preview the file currently open in that editor. pumlv accepts any file or directory path on the command line, regardless of what you have open.

pumlv aims to remove all of these pain points.

> This repository is inspired by [k1LoW/mo](https://github.com/k1LoW/mo) (a local preview server for Markdown).

## Installation

Download a pre-built binary from the [releases page](https://github.com/rin2yh/pumlv/releases), or install with Go:

```sh
go install github.com/rin2yh/pumlv@latest
```


## Usage

```sh
pumlv ./docs                      # watch a directory recursively
pumlv ./design/seq.puml           # a single file
pumlv ./docs ./design/seq.puml    # multiple arguments are allowed
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `0` (pick a free port) | TCP port |
| `--host` | `127.0.0.1` | Bind host |
| `--no-open` | `false` | Do not launch the browser automatically |
| `--ext` | `.puml,.plantuml,.iuml,.wsd` | File extensions to watch |

On startup pumlv prints `pumlv listening on http://127.0.0.1:<port>` and opens the URL in your default browser. Press `Ctrl+C` for a graceful shutdown.

## About PlantUML rendering

To keep everything in the browser, this project bundles PlantUML's official TeaVM build (`plantuml.js` ~7 MB + `viz-global.js` ~1.4 MB). `frontend/scripts/fetch-plantuml-core.mjs` downloads `js-plantuml-SNAPSHOT.zip` from the [plantuml/plantuml releases](https://github.com/plantuml/plantuml/releases/tag/snapshot), extracts the two files, Vite copies them into `static/dist/`, and `go:embed` then bundles them into the final binary. PlantUML source is never sent to any external service.

## License

MIT. See [LICENSE](./LICENSE).

Third-party license texts are bundled in [`CREDITS`](./CREDITS); run `pumlv credits` to print them.
