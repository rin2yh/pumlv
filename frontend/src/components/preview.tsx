import {
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformComponent,
} from "react-zoom-pan-pinch";
import { useEffect, useRef, useState, type FocusEvent, type JSX, type KeyboardEvent } from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 50;

const BASE_BTN =
  "flex h-8 cursor-pointer items-center rounded border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm hover:bg-white active:bg-slate-100";

function clampScale(value: number): number {
  if (value < MIN_SCALE) return MIN_SCALE;
  if (value > MAX_SCALE) return MAX_SCALE;
  return value;
}

function ZoomControls(): JSX.Element {
  const { zoomIn, zoomOut, resetTransform, centerView } = useControls();
  // useTransformComponent re-renders on every transform change (wheel/pinch
  // included), unlike useTransformContext which only exposes a ref.
  const scale = useTransformComponent(({ state }) => state.scale);
  const displayPercent = Math.round(scale * 100);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(displayPercent));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipCommitRef = useRef(false);

  // Sync the input with the live scale whenever the user isn't editing.
  useEffect(() => {
    if (!editing) setDraft(String(displayPercent));
  }, [displayPercent, editing]);

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setEditing(false);
      return;
    }
    const parsed = Number.parseFloat(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      centerView(clampScale(parsed / 100), 0);
    }
    setEditing(false);
  };

  const cancel = () => {
    skipCommitRef.current = true;
    setDraft(String(displayPercent));
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      inputRef.current?.blur();
    }
  };

  const onFocus = (e: FocusEvent<HTMLInputElement>) => {
    setEditing(true);
    setDraft(String(displayPercent));
    e.target.select();
  };

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
      <div className="flex h-8 w-14 items-center justify-center rounded border border-slate-200 bg-white/90 text-xs tabular-nums text-slate-600 shadow-sm backdrop-blur-sm focus-within:ring-1 focus-within:ring-slate-400">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={editing ? draft : String(displayPercent)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={onFocus}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="h-full w-8 cursor-text bg-transparent text-right outline-none"
          aria-label="Zoom level"
        />
        <span aria-hidden="true">%</span>
      </div>
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

export function Preview({ svg }: { svg: string }): JSX.Element {
  return (
    <div className="relative h-full overflow-hidden">
      {/* key remounts the wrapper on file change, resetting zoom/pan state */}
      <TransformWrapper key={svg} centerOnInit minScale={MIN_SCALE} maxScale={MAX_SCALE}>
        <ZoomControls />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <img src={svg} alt="preview" />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
