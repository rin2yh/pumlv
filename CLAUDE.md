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
make build
./pumlv ./examples
```

For HMR during frontend development:

```sh
make dev   # starts pumlv on :8765 and pnpm dev on :5173 (/api proxied to :8765)
```

### CI commands

```sh
make lint   # go vet + oxlint + format checks (Go and frontend)
make test   # go test + vitest
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
