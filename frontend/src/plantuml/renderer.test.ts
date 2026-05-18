import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  interface Window {
    cheerpjInit?: (opts?: Record<string, unknown>) => Promise<void>;
    cheerpjRunLibrary?: (classpath: string) => Promise<unknown>;
  }
}

const originalFetch = globalThis.fetch;

let cheerpjInit: ReturnType<typeof vi.fn>;
let cheerpjRunLibrary: ReturnType<typeof vi.fn>;
let svgConvert: ReturnType<typeof vi.fn>;
let runInitMain: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();

  svgConvert = vi.fn(async () => "<svg>fake</svg>");
  runInitMain = vi.fn(async () => undefined);

  const lib = {
    com: {
      plantuml: {
        api: {
          cheerpj: {
            v1: {
              Svg: { convert: svgConvert },
              RunInit: { main: runInitMain },
            },
          },
        },
      },
    },
  };

  cheerpjInit = vi.fn(async () => undefined);
  cheerpjRunLibrary = vi.fn(async () => lib);

  window.cheerpjInit = cheerpjInit as unknown as Window["cheerpjInit"];
  window.cheerpjRunLibrary = cheerpjRunLibrary as unknown as Window["cheerpjRunLibrary"];

  globalThis.fetch = vi.fn(async () => new Response("")) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete window.cheerpjInit;
  delete window.cheerpjRunLibrary;
});

describe("renderPlantUML", () => {
  it("returns a data:image/svg+xml URL from Svg.convert", async () => {
    const { renderPlantUML } = await import("./renderer");
    const url = await renderPlantUML("@startuml\nA -> B\n@enduml");
    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""))).toBe(
      "<svg>fake</svg>",
    );
  });

  it("invokes Svg.convert with the correct signature", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");
    expect(svgConvert).toHaveBeenCalledWith("light", "@startuml\n@enduml");
  });

  it("bootstraps CheerpJ exactly once across multiple renders", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("a");
    await renderPlantUML("b");
    await renderPlantUML("c");
    expect(cheerpjInit).toHaveBeenCalledTimes(1);
    expect(cheerpjRunLibrary).toHaveBeenCalledTimes(1);
    expect(svgConvert).toHaveBeenCalledTimes(3);
  });

  it("preloads the .jar before initializing CheerpJ", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");

    const calls = fetchMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain("/plantuml-core.jar");
  });

  it("does not fetch the .jar.js AOT bundle", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");

    const calls = fetchMock.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("/plantuml-core.jar.js");
  });

  it("runs RunInit.main to initialize PlantUML", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");
    expect(runInitMain).toHaveBeenCalledTimes(1);
  });

  it("loads the library with the /app classpath", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");
    expect(cheerpjRunLibrary).toHaveBeenCalledWith("/app/plantuml-core.jar");
  });

  it("throws when Svg.convert returns a non-string value", async () => {
    svgConvert.mockResolvedValueOnce(undefined);
    const { renderPlantUML } = await import("./renderer");
    await expect(renderPlantUML("@startuml\n@enduml")).rejects.toThrow(/PlantUML render failed/);
  });

  it("throws if cheerpjRunLibrary is not available after cheerpjInit", async () => {
    // Simulate CheerpJ 4.x not exposing cheerpjRunLibrary after init
    cheerpjInit.mockImplementationOnce(async () => {
      delete window.cheerpjRunLibrary;
    });
    const { renderPlantUML } = await import("./renderer");
    await expect(renderPlantUML("@startuml\n@enduml")).rejects.toThrow(
      /cheerpjRunLibrary missing/,
    );
  });

  it("throws if cheerpjInit disappears between loader and bootstrap", async () => {
    delete window.cheerpjInit;
    delete window.cheerpjRunLibrary;

    const appendChild = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node: Node): Node => {
        queueMicrotask(() => {
          const ev = new Event("load");
          (node as HTMLScriptElement).onload?.(ev as unknown as Event);
        });
        return node;
      });

    const { renderPlantUML } = await import("./renderer");
    await expect(renderPlantUML("@startuml\n@enduml")).rejects.toThrow(/CheerpJ API missing/);
    appendChild.mockRestore();
  });

  it("passes large source to Svg.convert without truncation", async () => {
    const largeSource = "@startuml\n" + "A -> B : message\n".repeat(1000) + "@enduml";
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML(largeSource);
    expect(svgConvert).toHaveBeenCalledWith("light", largeSource);
  });
});
