import { expect, test, type Locator } from "@playwright/test";
import { PAN_STEP, PAN_STEP_FAST } from "../../src/components/use-keyboard-pan";

const TRANSLATE_RE = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/;

async function readTranslate(canvas: Locator): Promise<[number, number]> {
  const transform = await canvas.evaluate((el) => (el as HTMLElement).style.transform);
  const m = TRANSLATE_RE.exec(transform);
  if (!m) throw new Error(`unexpected transform: ${transform}`);
  return [parseFloat(m[1]!), parseFloat(m[2]!)];
}

test.describe("arrow key panning", () => {
  test("arrow keys translate the preview canvas", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await preview.waitFor({ state: "visible", timeout: 60_000 });

    // TransformComponent applies the inline transform to the <img>'s parent div.
    const canvas = preview.locator("..");

    const [x0, y0] = await readTranslate(canvas);

    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await readTranslate(canvas))[0]).toBeCloseTo(x0 - PAN_STEP, 0);

    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await readTranslate(canvas))[1]).toBeCloseTo(y0 - PAN_STEP, 0);

    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await readTranslate(canvas))[0]).toBeCloseTo(x0, 0);

    await page.keyboard.press("ArrowUp");
    await expect.poll(async () => (await readTranslate(canvas))[1]).toBeCloseTo(y0, 0);
  });

  test("Shift+arrow pans by a larger step", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await preview.waitFor({ state: "visible", timeout: 60_000 });
    const canvas = preview.locator("..");

    const [x0] = await readTranslate(canvas);
    await page.keyboard.press("Shift+ArrowRight");
    await expect
      .poll(async () => (await readTranslate(canvas))[0])
      .toBeCloseTo(x0 - PAN_STEP_FAST, 0);
  });
});
