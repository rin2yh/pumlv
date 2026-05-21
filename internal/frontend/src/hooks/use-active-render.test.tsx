import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFileSource } from "../api/files";
import { renderPlantUML } from "../plantuml/renderer";
import { flush } from "../test/flush";
import { useActiveRender } from "./use-active-render";

vi.mock("../api/files", () => ({
  fetchFileSource: vi.fn(),
}));

vi.mock("../plantuml/renderer", () => ({
  renderPlantUML: vi.fn(),
}));

const mockedFetchFileSource = vi.mocked(fetchFileSource);
const mockedRenderPlantUML = vi.mocked(renderPlantUML);

const deferred = <T,>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const renderActive = (initial: string | null = null) =>
  renderHook(({ active }: { active: string | null }) => useActiveRender(active), {
    initialProps: { active: initial },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useActiveRender", () => {
  it("starts idle with no active path", () => {
    const { result } = renderActive(null);
    expect(result.current.render).toEqual({ kind: "idle" });
    expect(result.current.source).toBe("");
    expect(mockedFetchFileSource).not.toHaveBeenCalled();
  });

  it("fetches source and renders SVG when active is set", async () => {
    mockedFetchFileSource.mockResolvedValueOnce("@startuml\n@enduml");
    mockedRenderPlantUML.mockResolvedValueOnce("data:image/svg+xml,svg");

    const { result } = renderActive("/a.puml");
    await flush(3);

    expect(result.current.source).toBe("@startuml\n@enduml");
    expect(result.current.render).toEqual({ kind: "ok", svg: "data:image/svg+xml,svg" });
    expect(mockedFetchFileSource).toHaveBeenCalledWith("/a.puml", expect.any(AbortSignal));
  });

  it("shows loading state while the source/render is in flight", async () => {
    const src = deferred<string>();
    mockedFetchFileSource.mockReturnValueOnce(src.promise);
    mockedRenderPlantUML.mockResolvedValueOnce("data:image/svg+xml,x");

    const { result } = renderActive("/a.puml");
    expect(result.current.render).toEqual({ kind: "loading" });

    await act(async () => {
      src.resolve("body");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.render).toEqual({ kind: "ok", svg: "data:image/svg+xml,x" });
  });

  it.each([
    {
      name: "source fetch rejects with Error",
      setup: () => {
        mockedFetchFileSource.mockRejectedValueOnce(new Error("boom"));
      },
      message: "boom",
    },
    {
      name: "renderer rejects with Error",
      setup: () => {
        mockedFetchFileSource.mockResolvedValueOnce("source");
        mockedRenderPlantUML.mockRejectedValueOnce(new Error("parse error"));
      },
      message: "parse error",
    },
    {
      name: "non-Error throwable is coerced to string",
      setup: () => {
        mockedFetchFileSource.mockRejectedValueOnce("string error");
      },
      message: "string error",
    },
  ])("reports error state when $name", async ({ setup, message }) => {
    setup();
    const { result } = renderActive("/a.puml");
    await flush(3);

    expect(result.current.render).toEqual({ kind: "error", message });
  });

  it("returns to idle and clears source when active becomes null", async () => {
    mockedFetchFileSource.mockResolvedValueOnce("source");
    mockedRenderPlantUML.mockResolvedValueOnce("data:image/svg+xml,x");
    const { result, rerender } = renderActive("/a.puml");
    await flush(3);

    rerender({ active: null });
    expect(result.current.source).toBe("");
    expect(result.current.render).toEqual({ kind: "idle" });
  });

  it("discards results from a stale fetch when active changes rapidly", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    mockedFetchFileSource.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mockedRenderPlantUML.mockResolvedValue("data:image/svg+xml,svg");

    const { result, rerender } = renderActive("/a.puml");
    rerender({ active: "/b.puml" });

    await act(async () => {
      first.resolve("first body");
      second.resolve("second body");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.source).toBe("second body");
    expect(result.current.render).toEqual({ kind: "ok", svg: "data:image/svg+xml,svg" });
    // The stale `/a.puml` fetch resolved first but must not reach renderPlantUML.
    expect(mockedRenderPlantUML).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when reload is invoked", async () => {
    mockedFetchFileSource.mockResolvedValue("source");
    mockedRenderPlantUML.mockResolvedValue("data:image/svg+xml,x");
    const { result } = renderActive("/a.puml");
    await flush(3);

    expect(mockedFetchFileSource).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());
    await flush(3);

    expect(mockedFetchFileSource).toHaveBeenCalledTimes(2);
  });
});
