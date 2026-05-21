import { describe, expect, it } from "vitest";
import { act } from "react";
import { FileTree } from ".";
import { flatFiles, nestedFiles } from "./test/fixtures";
import { setupRender } from "../../test/render";

const render = setupRender();

function dirButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")];
}

function fileButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>("button:not([aria-expanded])")];
}

function dirByTitle(title: string): HTMLButtonElement {
  const btn = dirButtons().find((b) => b.getAttribute("title") === title);
  if (!btn) {
    throw new Error(`directory toggle "${title}" not found`);
  }
  return btn;
}

describe("FileTree", () => {
  it("shows the empty state when no files are passed", () => {
    render(<FileTree files={[]} active={null} onSelect={() => {}} />);
    expect(document.body.textContent).toContain("no files found");
    expect(document.querySelector("nav")).toBeNull();
  });

  it.each([
    {
      name: "flat sources",
      files: flatFiles,
      dirs: ["/a", "/b"],
      fileLabels: ["x.puml", "y.puml", "z.puml"],
    },
    {
      name: "nested subdirectories",
      files: nestedFiles,
      dirs: ["/r", "sub", "deep"],
      fileLabels: ["b.puml", "a.puml", "top.puml"],
    },
  ])(
    "renders dir + file buttons with all groups expanded ($name)",
    ({ files, dirs, fileLabels }) => {
      render(<FileTree files={files} active={null} onSelect={() => {}} />);
      expect(dirButtons().map((b) => b.getAttribute("title"))).toEqual(dirs);
      expect(dirButtons().every((b) => b.getAttribute("aria-expanded") === "true")).toBe(true);
      expect(fileButtons().map((b) => b.textContent)).toEqual(fileLabels);
    },
  );

  it.each([
    {
      name: "source group collapse hides its files",
      files: flatFiles,
      toggle: "/a",
      remainingDirs: ["/a", "/b"],
      remainingFiles: ["z.puml"],
    },
    {
      name: "leaf subdirectory collapse hides only its own files",
      files: nestedFiles,
      toggle: "deep",
      remainingDirs: ["/r", "sub", "deep"],
      remainingFiles: ["a.puml", "top.puml"],
    },
    {
      name: "ancestor collapse hides descendant toggles",
      files: nestedFiles,
      toggle: "sub",
      remainingDirs: ["/r", "sub"],
      remainingFiles: ["top.puml"],
    },
    {
      name: "root collapse hides everything below it",
      files: nestedFiles,
      toggle: "/r",
      remainingDirs: ["/r"],
      remainingFiles: [],
    },
  ])("$name", ({ files, toggle, remainingDirs, remainingFiles }) => {
    render(<FileTree files={files} active={null} onSelect={() => {}} />);
    const target = dirByTitle(toggle);
    act(() => {
      target.click();
    });

    expect(target.getAttribute("aria-expanded")).toBe("false");
    expect(dirButtons().map((b) => b.getAttribute("title"))).toEqual(remainingDirs);
    expect(fileButtons().map((b) => b.textContent)).toEqual(remainingFiles);
  });

  it("re-clicking a collapsed toggle restores the original tree", () => {
    render(<FileTree files={flatFiles} active={null} onSelect={() => {}} />);
    const before = fileButtons().map((b) => b.textContent);

    const rootA = dirByTitle("/a");
    act(() => {
      rootA.click();
    });
    expect(rootA.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      rootA.click();
    });
    expect(rootA.getAttribute("aria-expanded")).toBe("true");
    expect(fileButtons().map((b) => b.textContent)).toEqual(before);
  });

  it("passes active down so the selected file gets the highlight", () => {
    render(<FileTree files={flatFiles} active="/a/y.puml" onSelect={() => {}} />);
    const selected = fileButtons().find((b) => b.textContent === "y.puml");
    expect(selected?.className).toMatch(/violet/);
  });
});
