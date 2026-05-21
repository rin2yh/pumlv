import { describe, expect, it } from "vitest";
import { Preview } from "./index";
import { typeAndCommitInput } from "../../test/input";
import { setupRender } from "../../test/render";
import { NEXT_SVG, SAMPLE_SVG } from "./test/fixtures";
import { zoomInput } from "./test/queries";

const render = setupRender();

describe("Preview", () => {
  it("resets the zoom display to 100% when svg changes (TransformWrapper remounts on key)", () => {
    render(<Preview svg={SAMPLE_SVG} />);
    typeAndCommitInput(zoomInput(), "250");
    expect(zoomInput().value).toBe("250");

    render(<Preview svg={NEXT_SVG} />);
    expect(zoomInput().value).toBe("100");
  });
});
