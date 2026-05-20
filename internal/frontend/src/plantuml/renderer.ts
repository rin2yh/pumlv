import { loadPlantUMLModule } from "./bootstrap";
import { splitLines } from "../lib/lines";

export async function renderPlantUML(source: string): Promise<string> {
  const mod = await loadPlantUMLModule();
  const lines = splitLines(source);
  const svg = await new Promise<string>((resolve, reject) => {
    mod.renderToString(lines, resolve, (msg) => reject(new Error(msg)));
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
