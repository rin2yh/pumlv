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
  play: async ({ canvasElement, step }) => {
    await step("shows the 'no source' placeholder", async () => {
      await expect(within(canvasElement).getByText("no source")).toBeInTheDocument();
    });

    await step("does not render the <pre> source container", async () => {
      await expect(canvasElement.querySelector("pre")).toBeNull();
    });
  },
};

export const Plain: Story = {
  args: { source: "@startuml\nactor User\n@enduml" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders the source inside a <pre> container", async () => {
      await waitFor(() => expect(canvasElement.querySelector("pre")).not.toBeNull());
    });

    await step("each source line is visible as text", async () => {
      await expect(await canvas.findByText("@startuml")).toBeInTheDocument();
      await expect(await canvas.findByText(/actor/)).toBeInTheDocument();
      await expect(await canvas.findByText("@enduml")).toBeInTheDocument();
    });
  },
};

export const XSSAttempt: Story = {
  args: { source: "<script>alert(1)</script>" },
  play: async ({ canvasElement, step }) => {
    await step("the source appears as visible text in the <pre>", async () => {
      await waitFor(() => {
        const pre = canvasElement.querySelector("pre");
        expect(pre).not.toBeNull();
        expect(pre!.textContent).toContain("<script>alert(1)</script>");
      });
    });

    await step("no actual <script> tag is injected into the canvas", async () => {
      await expect(canvasElement.querySelector("script")).toBeNull();
    });
  },
};

export const Fold: Story = {
  args: { source: "class A {\n  field1\n  field2\n}\nclass B" },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("a fold toggle appears on the opening brace line", async () => {
      const toggle = await canvas.findByRole("button", { name: FOLD_LABEL });
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    await step("clicking the fold toggle hides the block body", async () => {
      await userEvent.click(await canvas.findByRole("button", { name: FOLD_LABEL }));
      await waitFor(() => {
        expect(canvasElement.textContent).not.toContain("field1");
        expect(canvasElement.textContent).not.toContain("field2");
      });
      await expect(canvas.getByRole("button", { name: UNFOLD_LABEL })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    await step("clicking the unfold toggle restores the block body", async () => {
      await userEvent.click(canvas.getByRole("button", { name: UNFOLD_LABEL }));
      await waitFor(() => {
        expect(canvasElement.textContent).toContain("field1");
        expect(canvasElement.textContent).toContain("field2");
      });
    });
  },
};
