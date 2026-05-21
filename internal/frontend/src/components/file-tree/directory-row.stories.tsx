import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DirectoryRow } from "./directory-row";
import type { DirNode } from "./tree";

const NODE: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };

const meta: Meta<typeof DirectoryRow> = {
  component: DirectoryRow,
  args: {
    node: NODE,
    depth: 1,
    isExpanded: true,
    onToggle: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof DirectoryRow>;

export const Expanded: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: /sub/ });
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalledWith(NODE.key);
  },
};

export const Collapsed: Story = {
  args: { isExpanded: false },
};

export const Depth0: Story = {
  args: { depth: 0 },
};

export const Depth1: Story = {
  args: { depth: 1 },
};
