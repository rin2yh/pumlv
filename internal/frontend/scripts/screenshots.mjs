// Generates README artwork by rendering every examples/*.puml through the
// real pumlv binary + PlantUML TeaVM pipeline. Doubles as an end-to-end smoke
// check, and exports its server/browser plumbing so ad-hoc Playwright scripts
// (see .claude/skills/screenshot) can reuse it instead of re-pasting.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..", "..");
const BIN = resolve(ROOT, "pumlv");
const EXAMPLES = resolve(ROOT, "examples");
const IMAGES_DIR = resolve(ROOT, "images");
const PORT = Number(process.env.PUMLV_SCREENSHOT_PORT ?? 8767);

export async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`server did not become ready: ${url}`);
}

export function spawnPumlv({ bin = BIN, dir = EXAMPLES, port = PORT, host = "127.0.0.1" } = {}) {
  const server = spawn(bin, ["--no-open", "--host", host, "--port", String(port), dir], {
    stdio: ["ignore", "inherit", "inherit"],
  });

  const cleanup = () => {
    if (!server.killed) server.kill("SIGTERM");
  };
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      cleanup();
      process.exit(sig === "SIGINT" ? 130 : 1);
    });
  }
  process.on("uncaughtException", (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
  process.on("unhandledRejection", (err) => {
    cleanup();
    console.error(err);
    process.exit(1);
  });
  server.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`pumlv server exited unexpectedly (code=${code}, signal=${signal})`);
      process.exit(1);
    }
  });

  return { server, cleanup, baseURL: `http://${host}:${port}` };
}

export async function withPumlvPage(
  {
    bin,
    dir,
    port,
    host,
    viewport = { width: 1280, height: 800 },
    deviceScaleFactor,
    launchOptions = { channel: "chrome" },
  } = {},
  fn,
) {
  const { cleanup, baseURL } = spawnPumlv({ bin, dir, port, host });
  await waitForServer(`${baseURL}/api/files`);

  const browser = await chromium.launch(launchOptions);
  try {
    const ctx = await browser.newContext({
      viewport,
      ...(deviceScaleFactor != null ? { deviceScaleFactor } : {}),
    });
    const page = await ctx.newPage();
    await page.goto(baseURL);
    return await fn({ page, context: ctx, browser, baseURL });
  } finally {
    await browser.close();
    cleanup();
  }
}

async function runGallery() {
  if (!existsSync(BIN)) {
    console.error(`pumlv binary not found at ${BIN}. Run 'make build' first.`);
    process.exit(1);
  }
  mkdirSync(IMAGES_DIR, { recursive: true });

  const pumlFiles = readdirSync(EXAMPLES)
    .filter((f) => /\.(puml|plantuml|iuml|wsd)$/i.test(f))
    .map((f) => resolve(EXAMPLES, f))
    .filter((p) => statSync(p).isFile());

  if (pumlFiles.length === 0) {
    console.error(`no PlantUML files found in ${EXAMPLES}`);
    process.exit(1);
  }

  await withPumlvPage({ bin: BIN, dir: EXAMPLES, port: PORT }, async ({ page }) => {
    const buttons = page.locator("aside nav button");
    await buttons.first().waitFor({ timeout: 30_000 });
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const name = (await btn.getAttribute("title")) ?? `file-${i}`;
      await btn.click();
      await page.getByAltText("preview").waitFor({ timeout: 90_000 });
      const rendered = await page
        .waitForFunction(
          () => {
            const img = document.querySelector('img[alt="preview"]');
            return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
          },
          null,
          { timeout: 90_000 },
        )
        .then(() => true)
        .catch(() => false);

      if (!rendered) {
        console.warn(`skip ${name}: preview did not finish rendering within 90s`);
        continue;
      }

      const safe = name.replaceAll(/[\\/]/g, "_");
      const out = resolve(IMAGES_DIR, `${safe.replace(/\.[^.]+$/, "")}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`saved ${out}`);
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runGallery();
}
