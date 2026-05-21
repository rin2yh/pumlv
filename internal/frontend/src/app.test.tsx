import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import App from "./app";
import { fetchFileSource, fetchFiles, type FileEntry } from "./api/files";
import { subscribe, type EventHandler } from "./api/events";
import { renderPlantUML } from "./plantuml/renderer";
import { flush } from "./test/flush";
import { setupRender } from "./test/render";
import { SOURCE_PANEL_ID, SOURCE_PANEL_NAME, SOURCE_TOGGLE_LABEL } from "./source-panel";

vi.mock("./api/files", async () => {
  const actual = await vi.importActual<typeof import("./api/files")>("./api/files");
  return { ...actual, fetchFiles: vi.fn(), fetchFileSource: vi.fn() };
});

vi.mock("./api/events", () => ({
  subscribe: vi.fn(),
}));

vi.mock("./plantuml/renderer", () => ({
  renderPlantUML: vi.fn(),
}));

const mockedFetchFiles = vi.mocked(fetchFiles);
const mockedFetchFileSource = vi.mocked(fetchFileSource);
const mockedRenderPlantUML = vi.mocked(renderPlantUML);
const mockedSubscribe = vi.mocked(subscribe);

const file = (path: string): FileEntry => ({ path, rel: path, name: path, source: "/" });

const FILES: FileEntry[] = [file("/a.puml"), file("/b.puml")];

const SOURCES: Record<string, string> = {
  "/a.puml": "@startuml\nactor A\n@enduml",
  "/b.puml": "@startuml\nactor B\n@enduml",
};

const RENDERED: Record<string, string> = {
  "/a.puml": "data:image/svg+xml;charset=utf-8,a",
  "/b.puml": "data:image/svg+xml;charset=utf-8,b",
};

let capturedEventHandler: EventHandler | null = null;

beforeEach(() => {
  capturedEventHandler = null;
  mockedFetchFiles.mockResolvedValue(FILES);
  mockedFetchFileSource.mockImplementation(async (path) => SOURCES[path] ?? "");
  mockedRenderPlantUML.mockImplementation(async (src) => {
    const path = Object.keys(SOURCES).find((p) => SOURCES[p] === src);
    return path ? RENDERED[path]! : "data:image/svg+xml;charset=utf-8,unknown";
  });
  mockedSubscribe.mockImplementation((handler) => {
    capturedEventHandler = handler;
    return () => {
      capturedEventHandler = null;
    };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

const render = setupRender();

const toggleButton = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`button[aria-controls="${SOURCE_PANEL_ID}"]`)!;

const sourcePanel = (): HTMLElement =>
  document.querySelector<HTMLElement>(`section[aria-label="${SOURCE_PANEL_NAME}"]`)!;

const previewImg = (): HTMLImageElement | null =>
  document.querySelector<HTMLImageElement>('img[alt="preview"]');

const fileButton = (rel: string): HTMLButtonElement => {
  const buttons = document.querySelectorAll<HTMLButtonElement>("aside nav button");
  for (const b of buttons) {
    if (b.textContent?.includes(rel) && !b.hasAttribute("aria-expanded")) return b;
  }
  throw new Error(`file button ${rel} not found`);
};

describe("App", () => {
  it("loads the file list and renders the first file's preview by default", async () => {
    render(<App />);
    await flush(5);

    expect(document.body.textContent).toContain(`${FILES.length} file(s)`);
    expect(previewImg()!.getAttribute("src")).toBe(RENDERED["/a.puml"]);
    expect(sourcePanel().hasAttribute("hidden")).toBe(false);
    expect(sourcePanel().textContent).toContain("actor A");
  });

  describe("source panel toggle", () => {
    it("hides the real <SourceView> region when clicked", async () => {
      render(<App />);
      await flush(5);

      expect(toggleButton().textContent).toBe(SOURCE_TOGGLE_LABEL.open);
      expect(sourcePanel().hasAttribute("hidden")).toBe(false);

      act(() => toggleButton().click());
      expect(toggleButton().textContent).toBe(SOURCE_TOGGLE_LABEL.closed);
      expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
      expect(sourcePanel().hasAttribute("hidden")).toBe(true);
    });

    it("restores the panel on a second click", async () => {
      render(<App />);
      await flush(5);

      act(() => toggleButton().click());
      act(() => toggleButton().click());

      expect(toggleButton().textContent).toBe(SOURCE_TOGGLE_LABEL.open);
      expect(sourcePanel().hasAttribute("hidden")).toBe(false);
    });
  });

  it("re-renders the preview and source when a different file is selected", async () => {
    render(<App />);
    await flush(5);
    expect(previewImg()!.getAttribute("src")).toBe(RENDERED["/a.puml"]);

    act(() => fileButton("b.puml").click());
    await flush(5);

    expect(previewImg()!.getAttribute("src")).toBe(RENDERED["/b.puml"]);
    expect(sourcePanel().textContent).toContain("actor B");
  });

  it("reloads the active file when a 'changed' event matches it", async () => {
    render(<App />);
    await flush(5);
    expect(mockedFetchFileSource).toHaveBeenCalledTimes(1);

    await act(async () => {
      capturedEventHandler!({ type: "changed", path: "/a.puml" });
    });
    await flush(5);
    expect(mockedFetchFileSource).toHaveBeenCalledTimes(2);
  });

  it("ignores 'changed' events for files that aren't active", async () => {
    render(<App />);
    await flush(5);
    expect(mockedFetchFileSource).toHaveBeenCalledTimes(1);

    await act(async () => {
      capturedEventHandler!({ type: "changed", path: "/b.puml" });
    });
    await flush(5);
    expect(mockedFetchFileSource).toHaveBeenCalledTimes(1);
  });

  it("shows the error panel when rendering fails", async () => {
    mockedRenderPlantUML.mockRejectedValueOnce(new Error("syntax error"));
    render(<App />);
    await flush(5);

    expect(previewImg()).toBeNull();
    expect(document.body.textContent).toContain("syntax error");
  });
});
