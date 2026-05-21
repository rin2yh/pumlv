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
  play: async ({ canvasElement, args, step }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });

    await step("exposes aria-expanded=true and a down chevron", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(button.textContent).toContain("▾");
    });

    await step("click fires onToggle with the node key", async () => {
      await userEvent.click(button);
      await expect(args.onToggle).toHaveBeenCalledWith(dir.key);
    });
  },
};

export const Collapsed: Story = {
  args: { isExpanded: false },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });

    await step("exposes aria-expanded=false and a right chevron", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(button.textContent).toContain("▸");
    });
  },
};

export const Depth0: Story = {
  args: { depth: 0 },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });
    const fontSize = parseFloat(window.getComputedStyle(button).fontSize);
    await expect(fontSize).toBeLessThan(14);
  },
};

export const Depth1: Story = {
  args: { depth: 1 },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });
    const fontSize = parseFloat(window.getComputedStyle(button).fontSize);
    await expect(fontSize).toBeGreaterThanOrEqual(14);
  },
};
