// Bootstraps CheerpJ 4.3 in the main thread and renders PlantUML via
// plantuml-core.jar using Library Mode. CheerpJ 4.x runs the JVM in
// WebAssembly, so Java call depth is independent of the JavaScript call
// stack — large or deeply-recursive diagrams no longer cause RangeError.
// Only plantuml-core.jar is required; the CheerpJ 2.x AOT .jar.js bundle
// is not used.

const CHEERPJ_LOADER_URL = "https://cjrtnc.leaningtech.com/4.3/loader.js";
const JAR_PATH = "/plantuml-core.jar";
const CLASSPATH = `/app${JAR_PATH}`;

declare global {
  interface Window {
    cheerpjInit?: (opts?: Record<string, unknown>) => Promise<void>;
    cheerpjRunLibrary?: (classpath: string) => Promise<unknown>;
  }
}

let ready: Promise<unknown> | null = null;

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} failed: timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function bootstrap(): Promise<unknown> {
  if (ready) return ready;

  ready = (async () => {
    if (!window.cheerpjInit) {
      await withTimeout(loadLoaderScript(), 30_000, "CheerpJ loader");
    }
    if (!window.cheerpjInit) {
      throw new Error("CheerpJ API missing after loader.js");
    }

    await fetch(JAR_PATH);

    // crossOriginIsolated is required for SharedArrayBuffer (CheerpJ 4.x threading).
    if (!self.crossOriginIsolated) {
      throw new Error(
        `CheerpJ failed: page is not cross-origin isolated ` +
          `(crossOriginIsolated=${self.crossOriginIsolated}, ` +
          `hasSharedArrayBuffer=${typeof SharedArrayBuffer !== "undefined"})`,
      );
    }

    // CheerpJ 4.x exposes cheerpjRunLibrary only after cheerpjInit resolves.
    await withTimeout(window.cheerpjInit({ status: "none" }), 60_000, "cheerpjInit");

    if (!window.cheerpjRunLibrary) {
      throw new Error("cheerpjRunLibrary missing after cheerpjInit");
    }

    const lib = await withTimeout(window.cheerpjRunLibrary(CLASSPATH), 60_000, "cheerpjRunLibrary");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const RunInit = await (lib as any).com.plantuml.api.cheerpj.v1.RunInit;
    await RunInit.main(null);

    return lib;
  })();

  return ready;
}

export async function renderPlantUML(source: string): Promise<string> {
  const lib = await bootstrap();
  if (!lib) throw new Error("CheerpJ library not loaded");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Svg = await (lib as any).com.plantuml.api.cheerpj.v1.Svg;
  const svg = await Svg.convert("light", source);

  if (typeof svg !== "string") {
    throw new Error("PlantUML render failed");
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
