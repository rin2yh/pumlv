import { useState, type JSX } from "react";
import { MiniMap, TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { MAX_SCALE, MIN_SCALE } from "./zoom";
import { ZoomControls } from "./zoom-controls";

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;
// violet-600 — matches the app accent so the viewport rectangle is recognizable.
const MINIMAP_BORDER = "#7c3aed";

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
        {/* MiniMap forces position: relative inline, so wrap it to position
            the whole minimap in the overlay corner — bottom-right, stacked
            above the zoom controls. */}
        <div
          aria-label="diagram minimap"
          className="pointer-events-none absolute bottom-14 right-3 z-20 overflow-hidden rounded border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm"
        >
          <MiniMap width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} borderColor={MINIMAP_BORDER}>
            <img src={svg} alt="" draggable={false} />
          </MiniMap>
        </div>
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
