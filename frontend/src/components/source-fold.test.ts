import { describe, expect, it } from "vitest";
import { computeFoldRanges, hiddenLines, type FoldRange } from "./source-fold";

interface ComputeCase {
  name: string;
  src: string;
  expected: FoldRange[];
}

const computeCases: ComputeCase[] = [
  {
    name: "returns no ranges for source without braces",
    src: "@startuml\nactor User\n@enduml\n",
    expected: [],
  },
  {
    name: "detects a single brace block spanning multiple lines",
    src: ["@startuml", "class A {", "  field", "}", "@enduml"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "ignores single-line braces ({ and } on same line)",
    src: ["class A { field }", "class B {", "  x", "}"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "detects multiple sibling blocks",
    src: ["class A {", "  a", "}", "class B {", "  b", "}"].join("\n"),
    expected: [
      { startLine: 0, endLine: 2 },
      { startLine: 3, endLine: 5 },
    ],
  },
  {
    name: "detects nested blocks",
    src: ["package P {", "  class A {", "    f", "  }", "}"].join("\n"),
    expected: [
      { startLine: 0, endLine: 4 },
      { startLine: 1, endLine: 3 },
    ],
  },
  {
    name: "ignores braces inside double-quoted strings",
    src: ['note "}" as N1', "class A {", "  x", "}"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "ignores braces after a line comment",
    src: ["' class A {", "class B {", "  x", "}"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "ignores braces inside block comments",
    src: ["/' { '/", "class B {", "  x", "}"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "ignores escaped quotes inside strings",
    src: ['note "\\"{" as N', "class A {", "  x", "}"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "ignores unmatched closing braces",
    src: ["}", "class A {", "  x", "}"].join("\n"),
    expected: [{ startLine: 1, endLine: 3 }],
  },
  {
    name: "handles CRLF line endings",
    src: "class A {\r\n  x\r\n}\r\n",
    expected: [{ startLine: 0, endLine: 2 }],
  },
];

describe("computeFoldRanges", () => {
  for (const { name, src, expected } of computeCases) {
    it(name, () => {
      expect(computeFoldRanges(src)).toEqual(expected);
    });
  }
});

interface HiddenCase {
  name: string;
  ranges: FoldRange[];
  folded: number[];
  expected: number[];
}

const hiddenCases: HiddenCase[] = [
  {
    name: "hides lines from start+1 through end of a folded range",
    ranges: [{ startLine: 1, endLine: 4 }],
    folded: [1],
    expected: [2, 3, 4],
  },
  {
    name: "returns an empty set when nothing is folded",
    ranges: [{ startLine: 0, endLine: 2 }],
    folded: [],
    expected: [],
  },
  {
    name: "hides nested ranges when only the outer is folded",
    ranges: [
      { startLine: 0, endLine: 4 },
      { startLine: 1, endLine: 3 },
    ],
    folded: [0],
    expected: [1, 2, 3, 4],
  },
];

describe("hiddenLines", () => {
  for (const { name, ranges, folded, expected } of hiddenCases) {
    it(name, () => {
      expect(hiddenLines(ranges, new Set(folded))).toEqual(new Set(expected));
    });
  }
});
