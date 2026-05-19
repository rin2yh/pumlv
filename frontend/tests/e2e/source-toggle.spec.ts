import { expect, test, type Page } from "@playwright/test";
import { SOURCE_TOGGLE_LABEL, type SourceToggleLabel } from "../../src/sourcePanel";

const scenarios: Array<{
  name: string;
  clicks: number;
  expectedLabel: SourceToggleLabel;
  expectedPanel: "visible" | "hidden";
}> = [
  {
    name: "shows the source panel by default",
    clicks: 0,
    expectedLabel: SOURCE_TOGGLE_LABEL.open,
    expectedPanel: "visible",
  },
  {
    name: "hides the source panel after one toggle",
    clicks: 1,
    expectedLabel: SOURCE_TOGGLE_LABEL.closed,
    expectedPanel: "hidden",
  },
  {
    name: "re-shows the source panel after toggling back",
    clicks: 2,
    expectedLabel: SOURCE_TOGGLE_LABEL.open,
    expectedPanel: "visible",
  },
];

async function clickToggle(page: Page, times: number): Promise<void> {
  const toggle = page.getByTestId("source-toggle");
  for (let i = 0; i < times; i++) {
    await toggle.click();
  }
}

test.describe("source panel toggle", () => {
  for (const { name, clicks, expectedLabel, expectedPanel } of scenarios) {
    test(name, async ({ page }) => {
      await page.goto("/");

      const preview = page.getByAltText("preview");
      await expect(preview).toBeVisible({ timeout: 60_000 });

      await clickToggle(page, clicks);

      await expect(page.getByTestId("source-toggle")).toHaveText(expectedLabel);

      const sourcePanel = page.getByTestId("source-panel");
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
