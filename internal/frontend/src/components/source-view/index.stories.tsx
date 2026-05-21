import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { SourceView } from ".";

const meta: Meta<typeof SourceView> = {
  component: SourceView,
  args: { source: "" },
};

export default meta;

type Story = StoryObj<typeof SourceView>;

export const Empty: Story = {};

export const Plain: Story = {
  args: { source: "@startuml\nclass A\n@enduml\n" },
};

export const Fold: Story = {
  args: { source: ["class A {", "  field1", "  field2", "}", "class B"].join("\n") },
};

export const XSSAttempt: Story = {
  args: { source: "<script>alert(1)</script>" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    });
    await expect(canvasElement.querySelector("script")).toBeNull();
  },
};
