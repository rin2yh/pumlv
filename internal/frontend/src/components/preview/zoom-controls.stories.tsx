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

export const Default: Story = {};

export const Type: Story = {
  play: async ({ canvasElement }) => {
    const input = zoomInput(canvasElement);
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, "250{Enter}");
    await expect(input.value).toBe("250");
  },
};

export const Clamp: Story = {
  play: async ({ canvasElement }) => {
    const input = zoomInput(canvasElement);
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, "99999{Enter}");
    await expect(input.value).toBe(String(MAX_SCALE * 100));
  },
};

export const Escape: Story = {
  play: async ({ canvasElement }) => {
    const input = zoomInput(canvasElement);
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, "250{Escape}");
    await expect(input.value).toBe("100");
  },
};

// react-zoom-pan-pinch animates zoomIn/zoomOut/resetTransform over ~300 ms via
// requestAnimationFrame, so allow the value enough time to settle in the real
// browser. The 100 ms pre-click warmup gives TransformWrapper a beat to finish
// setting up its layout-derived state before the first interaction.
const ANIM_TIMEOUT = { timeout: 3000, interval: 50 };
const waitForReady = () => new Promise((r) => setTimeout(r, 100));

export const ZoomIn: Story = {
  play: async ({ canvasElement }) => {
    await waitForReady();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Zoom in" }));
    await waitFor(
      () => expect(Number(zoomInput(canvasElement).value)).toBeGreaterThan(100),
      ANIM_TIMEOUT,
    );
  },
};

export const ZoomOut: Story = {
  play: async ({ canvasElement }) => {
    await waitForReady();
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Zoom out" }));
    await waitFor(
      () => expect(Number(zoomInput(canvasElement).value)).toBeLessThan(100),
      ANIM_TIMEOUT,
    );
  },
};

export const Reset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = zoomInput(canvasElement);

    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, "250{Enter}");
    await expect(input.value).toBe("250");

    await userEvent.click(canvas.getByRole("button", { name: "Reset zoom" }));
    await waitFor(() => expect(zoomInput(canvasElement).value).toBe("100"), ANIM_TIMEOUT);
  },
};
