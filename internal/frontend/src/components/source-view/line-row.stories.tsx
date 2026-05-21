import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { LineRow } from "./line-row";
import { FOLD_LABEL, lineIndentPx, UNFOLD_LABEL } from "./source-fold";

const TOKENS = [
  { content: "class A ", color: "#111111" },
  { content: "{", color: "#222222" },
];

const meta: Meta<typeof LineRow> = {
  component: LineRow,
  args: {
    tokens: TOKENS,
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
    await step("renders the token content as text", async () => {
      await expect(canvasElement.textContent).toContain("class A {");
    });

    await step("first token's computed color matches the inline color prop", async () => {
      const colored = [...canvasElement.querySelectorAll<HTMLElement>("span[style]")].find(
        (s) => s.textContent === "class A ",
      );
      await expect(colored).toBeTruthy();
      await expect(window.getComputedStyle(colored!).color).toBe("rgb(17, 17, 17)");
    });
  },
};

export const FoldStart: Story = {
  args: { isFoldStart: true, isFolded: false },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: FOLD_LABEL });

    await step("renders the fold toggle with the down chevron", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(button.textContent).toContain("▼");
    });
  },
};

export const Folded: Story = {
  args: { isFoldStart: true, isFolded: true },
  play: async ({ canvasElement, step }) => {
    const button = within(canvasElement).getByRole("button", { name: UNFOLD_LABEL });

    await step("renders the unfold toggle with the right chevron", async () => {
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(button.textContent).toContain("▶");
    });

    await step("renders the trailing ellipsis to signal hidden content", async () => {
      await expect(canvasElement.textContent).toContain("…");
    });
  },
};

export const Indented: Story = {
  args: { depth: 2, isFoldStart: true },
  play: async ({ canvasElement, step }) => {
    const row = canvasElement.querySelector<HTMLElement>("div")!;

    await step("paddingLeft scales with depth", async () => {
      const px = parseFloat(window.getComputedStyle(row).paddingLeft);
      await expect(px).toBe(lineIndentPx(2));
    });
  },
};
