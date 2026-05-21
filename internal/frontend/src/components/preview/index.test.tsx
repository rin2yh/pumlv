import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { Preview } from "./index";
import { setupRender } from "../../test/render";

let mockScale = 1;

let lastPanningStart: (() => void) | undefined;
let lastPanningStop: (() => void) | undefined;
let lastWrapperClass: string | undefined;

vi.mock("./use-keyboard-pan", () => ({
  useKeyboardPan: () => {},
}));

vi.mock("./minimap", () => ({
  Minimap: () => null,
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
  }) => {
    lastWrapperClass = wrapperClass;
    return <div className={wrapperClass}>{children}</div>;
  },
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
const previewImg = () => document.querySelector<HTMLImageElement>('img[alt="preview"]')!;

const render = setupRender();

beforeEach(() => {
  mockScale = 1;
  lastPanningStart = undefined;
  lastPanningStop = undefined;
  lastWrapperClass = undefined;
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
      expect(lastWrapperClass).toBe(expected);
    });
  });
});
