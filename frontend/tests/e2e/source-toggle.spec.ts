import { expect, test } from "@playwright/test";

test.describe("source panel toggle", () => {
  test("hides and shows the source panel via the header button", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 60_000 });

    const toggle = page.getByRole("button", { name: "hide source" });
    const sourcePanel = page.locator("main > div > section").nth(1);
    await expect(sourcePanel).toBeVisible();

    await toggle.click();
    await expect(page.getByRole("button", { name: "show source" })).toBeVisible();
    await expect(sourcePanel).toBeHidden();

    await expect(preview).toBeVisible();
    const src = await preview.getAttribute("src");
    expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

    await page.getByRole("button", { name: "show source" }).click();
    await expect(toggle).toBeVisible();
    await expect(sourcePanel).toBeVisible();
  });
});
