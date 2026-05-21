import { describe, expect, it } from "vitest";
import { highlight } from "./highlighter";
import { splitLines } from "../../lib/lines";

describe("highlight (real shiki)", () => {
  it("returns tokens with hex fg/bg for non-empty input", async () => {
    const result = await highlight("@startuml\nactor A\n@enduml");
    expect(result).not.toBeNull();
    expect(result!.fg).toMatch(/^#[0-9a-f]{3,8}$/i);
    expect(result!.bg).toMatch(/^#[0-9a-f]{3,8}$/i);
    expect(result!.tokens.length).toBeGreaterThan(0);
    expect(result!.tokens.flat().map((t) => t.content).join("")).toContain("startuml");
  });

  it.each([
    "a",
    "line0\nline1\nline2",
    "@startuml\nactor A\n@enduml",
    "a\n",
    "a\n\n",
    "",
  ])("token row count matches splitLines for %p", async (source) => {
    const result = await highlight(source);
    expect(result).not.toBeNull();
    expect(result!.tokens).toHaveLength(splitLines(source).length);
  });
});
