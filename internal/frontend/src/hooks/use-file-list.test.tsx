import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  delete window.webkit;
  vi.unstubAllGlobals();
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

  it("applies native selections after registering the listener and initializing the bridge", async () => {
    const files = [file("/a.puml"), file("/b.puml")];
    mockedFetchFiles.mockResolvedValueOnce(files);
    const messages: { id?: string; type: string }[] = [];
    window.webkit = {
      messageHandlers: {
        pumlv: {
          postMessage(message) {
            const request = JSON.parse(message) as { id?: string; type: string };
            messages.push(request);
            if (request.type === "ready") {
              window.dispatchEvent(new CustomEvent("pumlv:select", { detail: "/b.puml" }));
            }
          },
        },
      },
    };
    vi.stubGlobal("location", { protocol: "pumlv:" } as Location);

    const { result, unmount } = renderHook(() => useFileList());
    await flush();

    expect(messages.map((message) => message.type)).toEqual(["ready"]);
    expect(result.current.active).toBe("/b.puml");

    act(() => window.dispatchEvent(new CustomEvent("pumlv:select", { detail: "/a.puml" })));
    expect(result.current.active).toBe("/a.puml");
    unmount();
    act(() => window.dispatchEvent(new CustomEvent("pumlv:select", { detail: "/b.puml" })));
    expect(result.current.active).toBe("/a.puml");
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

it("refreshes Markdown labels and falls back within the same file after block removal", async () => {
  const markdown = {
    ...file("/diagrams.md"),
    diagrams: [{ line: 1, title: "First" }, { line: 8 }],
  };
  mockedFetchFiles.mockResolvedValueOnce([markdown]);
  const { result } = renderHook(() => useFileList());
  await flush();
  expect(result.current.active).toBe("markdown:%2Fdiagrams.md:1");
  act(() => result.current.select("markdown:%2Fdiagrams.md:8"));
  mockedFetchFiles.mockResolvedValueOnce([
    { ...markdown, diagrams: [{ line: 1, title: "Updated" }] },
  ]);
  act(() => result.current.reload());
  await flush();
  expect(result.current.files[0]?.diagrams).toEqual([{ line: 1, title: "Updated" }]);
  expect(result.current.active).toBe("markdown:%2Fdiagrams.md:1");
});
