import { loadPlantUMLModule, type PlantUMLModule } from "./bootstrap";

// Matches the error thrown by the TeaVM build when layout dimensions exceed
// the browser rendering limit: "Diagram too large for browser rendering: W x H (max 4096)"
const TOO_LARGE_RE = /Diagram too large for browser rendering:\s*(\d+)\s*x\s*(\d+)/;

// Target maximum dimension for auto-scaled retries, kept slightly below the
// hard 4096 limit to avoid floating-point rounding edge cases.
const MAX_RENDER_PX = 4000;

export async function renderPlantUML(source: string): Promise<string> {
  const mod = await loadPlantUMLModule();
  const lines = source.split(/\r\n|\r|\n/);

  try {
    const svg = await renderLines(mod, lines);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const match = TOO_LARGE_RE.exec(msg);
    if (!match) throw e;

    // Auto-scale: compute the factor that brings the larger axis within
    // MAX_RENDER_PX, then retry with a "scale X" pragma injected into the source.
    const w = Number(match[1]);
    const h = Number(match[2]);
    const scale = MAX_RENDER_PX / Math.max(w, h);
    const svg = await renderLines(mod, withScale(lines, scale));
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}

export function withScale(lines: string[], scale: number): string[] {
  const idx = lines.findIndex((l) => /^@start/i.test(l.trim()));
  const insert = idx >= 0 ? idx + 1 : 0;
  const rounded = Math.floor(scale * 10000) / 10000;
  return [...lines.slice(0, insert), `scale ${rounded.toFixed(4)}`, ...lines.slice(insert)];
}

function renderLines(mod: PlantUMLModule, lines: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    mod.renderToString(lines, resolve, (msg) => reject(new Error(msg)));
  });
}
