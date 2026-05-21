import { type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { ZoomControls } from "./zoom-controls";
import { MAX_SCALE, MIN_SCALE } from "./zoom";

function Wrapped(): JSX.Element {
  "use no memo";
  return (
    <div style={{ width: 480, height: 360, position: "relative" }}>
      <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE}>
        <ZoomControls />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div style={{ width: 480, height: 360 }} />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

const meta: Meta<typeof Wrapped> = {
  component: Wrapped,
};

export default meta;

type Story = StoryObj<typeof Wrapped>;

const zoomInput = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    await step("input shows 100 on initial render", async () => {
      await expect(zoomInput(canvasElement).value).toBe("100");
    });
  },
};

export const Type: Story = {
  play: async ({ canvasElement, step }) => {
    const input = zoomInput(canvasElement);

    await step("typing 250 + Enter commits the new zoom", async () => {
      await userEvent.click(input);
      await userEvent.clear(input);
      await userEvent.type(input, "250{Enter}");
      await expect(input.value).toBe("250");
    });
  },
};

export const Clamp: Story = {
  play: async ({ canvasElement, step }) => {
    const input = zoomInput(canvasElement);

    await step("an out-of-range value clamps to MAX_SCALE", async () => {
      await userEvent.click(input);
      await userEvent.clear(input);
      await userEvent.type(input, "99999{Enter}");
      await expect(input.value).toBe(String(MAX_SCALE * 100));
    });
  },
};

export const Escape: Story = {
  play: async ({ canvasElement, step }) => {
    const input = zoomInput(canvasElement);

    await step("Escape discards the draft without changing the zoom", async () => {
      await userEvent.click(input);
      await userEvent.clear(input);
      await userEvent.type(input, "250{Escape}");
      await expect(input.value).toBe("100");
    });
  },
};

// react-zoom-pan-pinch animates zoomIn/zoomOut/resetTransform over ~300 ms via
// requestAnimationFrame, so allow the value enough time to settle in the real
// browser.
const ANIM_TIMEOUT = { timeout: 3000, interval: 50 };

// Give TransformWrapper a beat after mount to initialize its layout-derived
// state. Without this the first click sometimes lands before the wrapper has
// finished setting up, leaving the displayed scale stuck at the initial value.
const waitForReady = () => new Promise((r) => setTimeout(r, 100));

export const ZoomIn: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await waitForReady();

    await step("clicking 'Zoom in' raises the displayed zoom above 100", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
      await waitFor(
        () => expect(Number(zoomInput(canvasElement).value)).toBeGreaterThan(100),
        ANIM_TIMEOUT,
      );
    });
  },
};

export const ZoomOut: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await waitForReady();

    await step("clicking 'Zoom out' drops the displayed zoom below 100", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Zoom out" }));
      await waitFor(
        () => expect(Number(zoomInput(canvasElement).value)).toBeLessThan(100),
        ANIM_TIMEOUT,
      );
    });
  },
};

export const Reset: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = zoomInput(canvasElement);

    await step("first bump zoom to 250 so reset has something to restore", async () => {
      await userEvent.click(input);
      await userEvent.clear(input);
      await userEvent.type(input, "250{Enter}");
      await expect(input.value).toBe("250");
    });

    await step("clicking 'Reset zoom' returns to 100", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Reset zoom" }));
      await waitFor(() => expect(zoomInput(canvasElement).value).toBe("100"), ANIM_TIMEOUT);
    });
  },
};
