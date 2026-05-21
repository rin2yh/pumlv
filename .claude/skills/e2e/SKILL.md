---
name: e2e
description: Run the Playwright end-to-end suite for pumlv. TRIGGER on both directions — when the user asks to run e2e tests (e.g. "run e2e", "e2eを実行", "make e2e"), validate a UI change in a real browser, or debug a failing spec; AND whenever you are about to run `make e2e`, `pnpm test:e2e`, or `playwright test` on your own initiative (e.g. as part of verifying a frontend PR's Test plan before handing it off, or before declaring a UI-touching change complete). Invoke this skill BEFORE running the e2e command, not after.
---

# Run pumlv e2e tests

The suite lives in `internal/frontend/tests/e2e/` and is driven by `make e2e`, which:

1. Runs `make build` — `go generate ./...` (which builds the embedded SPA via `pnpm run build`) then `go build -trimpath -o pumlv .`.
2. Runs `cd internal/frontend && pnpm test:e2e` (i.e. `playwright test`). Playwright's `webServer` spec spawns the freshly-built `./pumlv` on `127.0.0.1:8766` against `../../examples` and tears it down after the run.

The configured project is `chromium` only, and it launches with `channel: "chrome"`.

## Run it

```bash
make e2e
```

That is the whole happy path. Run from the repo root.

## Recovering from failures

- **`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`** — Playwright is set to `channel: "chrome"` and Chrome isn't installed. Try `cd internal/frontend && pnpm exec playwright install chrome`. If the sandbox blocks the download (e.g. apt mirrors return 403), find a preinstalled chromium under `/opt/pw-browsers/<version>/chrome-linux/chrome` and symlink it to the path Playwright is checking: `mkdir -p /opt/google/chrome && ln -sf /opt/pw-browsers/<version>/chrome-linux/chrome /opt/google/chrome/chrome`, then re-run `make e2e`. Note that `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` does **not** work here — it only overrides `channel: "chromium"`, not `channel: "chrome"`. Do **not** edit `playwright.config.ts` to bake in a sandbox-local path.

- **Server didn't come up within 30 s** — the binary is missing or stale. Confirm `./pumlv --no-open --port 8766 ./examples` boots by hand. If `make build` fails earlier with `pattern all:dist: no matching files found` from `internal/static/embed.go`, the frontend bundle wasn't produced — re-run `make build` from a clean tree (the `go:generate` directive runs `pnpm install && pnpm run build`).

- **Port already in use** — kill any stray `pumlv` from a previous run (`pgrep -af pumlv`) before retrying. `playwright.config.ts` has `reuseExistingServer: !process.env.CI`, so a stale local server won't error out by itself but will mask the binary you just built.

- **A spec failed** — Playwright writes `internal/frontend/playwright-report/index.html` and `internal/frontend/test-results/<spec>/trace.zip` per failure. Inspect those first; don't guess at fixes from the terminal output alone:

  ```bash
  cd internal/frontend && pnpm exec playwright show-trace test-results/<dir>/trace.zip
  ```

  Fix the underlying regression. Don't `test.skip` a failure to make CI green — either fix it or report it.

## Iterating on one spec

While debugging, re-run only the spec you're working on:

```bash
cd internal/frontend && pnpm exec playwright test tests/e2e/<name>.spec.ts
```

Once it passes, run `make e2e` once more from the repo root to confirm the whole suite still passes before reporting back.

## Don't

- Don't run `pnpm test:e2e` directly without first running `make build` — the `webServer.command` points at `../../pumlv`, which may not exist or may be stale.
- Don't add tests to `internal/frontend/tests/e2e/` that depend on files outside `examples/` — that directory is what the e2e Playwright config serves.
