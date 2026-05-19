import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPlantUMLModule } from "./bootstrap";
import { renderPlantUML, withScale } from "./renderer";

vi.mock("./bootstrap", () => ({
  loadPlantUMLModule: vi.fn(),
}));

let renderToString: ReturnType<typeof vi.fn>;

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

  it.each([
    { error: "parse error at line 2" },
    { error: "syntax error" },
    { error: "unknown diagram type" },
  ])("re-throws non-size errors as-is ($error)", async ({ error }) => {
    renderToString.mockImplementationOnce(
      (_lines: string[], _onSuccess: (svg: string) => void, onError: (msg: string) => void) => {
        onError(error);
      },
    );
    await expect(renderPlantUML("bad")).rejects.toThrow(error);
  });

  it("retries with an auto-calculated scale pragma when the diagram is too large", async () => {
    renderToString
      .mockImplementationOnce(
        (_lines: string[], _onSuccess: (svg: string) => void, onError: (msg: string) => void) => {
          onError("Diagram too large for browser rendering: 654 x 56057 (max 4096)");
        },
      )
      .mockImplementationOnce((_lines: string[], onSuccess: (svg: string) => void) => {
        onSuccess("<svg>scaled</svg>");
      });

    const url = await renderPlantUML("@startuml\nA -> B\n@enduml");
    expect(url).toContain(encodeURIComponent("<svg>scaled</svg>"));

    // Second call must include a scale pragma right after @startuml
    const retryLines: string[] = renderToString.mock.calls[1][0];
    expect(retryLines[0]).toBe("@startuml");
    expect(retryLines[1]).toMatch(/^scale 0\.\d+/);
    // Scaled height must fit within 4000px (MAX_RENDER_PX)
    const scale = parseFloat(retryLines[1].split(" ")[1]);
    expect(56057 * scale).toBeLessThanOrEqual(4000);
  });

  it("propagates the error if the retry also fails", async () => {
    renderToString.mockImplementation(
      (_lines: string[], _onSuccess: (svg: string) => void, onError: (msg: string) => void) => {
        onError("Diagram too large for browser rendering: 654 x 56057 (max 4096)");
      },
    );
    await expect(renderPlantUML("@startuml\nA -> B\n@enduml")).rejects.toThrow(/Diagram too large/);
  });
});

describe("withScale", () => {
  it.each([
    {
      name: "inserts after @startuml",
      lines: ["@startuml", "A -> B", "@enduml"],
      scale: 0.5,
      expected: ["@startuml", "scale 0.5000", "A -> B", "@enduml"],
    },
    {
      name: "inserts at position 0 when no @start line is found",
      lines: ["A -> B"],
      scale: 0.25,
      expected: ["scale 0.2500", "A -> B"],
    },
    {
      name: "handles @startmindmap",
      lines: ["@startmindmap", "* root", "@endmindmap"],
      scale: 0.8,
      expected: ["@startmindmap", "scale 0.8000", "* root", "@endmindmap"],
    },
    {
      name: "handles @startwbs",
      lines: ["@startwbs", "* root", "@endwbs"],
      scale: 0.3,
      expected: ["@startwbs", "scale 0.3000", "* root", "@endwbs"],
    },
    {
      name: "floor-rounds to avoid exceeding the limit",
      lines: ["@startuml", "@enduml"],
      scale: 4000 / 56057,
      expected: ["@startuml", "scale 0.0713", "@enduml"],
    },
  ])("$name", ({ lines, scale, expected }) => {
    expect(withScale(lines, scale)).toEqual(expected);
  });
});
