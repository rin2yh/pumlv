import { expect, test, type Page } from "@playwright/test";

type Label = "hide source" | "show source";

const scenarios: Array<{
  name: string;
  clicks: number;
  expectedButton: Label;
  expectedPanel: "visible" | "hidden";
}> = [
  {
    name: "shows the source panel by default",
    clicks: 0,
    expectedButton: "hide source",
    expectedPanel: "visible",
  },
  {
    name: "hides the source panel after one toggle",
    clicks: 1,
    expectedButton: "show source",
    expectedPanel: "hidden",
  },
  {
    name: "re-shows the source panel after toggling back",
    clicks: 2,
    expectedButton: "hide source",
    expectedPanel: "visible",
  },
];

async function clickToggle(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const label: Label = i % 2 === 0 ? "hide source" : "show source";
    await page.getByRole("button", { name: label }).click();
  }
}

test.describe("source panel toggle", () => {
  for (const { name, clicks, expectedButton, expectedPanel } of scenarios) {
    test(name, async ({ page }) => {
      await page.goto("/");

      const preview = page.getByAltText("preview");
      await expect(preview).toBeVisible({ timeout: 60_000 });

      await clickToggle(page, clicks);

      await expect(page.getByRole("button", { name: expectedButton })).toBeVisible();

      const sourcePanel = page.locator("main > div > section").nth(1);
      if (expectedPanel === "visible") {
        await expect(sourcePanel).toBeVisible();
      } else {
        await expect(sourcePanel).toBeHidden();
      }

      await expect(preview).toBeVisible();
      const src = await preview.getAttribute("src");
      expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    });
  }
});
