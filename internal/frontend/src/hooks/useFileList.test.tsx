import { act, type JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFiles, type FileEntry } from "../api/files";
import { flush } from "../test/flush";
import { setupRender } from "../test/render";
import { useFileList, type UseFileListResult } from "./useFileList";

vi.mock("../api/files", () => ({
  fetchFiles: vi.fn(),
}));

const mockedFetchFiles = vi.mocked(fetchFiles);

let captured: UseFileListResult | null;

function Probe(): JSX.Element {
  captured = useFileList();
  return <div />;
}

const render = setupRender();

const file = (path: string): FileEntry => ({
  path,
  rel: path,
  name: path,
  source: "/",
});

beforeEach(() => {
  captured = null;
  vi.clearAllMocks();
});

afterEach(() => {
  captured = null;
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

    render(<Probe />);
    await flush();

    expect(captured!.files).toEqual(initial);
    expect(captured!.active).toBe(expected);
  });

  it("select updates the active path", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml")]);

    render(<Probe />);
    await flush();

    act(() => captured!.select("/b.puml"));
    expect(captured!.active).toBe("/b.puml");
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
    render(<Probe />);
    await flush();

    act(() => captured!.select(selected));

    mockedFetchFiles.mockResolvedValueOnce(reloaded);
    act(() => captured!.reload());
    await flush();

    expect(captured!.active).toBe(expected);
  });

  it.each([
    { name: "once on mount", reloads: 0, expected: 1 },
    { name: "once per reload", reloads: 2, expected: 3 },
  ])("fetchFiles is called $name", async ({ reloads, expected }) => {
    mockedFetchFiles.mockResolvedValue([file("/a.puml")]);
    render(<Probe />);
    await flush();

    for (let i = 0; i < reloads; i++) {
      act(() => captured!.reload());
      await flush();
    }

    expect(mockedFetchFiles).toHaveBeenCalledTimes(expected);
  });
});
