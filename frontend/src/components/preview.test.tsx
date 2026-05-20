import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { Preview } from "./preview";
import { setupRender } from "../test/render";

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();
const mockCenterView = vi.fn();

let mockScale = 1;

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children: ReactNode }) => children,
  TransformComponent: ({ children }: { children: ReactNode }) => children,
  useControls: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    resetTransform: mockResetTransform,
    centerView: mockCenterView,
  }),
  useTransformComponent: (cb: (s: { state: { scale: number } }) => unknown) =>
    cb({ state: { scale: mockScale } }),
}));

const SAMPLE_SVG = "data:image/png;base64,AAAA";

const zoomInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;
const zoomLevel = () => zoomInput().value;

const typeAndCommit = (value: string, { key = "Enter" } = {}) => {
  const input = zoomInput();
  act(() => {
    input.focus();
  });
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
};

const render = setupRender();

beforeEach(() => {
  mockScale = 1;
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
      { scale: 1, expected: "100" },
      { scale: 0.5, expected: "50" },
      { scale: 2.5, expected: "250" },
    ])("displays zoom level as $expected% when scale is $scale", ({ scale, expected }) => {
      mockScale = scale;
      render(<Preview svg={SAMPLE_SVG} />);
      expect(zoomInput().value).toBe(expected);
    });

    it("resets zoom display to 100 when svg prop changes", () => {
      mockScale = 2;
      render(<Preview svg={SAMPLE_SVG} />);
      expect(zoomLevel()).toBe("200");

      mockScale = 1;
      render(<Preview svg="data:image/png;base64,BBBB" />);
      expect(zoomLevel()).toBe("100");
    });

    it.each([
      { input: "150", expectedScale: 1.5 },
      { input: "75", expectedScale: 0.75 },
      { input: "200%", expectedScale: 2 },
    ])(
      "typing '$input' and pressing Enter calls centerView with scale=$expectedScale",
      ({ input, expectedScale }) => {
        render(<Preview svg={SAMPLE_SVG} />);
        typeAndCommit(input);
        expect(mockCenterView).toHaveBeenCalledWith(expectedScale, 0);
      },
    );

    it.each([
      { input: "5", expectedScale: 0.1 },
      { input: "10000", expectedScale: 50 },
    ])("clamps '$input%' to scale=$expectedScale (MIN/MAX bounds)", ({ input, expectedScale }) => {
      render(<Preview svg={SAMPLE_SVG} />);
      typeAndCommit(input);
      expect(mockCenterView).toHaveBeenCalledWith(expectedScale, 0);
    });

    it.each(["abc", "", "-50", "0"])(
      "ignores invalid input '%s' without calling centerView",
      (value) => {
        render(<Preview svg={SAMPLE_SVG} />);
        typeAndCommit(value);
        expect(mockCenterView).not.toHaveBeenCalled();
      },
    );

    it("pressing Escape reverts the draft and does not call centerView", () => {
      mockScale = 1;
      render(<Preview svg={SAMPLE_SVG} />);
      typeAndCommit("250", { key: "Escape" });
      expect(mockCenterView).not.toHaveBeenCalled();
      expect(zoomInput().value).toBe("100");
    });

    it("blurring the input without changing it does not call centerView with a NaN", () => {
      render(<Preview svg={SAMPLE_SVG} />);
      const input = zoomInput();
      act(() => {
        input.focus();
      });
      act(() => {
        input.blur();
      });
      // value '100' is valid — but it's the current scale, so centerView is called with 1.
      // Either it isn't called, or it's called with the same scale; both are fine. NaN must not occur.
      if (mockCenterView.mock.calls.length > 0) {
        expect(mockCenterView).toHaveBeenCalledWith(1, 0);
      }
    });
  });
});
