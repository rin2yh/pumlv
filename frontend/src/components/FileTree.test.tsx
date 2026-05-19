import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FileTree } from "./FileTree";
import type { FileEntry } from "../api/files";

let container: HTMLDivElement;
let root: Root;

function render(node: ReactElement): void {
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

function dirButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")];
}

function fileButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button:not([aria-expanded])")];
}

function dirByTitle(title: string): HTMLButtonElement {
  const btn = dirButtons().find((b) => b.getAttribute("title") === title);
  if (!btn) {
    throw new Error(`directory toggle "${title}" not found`);
  }
  return btn;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const flat: FileEntry[] = [
  { path: "/a/x.puml", rel: "x.puml", name: "x.puml", source: "/a" },
  { path: "/a/y.puml", rel: "y.puml", name: "y.puml", source: "/a" },
  { path: "/b/z.puml", rel: "z.puml", name: "z.puml", source: "/b" },
];

const nested: FileEntry[] = [
  { path: "/r/top.puml", rel: "top.puml", name: "top.puml", source: "/r" },
  { path: "/r/sub/a.puml", rel: "sub/a.puml", name: "a.puml", source: "/r" },
  { path: "/r/sub/deep/b.puml", rel: "sub/deep/b.puml", name: "b.puml", source: "/r" },
];

describe("FileTree", () => {
  it("shows the empty state when no files are passed", () => {
    render(<FileTree files={[]} active={null} onSelect={() => {}} />);
    expect(container.textContent).toContain("no files found");
    expect(container.querySelector("nav")).toBeNull();
  });

  it.each([
    {
      name: "flat sources",
      files: flat,
      dirs: ["/a", "/b"],
      fileLabels: ["x.puml", "y.puml", "z.puml"],
    },
    {
      name: "nested subdirectories",
      files: nested,
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

  it("highlights the active file", () => {
    render(<FileTree files={flat} active="/a/y.puml" onSelect={() => {}} />);
    const buttons = fileButtons();
    const activeButton = buttons.find((b) => b.textContent === "y.puml");
    expect(activeButton?.className).toMatch(/violet/);

    const inactive = buttons.find((b) => b.textContent === "x.puml");
    expect(inactive?.className).not.toMatch(/violet/);
  });

  it("calls onSelect with the path of the clicked file", () => {
    const onSelect = vi.fn();
    render(<FileTree files={flat} active={null} onSelect={onSelect} />);

    click(fileButtons().find((b) => b.textContent === "z.puml")!);

    expect(onSelect).toHaveBeenCalledWith("/b/z.puml");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "source group collapse hides its files",
      files: flat,
      toggle: "/a",
      remainingDirs: ["/a", "/b"],
      remainingFiles: ["z.puml"],
    },
    {
      name: "leaf subdirectory collapse hides only its own files",
      files: nested,
      toggle: "deep",
      remainingDirs: ["/r", "sub", "deep"],
      remainingFiles: ["a.puml", "top.puml"],
    },
    {
      name: "ancestor collapse hides descendant toggles",
      files: nested,
      toggle: "sub",
      remainingDirs: ["/r", "sub"],
      remainingFiles: ["top.puml"],
    },
    {
      name: "root collapse hides everything below it",
      files: nested,
      toggle: "/r",
      remainingDirs: ["/r"],
      remainingFiles: [],
    },
  ])("$name", ({ files, toggle, remainingDirs, remainingFiles }) => {
    render(<FileTree files={files} active={null} onSelect={() => {}} />);

    const target = dirByTitle(toggle);
    click(target);

    expect(target.getAttribute("aria-expanded")).toBe("false");
    expect(dirButtons().map((b) => b.getAttribute("title"))).toEqual(remainingDirs);
    expect(fileButtons().map((b) => b.textContent)).toEqual(remainingFiles);
  });

  it("re-clicking a collapsed toggle restores the original tree", () => {
    render(<FileTree files={flat} active={null} onSelect={() => {}} />);
    const before = fileButtons().map((b) => b.textContent);

    const rootA = dirByTitle("/a");
    click(rootA);
    expect(rootA.getAttribute("aria-expanded")).toBe("false");

    click(rootA);
    expect(rootA.getAttribute("aria-expanded")).toBe("true");
    expect(fileButtons().map((b) => b.textContent)).toEqual(before);
  });
});
