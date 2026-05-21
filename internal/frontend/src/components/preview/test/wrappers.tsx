import type { JSX, ReactNode } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Minimap } from "../minimap";
import { MAX_SCALE, MIN_SCALE } from "../zoom";

// "use no memo" on these story-local wrappers: the React Compiler
// runtime in the browser-test environment can't always resolve
// useMemoCache for components compiled outside the production graph.
// Disabling memo on the wrapper avoids touching production code.

export function ZoomControlsHarness({ children }: { children: ReactNode }): JSX.Element {
  "use no memo";
  return (
    <div style={{ position: "relative", height: 320, width: 480 }}>
      <TransformWrapper minScale={MIN_SCALE} maxScale={MAX_SCALE}>
        {children}
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div style={{ width: 200, height: 200 }} />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}

export function MinimapHarness({ svg }: { svg: string }): JSX.Element {
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
