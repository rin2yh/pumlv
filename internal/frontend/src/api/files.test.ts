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
    expect(mock).toHaveBeenCalledWith("/api/file?path=%2Ftmp%2Fa%20b.puml");
  });

  it("encodes non-ASCII paths", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    } as unknown as Response);
    globalThis.fetch = mock as unknown as typeof fetch;

    await fetchFileSource("/tmp/日本語.puml");
    expect(mock).toHaveBeenCalledWith(`/api/file?path=${encodeURIComponent("/tmp/日本語.puml")}`);
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
  it("returns true for two empty lists", () => {
    expect(sameFilePaths([], [])).toBe(true);
  });

  it("returns true when both lists have the same paths in the same order", () => {
    const a = [entry("/a.puml"), entry("/b.puml")];
    const b = [entry("/a.puml"), entry("/b.puml")];
    expect(sameFilePaths(a, b)).toBe(true);
  });

  it("returns true when only non-path fields differ", () => {
    const a: FileEntry[] = [{ path: "/a.puml", rel: "a.puml", name: "a.puml", source: "/" }];
    const b: FileEntry[] = [{ path: "/a.puml", rel: "x", name: "x", source: "/different" }];
    expect(sameFilePaths(a, b)).toBe(true);
  });

  it("returns false when lengths differ", () => {
    expect(sameFilePaths([entry("/a.puml")], [entry("/a.puml"), entry("/b.puml")])).toBe(false);
  });

  it("returns false when a path differs", () => {
    expect(sameFilePaths([entry("/a.puml")], [entry("/b.puml")])).toBe(false);
  });

  it("returns false when order differs", () => {
    const a = [entry("/a.puml"), entry("/b.puml")];
    const b = [entry("/b.puml"), entry("/a.puml")];
    expect(sameFilePaths(a, b)).toBe(false);
  });
});
