import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  interface Window {
    cheerpjInit?: (opts?: Record<string, unknown>) => Promise<void>;
    cheerpjRunMain?: (main: string, classpath: string, ...args: string[]) => Promise<number>;
    cjCall?: <T = unknown>(className: string, method: string, ...args: unknown[]) => Promise<T>;
  }
}

const originalFetch = globalThis.fetch;

let cheerpjInit: ReturnType<typeof vi.fn>;
let cheerpjRunMain: ReturnType<typeof vi.fn>;
let cjCall: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();

  cheerpjInit = vi.fn(async () => undefined);
  cheerpjRunMain = vi.fn(async () => 0);
  cjCall = vi.fn(async () => "ZmFrZQ==");

  window.cheerpjInit = cheerpjInit as unknown as Window["cheerpjInit"];
  window.cheerpjRunMain = cheerpjRunMain as unknown as Window["cheerpjRunMain"];
  window.cjCall = cjCall as unknown as Window["cjCall"];

  globalThis.fetch = vi.fn(async () => new Response("")) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete window.cheerpjInit;
  delete window.cheerpjRunMain;
  delete window.cjCall;
});

describe("renderPlantUML", () => {
  it("returns a data:image/png URL using the base64 string from cjCall", async () => {
    const { renderPlantUML } = await import("./renderer");
    const url = await renderPlantUML("@startuml\nA -> B\n@enduml");
    expect(url).toBe("data:image/png;base64,ZmFrZQ==");
  });

  it("invokes cjCall with the PlantUML cheerpj API signature", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");
    expect(cjCall).toHaveBeenCalledWith(
      "com.plantuml.api.cheerpj.v1.Png",
      "convertToBase64",
      "light",
      "@startuml\n@enduml",
    );
  });

  it("bootstraps CheerpJ exactly once across multiple renders", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("a");
    await renderPlantUML("b");
    await renderPlantUML("c");
    expect(cheerpjInit).toHaveBeenCalledTimes(1);
    expect(cheerpjRunMain).toHaveBeenCalledTimes(1);
    expect(cjCall).toHaveBeenCalledTimes(3);
  });

  it("preloads the .jar and .jar.js before initializing CheerpJ", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");

    const calls = fetchMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain("/plantuml-core.jar");
    expect(calls).toContain("/plantuml-core.jar.js");
  });

  it("runs RunInit with the /app classpath", async () => {
    const { renderPlantUML } = await import("./renderer");
    await renderPlantUML("@startuml\n@enduml");
    expect(cheerpjRunMain).toHaveBeenCalledWith(
      "com.plantuml.api.cheerpj.v1.RunInit",
      "/app/plantuml-core.jar",
    );
  });

  it("throws when cjCall returns a non-string value", async () => {
    cjCall.mockResolvedValueOnce(undefined);
    const { renderPlantUML } = await import("./renderer");
    await expect(renderPlantUML("@startuml\n@enduml")).rejects.toThrow(/PlantUML render failed/);
  });

  it("throws if cjCall is missing on the window after bootstrap", async () => {
    delete window.cjCall;
    const { renderPlantUML } = await import("./renderer");
    await expect(renderPlantUML("@startuml\n@enduml")).rejects.toThrow(/cjCall missing/);
  });

  it("throws if cheerpjInit disappears between loader and bootstrap", async () => {
    delete window.cheerpjInit;
    delete window.cheerpjRunMain;

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
});
