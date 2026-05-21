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

export const Empty: Story = {
  args: { files: [] },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("shows the empty-state placeholder", async () => {
      await expect(canvas.getByText("no files found")).toBeInTheDocument();
    });

    await step("does not render the nav element", async () => {
      await expect(canvasElement.querySelector("nav")).toBeNull();
    });
  },
};

export const Flat: Story = {
  args: { files: flatFiles },
  play: async ({ canvasElement, step }) => {
    const dirButtons = canvasElement.querySelectorAll("button[aria-expanded]");
    const fileButtons = canvasElement.querySelectorAll("button:not([aria-expanded])");

    await step("renders one directory toggle per source root", async () => {
      await expect([...dirButtons].map((b) => b.getAttribute("title"))).toEqual(["/a", "/b"]);
    });

    await step("renders all leaf files with the source directories expanded", async () => {
      await expect([...fileButtons].map((b) => b.textContent)).toEqual([
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
    const dirButtons = canvasElement.querySelectorAll("button[aria-expanded]");
    const fileButtons = canvasElement.querySelectorAll("button:not([aria-expanded])");

    await step("renders the full chain of nested directory toggles", async () => {
      await expect([...dirButtons].map((b) => b.getAttribute("title"))).toEqual([
        "/r",
        "sub",
        "deep",
      ]);
    });

    await step("renders files at every nesting depth", async () => {
      await expect([...fileButtons].map((b) => b.textContent)).toEqual([
        "b.puml",
        "a.puml",
        "top.puml",
      ]);
    });
  },
};

export const WithSelection: Story = {
  args: { files: flatFiles, active: "/a/y.puml" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("button", { name: "y.puml" });

    await step("selected file row is visually highlighted", async () => {
      const styles = window.getComputedStyle(selected);
      await expect(styles.backgroundColor).not.toBe(pageBg());
      await expect(styles.fontWeight).toBe("500");
    });
  },
};

export const Collapse: Story = {
  args: { files: flatFiles },
  play: async ({ canvasElement, step }) => {
    const toggle = within(canvasElement).getByTitle("/a") as HTMLButtonElement;
    const fileButtons = () => canvasElement.querySelectorAll("button:not([aria-expanded])");

    await step("starts expanded with every file visible", async () => {
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect([...fileButtons()].map((b) => b.textContent)).toEqual([
        "x.puml",
        "y.puml",
        "z.puml",
      ]);
    });

    await step("clicking the toggle hides the children of /a", async () => {
      await userEvent.click(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect([...fileButtons()].map((b) => b.textContent)).toEqual(["z.puml"]);
    });

    await step("clicking again restores the original list", async () => {
      await userEvent.click(toggle);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect([...fileButtons()].map((b) => b.textContent)).toEqual([
        "x.puml",
        "y.puml",
        "z.puml",
      ]);
    });
  },
};
