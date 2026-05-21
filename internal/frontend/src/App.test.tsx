import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import App from "./App";
import { setupRender } from "./test/render";
import { SOURCE_PANEL_NAME, SOURCE_TOGGLE_LABEL } from "./sourcePanel";

vi.mock("./hooks/useFileList", () => ({
  useFileList: () => ({
    files: [{ path: "/a.puml", rel: "a.puml", name: "a.puml", source: "/" }],
    active: "/a.puml",
    select: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock("./hooks/useActiveRender", () => ({
  useActiveRender: () => ({
    source: "@startuml\n@enduml",
    render: { kind: "ok", svg: "data:image/svg+xml,svg" },
    reload: vi.fn(),
  }),
}));

vi.mock("./hooks/useServerEvents", () => ({
  useServerEvents: () => {},
}));

vi.mock("./components/file-tree", () => ({
  FileTree: () => <div data-testid="file-tree" />,
}));

vi.mock("./components/preview", () => ({
  Preview: () => <div data-testid="preview" />,
}));

vi.mock("./components/source-view", () => ({
  SourceView: () => <div data-testid="source-view" />,
}));

const render = setupRender();

const toggleButton = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>("button[aria-expanded]")!;

const sourcePanel = (): HTMLElement =>
  document.querySelector<HTMLElement>(`section[aria-label="${SOURCE_PANEL_NAME}"]`)!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App source panel toggle", () => {
  it("renders the source panel and 'hide source' label by default", () => {
    render(<App />);
    expect(toggleButton().textContent).toBe(SOURCE_TOGGLE_LABEL.open);
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
    expect(sourcePanel().hasAttribute("hidden")).toBe(false);
  });

  it("hides the source panel after one click", () => {
    render(<App />);
    act(() => toggleButton().click());
    expect(toggleButton().textContent).toBe(SOURCE_TOGGLE_LABEL.closed);
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    expect(sourcePanel().hasAttribute("hidden")).toBe(true);
  });

  it("re-shows the source panel after toggling back", () => {
    render(<App />);
    act(() => toggleButton().click());
    act(() => toggleButton().click());
    expect(toggleButton().textContent).toBe(SOURCE_TOGGLE_LABEL.open);
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
    expect(sourcePanel().hasAttribute("hidden")).toBe(false);
  });
});
