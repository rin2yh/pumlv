import { useEffect } from "react";
import { useTransformContext } from "react-zoom-pan-pinch";

const PAN_STEP = 50;
const PAN_STEP_FAST = 200;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useKeyboardPan(): void {
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
}
