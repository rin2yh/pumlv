import { expect, test, type Page } from "@playwright/test";
import {
  SOURCE_TOGGLE_LABEL,
  type SourceToggleLabel,
} from "../../src/components/sourcePanel";

const scenarios: Array<{
  name: string;
  clicks: number;
  expectedButton: SourceToggleLabel;
  expectedPanel: "visible" | "hidden";
}> = [
  {
    name: "shows the source panel by default",
    clicks: 0,
    expectedButton: SOURCE_TOGGLE_LABEL.open,
    expectedPanel: "visible",
  },
  {
    name: "hides the source panel after one toggle",
    clicks: 1,
    expectedButton: SOURCE_TOGGLE_LABEL.closed,
    expectedPanel: "hidden",
  },
  {
    name: "re-shows the source panel after toggling back",
    clicks: 2,
    expectedButton: SOURCE_TOGGLE_LABEL.open,
    expectedPanel: "visible",
  },
];

async function clickToggle(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    const label: SourceToggleLabel =
      i % 2 === 0 ? SOURCE_TOGGLE_LABEL.open : SOURCE_TOGGLE_LABEL.closed;
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
