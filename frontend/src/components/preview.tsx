import {
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformComponent,
} from "react-zoom-pan-pinch";
import type { JSX } from "react";
import { useKeyboardPan } from "./use-keyboard-pan";

const MIN_SCALE = 0.1;
const MAX_SCALE = 50;

const BASE_BTN =
  "flex h-8 cursor-pointer items-center rounded border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm hover:bg-white active:bg-slate-100";

function ZoomControls(): JSX.Element {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  // useTransformComponent re-renders on every transform change (wheel/pinch
  // included), unlike useTransformContext which only exposes a ref.
  const scale = useTransformComponent(({ state }) => state.scale);

  return (
    <div className="absolute bottom-3 right-3 z-20 flex gap-1">
      <button
        type="button"
        onClick={() => zoomOut()}
        className={`${BASE_BTN} w-8 justify-center`}
        aria-label="Zoom out"
      >
        −
      </button>
      <span
        className="flex h-8 w-14 items-center justify-center rounded border border-slate-200 bg-white/90 text-xs tabular-nums text-slate-600 shadow-sm backdrop-blur-sm"
        aria-label="Zoom level"
      >
        {Math.round(scale * 100)}%
      </span>
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
        onClick={() => resetTransform()}
        className={`${BASE_BTN} px-2 text-xs`}
        aria-label="Reset zoom"
      >
        reset
      </button>
    </div>
  );
}

function KeyboardPan(): null {
  useKeyboardPan();
  return null;
}

export function Preview({ svg }: { svg: string }): JSX.Element {
  return (
    <div className="relative h-full overflow-hidden">
      {/* key remounts the wrapper on file change, resetting zoom/pan state */}
      <TransformWrapper key={svg} centerOnInit minScale={MIN_SCALE} maxScale={MAX_SCALE}>
        <KeyboardPan />
        <ZoomControls />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <img src={svg} alt="preview" />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
