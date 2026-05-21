import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileTree } from ".";
import { flatFiles, nestedFiles } from "./test/fixtures";

const meta: Meta<typeof FileTree> = {
  component: FileTree,
  args: {
    files: flatFiles,
    active: null,
    onSelect: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof FileTree>;

export const Empty: Story = {
  args: { files: [] },
};

export const Flat: Story = {
  args: { files: flatFiles },
};

export const Nested: Story = {
  args: { files: nestedFiles },
};

export const WithSelection: Story = {
  args: { files: flatFiles, active: "/a/y.puml" },
};

export const Collapse: Story = {
  args: { files: flatFiles },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-expanded][title="/a"]',
    )!;

    await userEvent.click(toggle);
    await expect(canvas.queryByRole("button", { name: "x.puml" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "y.puml" })).toBeNull();

    await userEvent.click(toggle);
    await expect(canvas.getByRole("button", { name: "x.puml" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "y.puml" })).toBeInTheDocument();
  },
};
