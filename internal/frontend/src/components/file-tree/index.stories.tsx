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

const pageBg = () => window.getComputedStyle(document.body).backgroundColor;

function dirButtons(canvasElement: HTMLElement): HTMLButtonElement[] {
  return [...canvasElement.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")];
}

function fileButtons(canvasElement: HTMLElement): HTMLButtonElement[] {
  return [...canvasElement.querySelectorAll<HTMLButtonElement>("button:not([aria-expanded])")];
}

const paddingOf = (el: HTMLButtonElement) => parseFloat(window.getComputedStyle(el).paddingLeft);

export const Empty: Story = {
  args: { files: [] },
  play: async ({ canvasElement, step }) => {
    await step("shows the empty-state placeholder", async () => {
      await expect(within(canvasElement).getByText("no files found")).toBeInTheDocument();
    });

    await step("does not render the nav list", async () => {
      await expect(canvasElement.querySelector("nav")).toBeNull();
    });
  },
};

export const Flat: Story = {
  play: async ({ canvasElement, step }) => {
    await step("renders both source-root toggles", async () => {
      const dirs = dirButtons(canvasElement).map((b) => b.getAttribute("title"));
      await expect(dirs).toEqual(["/a", "/b"]);
    });

    await step("renders every file under its source root", async () => {
      const files = fileButtons(canvasElement).map((b) => b.textContent);
      await expect(files).toEqual(["x.puml", "y.puml", "z.puml"]);
    });
  },
};

export const Nested: Story = {
  args: { files: nestedFiles },
  play: async ({ canvasElement, step }) => {
    await step("renders nested directory toggles in tree order", async () => {
      const dirs = dirButtons(canvasElement).map((b) => b.getAttribute("title"));
      await expect(dirs).toEqual(["/r", "sub", "deep"]);
    });

    await step("renders descendant files in tree order", async () => {
      const files = fileButtons(canvasElement).map((b) => b.textContent);
      await expect(files).toEqual(["b.puml", "a.puml", "top.puml"]);
    });

    await step("indents deeper rows further from the left edge", async () => {
      const [r, sub, deep] = dirButtons(canvasElement);
      await expect(paddingOf(sub!)).toBeGreaterThan(paddingOf(r!));
      await expect(paddingOf(deep!)).toBeGreaterThan(paddingOf(sub!));
    });
  },
};

export const WithSelection: Story = {
  args: { active: "/a/y.puml" },
  play: async ({ canvasElement, step }) => {
    const selected = fileButtons(canvasElement).find((b) => b.textContent === "y.puml");
    await expect(selected).toBeDefined();

    await step("selected file gets a non-default highlight", async () => {
      const styles = window.getComputedStyle(selected!);
      await expect(styles.backgroundColor).not.toBe(pageBg());
      await expect(styles.fontWeight).toBe("500");
    });

    await step("other files remain unselected", async () => {
      const other = fileButtons(canvasElement).find((b) => b.textContent === "x.puml")!;
      const styles = window.getComputedStyle(other);
      await expect(styles.backgroundColor).toBe(pageBg());
      await expect(styles.fontWeight).toBe("400");
    });
  },
};

export const Collapse: Story = {
  play: async ({ canvasElement, step }) => {
    const toggle = dirButtons(canvasElement).find((b) => b.getAttribute("title") === "/a")!;
    const before = fileButtons(canvasElement).map((b) => b.textContent);

    await step("collapsing a directory hides its files", async () => {
      await userEvent.click(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(fileButtons(canvasElement).map((b) => b.textContent)).toEqual(["z.puml"]);
    });

    await step("re-expanding restores the original file list", async () => {
      await userEvent.click(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(fileButtons(canvasElement).map((b) => b.textContent)).toEqual(before);
    });
  },
};
