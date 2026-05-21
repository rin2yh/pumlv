import { describe, expect, it } from "vitest";
import { Preview } from "./index";
import { typeAndCommitInput } from "../../test/input";
import { setupRender } from "../../test/render";

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const zoomInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;

const render = setupRender();

describe("Preview", () => {
  it("resets the zoom display to 100% when svg changes (TransformWrapper remounts on key)", () => {
    render(<Preview svg={SAMPLE_SVG} />);
    typeAndCommitInput(zoomInput(), "250");
    expect(zoomInput().value).toBe("250");

    render(<Preview svg="data:image/png;base64,BBBB" />);
    expect(zoomInput().value).toBe("100");
  });
});
