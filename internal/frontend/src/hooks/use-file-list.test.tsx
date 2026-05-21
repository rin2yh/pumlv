import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFiles, type FileEntry } from "../api/files";
import { flush } from "../test/flush";
import { useFileList } from "./use-file-list";

vi.mock("../api/files", async () => {
  const actual = await vi.importActual<typeof import("../api/files")>("../api/files");
  return { ...actual, fetchFiles: vi.fn() };
});

const mockedFetchFiles = vi.mocked(fetchFiles);

const file = (path: string): FileEntry => ({
  path,
  rel: path,
  name: path,
  source: "/",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFileList", () => {
  it.each([
    {
      name: "selects the first file as active",
      files: [file("/a.puml"), file("/b.puml")],
      expected: "/a.puml",
    },
    { name: "leaves active null when the list is empty", files: [], expected: null },
  ])("initial load $name", async ({ files: initial, expected }) => {
    mockedFetchFiles.mockResolvedValueOnce(initial);

    const { result } = renderHook(() => useFileList());
    await flush();

    expect(result.current.files).toEqual(initial);
    expect(result.current.active).toBe(expected);
  });

  it("select updates the active path", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml")]);

    const { result } = renderHook(() => useFileList());
    await flush();

    act(() => result.current.select("/b.puml"));
    expect(result.current.active).toBe("/b.puml");
  });

  it.each([
    {
      name: "preserves active when the file still exists",
      initial: [file("/a.puml"), file("/b.puml")],
      selected: "/b.puml",
      reloaded: [file("/a.puml"), file("/b.puml"), file("/c.puml")],
      expected: "/b.puml",
    },
    {
      name: "falls back to the first file when active is gone",
      initial: [file("/a.puml"), file("/b.puml")],
      selected: "/b.puml",
      reloaded: [file("/c.puml"), file("/d.puml")],
      expected: "/c.puml",
    },
    {
      name: "clears active when the reloaded list is empty",
      initial: [file("/a.puml")],
      selected: "/a.puml",
      reloaded: [],
      expected: null,
    },
  ])("on reload $name", async ({ initial, selected, reloaded, expected }) => {
    mockedFetchFiles.mockResolvedValueOnce(initial);
    const { result } = renderHook(() => useFileList());
    await flush();

    act(() => result.current.select(selected));

    mockedFetchFiles.mockResolvedValueOnce(reloaded);
    act(() => result.current.reload());
    await flush();

    expect(result.current.active).toBe(expected);
  });

  it.each([
    { name: "once on mount", reloads: 0, expected: 1 },
    { name: "once per reload", reloads: 2, expected: 3 },
  ])("fetchFiles is called $name", async ({ reloads, expected }) => {
    mockedFetchFiles.mockResolvedValue([file("/a.puml")]);
    const { result } = renderHook(() => useFileList());
    await flush();

    for (let i = 0; i < reloads; i++) {
      act(() => result.current.reload());
      await flush();
    }

    expect(mockedFetchFiles).toHaveBeenCalledTimes(expected);
  });
});
