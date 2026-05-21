import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { LineRow } from "./line-row";
import { FOLD_LABEL, lineIndentPx, UNFOLD_LABEL } from "./source-fold";

const tokens = [
  { content: "class A ", color: "#111" },
  { content: "{", color: "#222" },
];

const meta: Meta<typeof LineRow> = {
  component: LineRow,
  args: {
    tokens,
    depth: 0,
    isFoldStart: false,
    isFolded: false,
    onToggle: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof LineRow>;

export const Plain: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders each token's content as text", async () => {
      await expect(canvas.getByText(/class A/)).toBeInTheDocument();
      await expect(canvas.getByText("{")).toBeInTheDocument();
    });

    await step("a colored token span carries the expected computed color", async () => {
      const colored = canvasElement.querySelectorAll<HTMLSpanElement>("span[style]");
      const colors = Array.from(colored).map((s) => window.getComputedStyle(s).color);
      await expect(colors).toContain("rgb(17, 17, 17)");
    });
  },
};

export const FoldStart: Story = {
  args: { isFoldStart: true },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders the fold button with the fold aria-label", async () => {
      const button = canvas.getByRole("button", { name: FOLD_LABEL });
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(button.textContent).toContain("▼");
    });
  },
};

export const Folded: Story = {
  args: { isFoldStart: true, isFolded: true },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders the unfold button with the unfold aria-label", async () => {
      const button = canvas.getByRole("button", { name: UNFOLD_LABEL });
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(button.textContent).toContain("▶");
    });

    await step("renders the fold ellipsis", async () => {
      await expect(canvasElement.textContent).toContain("…");
    });
  },
};

export const Indented: Story = {
  args: { depth: 2, isFoldStart: true },
  play: async ({ canvasElement, step }) => {
    await step("paddingLeft reflects the depth", async () => {
      const row = canvasElement.querySelector("button")!.closest("div") as HTMLElement;
      await expect(window.getComputedStyle(row).paddingLeft).toBe(`${lineIndentPx(2)}px`);
    });
  },
};
