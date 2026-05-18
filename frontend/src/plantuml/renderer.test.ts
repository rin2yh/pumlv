import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setPlantUMLModuleForTests, renderPlantUML } from "./renderer";

let renderToString: ReturnType<typeof vi.fn>;

beforeEach(() => {
  renderToString = vi.fn(
    (_lines: string[], onSuccess: (svg: string) => void, _onError: (msg: string) => void) => {
      onSuccess("<svg>fake</svg>");
    },
  );
  setPlantUMLModuleForTests({ renderToString });
});

afterEach(() => {
  setPlantUMLModuleForTests(null);
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

  it("rejects when renderToString reports an error", async () => {
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

  it("reuses the bootstrapped module across multiple renders", async () => {
    await renderPlantUML("a");
    await renderPlantUML("b");
    await renderPlantUML("c");
    expect(renderToString).toHaveBeenCalledTimes(3);
  });
});
