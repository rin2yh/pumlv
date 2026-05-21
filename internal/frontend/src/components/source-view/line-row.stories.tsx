import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { LineRow } from "./line-row";
import { FOLD_LABEL } from "./source-fold";

const tokens = [
  { content: "class A ", color: "#111" },
  { content: "{", color: "#222" },
];

const meta: Meta<typeof LineRow> = {
  component: LineRow,
  args: {
    tokens,
    depth: 0,
    isFoldStart: false,
    isFolded: false,
    onToggle: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof LineRow>;

export const Plain: Story = {};

export const FoldStart: Story = {
  args: { isFoldStart: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: FOLD_LABEL });
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalled();
  },
};

export const Folded: Story = {
  args: { isFoldStart: true, isFolded: true },
};

export const Indented: Story = {
  args: { depth: 2, isFoldStart: true },
};
