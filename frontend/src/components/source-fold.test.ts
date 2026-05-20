import { describe, expect, it } from "vitest";
import { computeFoldRanges, hiddenLines } from "./source-fold";

describe("computeFoldRanges", () => {
  it("returns no ranges for source without braces", () => {
    const src = "@startuml\nactor User\n@enduml\n";
    expect(computeFoldRanges(src)).toEqual([]);
  });

  it("detects a single brace block spanning multiple lines", () => {
    const src = ["@startuml", "class A {", "  field", "}", "@enduml"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("ignores single-line braces ({ and } on same line)", () => {
    const src = ["class A { field }", "class B {", "  x", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("detects multiple sibling blocks", () => {
    const src = ["class A {", "  a", "}", "class B {", "  b", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([
      { startLine: 0, endLine: 2 },
      { startLine: 3, endLine: 5 },
    ]);
  });

  it("detects nested blocks", () => {
    const src = ["package P {", "  class A {", "    f", "  }", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([
      { startLine: 0, endLine: 4 },
      { startLine: 1, endLine: 3 },
    ]);
  });

  it("ignores braces inside double-quoted strings", () => {
    const src = ['note "}" as N1', "class A {", "  x", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("ignores braces after a line comment", () => {
    const src = ["' class A {", "class B {", "  x", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("ignores braces inside block comments", () => {
    const src = ["/' { '/", "class B {", "  x", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("ignores escaped quotes inside strings", () => {
    const src = ['note "\\"{" as N', "class A {", "  x", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("ignores unmatched closing braces", () => {
    const src = ["}", "class A {", "  x", "}"].join("\n");
    expect(computeFoldRanges(src)).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it("handles CRLF line endings", () => {
    const src = "class A {\r\n  x\r\n}\r\n";
    expect(computeFoldRanges(src)).toEqual([{ startLine: 0, endLine: 2 }]);
  });
});

describe("hiddenLines", () => {
  it("hides lines after a folded range's start through its end", () => {
    const ranges = [{ startLine: 1, endLine: 4 }];
    const hidden = hiddenLines(ranges, new Set([1]), 6);
    expect(hidden).toEqual([false, false, true, true, true, false]);
  });

  it("returns all-false when nothing is folded", () => {
    const ranges = [{ startLine: 0, endLine: 2 }];
    expect(hiddenLines(ranges, new Set(), 3)).toEqual([false, false, false]);
  });

  it("hides nested ranges when only the outer is folded", () => {
    const ranges = [
      { startLine: 0, endLine: 4 },
      { startLine: 1, endLine: 3 },
    ];
    expect(hiddenLines(ranges, new Set([0]), 5)).toEqual([false, true, true, true, true]);
  });

  it("clamps end line to the available total", () => {
    const ranges = [{ startLine: 0, endLine: 10 }];
    expect(hiddenLines(ranges, new Set([0]), 3)).toEqual([false, true, true]);
  });
});
