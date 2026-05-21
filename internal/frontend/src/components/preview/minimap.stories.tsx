import { type JSX } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
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

const meta: Meta<typeof Wrapped> = {
  component: Wrapped,
  args: { svg: SAMPLE_SVG },
};

export default meta;

type Story = StoryObj<typeof Wrapped>;

export const Default: Story = {};

export const Updated: Story = {
  args: { svg: NEXT_SVG },
};
