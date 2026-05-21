import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DirectoryRow } from "./directory-row";
import { rowIndentPx, type DirNode } from "./tree";

const dir: DirNode = { kind: "dir", key: "/r/sub", name: "sub", children: [] };
const nameMatcher = new RegExp(dir.name);
const TEXT_XS_PX = 12;
const TEXT_SM_PX = 14;
const SLATE_400 = "oklch(0.704 0.04 256.788)";
const SLATE_500 = "oklch(0.554 0.046 257.417)";
const SLATE_700 = "oklch(0.372 0.044 257.287)";

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

function chevronOf(button: HTMLElement): HTMLElement {
  const chevron = button.firstElementChild as HTMLElement | null;
  if (!chevron) throw new Error("chevron span not found");
  return chevron;
}

export const Expanded: Story = {
  play: async ({ canvasElement, args, step }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });
    const chevron = chevronOf(button);

    await step("the chevron renders pointing down in slate-400", async () => {
      await expect(chevron.textContent).toBe("▾");
      await expect(window.getComputedStyle(chevron).color).toBe(SLATE_400);
      await expect(button).toHaveAttribute("aria-expanded", "true");
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
    const chevron = chevronOf(button);

    await step("the chevron renders pointing right in slate-400", async () => {
      await expect(chevron.textContent).toBe("▸");
      await expect(window.getComputedStyle(chevron).color).toBe(SLATE_400);
      await expect(button).toHaveAttribute("aria-expanded", "false");
    });
  },
};

export const Depth0: Story = {
  args: { depth: 0 },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });
    const styles = window.getComputedStyle(button);
    await expect(parseFloat(styles.fontSize)).toBe(TEXT_XS_PX);
    await expect(parseFloat(styles.paddingLeft)).toBe(rowIndentPx(0));
    await expect(styles.color).toBe(SLATE_500);
    await expect(styles.fontWeight).toBe("500");
  },
};

export const Depth1: Story = {
  args: { depth: 1 },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: nameMatcher });
    const styles = window.getComputedStyle(button);
    await expect(parseFloat(styles.fontSize)).toBe(TEXT_SM_PX);
    await expect(parseFloat(styles.paddingLeft)).toBe(rowIndentPx(1));
    await expect(styles.color).toBe(SLATE_700);
    await expect(styles.fontWeight).toBe("400");
  },
};
