import type { Meta, StoryObj } from "@storybook/react-vite";
import type { JSX } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Minimap } from "./minimap";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const UPDATED_SVG = "data:image/png;base64,NEXT";

// The react-compiler runtime in browser-test can't always resolve
// useMemoCache for story-local components; disabling memo on this thin
// wrapper avoids touching production code.
function Wrapped({ svg }: { svg: string }): JSX.Element {
  "use no memo";
  return (
    <div style={{ position: "relative", height: 320, width: 480 }}>
      <TransformWrapper>
        <Minimap svg={svg} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div />
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
  args: { svg: UPDATED_SVG },
};

export const BorderColor: Story = {};
