# CLAUDE.md

This document provides instructions for Claude Code when working with the **pumlv** project — a CLI tool that opens PlantUML files in a browser with live-reload.

## Project Overview

pumlv is a Go HTTP server with an embedded React SPA, compiled into a single binary. Rendering runs entirely in the browser via CheerpJ + plantuml-core.jar — no Java, no external server required.

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

- `frontend/src/plantuml/renderer.ts` — SVG generation via CheerpJ + plantuml-core.jar
- `frontend/scripts/fetch-plantuml-core.mjs` — downloads plantuml-core.jar.js from GitHub Releases
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
