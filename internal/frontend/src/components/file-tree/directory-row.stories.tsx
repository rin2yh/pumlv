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
    const button = within(canvasElement).getByRole("button", { name: /sub/ });

    await step("exposes aria-expanded=true and the down chevron", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "true");
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
    const button = within(canvasElement).getByRole("button", { name: /sub/ });

    await step("exposes aria-expanded=false and the right chevron", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(button.textContent).toContain("▸");
    });
  },
};

export const Depth0: Story = {
  args: { depth: 0 },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: /sub/ });

    await step("source-root rows render at the smaller font size", async () => {
      const { fontSize } = window.getComputedStyle(button);
      await expect(fontSize).toBe("12px");
    });
  },
};

export const Depth1: Story = {
  args: { depth: 1 },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: /sub/ });

    await step("nested directories render at the larger font size", async () => {
      const { fontSize } = window.getComputedStyle(button);
      await expect(fontSize).toBe("14px");
    });
  },
};
