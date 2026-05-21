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

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    await step("the input shows 100 on initial render", async () => {
      await expect(zoomInputOf(canvasElement).value).toBe("100");
    });
  },
};

export const Type: Story = {
  play: async ({ canvasElement, step }) => {
    const input = zoomInputOf(canvasElement);

    await step("typing 250 + Enter commits the new zoom value", async () => {
      await typeAndCommit(input, "250");
      await expect(input.value).toBe("250");
    });
  },
};

export const Clamp: Story = {
  play: async ({ canvasElement, step }) => {
    const input = zoomInputOf(canvasElement);

    await step("typing a huge value clamps to MAX_SCALE * 100", async () => {
      await typeAndCommit(input, "99999");
      await expect(input.value).toBe(String(MAX_SCALE * 100));
    });
  },
};

export const Escape: Story = {
  play: async ({ canvasElement, step }) => {
    const input = zoomInputOf(canvasElement);

    await step("Escape reverts the draft to the previously committed value", async () => {
      await typeAndCommit(input, "250", "{Escape}");
      await expect(input.value).toBe("100");
    });
  },
};

export const ZoomIn: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = zoomInputOf(canvasElement);

    await step("clicking 'Zoom in' raises the displayed zoom above 100", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Zoom in" }));
      await waitFor(
        async () => {
          await expect(Number(input.value)).toBeGreaterThan(100);
        },
        { timeout: 3000 },
      );
    });
  },
};

export const ZoomOut: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = zoomInputOf(canvasElement);

    await step("clicking 'Zoom out' drops the displayed zoom below 100", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Zoom out" }));
      await waitFor(
        async () => {
          await expect(Number(input.value)).toBeLessThan(100);
        },
        { timeout: 3000 },
      );
    });
  },
};

export const Reset: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = zoomInputOf(canvasElement);

    await step("starting from 250%, 'Reset zoom' returns the display to 100%", async () => {
      await typeAndCommit(input, "250");
      await expect(input.value).toBe("250");

      await userEvent.click(canvas.getByRole("button", { name: "Reset zoom" }));
      await waitFor(async () => {
        await expect(input.value).toBe("100");
      });
    });
  },
};
