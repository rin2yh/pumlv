import { describe, expect, it } from "vitest";
import {
  computeFoldRanges,
  computeLineDepths,
  hiddenLines,
  lineIndentPx,
  type FoldRange,
} from "./source-fold";

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

describe("computeLineDepths", () => {
  it("returns all zeros when there are no ranges", () => {
    expect(computeLineDepths(3, [])).toEqual([0, 0, 0]);
  });

  it("places opening and closing brace lines at the enclosing scope's depth", () => {
    // package P {       -> line 0, depth 0
    //   class A {       -> line 1, depth 1
    //     f             -> line 2, depth 2
    //   }               -> line 3, depth 1
    // }                 -> line 4, depth 0
    const ranges: FoldRange[] = [
      { startLine: 0, endLine: 4 },
      { startLine: 1, endLine: 3 },
    ];
    expect(computeLineDepths(5, ranges)).toEqual([0, 1, 2, 1, 0]);
  });

  it("treats sibling blocks as independent", () => {
    const ranges: FoldRange[] = [
      { startLine: 0, endLine: 2 },
      { startLine: 3, endLine: 5 },
    ];
    expect(computeLineDepths(6, ranges)).toEqual([0, 1, 0, 0, 1, 0]);
  });
});

describe("lineIndentPx", () => {
  it("returns zero at depth zero", () => {
    expect(lineIndentPx(0)).toBe(0);
  });

  it("scales linearly with depth", () => {
    expect(lineIndentPx(2)).toBe(lineIndentPx(1) * 2);
    expect(lineIndentPx(3)).toBeGreaterThan(lineIndentPx(2));
  });
});
