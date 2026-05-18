import { expect, test } from "@playwright/test";

const MIN_SVG_CHARS = 100;
const CHEERPJ_CDN = "https://cjrtnc.leaningtech.com";

// Inline mock for the CheerpJ loader so E2E tests run without any CDN
// download. cheerpjInit resolves immediately and Svg.convert returns a real
// SVG whose content is derived from the source text, so re-render tests see
// a different src when a different file is selected.
const CHEERPJ_MOCK_LOADER = `
(function () {
  window.cheerpjInit = async function () {
    window.cheerpjRunLibrary = async function () {
      return {
        com: { plantuml: { api: { cheerpj: { v1: {
          RunInit: { main: async function () {} },
          Svg: {
            convert: async function (theme, source) {
              var safe = (source || "").slice(0, 60).replace(/[<>&"']/g, "_");
              return (
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
                "<!-- mock-source:" + (source || "").length + ":" + safe + " -->" +
                '<rect width="400" height="300" fill="white" stroke="#aaa"/>' +
                '<text x="10" y="50" font-size="14">Mock PlantUML</text>' +
                '<text x="10" y="70" font-size="12">chars: ' + (source || "").length + "</text>" +
                "</svg>"
              );
            },
          },
        } } } } },
      };
    };
  };
})();
`;

test.beforeEach(async ({ page }) => {
  // Serve a mock CheerpJ loader so cheerpjInit resolves instantly
  // (no CDN download required in CI).
  await page.route(`${CHEERPJ_CDN}/**`, async (route) => {
    if (route.request().url().includes("loader.js")) {
      await route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body: CHEERPJ_MOCK_LOADER,
      });
    } else {
      // Block any other CDN assets — the mock doesn't need them.
      await route.abort("blockedbyclient");
    }
  });
});

test.describe("PlantUML rendering", () => {
  test("renders the initially selected file as an SVG data URL", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    const preview = page.getByAltText("preview");
    const errorPanel = page.locator("pre").filter({ hasText: /error|failed|missing/i });

    const which = await Promise.race([
      preview.waitFor({ state: "visible", timeout: 30_000 }).then(() => "ok" as const),
      errorPanel.first().waitFor({ state: "visible", timeout: 30_000 }).then(() => "err" as const),
    ]).catch(() => "timeout" as const);

    if (which !== "ok") {
      const errText = which === "err" ? await errorPanel.first().textContent() : "(timeout)";
      throw new Error(
        `Rendering did not produce preview image.\n` +
          `State: ${which}\n` +
          `Error: ${errText}\n` +
          `Console errors:\n${errors.join("\n")}`,
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
    await expect(preview).toBeVisible({ timeout: 30_000 });
    const firstSrc = await preview.getAttribute("src");
    expect(firstSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

    await buttons.nth(1).click();

    await expect
      .poll(async () => await preview.getAttribute("src"), { timeout: 30_000 })
      .not.toBe(firstSrc);

    const nextSrc = await preview.getAttribute("src");
    expect(nextSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
