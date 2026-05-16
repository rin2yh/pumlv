# Contributing to pumlv

## Getting Started

### Prerequisites

- Go 1.25+
- Node.js 22+ / pnpm 9+

### Setup

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