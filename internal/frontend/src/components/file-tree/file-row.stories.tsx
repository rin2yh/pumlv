import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileRow } from "./file-row";
import { flatFiles } from "./test/fixtures";

const ENTRY = flatFiles[0]!;

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

// Storybook's browser-test runner shares one Playwright page across stories,
// so a previous story's cursor position can leave the row in :hover and the
// computed background no longer matches the page background. Compare against
// the Selected highlight color instead — that flag flips with isSelected
// without being affected by cursor hover.
const SELECTED_BG = "oklch(0.969 0.016 293.756)"; // bg-violet-50

export const Default: Story = {
  play: async ({ canvasElement, args, step }) => {
    const button = within(canvasElement).getByRole("button", { name: ENTRY.name });

    await step("rel path is exposed as the tooltip", async () => {
      await expect(button).toHaveAttribute("title", ENTRY.rel);
    });

    await step("renders without the selected-row highlight", async () => {
      const styles = window.getComputedStyle(button);
      await expect(styles.backgroundColor).not.toBe(SELECTED_BG);
      await expect(styles.fontWeight).toBe("400");
    });

    await step("click fires onSelect with the file path", async () => {
      await userEvent.click(button);
      await expect(args.onSelect).toHaveBeenCalledWith(ENTRY.path);
    });
  },
};

export const Selected: Story = {
  args: { isSelected: true },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: ENTRY.name });

    await step("selected row is visually highlighted", async () => {
      const styles = window.getComputedStyle(button);
      await expect(styles.backgroundColor).toBe(SELECTED_BG);
      await expect(styles.fontWeight).toBe("500");
    });
  },
};
