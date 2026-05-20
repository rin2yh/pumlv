import {
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformComponent,
  useTransformContext,
} from "react-zoom-pan-pinch";
import { useEffect, type JSX } from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 50;
const PAN_STEP = 50;
const PAN_STEP_FAST = 200;

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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function KeyboardPan(): null {
  // useTransformContext returns a stable instance, so the listener is registered
  // exactly once. useControls returns a fresh object each render, which would
  // cause the keydown listener to re-register on every parent re-render.
  const ctx = useTransformContext();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const step = e.shiftKey ? PAN_STEP_FAST : PAN_STEP;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowLeft":
          dx = step;
          break;
        case "ArrowRight":
          dx = -step;
          break;
        case "ArrowUp":
          dy = step;
          break;
        case "ArrowDown":
          dy = -step;
          break;
        default:
          return;
      }
      e.preventDefault();
      const { positionX, positionY, scale } = ctx.transformState;
      ctx.setTransformState(scale, positionX + dx, positionY + dy);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx]);

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
