import { describe, expect, it } from "vitest";
import { clampScale, MAX_SCALE, MIN_SCALE } from "./zoom";

describe("clampScale", () => {
  it.each([
    { name: "returns the value unchanged when within range", input: 1, expected: 1 },
    {
      name: "returns MIN_SCALE for values just below the minimum",
      input: MIN_SCALE / 2,
      expected: MIN_SCALE,
    },
    {
      name: "returns MAX_SCALE for values just above the maximum",
      input: MAX_SCALE * 2,
      expected: MAX_SCALE,
    },
    {
      name: "returns the value unchanged at the minimum boundary",
      input: MIN_SCALE,
      expected: MIN_SCALE,
    },
    {
      name: "returns the value unchanged at the maximum boundary",
      input: MAX_SCALE,
      expected: MAX_SCALE,
    },
    { name: "clamps negative values to MIN_SCALE", input: -10, expected: MIN_SCALE },
    { name: "clamps zero to MIN_SCALE", input: 0, expected: MIN_SCALE },
  ])("$name", ({ input, expected }) => {
    expect(clampScale(input)).toBe(expected);
  });
});
