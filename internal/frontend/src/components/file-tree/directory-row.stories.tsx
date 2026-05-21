import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DirectoryRow } from "./directory-row";
import type { DirNode } from "./tree";

const DIR: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };

const meta: Meta<typeof DirectoryRow> = {
  component: DirectoryRow,
  args: {
    node: DIR,
    depth: 1,
    isExpanded: true,
    onToggle: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof DirectoryRow>;

const dirButton = (canvasElement: HTMLElement): HTMLButtonElement =>
  within(canvasElement).getByTitle(DIR.name) as HTMLButtonElement;

export const Expanded: Story = {
  play: async ({ canvasElement, args, step }) => {
    const button = dirButton(canvasElement);

    await step("aria-expanded reflects the expanded state", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "true");
    });

    await step("renders a down chevron when expanded", async () => {
      await expect(button.textContent).toContain("▾");
    });

    await step("click fires onToggle with the node key", async () => {
      await userEvent.click(button);
      await expect(args.onToggle).toHaveBeenCalledWith(DIR.key);
    });
  },
};

export const Collapsed: Story = {
  args: { isExpanded: false },
  play: async ({ canvasElement, step }) => {
    const button = dirButton(canvasElement);

    await step("aria-expanded reflects the collapsed state", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "false");
    });

    await step("renders a right chevron when collapsed", async () => {
      await expect(button.textContent).toContain("▸");
    });
  },
};

export const Depth0: Story = {
  args: { depth: 0 },
  play: async ({ canvasElement, step }) => {
    const button = dirButton(canvasElement);

    await step("source-root rows use the smaller font size", async () => {
      // text-xs => 12px
      await expect(window.getComputedStyle(button).fontSize).toBe("12px");
    });
  },
};

export const Depth1: Story = {
  args: { depth: 1 },
  play: async ({ canvasElement, step }) => {
    const button = dirButton(canvasElement);

    await step("nested directories use the larger font size", async () => {
      // text-sm => 14px
      await expect(window.getComputedStyle(button).fontSize).toBe("14px");
    });
  },
};
