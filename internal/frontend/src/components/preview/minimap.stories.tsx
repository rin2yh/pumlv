import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Minimap } from "./minimap";

const SAMPLE_SVG = "data:image/png;base64,AAAA";
const NEXT_SVG = "data:image/png;base64,BBBB";

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

const meta: Meta<typeof Minimap> = {
  component: Minimap,
  args: { svg: SAMPLE_SVG },
  decorators: [withTransform],
};

export default meta;

type Story = StoryObj<typeof Minimap>;

export const Default: Story = {};

export const AlternateSvg: Story = { args: { svg: NEXT_SVG } };
