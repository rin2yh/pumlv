import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Preview } from "./Preview";

let container: HTMLDivElement;
let root: Root;

function render(node: ReactElement): void {
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("Preview", () => {
  it("renders an img with the provided data URL as src", () => {
    const svg = "data:image/png;base64,AAAA";
    render(<Preview svg={svg} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(svg);
  });

  it("uses 'preview' as the alt text", () => {
    render(<Preview svg="data:image/png;base64,AAAA" />);
    const img = container.querySelector("img");
    expect(img!.getAttribute("alt")).toBe("preview");
  });

  it("updates the src when svg prop changes", () => {
    render(<Preview svg="data:image/png;base64,AAA1" />);
    act(() => {
      root.render(<Preview svg="data:image/png;base64,BBB2" />);
    });
    const img = container.querySelector("img");
    expect(img!.getAttribute("src")).toBe("data:image/png;base64,BBB2");
  });
});
