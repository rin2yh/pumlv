import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { setupRender } from "../../test/render";
import { FOLD_LABEL, UNFOLD_LABEL } from "./source-fold";
import type { ShikiToken } from "./highlighter";

let codeToTokensMock: ReturnType<typeof vi.fn>;

vi.mock("shiki/core", () => ({
  createHighlighterCore: vi.fn(async () => ({
    codeToTokens: codeToTokensMock,
  })),
}));

vi.mock("shiki/engine/oniguruma", () => ({
  createOnigurumaEngine: vi.fn(async () => ({})),
}));

vi.mock("shiki/themes/github-light.mjs", () => ({ default: {} }));
vi.mock("shiki/langs/yaml.mjs", () => ({ default: {} }));
vi.mock("shiki/wasm", () => ({ default: new ArrayBuffer(0) }));

const render = setupRender();

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function tokenize(source: string): { tokens: ShikiToken[][]; fg: string; bg: string } {
  return {
    tokens: source.split(/\r?\n/).map((line) => [{ content: line, color: "#222" }]),
    fg: "#222",
    bg: "#fff",
  };
}

function findFoldToggle(): HTMLButtonElement {
  return document.querySelector(
    `button[aria-label="${FOLD_LABEL}"], button[aria-label="${UNFOLD_LABEL}"]`,
  ) as HTMLButtonElement;
}

beforeEach(() => {
  codeToTokensMock = vi.fn((source: string) => tokenize(source));
});

afterEach(() => {
  vi.resetModules();
});

describe("SourceView", () => {
  it("shows 'no source' for an empty string", async () => {
    const { SourceView } = await import("./index");
    render(<SourceView source="" />);
    expect(document.body.textContent).toContain("no source");
    expect(document.querySelector("pre")).toBeNull();
  });

  it("renders one line per source line via the highlighter", async () => {
    const { SourceView } = await import("./index");
    render(<SourceView source={"@startuml\n@enduml\n"} />);
    await flushAsync();

    expect(codeToTokensMock).toHaveBeenCalledWith("@startuml\n@enduml\n", {
      lang: "yaml",
      theme: "github-light",
    });
    expect(document.body.textContent).toContain("@startuml");
    expect(document.body.textContent).toContain("@enduml");
  });

  it("falls back to a plain <pre> when the highlighter throws", async () => {
    codeToTokensMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const { SourceView } = await import("./index");
    render(<SourceView source={"<script>alert(1)</script>"} />);
    await flushAsync();

    const pre = document.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe("<script>alert(1)</script>");
    // React must have escaped the content; raw HTML must not be injected.
    expect(pre!.querySelector("script")).toBeNull();
  });

  it("clears highlighted output when source becomes empty", async () => {
    const { SourceView } = await import("./index");
    render(<SourceView source="hello" />);
    await flushAsync();
    expect(document.body.textContent).toContain("hello");

    render(<SourceView source="" />);
    expect(document.body.textContent).toContain("no source");
  });

  describe("folding", () => {
    const source = ["class A {", "  field1", "  field2", "}", "class B"].join("\n");

    it("renders a fold toggle on the opening brace line", async () => {
      const { SourceView } = await import("./index");
      render(<SourceView source={source} />);
      await flushAsync();

      const buttons = document.querySelectorAll(`button[aria-label="${FOLD_LABEL}"]`);
      expect(buttons.length).toBe(1);
      expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    });

    it("hides the block body after clicking the toggle", async () => {
      const { SourceView } = await import("./index");
      render(<SourceView source={source} />);
      await flushAsync();

      const button = document.querySelector(
        `button[aria-label="${FOLD_LABEL}"]`,
      ) as HTMLButtonElement;
      expect(button).not.toBeNull();

      act(() => {
        button.click();
      });

      expect(document.body.textContent).not.toContain("field1");
      expect(document.body.textContent).not.toContain("field2");
      expect(document.body.textContent).toContain("class A {");
      expect(document.body.textContent).toContain("class B");

      const unfoldBtn = document.querySelector(
        `button[aria-label="${UNFOLD_LABEL}"]`,
      ) as HTMLButtonElement;
      expect(unfoldBtn).not.toBeNull();
      expect(unfoldBtn.getAttribute("aria-expanded")).toBe("false");
    });

    it("re-shows the block body after toggling back", async () => {
      const { SourceView } = await import("./index");
      render(<SourceView source={source} />);
      await flushAsync();

      act(() => findFoldToggle().click());
      act(() => findFoldToggle().click());

      expect(document.body.textContent).toContain("field1");
      expect(document.body.textContent).toContain("field2");
    });

    it("does not show a fold toggle on lines without a brace block", async () => {
      const { SourceView } = await import("./index");
      render(<SourceView source={"@startuml\nactor User\n@enduml\n"} />);
      await flushAsync();

      expect(document.querySelector(`button[aria-label="${FOLD_LABEL}"]`)).toBeNull();
    });
  });
});
