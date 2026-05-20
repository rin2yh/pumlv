import { describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";
import { LineRow } from "./line-row";
import { FOLD_LABEL, UNFOLD_LABEL } from "./source-fold";
import { setupRender } from "../../test/render";

const render = setupRender();

const tokens = [
  { content: "class A ", color: "#111" },
  { content: "{", color: "#222" },
];

const renderLine = (overrides: Partial<ComponentProps<typeof LineRow>> = {}): void => {
  render(
    <LineRow
      tokens={tokens}
      depth={0}
      isFoldStart={false}
      isFolded={false}
      onToggle={() => {}}
      {...overrides}
    />,
  );
};

describe("LineRow", () => {
  it("renders each token's content", () => {
    renderLine();
    expect(document.body.textContent).toContain("class A {");
  });

  it("applies the token color as an inline style", () => {
    renderLine();
    const colored = Array.from(document.querySelectorAll("span[style]"));
    expect(colored.some((s) => (s as HTMLElement).style.color === "rgb(17, 17, 17)")).toBe(true);
  });

  it("omits the gutter button when isFoldStart=false", () => {
    renderLine();
    expect(document.querySelector("button")).toBeNull();
  });

  it.each([
    { isFolded: false, label: FOLD_LABEL, chevron: "▼", expanded: "true" },
    { isFolded: true, label: UNFOLD_LABEL, chevron: "▶", expanded: "false" },
  ])(
    "renders the $label toggle with chevron '$chevron' when isFolded=$isFolded",
    ({ isFolded, label, chevron, expanded }) => {
      renderLine({ isFoldStart: true, isFolded });
      const button = document.querySelector(`button[aria-label="${label}"]`)!;
      expect(button).not.toBeNull();
      expect(button.getAttribute("aria-expanded")).toBe(expanded);
      expect(button.textContent).toContain(chevron);
    },
  );

  it("calls onToggle when the gutter button is clicked", () => {
    const onToggle = vi.fn();
    renderLine({ isFoldStart: true, onToggle });
    act(() => {
      document.querySelector<HTMLButtonElement>("button")!.click();
    });
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders the fold ellipsis only when isFolded=true", () => {
    renderLine({ isFoldStart: true });
    expect(document.body.textContent).not.toContain("…");

    renderLine({ isFoldStart: true, isFolded: true });
    expect(document.body.textContent).toContain("…");
  });

  it.each([
    { depth: 0, expected: "0px" },
    { depth: 1, expected: "12px" },
    { depth: 2, expected: "24px" },
  ])("applies paddingLeft $expected at depth $depth", ({ depth, expected }) => {
    renderLine({ depth, isFoldStart: true });
    const row = document.querySelector("button")!.closest("div") as HTMLElement;
    expect(row.style.paddingLeft).toBe(expected);
  });
});
