import { expect, test } from "@playwright/test";

const PAN_STEP = 50;
const TRANSLATE_RE = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/;

test.describe("arrow key panning", () => {
  test("arrow keys translate the preview canvas", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await preview.waitFor({ state: "visible", timeout: 60_000 });

    // The transform is applied to the inner div rendered by TransformComponent
    // (parent of the <img alt="preview">).
    const canvas = preview.locator("..");

    const parseXY = async (): Promise<[number, number]> => {
      const transform = await canvas.evaluate((el) => (el as HTMLElement).style.transform);
      const m = TRANSLATE_RE.exec(transform);
      if (!m) throw new Error(`unexpected transform: ${transform}`);
      return [parseFloat(m[1]!), parseFloat(m[2]!)];
    };

    const [x0, y0] = await parseXY();

    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await parseXY())[0]).toBeCloseTo(x0 - PAN_STEP, 0);

    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await parseXY())[1]).toBeCloseTo(y0 - PAN_STEP, 0);

    await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => (await parseXY())[0]).toBeCloseTo(x0, 0);

    await page.keyboard.press("ArrowUp");
    await expect.poll(async () => (await parseXY())[1]).toBeCloseTo(y0, 0);
  });

  test("Shift+arrow pans by a larger step", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await preview.waitFor({ state: "visible", timeout: 60_000 });
    const canvas = preview.locator("..");

    const readX = async (): Promise<number> => {
      const transform = await canvas.evaluate((el) => (el as HTMLElement).style.transform);
      const m = TRANSLATE_RE.exec(transform);
      if (!m) throw new Error(`unexpected transform: ${transform}`);
      return parseFloat(m[1]!);
    };

    const x0 = await readX();
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(readX).toBeCloseTo(x0 - 200, 0);
  });
});
