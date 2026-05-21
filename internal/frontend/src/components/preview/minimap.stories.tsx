import type { Meta, StoryObj } from "@storybook/react-vite";
import { MinimapHarness } from "./test/wrappers";
import { SAMPLE_SVG } from "./test/fixtures";

const UPDATED_SVG = "data:image/png;base64,NEXT";

const meta: Meta<typeof MinimapHarness> = {
  component: MinimapHarness,
  args: { svg: SAMPLE_SVG },
};

export default meta;

type Story = StoryObj<typeof MinimapHarness>;

export const Default: Story = {};

export const Updated: Story = {
  args: { svg: UPDATED_SVG },
};
