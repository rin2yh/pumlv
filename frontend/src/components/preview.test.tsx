import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { Preview } from "./preview";
import { setupRender } from "../test/render";

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();

let mockScale = 1;

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children: ReactNode }) => children,
  TransformComponent: ({ children }: { children: ReactNode }) => children,
  useControls: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    resetTransform: mockResetTransform,
  }),
  useTransformComponent: (cb: (s: { state: { scale: number } }) => unknown) =>
    cb({ state: { scale: mockScale } }),
}));

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const view = setupRender();

beforeEach(() => {
  mockScale = 1;
  vi.clearAllMocks();
});

describe("Preview", () => {
  it.each([{ svg: SAMPLE_SVG }, { svg: "data:image/png;base64,ZZZZ" }])(
    "renders an img with src=$svg",
    ({ svg }) => {
      view.render(<Preview svg={svg} />);
      const img = view.container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img!.getAttribute("src")).toBe(svg);
    },
  );

  it("uses 'preview' as the alt text", () => {
    view.render(<Preview svg={SAMPLE_SVG} />);
    expect(view.container.querySelector("img")!.getAttribute("alt")).toBe("preview");
  });

  it.each([
    { from: "data:image/png;base64,AAA1", to: "data:image/png;base64,BBB2" },
    { from: "data:image/png;base64,CCC3", to: "data:image/png;base64,DDD4" },
  ])("updates src from $from to $to when svg prop changes", ({ from, to }) => {
    view.render(<Preview svg={from} />);
    view.render(<Preview svg={to} />);
    expect(view.container.querySelector("img")!.getAttribute("src")).toBe(to);
  });

  describe("zoom controls", () => {
    it.each(["Zoom in", "Zoom out", "Reset zoom"])("renders the '%s' button", (label) => {
      view.render(<Preview svg={SAMPLE_SVG} />);
      expect(view.container.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
    });

    it.each([
      { label: "Zoom in", mock: mockZoomIn },
      { label: "Zoom out", mock: mockZoomOut },
      { label: "Reset zoom", mock: mockResetTransform },
    ])("clicking '$label' button calls its handler", ({ label, mock }) => {
      view.render(<Preview svg={SAMPLE_SVG} />);
      view.click(view.container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!);
      expect(mock).toHaveBeenCalledOnce();
    });

    it.each([
      { scale: 1, expected: "100%" },
      { scale: 0.5, expected: "50%" },
      { scale: 2.5, expected: "250%" },
    ])("displays zoom level as $expected when scale is $scale", ({ scale, expected }) => {
      mockScale = scale;
      view.render(<Preview svg={SAMPLE_SVG} />);
      expect(view.container.querySelector('[aria-label="Zoom level"]')!.textContent).toBe(expected);
    });

    it("resets zoom display to 100% when svg prop changes", () => {
      const zoomLevel = () =>
        view.container.querySelector('[aria-label="Zoom level"]')!.textContent;

      mockScale = 2;
      view.render(<Preview svg={SAMPLE_SVG} />);
      expect(zoomLevel()).toBe("200%");

      mockScale = 1;
      view.render(<Preview svg="data:image/png;base64,BBBB" />);
      expect(zoomLevel()).toBe("100%");
    });
  });
});
