import { expect, test } from "@playwright/test";

const MIN_SVG_CHARS = 100;

test.describe("PlantUML rendering", () => {
  test("renders the initially selected file as an SVG data URL", async ({ page }) => {
    const consoleLogs: string[] = [];
    const networkRequests: string[] = [];
    const networkFailures: string[] = [];
    const workers: string[] = [];
    // Track requests whose body download has not yet completed.
    const pendingRequests = new Set<string>();
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => consoleLogs.push(`[pageerror] ${err.message}`));
    page.on("request", (req) => {
      pendingRequests.add(req.url());
      const url = req.url();
      if (url.includes("cheerpj") || url.includes("cjrtnc") || url.includes("plantuml")) {
        networkRequests.push(`REQ ${req.method()} ${url}`);
      }
    });
    page.on("response", (resp) => {
      const url = resp.url();
      if (url.includes("cheerpj") || url.includes("cjrtnc") || url.includes("plantuml")) {
        networkRequests.push(`RES ${resp.status()} ${url}`);
      }
    });
    page.on("requestfinished", (req) => pendingRequests.delete(req.url()));
    page.on("requestfailed", (req) => {
      pendingRequests.delete(req.url());
      networkFailures.push(`FAILED ${req.url()} — ${req.failure()?.errorText ?? "unknown"}`);
    });
    page.on("worker", (w) => {
      workers.push(`WORKER+ ${w.url()}`);
      w.on("close", () => workers.push(`WORKER- ${w.url()}`));
    });

    await page.goto("/");

    // Wait for either the preview image or the error panel to appear
    const preview = page.getByAltText("preview");
    const errorPanel = page.locator("pre").filter({ hasText: /error|failed|missing/i });

    const which = await Promise.race([
      preview.waitFor({ state: "visible", timeout: 180_000 }).then(() => "ok" as const),
      errorPanel.first().waitFor({ state: "visible", timeout: 180_000 }).then(() => "err" as const),
    ]).catch(() => "timeout" as const);

    if (which !== "ok") {
      const errText = which === "err" ? await errorPanel.first().textContent() : "(timeout)";
      const diag = await page.evaluate(() => ({
        crossOriginIsolated: (self as Window & typeof globalThis).crossOriginIsolated,
        hasSharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
        hasWebAssembly: typeof WebAssembly !== "undefined",
        hasWorker: typeof Worker !== "undefined",
        cheerpjInit: typeof (window as Record<string, unknown>).cheerpjInit,
        cheerpjRunLibrary: typeof (window as Record<string, unknown>).cheerpjRunLibrary,
        preTexts: Array.from(document.querySelectorAll("pre")).map((el) =>
          el.textContent?.slice(0, 200),
        ),
      }));
      throw new Error(
        `Rendering did not produce preview image.\n` +
          `State: ${which}\n` +
          `Error panel: ${errText}\n` +
          `Diagnostics: ${JSON.stringify(diag)}\n` +
          `Workers:\n${workers.join("\n")}\n` +
          `Pending (stalled) requests:\n${[...pendingRequests].join("\n")}\n` +
          `Network requests (CheerpJ/PlantUML):\n${networkRequests.join("\n")}\n` +
          `Network failures:\n${networkFailures.join("\n")}\n` +
          `Console (last 50):\n${consoleLogs.slice(-50).join("\n")}`,
      );
    }

    const src = await preview.getAttribute("src");
    expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    const svgText = decodeURIComponent((src ?? "").split(",").slice(1).join(","));
    expect(svgText.length).toBeGreaterThan(MIN_SVG_CHARS);
  });

  test("re-renders when another file is selected", async ({ page }) => {
    await page.goto("/");

    const buttons = page.locator("aside nav button");
    await expect.poll(async () => buttons.count(), { timeout: 30_000 }).toBeGreaterThan(1);

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 180_000 });
    const firstSrc = await preview.getAttribute("src");
    expect(firstSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

    await buttons.nth(1).click();

    await expect
      .poll(async () => await preview.getAttribute("src"), { timeout: 90_000 })
      .not.toBe(firstSrc);

    const nextSrc = await preview.getAttribute("src");
    expect(nextSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
