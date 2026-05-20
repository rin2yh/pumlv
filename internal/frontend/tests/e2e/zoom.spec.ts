import { expect, test } from "@playwright/test";

test.describe("Zoom controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText("preview")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel("Zoom level")).toHaveValue("100");
  });

  test("typing a percentage into the zoom input zooms to that scale", async ({ page }) => {
    const zoomInput = page.getByLabel("Zoom level");

    await zoomInput.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("200");
    await page.keyboard.press("Enter");

    await expect(zoomInput).toHaveValue("200");
  });

  test("Escape reverts the draft without changing zoom", async ({ page }) => {
    const zoomInput = page.getByLabel("Zoom level");

    await zoomInput.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("400");
    await page.keyboard.press("Escape");

    await expect(zoomInput).toHaveValue("100");
  });

  test("invalid input is ignored and display stays at the current scale", async ({ page }) => {
    const zoomInput = page.getByLabel("Zoom level");

    await zoomInput.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("abc");
    await page.keyboard.press("Enter");

    await expect(zoomInput).toHaveValue("100");
  });
});
