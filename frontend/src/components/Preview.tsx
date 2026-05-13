import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import type { JSX } from "react";

function ZoomControls(): JSX.Element {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const btnClass =
    "flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100";
  return (
    <div className="absolute bottom-3 right-3 z-10 flex gap-1">
      <button type="button" onClick={() => zoomIn()} className={btnClass} aria-label="Zoom in">
        +
      </button>
      <button type="button" onClick={() => zoomOut()} className={btnClass} aria-label="Zoom out">
        −
      </button>
      <button
        type="button"
        onClick={() => resetTransform()}
        className="flex h-8 cursor-pointer items-center rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100"
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
      <TransformWrapper centerOnInit minScale={0.1} maxScale={10}>
        <ZoomControls />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <img src={svg} alt="preview" />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
