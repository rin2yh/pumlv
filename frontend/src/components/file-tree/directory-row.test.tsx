import { describe, expect, it, vi } from "vitest";
import { DirectoryRow } from "./directory-row";
import type { DirNode } from "./tree";
import { setupRender } from "../../test/render";

const view = setupRender(DirectoryRow);

function button(): HTMLButtonElement {
  const b = view.container.querySelector("button");
  if (!b) throw new Error("DirectoryRow button not found");
  return b;
}

const dir: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };

describe("DirectoryRow", () => {
  it("renders a down chevron with aria-expanded=true when expanded", () => {
    view.render({ node: dir, depth: 1, isExpanded: true, onToggle: () => {} });
    const b = button();
    expect(b.getAttribute("aria-expanded")).toBe("true");
    expect(b.textContent).toContain("▾");
  });

  it("renders a right chevron with aria-expanded=false when collapsed", () => {
    view.render({ node: dir, depth: 1, isExpanded: false, onToggle: () => {} });
    const b = button();
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.textContent).toContain("▸");
  });

  it("calls onToggle with the node key when clicked", () => {
    const onToggle = vi.fn();
    view.render({ node: dir, depth: 1, isExpanded: true, onToggle });
    view.click(button());
    expect(onToggle).toHaveBeenCalledWith("/r/sub");
  });

  it("uses smaller text for source-root rows (depth 0) than nested directories", () => {
    view.render({ node: dir, depth: 0, isExpanded: true, onToggle: () => {} });
    const rootClass = button().className;
    expect(rootClass).toContain("text-xs");

    view.render({ node: dir, depth: 1, isExpanded: true, onToggle: () => {} });
    expect(button().className).toContain("text-sm");
  });
});
