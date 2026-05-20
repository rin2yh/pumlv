import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { Preview } from "./preview";
import { setupRender } from "../test/render";

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();
const mockSetTransform = vi.fn();

let mockScale = 1;
const mockTransformState = { scale: 1, positionX: 0, positionY: 0 };

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children: ReactNode }) => children,
  TransformComponent: ({ children }: { children: ReactNode }) => children,
  useControls: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    resetTransform: mockResetTransform,
    setTransform: mockSetTransform,
  }),
  useTransformComponent: (cb: (s: { state: { scale: number } }) => unknown) =>
    cb({ state: { scale: mockScale } }),
  useTransformContext: () => ({ transformState: mockTransformState }),
}));

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const zoomLevel = () => document.querySelector('[aria-label="Zoom level"]')!.textContent;

const render = setupRender();

beforeEach(() => {
  mockScale = 1;
  mockTransformState.scale = 1;
  mockTransformState.positionX = 100;
  mockTransformState.positionY = 200;
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

  describe("arrow key panning", () => {
    const pressKey = (key: string, init: KeyboardEventInit = {}) => {
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
      });
    };

    it.each([
      { key: "ArrowLeft", dx: 50, dy: 0 },
      { key: "ArrowRight", dx: -50, dy: 0 },
      { key: "ArrowUp", dx: 0, dy: 50 },
      { key: "ArrowDown", dx: 0, dy: -50 },
    ])("$key shifts the transform by ($dx, $dy)", ({ key, dx, dy }) => {
      render(<Preview svg={SAMPLE_SVG} />);
      pressKey(key);
      expect(mockSetTransform).toHaveBeenCalledWith(100 + dx, 200 + dy, 1, 0);
    });

    it("uses a larger step when Shift is held", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      pressKey("ArrowRight", { shiftKey: true });
      expect(mockSetTransform).toHaveBeenCalledWith(100 - 200, 200, 1, 0);
    });

    it("ignores non-arrow keys", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      pressKey("a");
      pressKey("Enter");
      expect(mockSetTransform).not.toHaveBeenCalled();
    });

    it.each(["INPUT", "TEXTAREA"])("ignores arrows while typing in a %s", (tagName) => {
      render(<Preview svg={SAMPLE_SVG} />);
      const editable = document.createElement(tagName.toLowerCase()) as HTMLElement;
      document.body.appendChild(editable);
      editable.focus();
      act(() => {
        editable.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      });
      expect(mockSetTransform).not.toHaveBeenCalled();
      document.body.removeChild(editable);
    });

    it("reads the latest position on each keypress", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      pressKey("ArrowRight");
      mockTransformState.positionX = 999;
      pressKey("ArrowRight");
      expect(mockSetTransform).toHaveBeenNthCalledWith(2, 999 - 50, 200, 1, 0);
    });
  });
});
