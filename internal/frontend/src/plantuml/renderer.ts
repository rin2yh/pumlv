import { loadPlantUMLModule } from "./bootstrap";

export async function renderPlantUML(source: string): Promise<string> {
  const mod = await loadPlantUMLModule();
  const lines = source.split(/\r\n|\r|\n/);
  const svg = await new Promise<string>((resolve, reject) => {
    mod.renderToString(lines, resolve, (msg) => reject(new Error(msg)));
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
