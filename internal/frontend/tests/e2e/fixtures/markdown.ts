import { test as base } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PumlvPage } from "../pages/pumlv-page";

export { expect } from "@playwright/test";

export const createMarkdownSource = (label: string) =>
  `# Markdown diagram\n\n~~~plantuml\nAlice -> Bob: ${label}\n~~~\n\nOrdinary prose.\n`;

type MarkdownFixtures = {
  pumlv: PumlvPage;
  markdownFile: { name: string; path: string };
};

export const test = base.extend<MarkdownFixtures>({
  pumlv: async ({ page }, use) => {
    await use(new PumlvPage(page));
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructuring fixture dependencies.
  markdownFile: async ({}, use) => {
    const name = `markdown-live-preview-${randomUUID()}.md`;
    const path = resolve("../../examples", name);
    await writeFile(path, createMarkdownSource("MarkdownInitial"));
    await use({ name, path });
    await rm(path, { force: true });
  },
});
