import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FileRow } from "./file-row";
import type { FileEntry } from "../../api/files";

let container: HTMLDivElement;
let root: Root;

function render(node: ReactElement): void {
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

function button(): HTMLButtonElement {
  const b = container.querySelector("button");
  if (!b) throw new Error("FileRow button not found");
  return b;
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

const entry: FileEntry = {
  path: "/a/x.puml",
  rel: "x.puml",
  name: "x.puml",
  source: "/a",
};

describe("FileRow", () => {
  it("shows the file's basename as the label and rel as the title", () => {
    render(<FileRow entry={entry} depth={1} isSelected={false} onSelect={() => {}} />);
    expect(button().textContent).toBe("x.puml");
    expect(button().getAttribute("title")).toBe("x.puml");
  });

  it("applies the active highlight when isSelected is true", () => {
    render(<FileRow entry={entry} depth={1} isSelected onSelect={() => {}} />);
    expect(button().className).toMatch(/violet/);
  });

  it("uses the inactive style when isSelected is false", () => {
    render(<FileRow entry={entry} depth={1} isSelected={false} onSelect={() => {}} />);
    expect(button().className).not.toMatch(/violet/);
  });

  it("calls onSelect with the file's absolute path when clicked", () => {
    const onSelect = vi.fn();
    render(<FileRow entry={entry} depth={1} isSelected={false} onSelect={onSelect} />);
    act(() => {
      button().click();
    });
    expect(onSelect).toHaveBeenCalledWith("/a/x.puml");
  });
});
