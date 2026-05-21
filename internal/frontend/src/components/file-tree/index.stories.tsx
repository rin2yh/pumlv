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

const pageBg = () => window.getComputedStyle(document.body).backgroundColor;

const dirButtons = (canvas: HTMLElement) => [
  ...canvas.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"),
];

const fileButtons = (canvas: HTMLElement) => [
  ...canvas.querySelectorAll<HTMLButtonElement>("button:not([aria-expanded])"),
];

const paddingLeftPx = (el: HTMLElement) => parseFloat(window.getComputedStyle(el).paddingLeft);

export const Empty: Story = {
  args: { files: [] },
  play: async ({ canvasElement, step }) => {
    await step("renders the no-files placeholder", async () => {
      await expect(within(canvasElement).getByText("no files found")).toBeInTheDocument();
    });

    await step("does not render the tree nav", async () => {
      await expect(canvasElement.querySelector("nav")).toBeNull();
    });
  },
};

export const Flat: Story = {
  play: async ({ canvasElement, step }) => {
    await step("renders one directory toggle per source root", async () => {
      await expect(dirButtons(canvasElement).map((b) => b.getAttribute("title"))).toEqual([
        "/a",
        "/b",
      ]);
    });

    await step("renders every file row", async () => {
      await expect(fileButtons(canvasElement).map((b) => b.textContent)).toEqual([
        "x.puml",
        "y.puml",
        "z.puml",
      ]);
    });
  },
};

export const Nested: Story = {
  args: { files: nestedFiles },
  play: async ({ canvasElement, step }) => {
    await step("renders directory toggles for each depth", async () => {
      await expect(dirButtons(canvasElement).map((b) => b.getAttribute("title"))).toEqual([
        "/r",
        "sub",
        "deep",
      ]);
    });

    await step("nested directories indent deeper than their parents", async () => {
      const [root, sub, deep] = dirButtons(canvasElement);
      await expect(paddingLeftPx(root!)).toBeLessThan(paddingLeftPx(sub!));
      await expect(paddingLeftPx(sub!)).toBeLessThan(paddingLeftPx(deep!));
    });
  },
};

export const WithSelection: Story = {
  args: { active: "/a/y.puml" },
  play: async ({ canvasElement, step }) => {
    const selected = fileButtons(canvasElement).find((b) => b.textContent === "y.puml");
    await expect(selected).toBeDefined();

    await step("selected row is visually highlighted", async () => {
      const styles = window.getComputedStyle(selected!);
      await expect(styles.backgroundColor).not.toBe(pageBg());
      await expect(styles.fontWeight).toBe("500");
    });
  },
};

export const Collapse: Story = {
  play: async ({ canvasElement, step }) => {
    const toggleA = () => dirButtons(canvasElement).find((b) => b.getAttribute("title") === "/a")!;
    const before = fileButtons(canvasElement).map((b) => b.textContent);

    await step("clicking a directory toggle hides its children", async () => {
      await userEvent.click(toggleA());
      await expect(toggleA()).toHaveAttribute("aria-expanded", "false");
      await expect(fileButtons(canvasElement).map((b) => b.textContent)).toEqual(["z.puml"]);
    });

    await step("re-clicking restores the original tree", async () => {
      await userEvent.click(toggleA());
      await expect(toggleA()).toHaveAttribute("aria-expanded", "true");
      await expect(fileButtons(canvasElement).map((b) => b.textContent)).toEqual(before);
    });
  },
};
