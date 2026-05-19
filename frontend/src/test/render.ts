import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";

export interface RenderContext<P> {
  readonly container: HTMLDivElement;
  render(props: P): void;
  click(el: HTMLElement): void;
}

export function setupRender<P extends object>(Component: ComponentType<P>): RenderContext<P> {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  return {
    get container() {
      return container;
    },
    render(props) {
      act(() => {
        root.render(createElement(Component, props));
      });
    },
    click(el) {
      act(() => {
        el.click();
      });
    },
  };
}
