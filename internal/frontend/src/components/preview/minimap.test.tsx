import { describe, expect, it } from "vitest";
import { MinimapHarness } from "./test/wrappers";
import { SAMPLE_SVG } from "./test/fixtures";
import { setupRender } from "../../test/render";

const container = () => document.querySelector('[aria-label="diagram minimap"]')!;
const imgs = () =>
  Array.from(container().querySelectorAll("img")).map((el) => el.getAttribute("src"));

const render = setupRender();

describe("Minimap", () => {
  it("renders the labeled overlay container", () => {
    render(<MinimapHarness svg={SAMPLE_SVG} />);
    expect(container()).not.toBeNull();
  });

  it("passes the svg through to the thumbnail img", () => {
    render(<MinimapHarness svg={SAMPLE_SVG} />);
    expect(imgs()).toContain(SAMPLE_SVG);
  });

  it("updates the thumbnail when svg changes", () => {
    render(<MinimapHarness svg={SAMPLE_SVG} />);
    const next = "data:image/png;base64,NEXT";
    render(<MinimapHarness svg={next} />);
    expect(imgs()).toContain(next);
    expect(imgs()).not.toContain(SAMPLE_SVG);
  });
});
