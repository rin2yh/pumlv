# pumlv

A Go-based local preview server for PlantUML. Just run `pumlv <path>` and the diagram opens in your browser, re-rendering automatically whenever you save the file. No Java, no Docker, no external server required.

- Fully local rendering (runs `plantuml-core.jar.js` in the browser)
- File-change detection → automatic re-render over SSE
- Works with both files and directories (directories are walked recursively)
- Single binary (frontend assets bundled via `go:embed`)

## Background

Existing PlantUML preview options have a few rough edges:

- Most tools are editor plugins (VSCode / IntelliJ / Vim, etc.) that stop working the moment you switch editors. pumlv runs as a standalone process, independent of any editor.
- Local rendering typically requires installing Java and Graphviz, or running Docker as separate infrastructure. pumlv has no runtime dependencies beyond the binary itself.
- Web-based tools (e.g. plantuml.com) send your diagram source to an external server. pumlv renders entirely in the browser via CheerpJ; your source never leaves your machine.
- Editor plugins can only preview the file currently open in that editor. pumlv accepts any file or directory path on the command line, regardless of what you have open.

pumlv aims to remove all of these pain points.

> This repository is inspired by [k1LoW/mo](https://github.com/k1LoW/mo) (a local preview server for Markdown).

## Installation

To use a pre-built binary:

```sh
go install github.com/rin2yh/pumlv@latest
```

To build from source, see the "Development" section below.

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

## HTTP API

The server exposes the following endpoints to the browser. `/api/file` enforces a whitelist built from the paths enumerated at startup to prevent directory traversal.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serves the embedded SPA (unknown paths fall back to `index.html`) |
| GET | `/api/files` | List of watched files (`[{path, rel, name, source}]`) |
| GET | `/api/file?path=...` | Source of the specified file (text/plain) |
| GET | `/api/events` | SSE stream. Event names are `hello` / `changed` / `tree` |

## Architecture

```
pumlv
├── main.go / cmd/root.go        # cobra entry point
├── server/
│   ├── server.go                # net.Listen → http.Server, started under donegroup
│   ├── handlers.go              # /api/files /api/file /api/events and SPA serving
│   ├── files.go                 # target file enumeration and whitelist (Registry)
│   ├── watcher.go               # fsnotify + 100ms debounce → broadcast to Hub
│   └── hub.go                   # SSE pub/sub
├── static/
│   ├── embed.go                 # //go:embed all:dist
│   └── dist/                    # frontend build output (from pnpm build)
└── frontend/                    # Vite + React 19 + Tailwind v4
    ├── scripts/fetch-plantuml-core.mjs  # downloads plantuml-core.jar.js from Releases
    └── src/
        ├── App.tsx / components/
        ├── api/{files,events}.ts
        └── plantuml/renderer.ts # SVG generation via CheerpJ + plantuml-core.jar
```

## Development

### Prerequisites

- Go 1.25 or newer
- Node.js 22 or newer + pnpm 9

### Setup

```sh
go generate ./...   # runs pnpm install & build for the frontend, producing static/dist
go build -o pumlv .
./pumlv ./examples
```

`go generate` is not invoked automatically by `go build`, so run it explicitly whenever you need to regenerate the frontend assets.

During development you can run the frontend dev server separately to get HMR:

```sh
# Terminal 1
./pumlv --no-open --port 8765 ./examples

# Terminal 2
cd frontend && pnpm dev   # http://localhost:5173 (`/api` is proxied to :8765)
```

### CI commands

```sh
# Go
go vet ./...
go fmt ./...        # OK when the output is empty
go test ./...

# Frontend
cd frontend
pnpm lint           # oxlint
pnpm fmt:check      # oxfmt
pnpm test           # vitest
pnpm build          # equivalent to `go generate ./...` from the repo root
```

### Rendering tests (E2E)

Playwright-driven real-rendering tests live under `frontend/tests/e2e/`. They launch a real Chrome, spawn the `pumlv` binary as the server, and verify that the in-browser CheerpJ + plantuml-core combination actually renders the diagrams in `examples/`. The CheerpJ runtime is fetched from `cjrtnc.leaningtech.com` on first load, so network access is required when running the E2E suite.

```sh
make build          # produces the pumlv binary at the repo root
make e2e            # runs `pnpm test:e2e` (Playwright) in frontend
make screenshot     # writes README screenshots to ./images/
```

Playwright and Chrome must be installed separately:

```sh
cd frontend
pnpm install
pnpm exec playwright install --with-deps chrome
```

## About PlantUML rendering

To keep everything in the browser, this project bundles the CheerpJ build of PlantUML's official [plantuml-core](https://github.com/plantuml/plantuml-core) (`plantuml-core.jar.js`, ~17 MB). `frontend/scripts/fetch-plantuml-core.mjs` downloads it via the GitHub Releases API, Vite copies it into `static/dist/`, and `go:embed` then bundles it into the final binary.

> ⚠️ Note: The CheerpJ runtime itself (`cjrtnc.leaningtech.com/2.3/loader.js`) is fetched from a CDN on first load. After that the browser cache serves it, and PlantUML source is never sent to any external service.

## License

The source code in this repository is released under the [MIT License](./LICENSE).

The full text of every third-party license required for binary redistribution is bundled in [`CREDITS`](./CREDITS) and embedded in the binary itself. Run `pumlv credits` to print it. `CREDITS` is regenerated by [gocredits](https://github.com/Songmu/gocredits) via `make credits`, and CI runs `make check-credits` to keep it in sync with `go.sum`.

### Third-party components (bundled or fetched at runtime)

#### Bundled in the binary / frontend output

| Component | License | Notes |
|---|---|---|
| [plantuml/plantuml-core](https://github.com/plantuml/plantuml-core) (`plantuml-core.jar`, `plantuml-core.jar.js`) | MIT | Fetched by `frontend/scripts/fetch-plantuml-core.mjs` and bundled into `static/dist/` |
| [React](https://github.com/facebook/react) (`react`, `react-dom`) | MIT | Bundled |
| [Shiki](https://github.com/shikijs/shiki) | MIT | Bundled |
| [Tailwind CSS](https://tailwindcss.com/) | MIT | Bundled |

Development-only (DevDependencies; not included in the final binary):

| Component | License | Notes |
|---|---|---|
| [Playwright](https://playwright.dev/) (`@playwright/test`) | Apache-2.0 | E2E rendering tests (`frontend/tests/e2e/`, `frontend/scripts/screenshots.mjs`) |

#### Fetched from a CDN at runtime (browser side)

| Component | License | Notes |
|---|---|---|
| [CheerpJ Runtime 2.3](https://cheerpj.com/) (`cjrtnc.leaningtech.com/2.3/loader.js`) | CheerpJ Community License | Free for OSS / non-commercial use (limited to usage from the `cjrtnc.leaningtech.com` domain). Commercial internal use requires a separate Commercial License |

#### Main dependencies linked into the Go binary

| Module | License |
|---|---|
| `github.com/spf13/cobra` | Apache-2.0 |
| `github.com/spf13/pflag` | BSD-3-Clause |
| `github.com/fsnotify/fsnotify` | BSD-3-Clause |
| `github.com/k1LoW/donegroup` | MIT |
| `github.com/muesli/termenv` | MIT |
| `github.com/pkg/browser` | BSD-2-Clause |
| `github.com/aymanbagabas/go-osc52/v2` | MIT |
| `github.com/mattn/go-isatty` | MIT |
| `github.com/rivo/uniseg` | MIT |
| `github.com/lucasb-eyer/go-colorful` | MIT |
| `github.com/inconshreveable/mousetrap` | Apache-2.0 |
| `golang.org/x/sys` | BSD-3-Clause |

See each upstream repository's `LICENSE` file for the full license text.
