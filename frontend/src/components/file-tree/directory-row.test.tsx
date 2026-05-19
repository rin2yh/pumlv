import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DirectoryRow } from "./directory-row";
import type { DirNode } from "./tree";

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
  if (!b) throw new Error("DirectoryRow button not found");
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

const dir: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };

describe("DirectoryRow", () => {
  it("renders a down chevron with aria-expanded=true when expanded", () => {
    render(<DirectoryRow node={dir} depth={1} isExpanded onToggle={() => {}} />);
    const b = button();
    expect(b.getAttribute("aria-expanded")).toBe("true");
    expect(b.textContent).toContain("▾");
  });

  it("renders a right chevron with aria-expanded=false when collapsed", () => {
    render(<DirectoryRow node={dir} depth={1} isExpanded={false} onToggle={() => {}} />);
    const b = button();
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.textContent).toContain("▸");
  });

  it("calls onToggle with the node key when clicked", () => {
    const onToggle = vi.fn();
    render(<DirectoryRow node={dir} depth={1} isExpanded onToggle={onToggle} />);
    act(() => {
      button().click();
    });
    expect(onToggle).toHaveBeenCalledWith("/r/sub");
  });

  it("uses smaller text for source-root rows (depth 0) than nested directories", () => {
    render(<DirectoryRow node={dir} depth={0} isExpanded onToggle={() => {}} />);
    const rootClass = button().className;
    expect(rootClass).toContain("text-xs");

    act(() => {
      root.render(<DirectoryRow node={dir} depth={1} isExpanded onToggle={() => {}} />);
    });
    expect(button().className).toContain("text-sm");
  });
});
