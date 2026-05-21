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

// bg-violet-50 — the FileRow selected-row highlight color. Compared directly
// because page bg / hover bg comparisons are sensitive to leftover cursor
// position across the shared Playwright session.
const SELECTED_BG = "oklch(0.969 0.016 293.756)";

export const Empty: Story = {
  args: { files: [] },
  play: async ({ canvasElement, step }) => {
    await step("shows the empty-state placeholder", async () => {
      await expect(within(canvasElement).getByText("no files found")).toBeInTheDocument();
    });

    await step("does not render the <nav> container", async () => {
      await expect(canvasElement.querySelector("nav")).toBeNull();
    });
  },
};

export const Flat: Story = {
  args: { files: flatFiles },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders one directory toggle per source root", async () => {
      const dirs = canvasElement.querySelectorAll("button[aria-expanded]");
      await expect(dirs.length).toBe(2);
    });

    await step("renders one file row per file", async () => {
      await expect(canvas.getByRole("button", { name: "x.puml" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "y.puml" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "z.puml" })).toBeInTheDocument();
    });
  },
};

export const Nested: Story = {
  args: { files: nestedFiles },
  play: async ({ canvasElement, step }) => {
    await step("renders nested directory toggles", async () => {
      const dirTitles = Array.from(
        canvasElement.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"),
      ).map((b) => b.getAttribute("title"));
      await expect(dirTitles).toEqual(["/r", "sub", "deep"]);
    });

    await step("deeper rows are visually indented further than shallower ones", async () => {
      const top = within(canvasElement).getByRole("button", { name: "top.puml" });
      const deep = within(canvasElement).getByRole("button", { name: "b.puml" });
      const topPad = Number.parseFloat(window.getComputedStyle(top).paddingLeft);
      const deepPad = Number.parseFloat(window.getComputedStyle(deep).paddingLeft);
      await expect(deepPad).toBeGreaterThan(topPad);
    });
  },
};

export const WithSelection: Story = {
  args: { files: flatFiles, active: "/a/y.puml" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("button", { name: "y.puml" });
    const other = canvas.getByRole("button", { name: "z.puml" });

    await step("the selected file row carries the highlight background", async () => {
      const styles = window.getComputedStyle(selected);
      await expect(styles.backgroundColor).toBe(SELECTED_BG);
      await expect(styles.fontWeight).toBe("500");
    });

    await step("non-selected rows do not carry the highlight background", async () => {
      await expect(window.getComputedStyle(other).backgroundColor).not.toBe(SELECTED_BG);
    });
  },
};

export const Collapse: Story = {
  args: { files: flatFiles },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const toggle = canvasElement.querySelector<HTMLButtonElement>(
      'button[aria-expanded][title="/a"]',
    )!;

    await step("collapsing a source root hides its children", async () => {
      await userEvent.click(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(canvas.queryByRole("button", { name: "x.puml" })).toBeNull();
      await expect(canvas.queryByRole("button", { name: "y.puml" })).toBeNull();
    });

    await step("re-expanding restores the children", async () => {
      await userEvent.click(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(canvas.getByRole("button", { name: "x.puml" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "y.puml" })).toBeInTheDocument();
    });
  },
};
