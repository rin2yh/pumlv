import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { Preview } from "./preview";
import { setupRender } from "../test/render";

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();

let mockScale = 1;

let lastPanningStart: (() => void) | undefined;
let lastPanningStop: (() => void) | undefined;

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({
    children,
    onPanningStart,
    onPanningStop,
  }: {
    children: ReactNode;
    onPanningStart?: () => void;
    onPanningStop?: () => void;
  }) => {
    lastPanningStart = onPanningStart;
    lastPanningStop = onPanningStop;
    return children;
  },
  TransformComponent: ({
    children,
    wrapperClass,
  }: {
    children: ReactNode;
    wrapperClass?: string;
  }) => (
    <div data-testid="transform-wrapper" className={wrapperClass}>
      {children}
    </div>
  ),
  useControls: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    resetTransform: mockResetTransform,
  }),
  useTransformComponent: (cb: (s: { state: { scale: number } }) => unknown) =>
    cb({ state: { scale: mockScale } }),
}));

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const zoomLevel = () => document.querySelector('[aria-label="Zoom level"]')!.textContent;
const panWrapper = () => document.querySelector('[data-testid="transform-wrapper"]')!;

const render = setupRender();

beforeEach(() => {
  mockScale = 1;
  lastPanningStart = undefined;
  lastPanningStop = undefined;
  vi.clearAllMocks();
});

describe("Preview", () => {
  it.each([{ svg: SAMPLE_SVG }, { svg: "data:image/png;base64,ZZZZ" }])(
    "renders an img with src=$svg",
    ({ svg }) => {
      render(<Preview svg={svg} />);
      const img = document.querySelector("img");
      expect(img).not.toBeNull();
      expect(img!.getAttribute("src")).toBe(svg);
    },
  );

  it("uses 'preview' as the alt text", () => {
    render(<Preview svg={SAMPLE_SVG} />);
    expect(document.querySelector("img")!.getAttribute("alt")).toBe("preview");
  });

  it.each([
    { from: "data:image/png;base64,AAA1", to: "data:image/png;base64,BBB2" },
    { from: "data:image/png;base64,CCC3", to: "data:image/png;base64,DDD4" },
  ])("updates src from $from to $to when svg prop changes", ({ from, to }) => {
    render(<Preview svg={from} />);
    render(<Preview svg={to} />);
    expect(document.querySelector("img")!.getAttribute("src")).toBe(to);
  });

  describe("zoom controls", () => {
    it.each(["Zoom in", "Zoom out", "Reset zoom"])("renders the '%s' button", (label) => {
      render(<Preview svg={SAMPLE_SVG} />);
      expect(document.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
    });

    it.each([
      { label: "Zoom in", mock: mockZoomIn },
      { label: "Zoom out", mock: mockZoomOut },
      { label: "Reset zoom", mock: mockResetTransform },
    ])("clicking '$label' button calls its handler", ({ label, mock }) => {
      render(<Preview svg={SAMPLE_SVG} />);
      act(() => {
        document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click();
      });
      expect(mock).toHaveBeenCalledOnce();
    });

    it.each([
      { scale: 1, expected: "100%" },
      { scale: 0.5, expected: "50%" },
      { scale: 2.5, expected: "250%" },
    ])("displays zoom level as $expected when scale is $scale", ({ scale, expected }) => {
      mockScale = scale;
      render(<Preview svg={SAMPLE_SVG} />);
      expect(document.querySelector('[aria-label="Zoom level"]')!.textContent).toBe(expected);
    });

    it("resets zoom display to 100% when svg prop changes", () => {
      mockScale = 2;
      render(<Preview svg={SAMPLE_SVG} />);
      expect(zoomLevel()).toBe("200%");

      mockScale = 1;
      render(<Preview svg="data:image/png;base64,BBBB" />);
      expect(zoomLevel()).toBe("100%");
    });
  });

  describe("drag cursor", () => {
    const startPan = () => lastPanningStart?.();
    const stopPan = () => lastPanningStop?.();

    it.each([
      { name: "defaults to cursor-grab when not panning", actions: [], expected: "cursor-grab" },
      {
        name: "switches to cursor-grabbing while panning",
        actions: [startPan],
        expected: "cursor-grabbing",
      },
      {
        name: "returns to cursor-grab when panning stops",
        actions: [startPan, stopPan],
        expected: "cursor-grab",
      },
    ])("$name", ({ actions, expected }) => {
      render(<Preview svg={SAMPLE_SVG} />);
      for (const action of actions) {
        act(() => action());
      }
      expect(panWrapper().className).toBe(expected);
    });
  });
});
