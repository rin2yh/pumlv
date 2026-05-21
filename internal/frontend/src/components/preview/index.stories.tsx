import { useState, type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

export const Default: Story = {};

export const WithControls: Story = {};

export const ResetOnSrcChange: Story = {
  decorators: [],
  render: () => <SwappablePreview initial={SAMPLE_SVG} next={NEXT_SVG} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const zoomInput = canvas.getByLabelText("Zoom level") as HTMLInputElement;

    await userEvent.click(zoomInput);
    await userEvent.clear(zoomInput);
    await userEvent.type(zoomInput, "250{Enter}");
    await expect(zoomInput.value).toBe("250");

    await userEvent.click(canvas.getByRole("button", { name: SWAP_LABEL }));
    await waitFor(async () => {
      const after = canvas.getByLabelText("Zoom level") as HTMLInputElement;
      await expect(after.value).toBe("100");
    });
  },
};
