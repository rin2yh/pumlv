import { expect, test } from "@playwright/test";

test.describe("source folding", () => {
  test("folds and unfolds a brace block", async ({ page }) => {
    await page.goto("/");

    const preview = page.getByAltText("preview");
    await expect(preview).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "class.puml" }).click();
    await expect(preview).toBeVisible();

    const sourceRegion = page.getByRole("region", { name: "Source" });
    await expect(sourceRegion.getByText("+registry: Registry")).toBeVisible();

    const foldButtons = sourceRegion.getByRole("button", { name: "fold block" });
    await expect(foldButtons.first()).toBeVisible();
    const initialFolds = await foldButtons.count();
    expect(initialFolds).toBeGreaterThan(0);

    await foldButtons.first().click();

    await expect(sourceRegion.getByText("+registry: Registry")).toBeHidden();
    await expect(
      sourceRegion.getByRole("button", { name: "unfold block" }).first(),
    ).toBeVisible();

    await sourceRegion.getByRole("button", { name: "unfold block" }).first().click();
    await expect(sourceRegion.getByText("+registry: Registry")).toBeVisible();
  });
});
