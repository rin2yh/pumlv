# Contributing to pumlv

## Prerequisites

- Go 1.25+
- Node.js 22+ / pnpm 9+

## Getting Started

```sh
make build
./pumlv ./examples
```

For HMR during frontend development:

```sh
make dev   # starts pumlv on :8765 and pnpm dev on :5173 (/api proxied to :8765)
```

## Testing

```sh
make lint   # go vet + oxlint + format checks (Go and frontend)
make test   # go test + vitest
```

### E2E (rendering tests)

Playwright-driven tests live under `frontend/tests/e2e/`. They launch a real Chrome, spawn the `pumlv` binary, and verify that CheerpJ + plantuml-core actually renders the diagrams in `examples/`. Network access is required (CheerpJ runtime is fetched from a CDN on first run).

Install Playwright once:

```sh
cd frontend
pnpm install
pnpm exec playwright install --with-deps chrome
```

Then run:

```sh
make e2e         # Playwright tests
make screenshot  # writes screenshots to ./images/
```

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

### HTTP API

The server exposes the following endpoints to the browser. `/api/file` enforces a whitelist built from the paths enumerated at startup to prevent directory traversal.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serves the embedded SPA (unknown paths fall back to `index.html`) |
| GET | `/api/files` | List of watched files (`[{path, rel, name, source}]`) |
| GET | `/api/file?path=...` | Source of the specified file (text/plain) |
| GET | `/api/events` | SSE stream. Event names are `hello` / `changed` / `tree` |
