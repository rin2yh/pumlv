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

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function dirButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")];
}

function fileButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button:not([aria-expanded])")];
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

const sample: FileEntry[] = [
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

  it("renders one root toggle per source directory", () => {
    render(<FileTree files={sample} active={null} onSelect={() => {}} />);
    const roots = [...container.querySelectorAll("nav > div > button[aria-expanded]")];
    expect(roots.map((b) => b.getAttribute("title"))).toEqual(["/a", "/b"]);
  });

  it("renders one file button per file with the basename as label", () => {
    render(<FileTree files={sample} active={null} onSelect={() => {}} />);
    const buttons = fileButtons();
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.textContent)).toEqual(["x.puml", "y.puml", "z.puml"]);
  });

  it("highlights the active file", () => {
    render(<FileTree files={sample} active="/a/y.puml" onSelect={() => {}} />);
    const buttons = fileButtons();
    const activeButton = buttons.find((b) => b.textContent === "y.puml");
    expect(activeButton?.className).toMatch(/violet/);

    const inactive = buttons.find((b) => b.textContent === "x.puml");
    expect(inactive?.className).not.toMatch(/violet/);
  });

  it("calls onSelect with the path of the clicked file", () => {
    const onSelect = vi.fn();
    render(<FileTree files={sample} active={null} onSelect={onSelect} />);

    const zButton = fileButtons().find((b) => b.textContent === "z.puml");
    click(zButton!);

    expect(onSelect).toHaveBeenCalledWith("/b/z.puml");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("expands all directories by default", () => {
    render(<FileTree files={nested} active={null} onSelect={() => {}} />);
    const dirs = dirButtons();
    for (const d of dirs) {
      expect(d.getAttribute("aria-expanded")).toBe("true");
    }
    expect(fileButtons()).toHaveLength(3);
  });

  it("renders a toggle for each nested subdirectory", () => {
    render(<FileTree files={nested} active={null} onSelect={() => {}} />);
    const names = dirButtons().map((b) => b.getAttribute("title"));
    expect(names).toEqual(["/r", "sub", "deep"]);
  });

  it("collapses a source group when its header is clicked", () => {
    render(<FileTree files={sample} active={null} onSelect={() => {}} />);
    expect(fileButtons()).toHaveLength(3);

    const rootA = dirButtons().find((b) => b.getAttribute("title") === "/a")!;
    click(rootA);

    expect(rootA.getAttribute("aria-expanded")).toBe("false");
    const remaining = fileButtons().map((b) => b.textContent);
    expect(remaining).toEqual(["z.puml"]);

    click(rootA);
    expect(rootA.getAttribute("aria-expanded")).toBe("true");
    expect(fileButtons()).toHaveLength(3);
  });

  it("collapses only the targeted subdirectory in a nested tree", () => {
    render(<FileTree files={nested} active={null} onSelect={() => {}} />);
    const deep = dirButtons().find((b) => b.getAttribute("title") === "deep")!;
    click(deep);

    expect(deep.getAttribute("aria-expanded")).toBe("false");
    const visible = fileButtons().map((b) => b.textContent);
    expect(visible).toEqual(["a.puml", "top.puml"]);
    expect(visible).not.toContain("b.puml");

    const sub = dirButtons().find((b) => b.getAttribute("title") === "sub")!;
    expect(sub.getAttribute("aria-expanded")).toBe("true");
    const r = dirButtons().find((b) => b.getAttribute("title") === "/r")!;
    expect(r.getAttribute("aria-expanded")).toBe("true");
  });

  it("hides a subdirectory's toggle when its ancestor is collapsed", () => {
    render(<FileTree files={nested} active={null} onSelect={() => {}} />);
    const sub = dirButtons().find((b) => b.getAttribute("title") === "sub")!;
    click(sub);

    const visibleDirs = dirButtons().map((b) => b.getAttribute("title"));
    expect(visibleDirs).toEqual(["/r", "sub"]);
    expect(fileButtons().map((b) => b.textContent)).toEqual(["top.puml"]);
  });
});
