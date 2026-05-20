import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { Preview } from "./index";
import { setupRender } from "../../test/render";

let mockScale = 1;

let lastPanningStart: (() => void) | undefined;
let lastPanningStop: (() => void) | undefined;

vi.mock("./use-keyboard-pan", () => ({
  useKeyboardPan: () => {},
}));

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
  }) => (
    <div
      data-testid="minimap-inner"
      data-width={width}
      data-height={height}
      data-border-color={borderColor}
    >
      {children}
    </div>
  ),
  useControls: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetTransform: vi.fn(),
    centerView: vi.fn(),
  }),
  useTransformComponent: (cb: (s: { state: { scale: number } }) => unknown) =>
    cb({ state: { scale: mockScale } }),
}));

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const zoomInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;
const panWrapper = () => document.querySelector('[data-testid="transform-wrapper"]')!;
const previewImg = () => panWrapper().querySelector("img")!;
const minimap = () => document.querySelector('[data-testid="minimap"]')!;
const minimapInner = () => document.querySelector('[data-testid="minimap-inner"]')!;
const minimapImgs = () =>
  Array.from(minimap().querySelectorAll("img")).map((el) => el.getAttribute("src"));

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

  it("resets the zoom display when svg changes (TransformWrapper remounts on key)", () => {
    mockScale = 2;
    render(<Preview svg={SAMPLE_SVG} />);
    expect(zoomInput().value).toBe("200");

    mockScale = 1;
    render(<Preview svg="data:image/png;base64,BBBB" />);
    expect(zoomInput().value).toBe("100");
  });

  describe("minimap", () => {
    it("renders the minimap container as an overlay", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      expect(minimap()).not.toBeNull();
    });

    it("passes a thumbnail of the current svg to MiniMap", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      expect(minimapImgs()).toContain(SAMPLE_SVG);
    });

    it("forwards configured width/height/borderColor to MiniMap", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      const inner = minimapInner();
      expect(inner.getAttribute("data-width")).toBe("160");
      expect(inner.getAttribute("data-height")).toBe("120");
      expect(inner.getAttribute("data-border-color")).toBe("#7c3aed");
    });

    it("updates the minimap thumbnail when svg changes", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      const next = "data:image/png;base64,NEXT";
      render(<Preview svg={next} />);
      expect(minimapImgs()).toContain(next);
      expect(minimapImgs()).not.toContain(SAMPLE_SVG);
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
