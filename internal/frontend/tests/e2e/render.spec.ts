import { expect, test } from "@playwright/test";

const MIN_SVG_CHARS = 100;

test.describe("PlantUML rendering", () => {
  test("renders the initially selected file as an SVG data URL", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const preview = page.getByAltText("preview");
    const errorPanel = page.locator("pre").filter({ hasText: /error|failed|missing/i });

    await test.step("loads the SPA", async () => {
      await page.goto("/");
    });

    await test.step("preview appears before the error panel", async () => {
      const which = await Promise.race([
        preview.waitFor({ state: "visible", timeout: 60_000 }).then(() => "ok" as const),
        errorPanel
          .first()
          .waitFor({ state: "visible", timeout: 60_000 })
          .then(() => "err" as const),
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
    });

    await test.step("preview src is a non-trivial SVG data URL", async () => {
      const src = await preview.getAttribute("src");
      expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      const svgText = decodeURIComponent((src ?? "").split(",").slice(1).join(","));
      expect(svgText.length).toBeGreaterThan(MIN_SVG_CHARS);
    });
  });

  test("re-renders when another file is selected", async ({ page }) => {
    const fileButtons = page.locator("aside nav button:not([aria-expanded])");
    const preview = page.getByAltText("preview");

    await test.step("loads the SPA with the initial preview", async () => {
      await page.goto("/");
      await expect.poll(async () => fileButtons.count(), { timeout: 60_000 }).toBeGreaterThan(1);
      await expect(preview).toBeVisible({ timeout: 60_000 });
    });

    let firstSrc: string | null = null;
    await test.step("initial preview is an SVG data URL", async () => {
      firstSrc = await preview.getAttribute("src");
      expect(firstSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    });

    await test.step("clicking another file replaces the preview", async () => {
      await fileButtons.last().click();
      await expect
        .poll(async () => await preview.getAttribute("src"), { timeout: 60_000 })
        .not.toBe(firstSrc);

      const nextSrc = await preview.getAttribute("src");
      expect(nextSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    });
  });

  test("collapses and re-expands a directory from its toggle header", async ({ page }) => {
    const dirToggles = page.locator("aside nav button[aria-expanded]");
    const fileButtons = page.locator("aside nav button:not([aria-expanded])");
    const rootToggle = dirToggles.first();

    let initialCount = 0;
    await test.step("tree loads with the root expanded", async () => {
      await page.goto("/");
      await expect.poll(async () => fileButtons.count(), { timeout: 60_000 }).toBeGreaterThan(0);
      initialCount = await fileButtons.count();
      await expect(rootToggle).toHaveAttribute("aria-expanded", "true");
    });

    await test.step("clicking the root toggle collapses every file", async () => {
      await rootToggle.click();
      await expect(rootToggle).toHaveAttribute("aria-expanded", "false");
      await expect(fileButtons).toHaveCount(0);
    });

    await test.step("clicking the root toggle again restores the file list", async () => {
      await rootToggle.click();
      await expect(rootToggle).toHaveAttribute("aria-expanded", "true");
      await expect(fileButtons).toHaveCount(initialCount);
    });
  });
});
