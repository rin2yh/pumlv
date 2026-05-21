import { useState, type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Minimap } from "./minimap";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const NEXT_SVG = "data:image/png;base64,NEXT";

function Wrapped({ svg }: { svg: string }): JSX.Element {
  "use no memo";
  return (
    <div style={{ width: 320, height: 240, position: "relative" }}>
      <TransformWrapper>
        <Minimap svg={svg} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div style={{ width: 320, height: 240 }} />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

function SwapWrapped({ first, second }: { first: string; second: string }): JSX.Element {
  "use no memo";
  const [svg, setSvg] = useState(first);
  return (
    <div>
      <button type="button" onClick={() => setSvg(second)}>
        swap
      </button>
      <Wrapped svg={svg} />
    </div>
  );
}

const meta: Meta<typeof Wrapped> = {
  component: Wrapped,
  args: { svg: SAMPLE_SVG },
};

export default meta;

type Story = StoryObj<typeof Wrapped>;

const overlay = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[aria-label="diagram minimap"]') as HTMLElement;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    await step("renders the labeled overlay container", async () => {
      await expect(overlay(canvasElement)).not.toBeNull();
    });

    await step("the thumbnail img carries the svg src", async () => {
      const img = overlay(canvasElement).querySelector("img[alt='minimap thumbnail']");
      await expect(img).toHaveAttribute("src", SAMPLE_SVG);
    });
  },
};

export const Updated: StoryObj<typeof SwapWrapped> = {
  render: (args) => <SwapWrapped {...args} />,
  args: { first: SAMPLE_SVG, second: NEXT_SVG },
  play: async ({ canvasElement, step }) => {
    const initialImg = () =>
      overlay(canvasElement).querySelector("img[alt='minimap thumbnail']") as HTMLImageElement;

    await step("starts with the first svg", async () => {
      await expect(initialImg().src).toBe(SAMPLE_SVG);
    });

    await step("updates the thumbnail when the svg prop changes", async () => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "swap" }));
      await expect(initialImg().src).toBe(NEXT_SVG);
    });
  },
};

export const BorderColor: Story = {
  play: async ({ canvasElement, step }) => {
    await step("the .rzpp-preview viewport carries the configured violet border", async () => {
      const preview = overlay(canvasElement).querySelector<HTMLElement>(".rzpp-preview")!;
      // #7c3aed normalizes to rgb(124, 58, 237) in computed styles.
      await expect(window.getComputedStyle(preview).borderColor).toBe("rgb(124, 58, 237)");
    });
  },
};
