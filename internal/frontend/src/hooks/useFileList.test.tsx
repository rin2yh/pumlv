import { act, type JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFiles, type FileEntry } from "../api/files";
import { setupRender } from "../test/render";
import { useFileList, type UseFileListResult } from "./useFileList";

vi.mock("../api/files", () => ({
  fetchFiles: vi.fn(),
}));

const mockedFetchFiles = vi.mocked(fetchFiles);

let captured: UseFileListResult | null;

function Harness(): JSX.Element {
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

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  captured = null;
  vi.clearAllMocks();
});

afterEach(() => {
  captured = null;
});

describe("useFileList", () => {
  it("loads files and selects the first one as active", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml")]);

    render(<Harness />);
    await flush();

    expect(captured!.files.map((f) => f.path)).toEqual(["/a.puml", "/b.puml"]);
    expect(captured!.active).toBe("/a.puml");
  });

  it("starts with no active when the file list is empty", async () => {
    mockedFetchFiles.mockResolvedValueOnce([]);

    render(<Harness />);
    await flush();

    expect(captured!.files).toEqual([]);
    expect(captured!.active).toBeNull();
  });

  it("setActive updates the active path", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml")]);

    render(<Harness />);
    await flush();

    act(() => captured!.setActive("/b.puml"));
    expect(captured!.active).toBe("/b.puml");
  });

  it("preserves active across reloads when the file still exists", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml")]);
    render(<Harness />);
    await flush();

    act(() => captured!.setActive("/b.puml"));

    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml"), file("/c.puml")]);
    act(() => captured!.reload());
    await flush();

    expect(captured!.active).toBe("/b.puml");
    expect(captured!.files).toHaveLength(3);
  });

  it("falls back to the first file when the previously active path is gone", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml"), file("/b.puml")]);
    render(<Harness />);
    await flush();

    act(() => captured!.setActive("/b.puml"));

    mockedFetchFiles.mockResolvedValueOnce([file("/c.puml"), file("/d.puml")]);
    act(() => captured!.reload());
    await flush();

    expect(captured!.active).toBe("/c.puml");
  });

  it("clears active when the reloaded list is empty", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml")]);
    render(<Harness />);
    await flush();

    expect(captured!.active).toBe("/a.puml");

    mockedFetchFiles.mockResolvedValueOnce([]);
    act(() => captured!.reload());
    await flush();

    expect(captured!.active).toBeNull();
  });

  it("calls fetchFiles only once on mount", async () => {
    mockedFetchFiles.mockResolvedValueOnce([file("/a.puml")]);
    render(<Harness />);
    await flush();
    expect(mockedFetchFiles).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when reload is invoked", async () => {
    mockedFetchFiles.mockResolvedValue([file("/a.puml")]);
    render(<Harness />);
    await flush();

    act(() => captured!.reload());
    await flush();
    act(() => captured!.reload());
    await flush();

    expect(mockedFetchFiles).toHaveBeenCalledTimes(3);
  });
});
