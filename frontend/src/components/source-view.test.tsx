import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { setupRenderHarness } from "../test/harness";

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

const harness = setupRenderHarness();

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  codeToHtmlMock = vi.fn(() => "<pre class='shiki'>highlighted</pre>");
});

afterEach(() => {
  vi.resetModules();
});

describe("SourceView", () => {
  it("shows 'no source' for an empty string", async () => {
    const { SourceView } = await import("./source-view");
    harness.render(<SourceView source="" />);
    expect(harness.container.textContent).toContain("no source");
    expect(harness.container.querySelector("pre")).toBeNull();
  });

  it("renders the highlighter output for a non-empty source", async () => {
    const { SourceView } = await import("./source-view");
    harness.render(<SourceView source={"@startuml\n@enduml\n"} />);
    await flushAsync();

    expect(codeToHtmlMock).toHaveBeenCalledWith("@startuml\n@enduml\n", {
      lang: "yaml",
      theme: "github-light",
    });
    expect(harness.container.innerHTML).toContain("highlighted");
  });

  it("falls back to escaped <pre> when the highlighter throws", async () => {
    codeToHtmlMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const { SourceView } = await import("./source-view");
    harness.render(<SourceView source={"<script>alert(1)</script>"} />);
    await flushAsync();

    const pre = harness.container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.innerHTML).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes & < > characters in the fallback", async () => {
    codeToHtmlMock.mockImplementation(() => {
      throw new Error("nope");
    });
    const { SourceView } = await import("./source-view");
    harness.render(<SourceView source="a & b < c > d" />);
    await flushAsync();

    const pre = harness.container.querySelector("pre");
    expect(pre!.innerHTML).toBe("a &amp; b &lt; c &gt; d");
  });

  it("clears highlighted html when source becomes empty", async () => {
    const { SourceView } = await import("./source-view");
    harness.render(<SourceView source="hello" />);
    await flushAsync();
    expect(harness.container.innerHTML).toContain("highlighted");

    harness.render(<SourceView source="" />);
    expect(harness.container.textContent).toContain("no source");
  });
});
