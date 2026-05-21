import { expect, test, type Page } from "@playwright/test";
import {
  SOURCE_PANEL_NAME,
  SOURCE_TOGGLE_LABEL,
  type SourceToggleLabel,
} from "../../src/source-panel";

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TOGGLE_NAME_PATTERN = new RegExp(
  `^(?:${escapeRegExp(SOURCE_TOGGLE_LABEL.open)}|${escapeRegExp(SOURCE_TOGGLE_LABEL.closed)})$`,
);

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
  const toggle = page.getByRole("button", { name: TOGGLE_NAME_PATTERN });
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

      await expect(page.getByRole("button", { name: expectedLabel })).toBeVisible();

      const sourcePanel = page.getByRole("region", {
        name: SOURCE_PANEL_NAME,
        includeHidden: true,
      });
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
