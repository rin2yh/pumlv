import { expect, test } from "@playwright/test";

const MIN_SVG_CHARS = 100;

test.describe("PlantUML rendering", () => {
  test("renders the initially selected file as an SVG data URL", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 90_000 });

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
    await expect(preview).toBeVisible({ timeout: 90_000 });
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
