import { expect, test, type Locator } from "@playwright/test";

const TRANSLATE_RE = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/;

async function readTranslate(el: Locator): Promise<[number, number] | null> {
  const transform = await el.evaluate((node) => (node as HTMLElement).style.transform);
  const m = TRANSLATE_RE.exec(transform);
  if (!m) return null;
  return [parseFloat(m[1]!), parseFloat(m[2]!)];
}

test.describe("Minimap", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText("preview")).toBeVisible({ timeout: 60_000 });
  });

  test("renders a minimap overlay with a thumbnail of the current diagram", async ({ page }) => {
    const minimap = page.getByLabel("diagram minimap");
    await expect(minimap).toBeVisible();

    const previewSrc = await page.getByAltText("preview").getAttribute("src");
    expect(previewSrc).toMatch(/^data:image\/svg\+xml/);

    const minimapImg = minimap.locator("img").first();
    await expect(minimapImg).toHaveAttribute("src", previewSrc!);
  });

  test("the viewport indicator moves when the user pans", async ({ page }) => {
    const indicator = page.locator(".rzpp-preview");
    await expect(indicator).toBeVisible();

    await expect.poll(async () => await readTranslate(indicator)).not.toBeNull();
    const before = await readTranslate(indicator);
    if (!before) throw new Error("indicator transform did not settle");

    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await readTranslate(indicator))?.[0])
      .not.toBe(before[0]);
  });
});
