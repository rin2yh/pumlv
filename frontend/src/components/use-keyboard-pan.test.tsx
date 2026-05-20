import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type JSX } from "react";
import { useKeyboardPan } from "./use-keyboard-pan";
import { setupRender } from "../test/render";

const mockSetTransformState = vi.fn();
const mockTransformState = { scale: 1, positionX: 0, positionY: 0 };

vi.mock("react-zoom-pan-pinch", () => ({
  useTransformContext: () => ({
    transformState: mockTransformState,
    setTransformState: mockSetTransformState,
  }),
}));

function Harness(): JSX.Element {
  useKeyboardPan();
  return <div />;
}

const render = setupRender();

beforeEach(() => {
  mockTransformState.scale = 1;
  mockTransformState.positionX = 100;
  mockTransformState.positionY = 200;
  vi.clearAllMocks();
});

const pressKey = (key: string, init: KeyboardEventInit = {}) => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
};

describe("useKeyboardPan", () => {
  it.each([
    { key: "ArrowLeft", dx: 50, dy: 0 },
    { key: "ArrowRight", dx: -50, dy: 0 },
    { key: "ArrowUp", dx: 0, dy: 50 },
    { key: "ArrowDown", dx: 0, dy: -50 },
  ])("$key shifts the transform by ($dx, $dy)", ({ key, dx, dy }) => {
    render(<Harness />);
    pressKey(key);
    expect(mockSetTransformState).toHaveBeenCalledWith(1, 100 + dx, 200 + dy);
  });

  it("uses a larger step when Shift is held", () => {
    render(<Harness />);
    pressKey("ArrowRight", { shiftKey: true });
    expect(mockSetTransformState).toHaveBeenCalledWith(1, 100 - 200, 200);
  });

  it("ignores non-arrow keys", () => {
    render(<Harness />);
    pressKey("a");
    pressKey("Enter");
    expect(mockSetTransformState).not.toHaveBeenCalled();
  });

  it.each(["INPUT", "TEXTAREA"])("ignores arrows while typing in a %s", (tagName) => {
    render(<Harness />);
    const editable = document.createElement(tagName.toLowerCase()) as HTMLElement;
    document.body.appendChild(editable);
    editable.focus();
    act(() => {
      editable.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(mockSetTransformState).not.toHaveBeenCalled();
    document.body.removeChild(editable);
  });

  it("reads the latest position on each keypress", () => {
    render(<Harness />);
    pressKey("ArrowRight");
    mockTransformState.positionX = 999;
    pressKey("ArrowRight");
    expect(mockSetTransformState).toHaveBeenNthCalledWith(2, 1, 999 - 50, 200);
  });

  it("removes the listener on unmount", () => {
    render(<Harness />);
    render(<div />);
    pressKey("ArrowRight");
    expect(mockSetTransformState).not.toHaveBeenCalled();
  });
});
