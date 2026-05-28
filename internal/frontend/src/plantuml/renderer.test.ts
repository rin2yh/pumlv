import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { loadPlantUMLModule } from "./bootstrap";
import { renderPlantUML } from "./renderer";

vi.mock("./bootstrap", () => ({
  loadPlantUMLModule: vi.fn(),
}));

let renderToString: Mock<
  (lines: string[], onSuccess: (svg: string) => void, onError: (message: string) => void) => void
>;

beforeEach(() => {
  vi.clearAllMocks();
  renderToString = vi.fn(
    (_lines: string[], onSuccess: (svg: string) => void, _onError: (msg: string) => void) => {
      onSuccess("<svg>fake</svg>");
    },
  );
  vi.mocked(loadPlantUMLModule).mockResolvedValue({ renderToString });
});

describe("renderPlantUML", () => {
  it("returns a data:image/svg+xml URL produced by renderToString", async () => {
    const url = await renderPlantUML("@startuml\nA -> B\n@enduml");
    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(url.replace("data:image/svg+xml;charset=utf-8,", ""))).toBe(
      "<svg>fake</svg>",
    );
  });

  it("invokes renderToString with the source split into lines", async () => {
    await renderPlantUML("@startuml\nA -> B\n@enduml");
    expect(renderToString).toHaveBeenCalledTimes(1);
    expect(renderToString.mock.calls[0][0]).toEqual(["@startuml", "A -> B", "@enduml"]);
  });

  it.each([
    { error: "parse error at line 2" },
    { error: "syntax error" },
    { error: "unknown diagram type" },
  ])("rejects when renderToString reports an error ($error)", async ({ error }) => {
    renderToString.mockImplementationOnce(
      (_lines: string[], _onSuccess: (svg: string) => void, onError: (msg: string) => void) => {
        onError(error);
      },
    );
    await expect(renderPlantUML("bad")).rejects.toThrow(error);
  });

  it("passes large source to renderToString without truncation", async () => {
    const largeSource = "@startuml\n" + "A -> B : message\n".repeat(1000) + "@enduml";
    await renderPlantUML(largeSource);
    const lines: string[] = renderToString.mock.calls[0][0];
    expect(lines).toHaveLength(largeSource.split("\n").length);
  });

  it("delegates module loading to loadPlantUMLModule on every render", async () => {
    await renderPlantUML("a");
    await renderPlantUML("b");
    await renderPlantUML("c");
    expect(vi.mocked(loadPlantUMLModule)).toHaveBeenCalledTimes(3);
    expect(renderToString).toHaveBeenCalledTimes(3);
  });
});
