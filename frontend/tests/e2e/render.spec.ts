import { expect, test } from "@playwright/test";

const MIN_PNG_BYTES = 1024;

test.describe("PlantUML rendering", () => {
  test("renders the initially selected file as a PNG data URL", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 90_000 });

    const src = await preview.getAttribute("src");
    expect(src).toMatch(/^data:image\/png;base64,/);
    const base64 = (src ?? "").split(",", 2)[1] ?? "";
    expect(base64.length).toBeGreaterThan(MIN_PNG_BYTES);
  });

  test("re-renders when another file is selected", async ({ page }) => {
    await page.goto("/");

    const buttons = page.locator("aside nav button");
    await expect.poll(async () => buttons.count(), { timeout: 30_000 }).toBeGreaterThan(1);

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 90_000 });
    const firstSrc = await preview.getAttribute("src");
    expect(firstSrc).toMatch(/^data:image\/png;base64,/);

    await buttons.nth(1).click();

    await expect
      .poll(async () => await preview.getAttribute("src"), { timeout: 90_000 })
      .not.toBe(firstSrc);

    const nextSrc = await preview.getAttribute("src");
    expect(nextSrc).toMatch(/^data:image\/png;base64,/);
  });
});
