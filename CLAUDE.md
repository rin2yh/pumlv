# pumlv

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

## HTTP API

The server exposes the following endpoints to the browser. `/api/file` enforces a whitelist built from the paths enumerated at startup to prevent directory traversal.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serves the embedded SPA (unknown paths fall back to `index.html`) |
| GET | `/api/files` | List of watched files (`[{path, rel, name, source}]`) |
| GET | `/api/file?path=...` | Source of the specified file (text/plain) |
| GET | `/api/events` | SSE stream. Event names are `hello` / `changed` / `tree` |

## Local Development

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
