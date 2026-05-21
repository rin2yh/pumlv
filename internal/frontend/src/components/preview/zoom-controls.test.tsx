import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, type JSX } from "react";
import { ZoomControlsHarness } from "./test/wrappers";
import { zoomInput } from "./test/queries";
import { ZoomControls } from "./zoom-controls";
import { MIN_SCALE } from "./zoom";
import { typeAndCommitInput } from "../../test/input";
import { setupRender } from "../../test/render";

const typeAndCommit = (value: string, options?: { key?: string }) =>
  typeAndCommitInput(zoomInput(), value, options);

function Wrapped(): JSX.Element {
  return (
    <ZoomControlsHarness>
      <ZoomControls />
    </ZoomControlsHarness>
  );
}

const render = setupRender();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ZoomControls", () => {
  it(`clamps inputs below MIN_SCALE to the minimum (${MIN_SCALE * 100}%)`, () => {
    render(<Wrapped />);
    typeAndCommit("5");
    expect(zoomInput().value).toBe(String(MIN_SCALE * 100));
  });

  it.each(["abc", "", "-50", "0"])(
    "ignores invalid input '%s' and keeps the display at the current scale",
    (value) => {
      render(<Wrapped />);
      typeAndCommit(value);
      expect(zoomInput().value).toBe("100");
    },
  );

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
});
