import { describe, expect, it } from "vitest";
import { Preview } from "./index";
import { setupRender } from "../../test/render";

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const zoomInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;
const previewImg = () => document.querySelector<HTMLImageElement>('img[alt="preview"]')!;

const render = setupRender();

describe("Preview", () => {
  it.each([{ svg: SAMPLE_SVG }, { svg: "data:image/png;base64,ZZZZ" }])(
    "renders an img with src=$svg",
    ({ svg }) => {
      render(<Preview svg={svg} />);
      expect(previewImg().getAttribute("src")).toBe(svg);
    },
  );

  it("uses 'preview' as the alt text", () => {
    render(<Preview svg={SAMPLE_SVG} />);
    expect(previewImg().getAttribute("alt")).toBe("preview");
  });

  it.each([
    { from: "data:image/png;base64,AAA1", to: "data:image/png;base64,BBB2" },
    { from: "data:image/png;base64,CCC3", to: "data:image/png;base64,DDD4" },
  ])("updates src from $from to $to when svg prop changes", ({ from, to }) => {
    render(<Preview svg={from} />);
    render(<Preview svg={to} />);
    expect(previewImg().getAttribute("src")).toBe(to);
  });

  it("shows the zoom display at 100% on initial render", () => {
    render(<Preview svg={SAMPLE_SVG} />);
    expect(zoomInput().value).toBe("100");
  });

  it("renders the zoom controls alongside the preview image", () => {
    render(<Preview svg={SAMPLE_SVG} />);
    expect(document.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Zoom out"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Reset zoom"]')).not.toBeNull();
  });
});
