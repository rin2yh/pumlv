# AGENTS.md

This document provides project guidance for AI coding agents working with **pumlv**, a CLI tool that opens PlantUML files in a browser with live-reload.

## Project Overview

pumlv is a Go HTTP server with an embedded React SPA, compiled into a single binary. Rendering runs entirely in the browser via plantuml/plantuml's TeaVM build (`plantuml.js` + `viz-global.js`) — no Java, no CheerpJ, no external server required.

Go module: `github.com/rin2yh/pumlv`

## Key Requirements

- Go 1.25+
- Node.js 22+
- pnpm 9+

## Build & Development Commands

@Makefile

## Go linting

`make lint-backend` checks Go formatting and runs golangci-lint. The linter
version is pinned in `.golangci-lint-version`; CI installs that version before
running the same Make target.

The configuration enables `errcheck`, `govet`, `ineffassign`, `staticcheck`,
and `unused` for error handling and static analysis, plus `gocritic` for common
implementation improvements. `revive` checks argument counts (at most three),
error naming, receiver naming, and Go initialism casing such as `ID` and `HTTP`.

No standard rule can reliably determine whether an arbitrary function name
starts with a verb or whether a boolean predicate should start with `Is`. Those
conventions remain part of code review; this project does not add a custom
analyzer. When a function needs more than three arguments, group related values
into an options or request struct when that makes the call clearer.

## Architecture

**Backend (Go):**

- `cmd/root.go` — CLI entry point (Cobra)
- `internal/server/server.go` — net.Listen → http.Server, started under donegroup
- `internal/server/handlers.go` — `/api/files`, `/api/file`, `/api/events`, SPA serving
- `internal/server/files.go` — file enumeration and whitelist (Registry); prevents directory traversal
- `internal/server/watcher.go` — fsnotify + 100ms debounce → broadcast to Hub
- `internal/server/hub.go` — SSE pub/sub

**Frontend (Vite + React 19 + Tailwind v4):**

- `internal/frontend/src/plantuml/renderer.ts` — SVG generation via plantuml.js (TeaVM) + viz-global.js (Graphviz/Viz.js)
- `internal/frontend/scripts/vendor-plantuml-core.mjs` — copies `plantuml.js` + `viz-global.js` out of the `@plantuml/core` npm package (MIT flavor) and patches the 4096px dimension limit up to 65536px
- `internal/frontend/scripts/generate-frontend-credits.mjs` — generates `credits/frontend.txt` from the SPA's production npm dependencies
- `internal/static/embed.go` — `//go:embed all:dist` bundles the frontend into the binary

## HTTP API

Internal endpoints (browser ↔ server). `/api/file` enforces a whitelist to prevent directory traversal.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/files` | List watched files (`[{path, rel, name, source}]`) |
| GET | `/api/file?path=...` | File source (text/plain) |
| GET | `/api/events` | SSE stream (`hello` / `changed` / `tree` events) |

## CI/CD

Uses **octocov** for coverage reporting. Releases automated via **tagpr** and **goreleaser**. `credits/` holds the bundled third-party license texts: `go.txt` and `frontend.txt` are generated, `vendored.txt` is hand-written.

## Architecture Decision Records

Store ADRs in `docs/adr/`. Record important future design decisions there using a concise Context / Decision / Consequences structure.

## Pull Requests

Verify every Test plan item yourself before handing the PR off — that includes UI behavior. Use `make test-frontend` / `make test-backend` / `make lint` for unit/lint checks, and the Playwright e2e suite (`make e2e`) or `make screenshot` for browser-level verification. If a feature lacks coverage, add an e2e test that exercises it. Pre-check every Test plan item you've verified; only leave something unchecked when verification is genuinely impossible in this environment, and call that out explicitly. Do not make the user point this out.

### Native macOS GUI E2E

After `make generate`, run `CGO_ENABLED=0 go run ./tools/test native` on macOS. Verify that:

- GUI mode has no HTTP listener and loads the `pumlv:` scheme and native bridge.
- The tree expands and selects files; selection survives WebView reload; a later Markdown diagram can be selected.
- File creation, edits and deletion update the tree and preview, and selection falls back when its file is removed.
- The sidebar resizes between its limits and the window closes cleanly.

The command captures `/tmp/pumlv-gui.png` for visual inspection.

Run `CGO_ENABLED=0 go run ./tools/test browser` for the Playwright browser regression suite.

## Git

**Always ask for user confirmation before force-pushing** (`git push --force`, `git push --force-with-lease`, or any equivalent), regardless of branch. When integrating upstream changes into a feature branch, prefer `git merge` over `git rebase` so a normal push works and force-push is unnecessary in the first place.
