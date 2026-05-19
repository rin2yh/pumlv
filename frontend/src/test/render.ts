import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";

export interface RenderContext {
  readonly container: HTMLDivElement;
  render(node: ReactElement): void;
  click(el: HTMLElement): void;
}

export function setupRender(): RenderContext {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = undefined;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    container.remove();
  });

  return {
    get container() {
      return container;
    },
    render(node) {
      root ??= createRoot(container);
      act(() => {
        root!.render(node);
      });
    },
    click(el) {
      act(() => {
        el.click();
      });
    },
  };
}
