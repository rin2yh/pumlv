import { useState, type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Preview } from ".";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const NEXT_SVG = "data:image/png;base64,BBBB";

function Sized({ svg }: { svg: string }): JSX.Element {
  "use no memo";
  return (
    <div style={{ width: 480, height: 360 }}>
      <Preview svg={svg} />
    </div>
  );
}

function SwapPreview(): JSX.Element {
  "use no memo";
  const [svg, setSvg] = useState(SAMPLE_SVG);
  return (
    <div>
      <button type="button" onClick={() => setSvg(NEXT_SVG)}>
        swap
      </button>
      <Sized svg={svg} />
    </div>
  );
}

const meta: Meta<typeof Sized> = {
  component: Sized,
  args: { svg: SAMPLE_SVG },
};

export default meta;

type Story = StoryObj<typeof Sized>;

const previewImg = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLImageElement>('img[alt="preview"]')!;

const zoomInput = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    await step("renders the preview img with the provided svg src", async () => {
      const img = within(canvasElement).getByAltText("preview") as HTMLImageElement;
      await expect(img.getAttribute("src")).toBe(SAMPLE_SVG);
    });
  },
};

export const WithControls: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("renders the zoom-in / zoom-out / reset controls", async () => {
      await expect(canvas.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Reset zoom" })).toBeInTheDocument();
    });

    await step("the zoom display starts at 100", async () => {
      await expect(zoomInput(canvasElement).value).toBe("100");
    });
  },
};

export const ResetOnSrcChange: StoryObj<typeof SwapPreview> = {
  render: () => <SwapPreview />,
  play: async ({ canvasElement, step }) => {
    const input = zoomInput(canvasElement);

    await step("typing a new zoom commits the value", async () => {
      await userEvent.click(input);
      await userEvent.clear(input);
      await userEvent.type(input, "250{Enter}");
      await expect(input.value).toBe("250");
    });

    await step("swapping the svg prop resets the zoom display to 100", async () => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "swap" }));
      await expect(previewImg(canvasElement).getAttribute("src")).toBe(NEXT_SVG);
      // After remount, query fresh — the input element is new.
      await expect(zoomInput(canvasElement).value).toBe("100");
    });
  },
};
