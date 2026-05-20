import { act, useState, type JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFileSource } from "../api/files";
import { renderPlantUML } from "../plantuml/renderer";
import { setupRender } from "../test/render";
import { useActiveRender, type UseActiveRenderResult } from "./useActiveRender";

vi.mock("../api/files", () => ({
  fetchFileSource: vi.fn(),
}));

vi.mock("../plantuml/renderer", () => ({
  renderPlantUML: vi.fn(),
}));

const mockedFetchFileSource = vi.mocked(fetchFileSource);
const mockedRenderPlantUML = vi.mocked(renderPlantUML);

let captured: UseActiveRenderResult | null;
let setActiveExternal: ((path: string | null) => void) | null;

function Harness({ initial = null }: { initial?: string | null }): JSX.Element {
  const [active, setActive] = useState<string | null>(initial);
  setActiveExternal = setActive;
  captured = useActiveRender(active);
  return <div />;
}

const render = setupRender();

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

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

beforeEach(() => {
  captured = null;
  setActiveExternal = null;
  vi.clearAllMocks();
});

afterEach(() => {
  captured = null;
  setActiveExternal = null;
});

describe("useActiveRender", () => {
  it("starts idle with no active path", () => {
    render(<Harness initial={null} />);
    expect(captured!.render).toEqual({ kind: "idle" });
    expect(captured!.source).toBe("");
    expect(mockedFetchFileSource).not.toHaveBeenCalled();
  });

  it("fetches source and renders SVG when active is set", async () => {
    mockedFetchFileSource.mockResolvedValueOnce("@startuml\n@enduml");
    mockedRenderPlantUML.mockResolvedValueOnce("data:image/svg+xml,svg");

    render(<Harness initial="/a.puml" />);
    await flush();

    expect(captured!.source).toBe("@startuml\n@enduml");
    expect(captured!.render).toEqual({ kind: "ok", svg: "data:image/svg+xml,svg" });
    expect(mockedFetchFileSource).toHaveBeenCalledWith("/a.puml");
  });

  it("shows loading state while the source/render is in flight", async () => {
    const src = deferred<string>();
    mockedFetchFileSource.mockReturnValueOnce(src.promise);
    mockedRenderPlantUML.mockResolvedValueOnce("data:image/svg+xml,x");

    render(<Harness initial="/a.puml" />);
    expect(captured!.render).toEqual({ kind: "loading" });

    await act(async () => {
      src.resolve("body");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(captured!.render).toEqual({ kind: "ok", svg: "data:image/svg+xml,x" });
  });

  it("reports an error state when the source fetch fails", async () => {
    mockedFetchFileSource.mockRejectedValueOnce(new Error("boom"));
    render(<Harness initial="/a.puml" />);
    await flush();

    expect(captured!.render).toEqual({ kind: "error", message: "boom" });
  });

  it("reports an error state when rendering fails", async () => {
    mockedFetchFileSource.mockResolvedValueOnce("source");
    mockedRenderPlantUML.mockRejectedValueOnce(new Error("parse error"));
    render(<Harness initial="/a.puml" />);
    await flush();

    expect(captured!.render).toEqual({ kind: "error", message: "parse error" });
  });

  it("returns to idle and clears source when active becomes null", async () => {
    mockedFetchFileSource.mockResolvedValueOnce("source");
    mockedRenderPlantUML.mockResolvedValueOnce("data:image/svg+xml,x");
    render(<Harness initial="/a.puml" />);
    await flush();

    act(() => setActiveExternal!(null));
    expect(captured!.source).toBe("");
    expect(captured!.render).toEqual({ kind: "idle" });
  });

  it("discards results from a stale fetch when active changes rapidly", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    mockedFetchFileSource.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mockedRenderPlantUML.mockResolvedValue("data:image/svg+xml,svg");

    render(<Harness initial="/a.puml" />);
    act(() => setActiveExternal!("/b.puml"));

    await act(async () => {
      first.resolve("first body");
      second.resolve("second body");
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(captured!.source).toBe("second body");
    expect(captured!.render).toEqual({ kind: "ok", svg: "data:image/svg+xml,svg" });
    // The stale `/a.puml` fetch resolved first but must not reach renderPlantUML.
    expect(mockedRenderPlantUML).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when reload is invoked", async () => {
    mockedFetchFileSource.mockResolvedValue("source");
    mockedRenderPlantUML.mockResolvedValue("data:image/svg+xml,x");
    render(<Harness initial="/a.puml" />);
    await flush();

    expect(mockedFetchFileSource).toHaveBeenCalledTimes(1);

    act(() => captured!.reload());
    await flush();

    expect(mockedFetchFileSource).toHaveBeenCalledTimes(2);
  });

  it("coerces non-Error throwables into a string message", async () => {
    mockedFetchFileSource.mockRejectedValueOnce("string error");
    render(<Harness initial="/a.puml" />);
    await flush();

    expect(captured!.render).toEqual({ kind: "error", message: "string error" });
  });
});
