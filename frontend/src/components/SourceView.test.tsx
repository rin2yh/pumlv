import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

let codeToHtmlMock: ReturnType<typeof vi.fn>;

vi.mock("shiki/core", () => ({
  createHighlighterCore: vi.fn(async () => ({
    codeToHtml: codeToHtmlMock,
  })),
}));

vi.mock("shiki/engine/oniguruma", () => ({
  createOnigurumaEngine: vi.fn(async () => ({})),
}));

vi.mock("shiki/themes/github-light.mjs", () => ({ default: {} }));
vi.mock("shiki/langs/yaml.mjs", () => ({ default: {} }));
vi.mock("shiki/wasm", () => ({ default: new ArrayBuffer(0) }));

let container: HTMLDivElement;
let root: Root;

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderSync(node: ReactElement): void {
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

beforeEach(() => {
  codeToHtmlMock = vi.fn(() => "<pre class='shiki'>highlighted</pre>");
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.resetModules();
});

describe("SourceView", () => {
  it("shows 'no source' for an empty string", async () => {
    const { SourceView } = await import("./SourceView");
    renderSync(<SourceView source="" />);
    expect(container.textContent).toContain("no source");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("renders the highlighter output for a non-empty source", async () => {
    const { SourceView } = await import("./SourceView");
    renderSync(<SourceView source={"@startuml\n@enduml\n"} />);
    await flushAsync();

    expect(codeToHtmlMock).toHaveBeenCalledWith("@startuml\n@enduml\n", {
      lang: "yaml",
      theme: "github-light",
    });
    expect(container.innerHTML).toContain("highlighted");
  });

  it("falls back to escaped <pre> when the highlighter throws", async () => {
    codeToHtmlMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const { SourceView } = await import("./SourceView");
    renderSync(<SourceView source={"<script>alert(1)</script>"} />);
    await flushAsync();

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.innerHTML).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes & < > characters in the fallback", async () => {
    codeToHtmlMock.mockImplementation(() => {
      throw new Error("nope");
    });
    const { SourceView } = await import("./SourceView");
    renderSync(<SourceView source="a & b < c > d" />);
    await flushAsync();

    const pre = container.querySelector("pre");
    expect(pre!.innerHTML).toBe("a &amp; b &lt; c &gt; d");
  });

  it("clears highlighted html when source becomes empty", async () => {
    const { SourceView } = await import("./SourceView");
    renderSync(<SourceView source="hello" />);
    await flushAsync();
    expect(container.innerHTML).toContain("highlighted");

    act(() => {
      root.render(<SourceView source="" />);
    });
    expect(container.textContent).toContain("no source");
  });
});
