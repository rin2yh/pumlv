import type { Meta, StoryObj } from "@storybook/react-vite";
import { MinimapHarness } from "./test/wrappers";
import { NEXT_SVG, SAMPLE_SVG } from "./test/fixtures";

const meta: Meta<typeof MinimapHarness> = {
  component: MinimapHarness,
  args: { svg: SAMPLE_SVG },
};

export default meta;

type Story = StoryObj<typeof MinimapHarness>;

export const Default: Story = {};

export const Updated: Story = {
  args: { svg: NEXT_SVG },
};
