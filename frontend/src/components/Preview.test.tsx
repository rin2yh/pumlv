import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Preview } from "./Preview";

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockResetTransform = vi.fn();

vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children: ReactNode }) => children,
  TransformComponent: ({ children }: { children: ReactNode }) => children,
  useControls: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    resetTransform: mockResetTransform,
  }),
}));

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
  vi.clearAllMocks();
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

  describe("zoom controls", () => {
    it("renders zoom in, zoom out, and reset buttons", () => {
      render(<Preview svg="data:image/png;base64,AAAA" />);
      expect(container.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="Zoom out"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="Reset zoom"]')).not.toBeNull();
    });

    it("calls zoomIn when zoom in button is clicked", () => {
      render(<Preview svg="data:image/png;base64,AAAA" />);
      act(() => {
        container.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
      });
      expect(mockZoomIn).toHaveBeenCalledOnce();
    });

    it("calls zoomOut when zoom out button is clicked", () => {
      render(<Preview svg="data:image/png;base64,AAAA" />);
      act(() => {
        container.querySelector<HTMLButtonElement>('[aria-label="Zoom out"]')!.click();
      });
      expect(mockZoomOut).toHaveBeenCalledOnce();
    });

    it("calls resetTransform when reset button is clicked", () => {
      render(<Preview svg="data:image/png;base64,AAAA" />);
      act(() => {
        container.querySelector<HTMLButtonElement>('[aria-label="Reset zoom"]')!.click();
      });
      expect(mockResetTransform).toHaveBeenCalledOnce();
    });
  });
});
