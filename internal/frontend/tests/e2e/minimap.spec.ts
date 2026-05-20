import { expect, test, type Locator } from "@playwright/test";

const TRANSLATE_RE = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/;

async function readTranslate(el: Locator): Promise<[number, number]> {
  const transform = await el.evaluate((node) => (node as HTMLElement).style.transform);
  const m = TRANSLATE_RE.exec(transform);
  if (!m) return [0, 0];
  return [parseFloat(m[1]!), parseFloat(m[2]!)];
}

test.describe("Minimap", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText("preview")).toBeVisible({ timeout: 60_000 });
  });

  test("renders a minimap overlay with a thumbnail of the current diagram", async ({ page }) => {
    const minimap = page.getByTestId("minimap");
    await expect(minimap).toBeVisible();

    // The thumbnail img inside the minimap is the same data URL as the preview.
    const previewSrc = await page.getByAltText("preview").getAttribute("src");
    expect(previewSrc).toMatch(/^data:image\/svg\+xml/);

    const minimapImg = minimap.locator("img").first();
    await expect(minimapImg).toHaveAttribute("src", previewSrc!);
  });

  test("the viewport indicator moves when the user pans", async ({ page }) => {
    // The library renders the viewport rectangle as a div with class
    // "rzpp-preview" whose transform reflects the visible region. Panning
    // should change that translate.
    const indicator = page.locator(".rzpp-preview");
    await expect(indicator).toBeVisible();

    // Let the minimap finish its initial transform pass.
    await expect.poll(async () => (await readTranslate(indicator))[0]).toBeCloseTo(0, 0);

    const [x0] = await readTranslate(indicator);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await readTranslate(indicator))[0]).not.toBe(x0);
  });
});
