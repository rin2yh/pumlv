import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ReactNode } from "react";
import { Minimap } from "./minimap";
import { setupRender } from "../../test/render";

let lastMiniMapProps: { width?: number; height?: number; borderColor?: string } = {};

vi.mock("react-zoom-pan-pinch", () => ({
  MiniMap: ({
    children,
    width,
    height,
    borderColor,
  }: {
    children: ReactNode;
    width?: number;
    height?: number;
    borderColor?: string;
  }) => {
    lastMiniMapProps = { width, height, borderColor };
    return <div>{children}</div>;
  },
}));

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const container = () => document.querySelector('[aria-label="diagram minimap"]')!;
const imgs = () =>
  Array.from(container().querySelectorAll("img")).map((el) => el.getAttribute("src"));

const render = setupRender();

beforeEach(() => {
  lastMiniMapProps = {};
});

describe("Minimap", () => {
  it("renders the labeled overlay container", () => {
    render(<Minimap svg={SAMPLE_SVG} />);
    expect(container()).not.toBeNull();
  });

  it("passes the svg through to the thumbnail img", () => {
    render(<Minimap svg={SAMPLE_SVG} />);
    expect(imgs()).toContain(SAMPLE_SVG);
  });

  it("forwards width/height/borderColor to the library MiniMap", () => {
    render(<Minimap svg={SAMPLE_SVG} />);
    expect(lastMiniMapProps.width).toBe(160);
    expect(lastMiniMapProps.height).toBe(120);
    expect(lastMiniMapProps.borderColor).toBe("#7c3aed");
  });

  it("updates the thumbnail when svg changes", () => {
    render(<Minimap svg={SAMPLE_SVG} />);
    const next = "data:image/png;base64,NEXT";
    render(<Minimap svg={next} />);
    expect(imgs()).toContain(next);
    expect(imgs()).not.toContain(SAMPLE_SVG);
  });
});
