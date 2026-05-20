import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { ZoomControls } from "./zoom-controls";
import { setupRender } from "../../test/render";

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();
const mockCenterView = vi.fn();

let mockScale = 1;

vi.mock("./use-keyboard-pan", () => ({
  useKeyboardPan: () => {},
}));

vi.mock("react-zoom-pan-pinch", () => ({
  useControls: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    resetTransform: mockResetTransform,
    centerView: mockCenterView,
  }),
  useTransformComponent: (cb: (s: { state: { scale: number } }) => unknown) =>
    cb({ state: { scale: mockScale } }),
}));

const zoomInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;

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

describe("ZoomControls", () => {
  it.each(["Zoom in", "Zoom out", "Reset zoom"])("renders the '%s' button", (label) => {
    render(<ZoomControls />);
    expect(document.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  });

  it.each([
    { label: "Zoom in", mock: mockZoomIn },
    { label: "Zoom out", mock: mockZoomOut },
    { label: "Reset zoom", mock: mockResetTransform },
  ])("clicking '$label' button calls its handler", ({ label, mock }) => {
    render(<ZoomControls />);
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
    render(<ZoomControls />);
    expect(zoomInput().value).toBe(expected);
  });

  it.each([
    { input: "150", expectedScale: 1.5 },
    { input: "75", expectedScale: 0.75 },
    { input: "200%", expectedScale: 2 },
    { input: "5", expectedScale: 0.1 },
    { input: "10000", expectedScale: 50 },
  ])(
    "typing '$input' commits scale=$expectedScale via centerView (clamped to MIN/MAX)",
    ({ input, expectedScale }) => {
      render(<ZoomControls />);
      typeAndCommit(input);
      expect(mockCenterView).toHaveBeenCalledWith(expectedScale, 0);
    },
  );

  it.each(["abc", "", "-50", "0"])(
    "ignores invalid input '%s' without calling centerView",
    (value) => {
      render(<ZoomControls />);
      typeAndCommit(value);
      expect(mockCenterView).not.toHaveBeenCalled();
    },
  );

  it("pressing Escape reverts the draft and does not call centerView", () => {
    mockScale = 1;
    render(<ZoomControls />);
    typeAndCommit("250", { key: "Escape" });
    expect(mockCenterView).not.toHaveBeenCalled();
    expect(zoomInput().value).toBe("100");
  });

  it("focusing then blurring without typing commits the current scale", () => {
    mockScale = 1;
    render(<ZoomControls />);
    const input = zoomInput();
    act(() => {
      input.focus();
    });
    act(() => {
      input.blur();
    });
    expect(mockCenterView).toHaveBeenCalledWith(1, 0);
  });
});
