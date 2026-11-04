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

test("selects every Markdown diagram and follows edits, additions, and deletions", async ({
  pumlv,
  markdownFile,
  request,
}) => {
  const block = (title: string, label: string) =>
    `~~~puml\n${title ? `title ${title}\n` : ""}Alice -> Bob: ${label}\n~~~\n`;
  const first = block("First", "MultiFirst");
  const second = block("", "MultiSecond");
  const third = block("Third", "MultiThird");

  await test.step("registers a Markdown file containing two diagrams", async () => {
    await writeFile(markdownFile.path, first + "\n" + second);
    await expect
      .poll(async () => {
        const files = await (await request.get("/api/files")).json();
        return files.find((f: { name: string }) => f.name === markdownFile.name)?.diagrams?.length;
      })
      .toBe(2);
  });

  await test.step("opens the Markdown file and lists both diagrams", async () => {
    await pumlv.open();
    await pumlv.selectFile(markdownFile.name);
    await expect(pumlv.getFileButton("L1: First")).toBeVisible();
    await expect(pumlv.getFileButton("L6")).toBeVisible();
  });

  await test.step("selects each diagram and previews it individually", async () => {
    await pumlv.selectFile("L1: First");
    await expect(pumlv.preview).toHaveAttribute("src", /MultiFirst/);
    await pumlv.selectFile("L6");
    await expect(pumlv.preview).toHaveAttribute("src", /MultiSecond/);
  });

  await test.step("edits the selected diagram and updates its label and preview", async () => {
    await writeFile(markdownFile.path, first + "\n" + block("Updated", "MultiUpdated"));
    await expect(pumlv.getFileButton("L6: Updated")).toBeVisible();
    await expect(pumlv.getFileButton("L6")).toHaveCount(0);
    await expect(pumlv.preview).toHaveAttribute("src", /MultiUpdated/);
  });

  await test.step("adds a third diagram and previews it", async () => {
    await writeFile(
      markdownFile.path,
      first + "\n" + block("Updated", "MultiUpdated") + "\n" + third,
    );
    await pumlv.selectFile("L11: Third");
    await expect(pumlv.preview).toHaveAttribute("src", /MultiThird/);
  });

  await test.step("removes the selected diagram and falls back to the first diagram", async () => {
    await writeFile(markdownFile.path, first + "\n" + second);
    await expect(pumlv.getFileButton("L11: Third")).toHaveCount(0);
    await expect(pumlv.preview).toHaveAttribute("src", /MultiFirst/);
  });

  await test.step("removes the earlier block and updates the remaining diagram's line and preview", async () => {
    await writeFile(markdownFile.path, second);
    await expect(pumlv.getFileButton("L6")).toHaveCount(0);
    await expect(pumlv.getFileButton("L1")).toBeVisible();
    await expect(pumlv.preview).toHaveAttribute("src", /MultiSecond/);
  });
});
