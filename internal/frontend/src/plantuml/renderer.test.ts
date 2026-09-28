import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPlantUML } from "./renderer";

afterEach(() => vi.unstubAllGlobals());

describe("renderPlantUML", () => {
  it("sends the source to the Go renderer and returns an SVG data URL", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('<svg width="10"/>'));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const url = await renderPlantUML("@startuml\nA -> B\n@enduml", controller.signal);
    expect(fetch).toHaveBeenCalledWith("/api/render", {
      method: "POST",
      body: "@startuml\nA -> B\n@enduml",
      signal: controller.signal,
    });
    expect(decodeURIComponent(url.split(",")[1]!)).toBe('<svg width="10"/>');
  });

  it("reports renderer errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad diagram\n", { status: 422 })),
    );
    await expect(renderPlantUML("bad")).rejects.toThrow("bad diagram");
  });
});
