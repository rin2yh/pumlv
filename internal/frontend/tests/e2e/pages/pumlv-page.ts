import type { Locator, Page } from "@playwright/test";

export class PumlvPage {
  readonly preview: Locator;

  constructor(private readonly page: Page) {
    this.preview = page.getByAltText("preview");
  }

  async open() {
    await this.page.goto("/");
  }

  getFileButton(name: string): Locator {
    return this.page.getByRole("navigation").getByRole("button", { name, exact: true });
  }

  async selectFile(name: string) {
    await this.getFileButton(name).click();
  }
}
