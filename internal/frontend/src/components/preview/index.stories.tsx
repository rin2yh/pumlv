import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type JSX } from "react";
import { expect, waitFor, within } from "storybook/test";
import { Preview } from ".";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const NEXT_SVG = "data:image/png;base64,BBBB";

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

export const WithControls: Story = {};

// The react-compiler runtime in browser-test can't always resolve
// useMemoCache for story-local components; skip memoization here so the
// SVG-swap remount we want to exercise actually happens.
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
  render: () => (
    <div style={{ height: 400 }}>
      <SvgSwapper />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText("Zoom level") as HTMLInputElement;

    await waitFor(
      async () => {
        await expect(canvas.getByAltText("preview")).toHaveAttribute("src", NEXT_SVG);
      },
      { timeout: 2000 },
    );
    await expect(input.value).toBe("100");
  },
};
