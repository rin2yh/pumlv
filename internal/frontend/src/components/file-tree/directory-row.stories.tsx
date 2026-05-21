import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DirectoryRow } from "./directory-row";
import type { DirNode } from "./tree";

const dir: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };
const nameMatcher = new RegExp(dir.name);

const meta: Meta<typeof DirectoryRow> = {
  component: DirectoryRow,
  args: {
    node: dir,
    depth: 1,
    isExpanded: true,
    onToggle: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof DirectoryRow>;

export const Expanded: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalledWith(dir.key);
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
