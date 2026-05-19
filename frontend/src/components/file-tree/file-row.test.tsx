import { describe, expect, it, vi } from "vitest";
import { FileRow } from "./file-row";
import type { FileEntry } from "../../api/files";
import { setupRender } from "../../test/render";

const view = setupRender(FileRow);

function button(): HTMLButtonElement {
  const b = view.container.querySelector("button");
  if (!b) throw new Error("FileRow button not found");
  return b;
}

const entry: FileEntry = {
  path: "/a/x.puml",
  rel: "x.puml",
  name: "x.puml",
  source: "/a",
};

describe("FileRow", () => {
  it("shows the file's basename as the label and rel as the title", () => {
    view.render({ entry, depth: 1, isSelected: false, onSelect: () => {} });
    expect(button().textContent).toBe("x.puml");
    expect(button().getAttribute("title")).toBe("x.puml");
  });

  it("applies the active highlight when isSelected is true", () => {
    view.render({ entry, depth: 1, isSelected: true, onSelect: () => {} });
    expect(button().className).toMatch(/violet/);
  });

  it("uses the inactive style when isSelected is false", () => {
    view.render({ entry, depth: 1, isSelected: false, onSelect: () => {} });
    expect(button().className).not.toMatch(/violet/);
  });

  it("calls onSelect with the file's absolute path when clicked", () => {
    const onSelect = vi.fn();
    view.render({ entry, depth: 1, isSelected: false, onSelect });
    view.click(button());
    expect(onSelect).toHaveBeenCalledWith("/a/x.puml");
  });
});
