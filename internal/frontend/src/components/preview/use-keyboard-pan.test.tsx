import { act, renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { TransformComponent, TransformWrapper, useTransformContext } from "react-zoom-pan-pinch";
import { beforeEach, describe, expect, it } from "vitest";
import { useKeyboardPan } from "./use-keyboard-pan";

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <TransformWrapper>
    {children as JSX.Element}
    <TransformComponent>
      <div />
    </TransformComponent>
  </TransformWrapper>
);

const mountHarness = (initial?: { x: number; y: number }) => {
  const harness = renderHook(
    () => {
      useKeyboardPan();
      return useTransformContext();
    },
    { wrapper },
  );
  if (initial) {
    act(() => {
      harness.result.current.setTransformState(1, initial.x, initial.y);
    });
  }
  return harness;
};

const pressKey = (key: string, init: KeyboardEventInit = {}) => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
};

let cleanupEditable: (() => void) | null = null;

beforeEach(() => {
  cleanupEditable?.();
  cleanupEditable = null;
});

describe("useKeyboardPan", () => {
  it.each([
    { key: "ArrowLeft", dx: 50, dy: 0 },
    { key: "ArrowRight", dx: -50, dy: 0 },
    { key: "ArrowUp", dx: 0, dy: 50 },
    { key: "ArrowDown", dx: 0, dy: -50 },
  ])("$key shifts the transform by ($dx, $dy)", ({ key, dx, dy }) => {
    const { result } = mountHarness({ x: 100, y: 200 });
    pressKey(key);
    expect(result.current.transformState.positionX).toBe(100 + dx);
    expect(result.current.transformState.positionY).toBe(200 + dy);
    expect(result.current.transformState.scale).toBe(1);
  });

  it("uses a larger step when Shift is held", () => {
    const { result } = mountHarness({ x: 100, y: 200 });
    pressKey("ArrowRight", { shiftKey: true });
    expect(result.current.transformState.positionX).toBe(100 - 200);
    expect(result.current.transformState.positionY).toBe(200);
  });

  it("ignores non-arrow keys", () => {
    const { result } = mountHarness({ x: 100, y: 200 });
    pressKey("a");
    pressKey("Enter");
    expect(result.current.transformState.positionX).toBe(100);
    expect(result.current.transformState.positionY).toBe(200);
  });

  it.each(["INPUT", "TEXTAREA"])("ignores arrows while typing in a %s", (tagName) => {
    const { result } = mountHarness({ x: 100, y: 200 });
    const editable = document.createElement(tagName.toLowerCase()) as HTMLElement;
    document.body.appendChild(editable);
    editable.focus();
    cleanupEditable = () => editable.remove();

    act(() => {
      editable.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });

    expect(result.current.transformState.positionX).toBe(100);
    expect(result.current.transformState.positionY).toBe(200);
  });

  it("reads the latest position on each keypress", () => {
    const { result } = mountHarness({ x: 100, y: 200 });
    pressKey("ArrowRight");
    expect(result.current.transformState.positionX).toBe(50);
    pressKey("ArrowRight");
    expect(result.current.transformState.positionX).toBe(0);
  });

  it("removes the listener on unmount", () => {
    const { result, unmount } = mountHarness({ x: 100, y: 200 });
    const ctx = result.current;
    unmount();
    pressKey("ArrowRight");
    expect(ctx.transformState.positionX).toBe(100);
  });
});
