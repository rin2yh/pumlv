import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ZoomControls } from "./zoom-controls";
import { MAX_SCALE, MIN_SCALE } from "./zoom";

const withTransform: Decorator = (Story) => (
  <div style={{ position: "relative", height: "300px", width: "400px" }}>
    <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE} centerOnInit>
      <Story />
      <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
        <div style={{ width: "200px", height: "150px", background: "#eee" }} />
      </TransformComponent>
    </TransformWrapper>
  </div>
);

const meta: Meta<typeof ZoomControls> = {
  component: ZoomControls,
  decorators: [withTransform],
};

export default meta;

type Story = StoryObj<typeof ZoomControls>;

const zoomInputOf = (root: HTMLElement) =>
  within(root).getByLabelText("Zoom level") as HTMLInputElement;

const typeAndCommit = async (input: HTMLInputElement, value: string, commit = "{Enter}") => {
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.type(input, `${value}${commit}`);
};

export const Default: Story = {};

export const Type: Story = {
  play: async ({ canvasElement }) => {
    const input = zoomInputOf(canvasElement);
    await typeAndCommit(input, "250");
    await expect(input.value).toBe("250");
  },
};

export const Clamp: Story = {
  play: async ({ canvasElement }) => {
    const input = zoomInputOf(canvasElement);
    await typeAndCommit(input, "99999");
    await expect(input.value).toBe(String(MAX_SCALE * 100));
  },
};

export const Escape: Story = {
  play: async ({ canvasElement }) => {
    const input = zoomInputOf(canvasElement);
    await typeAndCommit(input, "250", "{Escape}");
    await expect(input.value).toBe("100");
  },
};

export const ZoomIn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = zoomInputOf(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
    await waitFor(
      async () => {
        await expect(Number(input.value)).toBeGreaterThan(100);
      },
      { timeout: 3000 },
    );
  },
};

export const ZoomOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = zoomInputOf(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Zoom out" }));
    await waitFor(
      async () => {
        await expect(Number(input.value)).toBeLessThan(100);
      },
      { timeout: 3000 },
    );
  },
};

export const Reset: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = zoomInputOf(canvasElement);

    await typeAndCommit(input, "250");
    await expect(input.value).toBe("250");

    await userEvent.click(canvas.getByRole("button", { name: "Reset zoom" }));
    await waitFor(async () => {
      await expect(input.value).toBe("100");
    });
  },
};
