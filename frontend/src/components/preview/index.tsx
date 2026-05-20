import { useState, type JSX } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { MAX_SCALE, MIN_SCALE } from "./zoom";
import { ZoomControls } from "./zoom-controls";

export function Preview({ svg }: { svg: string }): JSX.Element {
  const [isPanning, setIsPanning] = useState(false);
  return (
    <div className="relative h-full overflow-hidden">
      {/* key remounts the wrapper on file change, resetting zoom/pan state */}
      <TransformWrapper
        key={svg}
        centerOnInit
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        onPanningStart={() => setIsPanning(true)}
        onPanningStop={() => setIsPanning(false)}
      >
        <ZoomControls />
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          wrapperClass={isPanning ? "cursor-grabbing" : "cursor-grab"}
        >
          <img src={svg} alt="preview" />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
