import { describe, expect, it } from "vitest";
import type { JSX } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Minimap } from "./minimap";
import { NEXT_SVG, SAMPLE_SVG } from "./test/fixtures";
import { setupRender } from "../../test/render";

const container = () => document.querySelector('[aria-label="diagram minimap"]')!;
const imgs = () =>
  Array.from(container().querySelectorAll("img")).map((el) => el.getAttribute("src"));

function Wrapped({ svg }: { svg: string }): JSX.Element {
  return (
    <TransformWrapper>
      <Minimap svg={svg} />
      <TransformComponent>
        <div />
      </TransformComponent>
    </TransformWrapper>
  );
}

const render = setupRender();

describe("Minimap", () => {
  it("renders the labeled overlay container", () => {
    render(<Wrapped svg={SAMPLE_SVG} />);
    expect(container()).not.toBeNull();
  });

  it("passes the svg through to the thumbnail img", () => {
    render(<Wrapped svg={SAMPLE_SVG} />);
    expect(imgs()).toContain(SAMPLE_SVG);
  });

  it("updates the thumbnail when svg changes", () => {
    render(<Wrapped svg={SAMPLE_SVG} />);
    render(<Wrapped svg={NEXT_SVG} />);
    expect(imgs()).toContain(NEXT_SVG);
    expect(imgs()).not.toContain(SAMPLE_SVG);
  });
});
