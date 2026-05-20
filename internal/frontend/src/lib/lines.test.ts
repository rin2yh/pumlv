import { describe, expect, it } from "vitest";
import { splitLines } from "./lines";

describe("splitLines", () => {
  it.each([
    { name: "splits LF", input: "a\nb\nc", expected: ["a", "b", "c"] },
    { name: "splits CRLF", input: "a\r\nb\r\nc", expected: ["a", "b", "c"] },
    { name: "splits lone CR", input: "a\rb\rc", expected: ["a", "b", "c"] },
    { name: "splits mixed line endings", input: "a\nb\r\nc\rd", expected: ["a", "b", "c", "d"] },
    { name: "returns a single element for an empty string", input: "", expected: [""] },
    {
      name: "returns a single element when no separator is present",
      input: "abc",
      expected: ["abc"],
    },
    { name: "preserves trailing empty line", input: "a\n", expected: ["a", ""] },
  ])("$name", ({ input, expected }) => {
    expect(splitLines(input)).toEqual(expected);
  });
});
