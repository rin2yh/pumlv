import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileRow } from "./file-row";

const ENTRY = {
  path: "/a/x.puml",
  rel: "x.puml",
  name: "x.puml",
  source: "/a",
};

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

const TRANSPARENT_BG = /^(rgba\(0, 0, 0, 0\)|transparent)$/;

const getButton = (canvasElement: HTMLElement): HTMLButtonElement => {
  const c = within(canvasElement);
  return c.getByRole("button", { name: ENTRY.name });
};

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const button = getButton(canvasElement);

    await expect(button).toHaveAccessibleName(ENTRY.name);
    await expect(button).toHaveAttribute("title", ENTRY.rel);

    const styles = window.getComputedStyle(button);
    await expect(styles.backgroundColor).toMatch(TRANSPARENT_BG);
    await expect(styles.fontWeight).toBe("400");

    await userEvent.click(button);
    await expect(args.onSelect).toHaveBeenCalledWith(ENTRY.path);
  },
};

export const Selected: Story = {
  args: { isSelected: true },
  play: async ({ canvasElement }) => {
    const button = getButton(canvasElement);
    const styles = window.getComputedStyle(button);

    // The selected row is highlighted with a non-transparent background and bolder text.
    // Asserting on the rendered styles (not the className string) makes this fail if the
    // Tailwind class is renamed without re-skinning, or if the highlight is lost entirely.
    await expect(styles.backgroundColor).not.toMatch(TRANSPARENT_BG);
    await expect(styles.fontWeight).toBe("500");

    const defaultBg = window.getComputedStyle(document.body).backgroundColor;
    await expect(styles.backgroundColor).not.toBe(defaultBg);
  },
};
