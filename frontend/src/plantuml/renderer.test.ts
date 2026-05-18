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

  it("rejects when renderToString reports a non-size error", async () => {
    renderToString.mockImplementationOnce(
      (_lines: string[], _onSuccess: (svg: string) => void, onError: (msg: string) => void) => {
        onError("parse error at line 2");
      },
    );
    await expect(renderPlantUML("bad")).rejects.toThrow(/parse error at line 2/);
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
  it("inserts the scale line immediately after @startuml", () => {
    const result = withScale(["@startuml", "A -> B", "@enduml"], 0.5);
    expect(result).toEqual(["@startuml", "scale 0.5000", "A -> B", "@enduml"]);
  });

  it("inserts at position 0 when no @start line is found", () => {
    const result = withScale(["A -> B"], 0.25);
    expect(result[0]).toBe("scale 0.2500");
    expect(result[1]).toBe("A -> B");
  });

  it("handles @startmindmap and other @start variants", () => {
    const result = withScale(["@startmindmap", "* root", "@endmindmap"], 0.8);
    expect(result[0]).toBe("@startmindmap");
    expect(result[1]).toMatch(/^scale 0\.8000/);
  });
});
