import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { splitLines } from "../../lib/lines";

const SHIKI_MODULES = [
  "shiki/core",
  "shiki/engine/oniguruma",
  "shiki/themes/github-light.mjs",
  "shiki/langs/yaml.mjs",
  "shiki/wasm",
] as const;

describe("highlight (real shiki)", () => {
  it("returns tokens with hex fg/bg for non-empty input", async () => {
    const { highlight } = await import("./highlighter");
    const result = await highlight("@startuml\nactor A\n@enduml");
    expect(result).not.toBeNull();
    expect(result!.fg).toMatch(/^#[0-9a-f]{3,8}$/i);
    expect(result!.bg).toMatch(/^#[0-9a-f]{3,8}$/i);
    expect(result!.tokens.length).toBeGreaterThan(0);
    expect(
      result!.tokens
        .flat()
        .map((t) => t.content)
        .join(""),
    ).toContain("startuml");
  });

  it.each(["a", "line0\nline1\nline2", "@startuml\nactor A\n@enduml", "a\n", "a\n\n", ""])(
    "token row count matches splitLines for %p",
    async (source) => {
      const { highlight } = await import("./highlighter");
      const result = await highlight(source);
      expect(result).not.toBeNull();
      expect(result!.tokens).toHaveLength(splitLines(source).length);
    },
  );
});

describe("highlight error and cache behavior", () => {
  let codeToTokensMock: ReturnType<typeof vi.fn>;
  let createHighlighterCoreMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    codeToTokensMock = vi.fn();
    createHighlighterCoreMock = vi.fn(async () => ({
      codeToTokens: codeToTokensMock,
    }));
    vi.doMock("shiki/core", () => ({
      createHighlighterCore: (...args: unknown[]) => createHighlighterCoreMock(...args),
    }));
    vi.doMock("shiki/engine/oniguruma", () => ({
      createOnigurumaEngine: vi.fn(async () => ({})),
    }));
    vi.doMock("shiki/themes/github-light.mjs", () => ({ default: {} }));
    vi.doMock("shiki/langs/yaml.mjs", () => ({ default: {} }));
    vi.doMock("shiki/wasm", () => ({ default: new ArrayBuffer(0) }));
  });

  afterEach(() => {
    SHIKI_MODULES.forEach((m) => vi.doUnmock(m));
    vi.resetModules();
  });

  it("returns null when shiki throws", async () => {
    codeToTokensMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const { highlight } = await import("./highlighter");
    expect(await highlight("x")).toBeNull();
  });

  it("returns null when createHighlighterCore rejects", async () => {
    createHighlighterCoreMock.mockRejectedValue(new Error("wasm load failed"));
    const { highlight } = await import("./highlighter");
    expect(await highlight("x")).toBeNull();
  });

  it("retries createHighlighterCore after a rejection (does not poison the cache)", async () => {
    createHighlighterCoreMock
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ codeToTokens: codeToTokensMock });
    codeToTokensMock.mockReturnValue({ tokens: [], fg: "", bg: "" });
    const { highlight } = await import("./highlighter");
    expect(await highlight("a")).toBeNull();
    expect(await highlight("b")).not.toBeNull();
    expect(createHighlighterCoreMock).toHaveBeenCalledTimes(2);
  });

  it("caches the highlighter across calls (createHighlighterCore runs once)", async () => {
    codeToTokensMock.mockReturnValue({ tokens: [], fg: "", bg: "" });
    const { highlight } = await import("./highlighter");
    await highlight("a");
    await highlight("b");
    await highlight("c");
    expect(createHighlighterCoreMock).toHaveBeenCalledTimes(1);
  });

  it("pads tokens to match the source line count when shiki returns fewer rows", async () => {
    codeToTokensMock.mockReturnValue({
      tokens: [[{ content: "line0" }]],
      fg: "",
      bg: "",
    });
    const { highlight } = await import("./highlighter");
    const result = await highlight("line0\nline1\nline2");
    expect(result!.tokens).toHaveLength(3);
    expect(result!.tokens[0]).toEqual([{ content: "line0" }]);
    expect(result!.tokens[1]).toEqual([{ content: "" }]);
    expect(result!.tokens[2]).toEqual([{ content: "" }]);
  });
});
