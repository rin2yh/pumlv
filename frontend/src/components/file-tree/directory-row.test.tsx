import { describe, expect, it, vi } from "vitest";
import { DirectoryRow } from "./directory-row";
import type { DirNode } from "./tree";
import { setupRenderHarness } from "../../test/harness";

const harness = setupRenderHarness();

function button(): HTMLButtonElement {
  const b = harness.container.querySelector("button");
  if (!b) throw new Error("DirectoryRow button not found");
  return b;
}

const dir: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };

describe("DirectoryRow", () => {
  it("renders a down chevron with aria-expanded=true when expanded", () => {
    harness.render(<DirectoryRow node={dir} depth={1} isExpanded onToggle={() => {}} />);
    const b = button();
    expect(b.getAttribute("aria-expanded")).toBe("true");
    expect(b.textContent).toContain("▾");
  });

  it("renders a right chevron with aria-expanded=false when collapsed", () => {
    harness.render(<DirectoryRow node={dir} depth={1} isExpanded={false} onToggle={() => {}} />);
    const b = button();
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.textContent).toContain("▸");
  });

  it("calls onToggle with the node key when clicked", () => {
    const onToggle = vi.fn();
    harness.render(<DirectoryRow node={dir} depth={1} isExpanded onToggle={onToggle} />);
    harness.click(button());
    expect(onToggle).toHaveBeenCalledWith("/r/sub");
  });

  it("uses smaller text for source-root rows (depth 0) than nested directories", () => {
    harness.render(<DirectoryRow node={dir} depth={0} isExpanded onToggle={() => {}} />);
    const rootClass = button().className;
    expect(rootClass).toContain("text-xs");

    harness.render(<DirectoryRow node={dir} depth={1} isExpanded onToggle={() => {}} />);
    expect(button().className).toContain("text-sm");
  });
});
