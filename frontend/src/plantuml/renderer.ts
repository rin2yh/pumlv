// Bootstraps CheerpJ 2.3 in the main thread (with fetch-preload — never via
// <script>) and renders PlantUML via plantuml-core's com.plantuml.api.cheerpj.v1
// API. Injecting plantuml-core.jar.js as <script> would block the main thread
// for tens of seconds; CheerpJ resolves the AOT bundle on its own once the
// classpath points at the real .jar.

const CHEERPJ_LOADER_URL = "https://cjrtnc.leaningtech.com/2.3/loader.js";
const JAR_PATH = "/plantuml-core.jar";
const CLASSPATH = `/app${JAR_PATH}`;

declare global {
  interface Window {
    cheerpjInit?: (opts?: Record<string, unknown>) => Promise<void>;
    cheerpjRunMain?: (main: string, classpath: string, ...args: string[]) => Promise<number>;
    cjCall?: <T = unknown>(className: string, method: string, ...args: unknown[]) => Promise<T>;
  }
}

let ready: Promise<void> | null = null;

function loadLoaderScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CHEERPJ_LOADER_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load: ${CHEERPJ_LOADER_URL}`));
    document.head.appendChild(s);
  });
}

async function bootstrap(): Promise<void> {
  if (ready) return ready;

  ready = (async () => {
    if (!window.cheerpjInit) {
      await loadLoaderScript();
    }
    if (!window.cheerpjInit || !window.cheerpjRunMain) {
      throw new Error("CheerpJ API missing after loader.js");
    }

    await Promise.all([fetch(JAR_PATH), fetch(`${JAR_PATH}.js`)]);

    await window.cheerpjInit({ status: "none" });

    await window.cheerpjRunMain("com.plantuml.api.cheerpj.v1.RunInit", CLASSPATH);
  })();

  return ready;
}

export async function renderPlantUML(source: string): Promise<string> {
  await bootstrap();
  if (!window.cjCall) throw new Error("cjCall missing");

  const png = await window.cjCall<string>(
    "com.plantuml.api.cheerpj.v1.Png",
    "convertToBase64",
    "light",
    source,
  );
  if (typeof png !== "string") {
    throw new Error("PlantUML render failed");
  }
  return `data:image/png;base64,${png}`;
}
