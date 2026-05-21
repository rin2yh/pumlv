import type { Meta, StoryObj } from "@storybook/react-vite";
import type { JSX } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { MAX_SCALE, MIN_SCALE } from "./zoom";
import { ZOOM_INPUT_LABEL, ZoomControls } from "./zoom-controls";

// "use no memo" — React Compiler runtime in browser-test can't resolve
// useMemoCache for story-local components.
function Wrapped(): JSX.Element {
  "use no memo";
  return (
    <div style={{ position: "relative", height: 320, width: 480 }}>
      <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE}>
        <ZoomControls />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div style={{ width: 200, height: 200 }} />
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

const getInput = (canvasElement: HTMLElement): HTMLInputElement =>
  within(canvasElement).getByLabelText(ZOOM_INPUT_LABEL) as HTMLInputElement;

// rzpp silently drops zoom calls before its first layout pass.
const settleMount = () => new Promise((r) => setTimeout(r, 100));

export const Default: Story = {};

export const Type: Story = {
  play: async ({ canvasElement }) => {
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard("250{Enter}");
    await expect(input.value).toBe("250");
  },
};

export const Clamp: Story = {
  play: async ({ canvasElement }) => {
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard("99999{Enter}");
    await expect(input.value).toBe(String(MAX_SCALE * 100));
  },
};

export const Escape: Story = {
  play: async ({ canvasElement }) => {
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard("250{Escape}");
    await expect(input.value).toBe("100");
  },
};

export const ZoomIn: Story = {
  play: async ({ canvasElement }) => {
    await settleMount();
    const button = within(canvasElement).getByRole("button", { name: "Zoom in" });
    await userEvent.click(button);
    await waitFor(
      async () => {
        await expect(Number(getInput(canvasElement).value)).toBeGreaterThan(100);
      },
      { timeout: 3000, interval: 50 },
    );
  },
};

export const ZoomOut: Story = {
  play: async ({ canvasElement }) => {
    await settleMount();
    const button = within(canvasElement).getByRole("button", { name: "Zoom out" });
    await userEvent.click(button);
    await waitFor(
      async () => {
        await expect(Number(getInput(canvasElement).value)).toBeLessThan(100);
      },
      { timeout: 3000, interval: 50 },
    );
  },
};

export const Reset: Story = {
  play: async ({ canvasElement }) => {
    await settleMount();
    const input = getInput(canvasElement);
    await userEvent.click(input);
    await userEvent.keyboard("250{Enter}");
    await expect(input.value).toBe("250");

    const reset = within(canvasElement).getByRole("button", { name: "Reset zoom" });
    await userEvent.click(reset);
    await waitFor(
      async () => {
        await expect(getInput(canvasElement).value).toBe("100");
      },
      { timeout: 3000, interval: 50 },
    );
  },
};
