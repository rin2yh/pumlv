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
  play: async ({ canvasElement, args, step }) => {
    const button = within(canvasElement).getByTitle(NODE.name) as HTMLButtonElement;

    await step("aria-expanded reflects the expanded state", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "true");
    });

    await step("renders the down chevron", async () => {
      await expect(button.textContent).toContain("▾");
    });

    await step("click fires onToggle with the node key", async () => {
      await userEvent.click(button);
      await expect(args.onToggle).toHaveBeenCalledWith(NODE.key);
    });
  },
};

export const Collapsed: Story = {
  args: { isExpanded: false },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByTitle(NODE.name) as HTMLButtonElement;

    await step("aria-expanded reflects the collapsed state", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "false");
    });

    await step("renders the right chevron", async () => {
      await expect(button.textContent).toContain("▸");
    });
  },
};

export const Depth0: Story = {
  args: { depth: 0 },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByTitle(NODE.name) as HTMLButtonElement;

    await step("source-root rows use the smaller font size", async () => {
      const fontSize = parseFloat(window.getComputedStyle(button).fontSize);
      await expect(fontSize).toBeLessThan(14);
    });
  },
};

export const Depth1: Story = {
  args: { depth: 1 },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByTitle(NODE.name) as HTMLButtonElement;

    await step("nested rows use the larger font size", async () => {
      const fontSize = parseFloat(window.getComputedStyle(button).fontSize);
      await expect(fontSize).toBeGreaterThanOrEqual(14);
    });
  },
};
