import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileRow } from "./file-row";
import { flatFiles } from "./test/fixtures";

const ENTRY = flatFiles[0]!;

const meta: Meta<typeof FileRow> = {
  component: FileRow,
  args: {
    entry: ENTRY,
    depth: 1,
    isSelected: false,
    onSelect: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof FileRow>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: ENTRY.name });
    await userEvent.click(button);
    await expect(args.onSelect).toHaveBeenCalledWith(ENTRY.path);
  },
};

export const Selected: Story = { args: { isSelected: true } };
