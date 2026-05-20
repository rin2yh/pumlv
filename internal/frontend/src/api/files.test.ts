import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchFileSource, fetchFiles, sameFilePaths, type FileEntry } from "./files";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchFiles", () => {
  it("returns the parsed file list", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ path: "/p", rel: "p", name: "p", source: "/" }]),
    } as unknown as Response);
    globalThis.fetch = mock as unknown as typeof fetch;

    const got = await fetchFiles();
    expect(got).toHaveLength(1);
    expect(got[0]!.name).toBe("p");
    expect(mock).toHaveBeenCalledWith("/api/files");
  });

  it("returns multiple entries preserving order", async () => {
    const payload: FileEntry[] = [
      { path: "/a/x.puml", rel: "x.puml", name: "x.puml", source: "/a" },
      { path: "/a/y.puml", rel: "y.puml", name: "y.puml", source: "/a" },
      { path: "/b/z.puml", rel: "z.puml", name: "z.puml", source: "/b" },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    } as unknown as Response) as unknown as typeof fetch;

    const got = await fetchFiles();
    expect(got).toEqual(payload);
  });

  it("returns an empty array when the server has no files", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response) as unknown as typeof fetch;

    await expect(fetchFiles()).resolves.toEqual([]);
  });

  it("throws when the response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(""),
    } as unknown as Response) as unknown as typeof fetch;
    await expect(fetchFiles()).rejects.toThrow(/failed to load files/);
  });

  it("includes the status code in the error message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response) as unknown as typeof fetch;
    await expect(fetchFiles()).rejects.toThrow(/404/);
  });

  it("propagates network errors from fetch", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("network down")) as unknown as typeof fetch;
    await expect(fetchFiles()).rejects.toThrow(/network down/);
  });
});

describe("fetchFileSource", () => {
  it("urlencodes the path", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("@startuml\n@enduml\n"),
    } as unknown as Response);
    globalThis.fetch = mock as unknown as typeof fetch;

    const body = await fetchFileSource("/tmp/a b.puml");
    expect(body).toBe("@startuml\n@enduml\n");
    expect(mock).toHaveBeenCalledWith("/api/file?path=%2Ftmp%2Fa%20b.puml", {
      signal: undefined,
    });
  });

  it("encodes non-ASCII paths", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    } as unknown as Response);
    globalThis.fetch = mock as unknown as typeof fetch;

    await fetchFileSource("/tmp/日本語.puml");
    expect(mock).toHaveBeenCalledWith(`/api/file?path=${encodeURIComponent("/tmp/日本語.puml")}`, {
      signal: undefined,
    });
  });

  it("returns an empty string for an empty file", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    } as unknown as Response) as unknown as typeof fetch;

    await expect(fetchFileSource("/tmp/empty.puml")).resolves.toBe("");
  });

  it("throws with status code on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response) as unknown as typeof fetch;

    await expect(fetchFileSource("/tmp/x.puml")).rejects.toThrow(/failed to load source: 503/);
  });

  it("forwards the AbortSignal to fetch", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    } as unknown as Response);
    globalThis.fetch = mock as unknown as typeof fetch;

    const controller = new AbortController();
    await fetchFileSource("/tmp/x.puml", controller.signal);

    expect(mock).toHaveBeenCalledWith("/api/file?path=%2Ftmp%2Fx.puml", {
      signal: controller.signal,
    });
  });

  it("rejects with the abort reason when the signal aborts mid-flight", async () => {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as unknown as typeof fetch;

    const controller = new AbortController();
    const pending = fetchFileSource("/tmp/x.puml", controller.signal);
    controller.abort();

    await expect(pending).rejects.toThrow(/aborted/);
  });
});

function entry(path: string): FileEntry {
  return {
    path,
    rel: path.replace(/^\//, ""),
    name: path.split("/").pop()!,
    source: "/",
  };
}

describe("sameFilePaths", () => {
  it.each([
    { name: "two empty lists", a: [], b: [], want: true },
    {
      name: "same paths in the same order",
      a: [entry("/a.puml"), entry("/b.puml")],
      b: [entry("/a.puml"), entry("/b.puml")],
      want: true,
    },
    {
      name: "only non-path fields differ",
      a: [{ path: "/a.puml", rel: "a.puml", name: "a.puml", source: "/" }] as FileEntry[],
      b: [{ path: "/a.puml", rel: "x", name: "x", source: "/different" }] as FileEntry[],
      want: true,
    },
    {
      name: "lengths differ",
      a: [entry("/a.puml")],
      b: [entry("/a.puml"), entry("/b.puml")],
      want: false,
    },
    {
      name: "a path differs",
      a: [entry("/a.puml")],
      b: [entry("/b.puml")],
      want: false,
    },
    {
      name: "order differs",
      a: [entry("/a.puml"), entry("/b.puml")],
      b: [entry("/b.puml"), entry("/a.puml")],
      want: false,
    },
  ])("$name -> $want", ({ a, b, want }) => {
    expect(sameFilePaths(a, b)).toBe(want);
  });
});
