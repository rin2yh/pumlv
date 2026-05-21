import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type JSX } from "react";
import { expect, waitFor, within } from "storybook/test";
import { Preview } from ".";
import { NEXT_SVG, SAMPLE_SVG } from "./test/fixtures";
import { ZOOM_INPUT_LABEL } from "./zoom-controls";

const meta: Meta<typeof Preview> = {
  component: Preview,
  args: { svg: SAMPLE_SVG },
  decorators: [
    (Story) => (
      <div style={{ height: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Preview>;

export const Default: Story = {};

function SvgSwapper(): JSX.Element {
  "use no memo";
  const [svg, setSvg] = useState(SAMPLE_SVG);
  useEffect(() => {
    const t = setTimeout(() => setSvg(NEXT_SVG), 200);
    return () => clearTimeout(t);
  }, []);
  return <Preview svg={svg} />;
}

export const ResetOnSrcChange: Story = {
  render: () => <SvgSwapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(ZOOM_INPUT_LABEL) as HTMLInputElement;

    await waitFor(
      async () => {
        await expect(canvas.getByAltText("preview")).toHaveAttribute("src", NEXT_SVG);
      },
      { timeout: 2000 },
    );
    await expect(input.value).toBe("100");
  },
};
