import { useState, type JSX } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { expect, userEvent, within } from "storybook/test";
import { Minimap } from "./minimap";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const NEXT_SVG = "data:image/png;base64,BBBB";
const SWAP_LABEL = "swap minimap svg";

const withTransform: Decorator = (Story) => (
  <div style={{ position: "relative", height: "300px", width: "400px" }}>
    <TransformWrapper>
      <Story />
      <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
        <div style={{ width: "100%", height: "100%" }} />
      </TransformComponent>
    </TransformWrapper>
  </div>
);

function SwappableMinimap({ initial, next }: { initial: string; next: string }): JSX.Element {
  const [svg, setSvg] = useState(initial);
  return (
    <div style={{ position: "relative", height: "300px", width: "400px" }}>
      <button type="button" onClick={() => setSvg(next)}>
        {SWAP_LABEL}
      </button>
      <TransformWrapper>
        <Minimap svg={svg} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div style={{ width: "100%", height: "100%" }} />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

const meta: Meta<typeof Minimap> = {
  component: Minimap,
  args: { svg: SAMPLE_SVG },
  decorators: [withTransform],
};

export default meta;

type Story = StoryObj<typeof Minimap>;

const thumbnailImg = (root: HTMLElement) =>
  root.querySelector<HTMLImageElement>('[aria-label="diagram minimap"] img');

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    await step("renders the labeled overlay container", async () => {
      const container = canvasElement.querySelector('[aria-label="diagram minimap"]');
      await expect(container).not.toBeNull();
    });

    await step("the thumbnail img carries the configured svg", async () => {
      const img = thumbnailImg(canvasElement);
      await expect(img).not.toBeNull();
      await expect(img!.getAttribute("src")).toBe(SAMPLE_SVG);
    });
  },
};

export const Updated: Story = {
  decorators: [],
  render: () => <SwappableMinimap initial={SAMPLE_SVG} next={NEXT_SVG} />,
  play: async ({ canvasElement, step }) => {
    await step("starts with the initial svg", async () => {
      await expect(thumbnailImg(canvasElement)!.getAttribute("src")).toBe(SAMPLE_SVG);
    });

    await step("updates the thumbnail when svg changes", async () => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: SWAP_LABEL }));
      await expect(thumbnailImg(canvasElement)!.getAttribute("src")).toBe(NEXT_SVG);
    });
  },
};

export const BorderColor: Story = {
  play: async ({ canvasElement, step }) => {
    await step("the viewport preview overlay uses the configured violet border", async () => {
      const preview = canvasElement.querySelector<HTMLElement>(
        '[aria-label="diagram minimap"] .rzpp-preview',
      );
      await expect(preview).not.toBeNull();
      const color = window.getComputedStyle(preview!).borderColor;
      // react-zoom-pan-pinch normalizes #7c3aed to its rgb form on every border.
      await expect(color).toMatch(/rgb\(124,\s*58,\s*237\)/);
    });
  },
};
