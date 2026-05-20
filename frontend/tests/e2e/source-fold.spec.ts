import { expect, test } from "@playwright/test";
import { FOLD_LABEL, UNFOLD_LABEL } from "../../src/components/source-view/source-fold";

test.describe("source folding", () => {
  test("folds and unfolds a brace block", async ({ page }) => {
    const preview = page.getByAltText("preview");
    const sourceRegion = page.getByRole("region", { name: "Source" });
    const fieldRow = sourceRegion.getByText("+registry: Registry");
    const foldToggle = sourceRegion.getByRole("button", { name: FOLD_LABEL }).first();
    const unfoldToggle = sourceRegion.getByRole("button", { name: UNFOLD_LABEL }).first();

    await test.step("open class.puml and wait for the preview to render", async () => {
      await page.goto("/");
      await expect(preview).toBeVisible({ timeout: 60_000 });
      await page.getByRole("button", { name: "class.puml" }).click();
      await expect(preview).toBeVisible();
      await expect(fieldRow).toBeVisible();
    });

    await test.step("source panel shows at least one fold toggle", async () => {
      await expect(foldToggle).toBeVisible();
      expect(await sourceRegion.getByRole("button", { name: FOLD_LABEL }).count()).toBeGreaterThan(
        0,
      );
    });

    await test.step("clicking the toggle hides the block body", async () => {
      await foldToggle.click();
      await expect(fieldRow).toBeHidden();
      await expect(unfoldToggle).toBeVisible();
    });

    await test.step("clicking again restores the block body", async () => {
      await unfoldToggle.click();
      await expect(fieldRow).toBeVisible();
    });
  });
});
