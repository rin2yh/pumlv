// Renders PlantUML to SVG in the browser using plantuml/plantuml's TeaVM build
// (frontend/public/plantuml/{plantuml.js,viz-global.js}).

const VIZ_URL = "/plantuml/viz-global.js";
const PLANTUML_MODULE_URL = "/plantuml/plantuml.js";

type RenderToString = (
  lines: string[],
  onSuccess: (svg: string) => void,
  onError: (message: string) => void,
) => void;

interface PlantUMLModule {
  renderToString: RenderToString;
}

let ready: Promise<PlantUMLModule> | null = null;

function loadVizGlobal(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = VIZ_URL;
    s.async = false;
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error(`failed to load: ${VIZ_URL}`)), {
      once: true,
    });
    document.head.appendChild(s);
  });
}

async function bootstrap(): Promise<PlantUMLModule> {
  if (ready) return ready;
  ready = (async () => {
    // plantuml.js only touches globalThis.Graphviz from inside renderToString,
    // so we can fetch/parse both scripts in parallel.
    const [, mod] = await Promise.all([
      loadVizGlobal(),
      import(/* @vite-ignore */ PLANTUML_MODULE_URL) as Promise<PlantUMLModule>,
    ]);
    if (typeof mod.renderToString !== "function") {
      throw new Error("plantuml.js did not export renderToString");
    }
    return mod;
  })();
  return ready;
}

export async function renderPlantUML(source: string): Promise<string> {
  const mod = await bootstrap();
  const lines = source.split(/\r\n|\r|\n/);
  const svg = await new Promise<string>((resolve, reject) => {
    mod.renderToString(lines, resolve, (msg) => reject(new Error(msg)));
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Test seam: lets unit tests substitute a fake module without going through
// the real dynamic import (which jsdom can't resolve against frontend/public).
export function setPlantUMLModuleForTests(mod: PlantUMLModule | null): void {
  ready = mod ? Promise.resolve(mod) : null;
}
