import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { SourceView } from "./index";

const meta: Meta<typeof SourceView> = {
  component: SourceView,
};

export default meta;

type Story = StoryObj<typeof SourceView>;

export const Empty: Story = {
  args: { source: "" },
  play: async ({ canvasElement, step }) => {
    await step("renders the 'no source' placeholder", async () => {
      await expect(within(canvasElement).getByText("no source")).toBeInTheDocument();
    });

    await step("omits the highlighted <pre> region", async () => {
      await expect(canvasElement.querySelector("pre")).toBeNull();
    });
  },
};

export const Plain: Story = {
  args: { source: "@startuml\nactor User\n@enduml" },
  play: async ({ canvasElement, step }) => {
    await step("renders each source line once highlighting settles", async () => {
      await waitFor(async () => {
        const text = canvasElement.textContent ?? "";
        await expect(text).toContain("@startuml");
        await expect(text).toContain("actor User");
        await expect(text).toContain("@enduml");
      });
    });
  },
};

export const XSSAttempt: Story = {
  args: { source: "<script>alert(1)</script>" },
  play: async ({ canvasElement, step }) => {
    await step("renders the source as text without inserting a real <script>", async () => {
      await waitFor(async () => {
        await expect(canvasElement.textContent).toContain("<script>alert(1)</script>");
      });
      await expect(canvasElement.querySelector("script")).toBeNull();
    });
  },
};
