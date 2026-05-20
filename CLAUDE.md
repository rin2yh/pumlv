# CLAUDE.md

This document provides instructions for Claude Code when working with the **pumlv** project — a CLI tool that opens PlantUML files in a browser with live-reload.

## Project Overview

pumlv is a Go HTTP server with an embedded React SPA, compiled into a single binary. Rendering runs entirely in the browser via plantuml/plantuml's TeaVM build (`plantuml.js` + `viz-global.js`) — no Java, no CheerpJ, no external server required.

Go module: `github.com/rin2yh/pumlv`

## Key Requirements

- Go 1.25+
- Node.js 22+
- pnpm 9+

## Build & Development Commands

@Makefile

## Architecture

**Backend (Go):**

- `cmd/root.go` — CLI entry point (Cobra)
- `server/server.go` — net.Listen → http.Server, started under donegroup
- `server/handlers.go` — `/api/files`, `/api/file`, `/api/events`, SPA serving
- `server/files.go` — file enumeration and whitelist (Registry); prevents directory traversal
- `server/watcher.go` — fsnotify + 100ms debounce → broadcast to Hub
- `server/hub.go` — SSE pub/sub

**Frontend (Vite + React 19 + Tailwind v4):**

- `frontend/src/plantuml/renderer.ts` — SVG generation via plantuml.js (TeaVM) + viz-global.js (Graphviz/Viz.js)
- `frontend/scripts/fetch-plantuml-core.mjs` — downloads `js-plantuml-SNAPSHOT.zip` from plantuml/plantuml releases and extracts `plantuml.js` + `viz-global.js`
- `static/embed.go` — `//go:embed all:dist` bundles the frontend into the binary

## HTTP API

Internal endpoints (browser ↔ server). `/api/file` enforces a whitelist to prevent directory traversal.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/files` | List watched files (`[{path, rel, name, source}]`) |
| GET | `/api/file?path=...` | File source (text/plain) |
| GET | `/api/events` | SSE stream (`hello` / `changed` / `tree` events) |

## CI/CD

Uses **octocov** for coverage reporting. Releases automated via **tagpr** and **goreleaser**. `make check-credits` keeps CREDITS in sync with go.sum.

## Pull Requests

Verify every Test plan item yourself before handing the PR off — that includes UI behavior. Use `make test-frontend` / `make test-backend` / `make lint` for unit/lint checks, and the Playwright e2e suite (`make e2e`) or `make screenshot` for browser-level verification. If a feature lacks coverage, add an e2e test that exercises it. Pre-check every Test plan item you've verified; only leave something unchecked when verification is genuinely impossible in this environment, and call that out explicitly. Do not make the user point this out.

## Git

**Always ask for user confirmation before force-pushing** (`git push --force`, `git push --force-with-lease`, or any equivalent), regardless of branch. When integrating upstream changes into a feature branch, prefer `git merge` over `git rebase` so a normal push works and force-push is unnecessary in the first place.
