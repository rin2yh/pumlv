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

export const Empty: Story = { args: { files: [] } };

export const Flat: Story = { args: { files: flatFiles } };

export const Nested: Story = { args: { files: nestedFiles } };

export const WithSelection: Story = { args: { files: flatFiles, active: "/a/y.puml" } };

export const Collapse: Story = {
  args: { files: flatFiles },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByTitle("/a") as HTMLButtonElement;
    const fileButtons = () => canvasElement.querySelectorAll("button:not([aria-expanded])");

    await userEvent.click(toggle);
    await expect([...fileButtons()].map((b) => b.textContent)).toEqual(["z.puml"]);

    await userEvent.click(toggle);
    await expect([...fileButtons()].map((b) => b.textContent)).toEqual([
      "x.puml",
      "y.puml",
      "z.puml",
    ]);
  },
};
