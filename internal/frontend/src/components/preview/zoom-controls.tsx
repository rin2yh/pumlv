import { useRef, useState, type FocusEvent, type JSX, type KeyboardEvent } from "react";
import { useControls, useTransformComponent } from "react-zoom-pan-pinch";
import { clampScale } from "./zoom";
import { useKeyboardPan } from "./use-keyboard-pan";

const BASE_BTN =
  "flex h-8 cursor-pointer items-center rounded border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm hover:bg-white active:bg-slate-100";

export const ZOOM_INPUT_LABEL = "Zoom level";

export function ZoomControls(): JSX.Element {
  const { zoomIn, zoomOut, resetTransform, centerView } = useControls();
  // useTransformComponent re-renders on every transform change (wheel/pinch
  // included), unlike useTransformContext which only exposes a ref.
  const scale = useTransformComponent(({ state }) => state.scale);
  const displayPercent = Math.round(scale * 100);

  useKeyboardPan();

  // null = not editing; the input mirrors displayPercent. A string value
  // means the user is mid-edit and that draft takes over until commit/cancel.
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipCommitRef = useRef(false);

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setDraft(null);
      return;
    }
    if (draft === null) return;
    const parsed = Number.parseFloat(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      centerView(clampScale(parsed / 100), 0);
    }
    setDraft(null);
  };

  const cancel = () => {
    skipCommitRef.current = true;
    setDraft(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
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
          value={draft ?? String(displayPercent)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={handleFocus}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="h-full w-8 cursor-text bg-transparent text-right outline-none"
          aria-label={ZOOM_INPUT_LABEL}
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
