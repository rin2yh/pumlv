import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { SourceView } from "./source-view";
import { setupRender } from "../test/render";

let codeToHtmlMock: ReturnType<typeof vi.fn>;

vi.mock("shiki/core", () => ({
  createHighlighterCore: vi.fn(async () => ({
    // Read codeToHtmlMock dynamically so the module-level highlighter
    // cache in source-view.tsx doesn't pin a stale mock between tests.
    get codeToHtml() {
      return codeToHtmlMock;
    },
  })),
}));

vi.mock("shiki/engine/oniguruma", () => ({
  createOnigurumaEngine: vi.fn(async () => ({})),
}));

vi.mock("shiki/themes/github-light.mjs", () => ({ default: {} }));
vi.mock("shiki/langs/yaml.mjs", () => ({ default: {} }));
vi.mock("shiki/wasm", () => ({ default: new ArrayBuffer(0) }));

const view = setupRender(SourceView);

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

describe("SourceView", () => {
  it("shows 'no source' for an empty string", () => {
    view.render({ source: "" });
    expect(view.container.textContent).toContain("no source");
    expect(view.container.querySelector("pre")).toBeNull();
  });

  it("renders the highlighter output for a non-empty source", async () => {
    view.render({ source: "@startuml\n@enduml\n" });
    await flushAsync();

    expect(codeToHtmlMock).toHaveBeenCalledWith("@startuml\n@enduml\n", {
      lang: "yaml",
      theme: "github-light",
    });
    expect(view.container.innerHTML).toContain("highlighted");
  });

  it("falls back to escaped <pre> when the highlighter throws", async () => {
    codeToHtmlMock.mockImplementation(() => {
      throw new Error("boom");
    });
    view.render({ source: "<script>alert(1)</script>" });
    await flushAsync();

    const pre = view.container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.innerHTML).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes & < > characters in the fallback", async () => {
    codeToHtmlMock.mockImplementation(() => {
      throw new Error("nope");
    });
    view.render({ source: "a & b < c > d" });
    await flushAsync();

    const pre = view.container.querySelector("pre");
    expect(pre!.innerHTML).toBe("a &amp; b &lt; c &gt; d");
  });

  it("clears highlighted html when source becomes empty", async () => {
    view.render({ source: "hello" });
    await flushAsync();
    expect(view.container.innerHTML).toContain("highlighted");

    view.render({ source: "" });
    expect(view.container.textContent).toContain("no source");
  });
});
