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
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = undefined;
  });

  afterEach(() => {
    const r = root;
    if (r) {
      act(() => {
        r.unmount();
      });
    }
    container.remove();
  });

  return {
    get container() {
      return container;
    },
    render(props) {
      const r = (root ??= createRoot(container));
      act(() => {
        r.render(createElement(Component, props));
      });
    },
    click(el) {
      act(() => {
        el.click();
      });
    },
  };
}
