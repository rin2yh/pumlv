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

describe("FileTree", () => {
  it("shows the empty state when no files are passed", () => {
    render(<FileTree files={[]} active={null} onSelect={() => {}} />);
    expect(container.textContent).toContain("no files found");
    expect(container.querySelector("nav")).toBeNull();
  });

  it("renders one group per source directory", () => {
    render(<FileTree files={sample} active={null} onSelect={() => {}} />);
    const groupHeaders = container.querySelectorAll("nav > div > p");
    const sources = [...groupHeaders].map((p) => p.textContent);
    expect(sources).toEqual(["/a", "/b"]);
  });

  it("renders one button per file with rel as the label", () => {
    render(<FileTree files={sample} active={null} onSelect={() => {}} />);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    expect([...buttons].map((b) => b.textContent)).toEqual(["x.puml", "y.puml", "z.puml"]);
  });

  it("highlights the active file", () => {
    render(<FileTree files={sample} active="/a/y.puml" onSelect={() => {}} />);
    const buttons = [...container.querySelectorAll("button")];
    const activeButton = buttons.find((b) => b.textContent === "y.puml");
    expect(activeButton?.className).toMatch(/violet/);

    const inactive = buttons.find((b) => b.textContent === "x.puml");
    expect(inactive?.className).not.toMatch(/violet/);
  });

  it("calls onSelect with the path of the clicked file", () => {
    const onSelect = vi.fn();
    render(<FileTree files={sample} active={null} onSelect={onSelect} />);

    const zButton = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "z.puml",
    );
    act(() => {
      zButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("/b/z.puml");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("uses the source path as the group header title attribute", () => {
    render(<FileTree files={sample} active={null} onSelect={() => {}} />);
    const headers = container.querySelectorAll("nav > div > p");
    expect(headers[0]!.getAttribute("title")).toBe("/a");
    expect(headers[1]!.getAttribute("title")).toBe("/b");
  });
});
