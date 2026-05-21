import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { FileTree } from ".";
import { flatFiles, nestedFiles } from "./test/fixtures";

const meta: Meta<typeof FileTree> = {
  component: FileTree,
  args: {
    files: flatFiles,
    active: null,
    onSelect: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof FileTree>;

export const Empty: Story = {
  args: { files: [] },
};

export const Flat: Story = {};

export const Nested: Story = {
  args: { files: nestedFiles },
};

export const WithSelection: Story = {
  args: { active: "/a/y.puml" },
};

export const Collapse: Story = {
  play: async ({ canvasElement, step }) => {
    const toggleA = () =>
      within(canvasElement).getByRole("button", { name: /\/a/, expanded: true });

    await step("clicking a directory toggle hides its children", async () => {
      await userEvent.click(toggleA());
      await expect(within(canvasElement).queryByRole("button", { name: "x.puml" })).toBeNull();
      await expect(within(canvasElement).queryByRole("button", { name: "y.puml" })).toBeNull();
    });

    await step("re-clicking restores the original tree", async () => {
      await userEvent.click(
        within(canvasElement).getByRole("button", { name: /\/a/, expanded: false }),
      );
      await expect(
        within(canvasElement).getByRole("button", { name: "x.puml" }),
      ).toBeInTheDocument();
      await expect(
        within(canvasElement).getByRole("button", { name: "y.puml" }),
      ).toBeInTheDocument();
    });
  },
};
