import { act, renderHook } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { TransformComponent, TransformWrapper, useTransformContext } from "react-zoom-pan-pinch";
import { describe, expect, it } from "vitest";
import { useKeyboardPan } from "./use-keyboard-pan";

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <TransformWrapper>
    {children}
    <TransformComponent>
      <div />
    </TransformComponent>
  </TransformWrapper>
);

const mount = () =>
  renderHook(
    () => {
      useKeyboardPan();
      return useTransformContext();
    },
    { wrapper },
  );

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
    const { result } = mount();
    pressKey(key);
    expect(result.current.transformState.positionX).toBe(dx);
    expect(result.current.transformState.positionY).toBe(dy);
    expect(result.current.transformState.scale).toBe(1);
  });

  it("uses a larger step when Shift is held", () => {
    const { result } = mount();
    pressKey("ArrowRight", { shiftKey: true });
    expect(result.current.transformState.positionX).toBe(-200);
    expect(result.current.transformState.positionY).toBe(0);
  });

  it("ignores non-arrow keys", () => {
    const { result } = mount();
    pressKey("a");
    pressKey("Enter");
    expect(result.current.transformState.positionX).toBe(0);
    expect(result.current.transformState.positionY).toBe(0);
  });

  it.each(["INPUT", "TEXTAREA"])("ignores arrows while typing in a %s", (tagName) => {
    const { result } = mount();
    const editable = document.createElement(tagName.toLowerCase()) as HTMLElement;
    document.body.appendChild(editable);
    try {
      editable.focus();
      act(() => {
        editable.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      });
      expect(result.current.transformState.positionX).toBe(0);
      expect(result.current.transformState.positionY).toBe(0);
    } finally {
      editable.remove();
    }
  });

  it("reads the latest position on each keypress", () => {
    const { result } = mount();
    pressKey("ArrowRight");
    expect(result.current.transformState.positionX).toBe(-50);
    pressKey("ArrowRight");
    expect(result.current.transformState.positionX).toBe(-100);
  });

  it("removes the listener on unmount", () => {
    const { result, unmount } = mount();
    const ctx = result.current;
    unmount();
    pressKey("ArrowRight");
    expect(ctx.transformState.positionX).toBe(0);
  });
});
