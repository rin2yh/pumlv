import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { LineRow } from "./line-row";
import { FOLD_LABEL, UNFOLD_LABEL } from "./source-fold";
import { setupRender } from "../../test/render";

const render = setupRender();

const tokens = [
  { content: "class A ", color: "#111" },
  { content: "{", color: "#222" },
];

describe("LineRow", () => {
  it("renders each token's content", () => {
    render(<LineRow tokens={tokens} isFoldStart={false} isFolded={false} onToggle={() => {}} />);
    expect(document.body.textContent).toContain("class A {");
  });

  it("applies the token color as an inline style", () => {
    render(<LineRow tokens={tokens} isFoldStart={false} isFolded={false} onToggle={() => {}} />);
    const colored = Array.from(document.querySelectorAll("span[style]"));
    expect(colored.some((s) => (s as HTMLElement).style.color === "rgb(17, 17, 17)")).toBe(true);
  });

  it("omits the gutter button when isFoldStart=false", () => {
    render(<LineRow tokens={tokens} isFoldStart={false} isFolded={false} onToggle={() => {}} />);
    expect(document.querySelector("button")).toBeNull();
  });

  it.each([
    { isFolded: false, label: FOLD_LABEL, chevron: "▼", expanded: "true" },
    { isFolded: true, label: UNFOLD_LABEL, chevron: "▶", expanded: "false" },
  ])(
    "renders the $label toggle with chevron '$chevron' when isFolded=$isFolded",
    ({ isFolded, label, chevron, expanded }) => {
      render(<LineRow tokens={tokens} isFoldStart isFolded={isFolded} onToggle={() => {}} />);
      const button = document.querySelector(`button[aria-label="${label}"]`)!;
      expect(button).not.toBeNull();
      expect(button.getAttribute("aria-expanded")).toBe(expanded);
      expect(button.textContent).toContain(chevron);
    },
  );

  it("calls onToggle when the gutter button is clicked", () => {
    const onToggle = vi.fn();
    render(<LineRow tokens={tokens} isFoldStart isFolded={false} onToggle={onToggle} />);
    act(() => {
      document.querySelector<HTMLButtonElement>("button")!.click();
    });
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders the fold ellipsis only when isFolded=true", () => {
    render(<LineRow tokens={tokens} isFoldStart isFolded={false} onToggle={() => {}} />);
    expect(document.body.textContent).not.toContain("…");

    render(<LineRow tokens={tokens} isFoldStart isFolded onToggle={() => {}} />);
    expect(document.body.textContent).toContain("…");
  });
});
