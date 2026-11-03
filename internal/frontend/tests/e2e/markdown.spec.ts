import { writeFile } from "node:fs/promises";
import { createMarkdownSource, expect, test } from "./fixtures/markdown";

test("previews a Markdown diagram through edits, removal, and restoration", async ({
  pumlv,
  markdownFile,
  request,
}) => {
  await test.step("waits for the Markdown file to be registered", async () => {
    // Registration is asynchronous and can precede the browser's SSE connection.
    await expect
      .poll(async () => {
        const response = await request.get("/api/files");
        const files: { name: string }[] = await response.json();
        return files.map(({ name }) => name);
      })
      .toContain(markdownFile.name);
  });

  await test.step("opens the Markdown file and previews its diagram", async () => {
    await pumlv.open();
    await pumlv.selectFile(markdownFile.name);
    await expect(pumlv.preview).toBeVisible();
    await expect(pumlv.preview).toHaveAttribute("src", /MarkdownInitial/);
  });

  await test.step("edits the diagram and sees the updated preview", async () => {
    await writeFile(markdownFile.path, createMarkdownSource("MarkdownUpdated"));
    await expect(pumlv.preview).toHaveAttribute("src", /MarkdownUpdated/);
    await expect(pumlv.preview).not.toHaveAttribute("src", /MarkdownInitial/);
  });

  await test.step("removes the diagram and sees the file disappear from the tree", async () => {
    await writeFile(markdownFile.path, "# No diagram\n");
    await expect(pumlv.getFileButton(markdownFile.name)).toHaveCount(0);
  });

  await test.step("adds a diagram again and previews the restored file", async () => {
    await writeFile(markdownFile.path, createMarkdownSource("MarkdownRestored"));
    await expect(pumlv.getFileButton(markdownFile.name)).toBeVisible();
    await pumlv.selectFile(markdownFile.name);
    await expect(pumlv.preview).toHaveAttribute("src", /MarkdownRestored/);
  });
});
