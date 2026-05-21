import { useState, type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Preview } from "./index";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const NEXT_SVG = "data:image/png;base64,BBBB";
const SWAP_LABEL = "swap svg";

function SwappablePreview({ initial, next }: { initial: string; next: string }): JSX.Element {
  const [svg, setSvg] = useState(initial);
  return (
    <div style={{ height: "300px" }}>
      <button type="button" onClick={() => setSvg(next)}>
        {SWAP_LABEL}
      </button>
      <Preview svg={svg} />
    </div>
  );
}

const meta: Meta<typeof Preview> = {
  component: Preview,
  args: { svg: SAMPLE_SVG },
  decorators: [
    (Story) => (
      <div style={{ height: "300px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Preview>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders an <img> with the configured src", async () => {
      const img = canvas.getByAltText("preview") as HTMLImageElement;
      await expect(img).toHaveAttribute("src", SAMPLE_SVG);
    });
  },
};

export const WithControls: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders the zoom-in / zoom-out / reset buttons", async () => {
      await expect(canvas.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Reset zoom" })).toBeInTheDocument();
    });

    await step("the zoom display starts at 100%", async () => {
      const zoomInput = canvas.getByLabelText("Zoom level") as HTMLInputElement;
      await expect(zoomInput.value).toBe("100");
    });
  },
};

export const ResetOnSrcChange: Story = {
  render: () => <SwappablePreview initial={SAMPLE_SVG} next={NEXT_SVG} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const zoomInput = canvas.getByLabelText("Zoom level") as HTMLInputElement;

    await step("manually typing a zoom value moves the display off 100", async () => {
      await userEvent.click(zoomInput);
      await userEvent.clear(zoomInput);
      await userEvent.type(zoomInput, "250{Enter}");
      await expect(zoomInput.value).toBe("250");
    });

    await step("changing svg remounts the TransformWrapper and snaps zoom to 100", async () => {
      await userEvent.click(canvas.getByRole("button", { name: SWAP_LABEL }));
      const after = canvas.getByLabelText("Zoom level") as HTMLInputElement;
      await expect(after.value).toBe("100");
      await expect(canvas.getByAltText("preview")).toHaveAttribute("src", NEXT_SVG);
    });
  },
};
