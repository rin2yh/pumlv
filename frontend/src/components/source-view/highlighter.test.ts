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

describe("highlight", () => {
  it("calls shiki with lang=yaml and theme=github-light", async () => {
    codeToTokensMock.mockReturnValue({ tokens: [], fg: "", bg: "" });
    const { highlight } = await import("./highlighter");
    await highlight("@startuml\n@enduml");
    expect(codeToTokensMock).toHaveBeenCalledWith("@startuml\n@enduml", {
      lang: "yaml",
      theme: "github-light",
    });
  });

  it("returns the tokens, fg, and bg from shiki", async () => {
    const tokens = [[{ content: "x", color: "#111" }]];
    codeToTokensMock.mockReturnValue({ tokens, fg: "#222", bg: "#fff" });
    const { highlight } = await import("./highlighter");
    expect(await highlight("x")).toEqual({ tokens, fg: "#222", bg: "#fff" });
  });

  it.each([
    { name: "missing fg defaults to empty string", field: "fg" as const },
    { name: "missing bg defaults to empty string", field: "bg" as const },
  ])("$name", async ({ field }) => {
    codeToTokensMock.mockReturnValue({ tokens: [], fg: undefined, bg: undefined });
    const { highlight } = await import("./highlighter");
    const result = await highlight("x");
    expect(result).not.toBeNull();
    expect(result![field]).toBe("");
  });

  it("returns null when shiki throws", async () => {
    codeToTokensMock.mockImplementation(() => {
      throw new Error("boom");
    });
    const { highlight } = await import("./highlighter");
    expect(await highlight("x")).toBeNull();
  });

  it("caches the highlighter across calls (createHighlighterCore runs once)", async () => {
    codeToTokensMock.mockReturnValue({ tokens: [], fg: "", bg: "" });
    const { highlight } = await import("./highlighter");
    await highlight("a");
    await highlight("b");
    await highlight("c");
    expect(createHighlighterCoreMock).toHaveBeenCalledTimes(1);
  });
});
