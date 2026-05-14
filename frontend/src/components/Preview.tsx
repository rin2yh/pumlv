import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import type { JSX } from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

const BASE_BTN =
  "flex h-8 cursor-pointer items-center rounded border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100";

function ZoomControls(): JSX.Element {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute bottom-3 right-3 z-10 flex gap-1">
      <button
        type="button"
        onClick={() => zoomIn()}
        className={`${BASE_BTN} w-8 justify-center`}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => zoomOut()}
        className={`${BASE_BTN} w-8 justify-center`}
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => resetTransform()}
        className={`${BASE_BTN} px-2 text-xs`}
        aria-label="Reset zoom"
      >
        reset
      </button>
    </div>
  );
}

export function Preview({ svg }: { svg: string }): JSX.Element {
  return (
    <div className="relative h-full overflow-hidden">
      <TransformWrapper centerOnInit minScale={MIN_SCALE} maxScale={MAX_SCALE}>
        <ZoomControls />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <img src={svg} alt="preview" />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
