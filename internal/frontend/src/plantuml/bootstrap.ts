// Loads plantuml/plantuml's TeaVM build (frontend/public/plantuml/{plantuml.js,viz-global.js}).
// Split out from renderer.ts so vi.mock() can replace this whole module in tests
// instead of poking module-private state through a back-door export.

const VIZ_URL = "/plantuml/viz-global.js";
const PLANTUML_MODULE_URL = "/plantuml/plantuml.js";

type RenderToString = (
  lines: string[],
  onSuccess: (svg: string) => void,
  onError: (message: string) => void,
) => void;

export interface PlantUMLModule {
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

export async function loadPlantUMLModule(): Promise<PlantUMLModule> {
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
