import { expect, test } from "@playwright/test";

const MIN_SVG_CHARS = 100;

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
      preview.waitFor({ state: "visible", timeout: 60_000 }).then(() => "ok" as const),
      errorPanel.first().waitFor({ state: "visible", timeout: 60_000 }).then(() => "err" as const),
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
    await expect.poll(async () => buttons.count(), { timeout: 60_000 }).toBeGreaterThan(1);

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 60_000 });
    const firstSrc = await preview.getAttribute("src");
    expect(firstSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

    await buttons.nth(1).click();

    await expect
      .poll(async () => await preview.getAttribute("src"), { timeout: 60_000 })
      .not.toBe(firstSrc);

    const nextSrc = await preview.getAttribute("src");
    expect(nextSrc).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
