import { MiniMap } from "react-zoom-pan-pinch";
import type { JSX } from "react";

const WIDTH = 160;
const HEIGHT = 120;
const BORDER = "#7c3aed";

export function Minimap({ svg }: { svg: string }): JSX.Element {
  return (
    <div
      aria-label="diagram minimap"
      className="pointer-events-none absolute bottom-14 right-3 z-20 overflow-hidden rounded border border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm"
    >
      <MiniMap width={WIDTH} height={HEIGHT} borderColor={BORDER}>
        <img src={svg} alt="minimap thumbnail" draggable={false} />
      </MiniMap>
    </div>
  );
}
