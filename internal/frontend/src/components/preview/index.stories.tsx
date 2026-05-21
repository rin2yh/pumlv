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

const zoomInput = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLInputElement>('input[aria-label="Zoom level"]')!;

export const Default: Story = {};

export const WithControls: Story = {};

export const ResetOnSrcChange: StoryObj<typeof SwapPreview> = {
  render: () => <SwapPreview />,
  play: async ({ canvasElement }) => {
    const input = zoomInput(canvasElement);
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, "250{Enter}");
    await expect(input.value).toBe("250");

    await userEvent.click(within(canvasElement).getByRole("button", { name: "swap" }));
    await expect(zoomInput(canvasElement).value).toBe("100");
  },
};
