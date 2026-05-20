---
name: screenshot
description: Capture screenshots of pumlv running in a real browser via Playwright. TRIGGER on both directions — when the user asks for a screenshot ("スクショ撮って", "show me", "send the image", "capture the source tab"); AND whenever you want to visually verify a UI-touching change, attach evidence to a PR or chat reply, produce a before/after comparison, or refresh the README gallery. Two modes — `make screenshot` regenerates the example gallery in `images/`, and an ad-hoc Playwright script shoots a specific UI region for one file. Invoke this skill BEFORE running either form.
---

# Capture pumlv screenshots

Two distinct workflows. Pick the one that matches the goal — don't conflate them.

## A. Regenerate the README gallery (`make screenshot`)

Runs `internal/frontend/scripts/screenshots.mjs` against every `examples/*.puml` and writes PNGs to the top-level `images/` directory (tracked in git). Use this when the renderer changes, an example is added, or `images/` falls out of sync with the examples.

```bash
make screenshot
```

`make screenshot` depends on `build`, so it refreshes `./pumlv` first, then drives Playwright through each entry in the sidebar.

## B. Ad-hoc capture for verification / chat reply

When you just need one screenshot of a specific UI region (e.g. the Source tab after a fix, the preview of one file), write a one-off Playwright script under `/tmp/`. **Do not extend `screenshots.mjs`** — that script is dedicated to the gallery and writes into a tracked directory.

Template (adapt the file, region, and output path):

```js
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "/home/user/pumlv/internal/frontend/node_modules/@playwright/test/index.mjs";

const BIN = "/home/user/pumlv/pumlv";       // run `make build` first
const DIR = "/tmp/pumlv-shot";              // contains the .puml file(s) to render
const PORT = 8770;                          // avoid the e2e default 8766
const CHROME = "<path/to/chrome>";          // see Recovery below

const server = spawn(BIN, ["--no-open", "--host", "127.0.0.1", "--port", String(PORT), DIR], {
  stdio: ["ignore", "inherit", "inherit"],
});
const cleanup = () => { if (!server.killed) server.kill("SIGTERM"); };
process.on("exit", cleanup);

const baseURL = `http://127.0.0.1:${PORT}`;
const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  try { if ((await fetch(`${baseURL}/api/files`)).ok) break; } catch {}
  await delay(150);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(baseURL);
  await page.getByRole("button", { name: "<file>.puml" }).click();

  // Pick the region to shoot:
  //   page.getByAltText("preview")                       — the rendered SVG
  //   page.getByRole("region", { name: "Source" })       — the source tab
  //   page                                                — the whole viewport
  const target = page.getByRole("region", { name: "Source" });
  await target.getByText("@startuml").first().waitFor({ timeout: 30_000 });
  await delay(800); // let the syntax highlighter settle

  await target.screenshot({ path: `${DIR}/shot.png` });
} finally {
  await browser.close();
  cleanup();
}
```

For the preview, wait until the SVG has actually rendered before shooting:

```js
await page.waitForFunction(() => {
  const img = document.querySelector('img[alt="preview"]');
  return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
}, null, { timeout: 90_000 });
```

After capturing, deliver the PNG to the user with the `SendUserFile` tool and a concise caption. Don't claim "screenshot taken" without actually sending the file.

### Before/after comparisons

For a visual diff of a change you're working on:

1. Save the "after" screenshot from the current tree.
2. `git checkout <pre-change-ref> -- <changed files>` and `make build`.
3. Shoot the "before" with the same viewport / region.
4. `git checkout HEAD -- <changed files>` and `make build` to restore.
5. `SendUserFile` both paths in one call so the user sees them side by side.

If the two PNGs come out identical (same MD5), the binary wasn't actually rebuilt between shots — verify the build succeeded between step 2 and step 3.

## Recovering from failures

- **`Chromium distribution 'chrome' is not found …`** — Playwright is set to `channel: "chrome"`. Try `cd internal/frontend && pnpm exec playwright install chrome`. If the sandbox blocks the download, point Playwright at a preinstalled chromium under `/opt/pw-browsers/<version>/chrome-linux/chrome` — via `executablePath` in the ad-hoc script, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<path> make screenshot` for the gallery. Do **not** commit that path or bake it into `screenshots.mjs`.

- **`make build` fails with `pattern all:dist: no matching files found`** — the frontend bundle wasn't generated. Re-run `make build` from a clean tree (the `go:generate` directive runs `pnpm install && pnpm run build`).

- **Port already in use** — `pgrep -af pumlv` for stray servers; kill them before retrying.

## Don't

- Don't extend `internal/frontend/scripts/screenshots.mjs` for one-off captures — it's the gallery generator.
- Don't commit ad-hoc PNGs to the repo. `images/` is tracked because it's the gallery; one-off shots belong under `/tmp/`.
- Don't say "screenshot taken" without calling `SendUserFile`.
