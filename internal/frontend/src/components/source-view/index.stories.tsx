import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SourceView } from ".";
import { FOLD_LABEL, UNFOLD_LABEL } from "./source-fold";

const meta: Meta<typeof SourceView> = {
  component: SourceView,
  args: { source: "" },
};

export default meta;

type Story = StoryObj<typeof SourceView>;

export const Empty: Story = {
  args: { source: "" },
};

export const Plain: Story = {
  args: { source: "@startuml\nactor User\n@enduml" },
};

export const XSSAttempt: Story = {
  args: { source: "<script>alert(1)</script>" },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const pre = canvasElement.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toContain("<script>alert(1)</script>");
    });
    await expect(canvasElement.querySelector("script")).toBeNull();
  },
};

export const Fold: Story = {
  args: { source: "class A {\n  field1\n  field2\n}\nclass B" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole("button", { name: FOLD_LABEL }));
    await waitFor(() => {
      expect(canvasElement.textContent).not.toContain("field1");
      expect(canvasElement.textContent).not.toContain("field2");
    });

    await userEvent.click(canvas.getByRole("button", { name: UNFOLD_LABEL }));
    await waitFor(() => {
      expect(canvasElement.textContent).toContain("field1");
      expect(canvasElement.textContent).toContain("field2");
    });
  },
};
