import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { SourceView } from "./index";

const meta: Meta<typeof SourceView> = {
  component: SourceView,
};

export default meta;

type Story = StoryObj<typeof SourceView>;

export const Empty: Story = { args: { source: "" } };

export const Plain: Story = { args: { source: "@startuml\nactor User\n@enduml" } };

export const XSSAttempt: Story = {
  args: { source: "<script>alert(1)</script>" },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(canvasElement.textContent).toContain("<script>alert(1)</script>");
    });
    await expect(canvasElement.querySelector("script")).toBeNull();
  },
};
