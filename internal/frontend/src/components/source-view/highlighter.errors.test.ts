import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let codeToTokensMock: ReturnType<typeof vi.fn>;
let createHighlighterCoreMock: ReturnType<typeof vi.fn>;

vi.mock("shiki/core", () => ({
  createHighlighterCore: (...args: unknown[]) => createHighlighterCoreMock(...args),
}));

vi.mock("shiki/engine/oniguruma", () => ({
  createOnigurumaEngine: vi.fn(async () => ({})),
}));

vi.mock("shiki/themes/github-light.mjs", () => ({ default: {} }));
vi.mock("shiki/langs/yaml.mjs", () => ({ default: {} }));
vi.mock("shiki/wasm", () => ({ default: new ArrayBuffer(0) }));

beforeEach(() => {
  codeToTokensMock = vi.fn();
  createHighlighterCoreMock = vi.fn(async () => ({
    codeToTokens: codeToTokensMock,
  }));
});

afterEach(() => {
  vi.resetModules();
});

describe("highlight error and cache behavior", () => {
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
