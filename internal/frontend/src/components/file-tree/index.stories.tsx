import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent } from "storybook/test";
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

export const Flat: Story = {};

export const Nested: Story = { args: { files: nestedFiles } };

export const WithSelection: Story = { args: { active: "/a/y.puml" } };

export const Collapse: Story = {
  play: async ({ canvasElement, step }) => {
    const toggle = canvasElement.querySelector<HTMLButtonElement>('button[title="/a"]')!;
    const filesIn = () =>
      [...canvasElement.querySelectorAll<HTMLButtonElement>("button:not([aria-expanded])")].map(
        (b) => b.textContent,
      );
    const before = filesIn();

    await step("collapsing a directory hides its files", async () => {
      await userEvent.click(toggle);
      await expect(filesIn()).toEqual(["z.puml"]);
    });

    await step("re-expanding restores the original file list", async () => {
      await userEvent.click(toggle);
      await expect(filesIn()).toEqual(before);
    });
  },
};
