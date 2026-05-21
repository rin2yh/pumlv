import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type JSX } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { ZoomControls } from "./zoom-controls";
import { MAX_SCALE, MIN_SCALE } from "./zoom";
import { setupRender } from "../../test/render";

vi.mock("./use-keyboard-pan", () => ({
  useKeyboardPan: () => {},
}));

const zoomInput = () => document.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;

const button = (label: string) =>
  document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

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

function Wrapped(): JSX.Element {
  return (
    <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE}>
      <ZoomControls />
      <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
        <div />
      </TransformComponent>
    </TransformWrapper>
  );
}

const render = setupRender();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ZoomControls", () => {
  it.each(["Zoom in", "Zoom out", "Reset zoom"])("renders the '%s' button", (label) => {
    render(<Wrapped />);
    expect(button(label)).not.toBeNull();
  });

  it("displays 100% on initial render", () => {
    render(<Wrapped />);
    expect(zoomInput().value).toBe("100");
  });

  it.each([
    { input: "150", expected: "150" },
    { input: "75", expected: "75" },
    { input: "200%", expected: "200" },
  ])("committing '$input' updates the displayed zoom to $expected%", ({ input, expected }) => {
    render(<Wrapped />);
    typeAndCommit(input);
    expect(zoomInput().value).toBe(expected);
  });

  it("clamps inputs below MIN_SCALE to the minimum (10%)", () => {
    render(<Wrapped />);
    typeAndCommit("5");
    expect(zoomInput().value).toBe(String(MIN_SCALE * 100));
  });

  it("clamps inputs above MAX_SCALE to the maximum (5000%)", () => {
    render(<Wrapped />);
    typeAndCommit("10000");
    expect(zoomInput().value).toBe(String(MAX_SCALE * 100));
  });

  it.each(["abc", "", "-50", "0"])(
    "ignores invalid input '%s' and keeps the display at the current scale",
    (value) => {
      render(<Wrapped />);
      typeAndCommit(value);
      expect(zoomInput().value).toBe("100");
    },
  );

  it("pressing Escape reverts the draft without changing the zoom", () => {
    render(<Wrapped />);
    typeAndCommit("250", { key: "Escape" });
    expect(zoomInput().value).toBe("100");
  });

  it("focusing then blurring without typing keeps the displayed scale unchanged", () => {
    render(<Wrapped />);
    const input = zoomInput();
    act(() => {
      input.focus();
    });
    act(() => {
      input.blur();
    });
    expect(zoomInput().value).toBe("100");
  });

  // react-zoom-pan-pinch's zoomIn/zoomOut/resetTransform animate over ~200–300 ms
  // via requestAnimationFrame; advance fake timers so the displayed scale lands
  // on its final value within the test.
  describe("animated controls", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const settleAnimation = async () => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    };

    it("clicking 'Zoom in' increases the displayed zoom above 100%", async () => {
      render(<Wrapped />);
      act(() => {
        button("Zoom in").click();
      });
      await settleAnimation();
      expect(Number(zoomInput().value)).toBeGreaterThan(100);
    });

    it("clicking 'Zoom out' decreases the displayed zoom below 100%", async () => {
      render(<Wrapped />);
      act(() => {
        button("Zoom out").click();
      });
      await settleAnimation();
      expect(Number(zoomInput().value)).toBeLessThan(100);
    });

    it("clicking 'Reset zoom' restores 100% after the zoom was changed", async () => {
      render(<Wrapped />);
      typeAndCommit("250");
      expect(zoomInput().value).toBe("250");

      act(() => {
        button("Reset zoom").click();
      });
      await settleAnimation();
      expect(zoomInput().value).toBe("100");
    });
  });
});
