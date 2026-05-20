import { useEffect, useState } from "react";
import { fetchFileSource } from "../api/files";
import { renderPlantUML } from "../plantuml/renderer";

type RenderState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; svg: string }
  | { kind: "error"; message: string };

export interface UseActiveRenderResult {
  source: string;
  render: RenderState;
  reload: () => void;
}

export function useActiveRender(active: string | null): UseActiveRenderResult {
  const [source, setSource] = useState<string>("");
  const [render, setRender] = useState<RenderState>({ kind: "idle" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!active) {
      setSource("");
      setRender({ kind: "idle" });
      return;
    }

    const controller = new AbortController();
    setRender({ kind: "loading" });

    void (async () => {
      try {
        const src = await fetchFileSource(active, controller.signal);
        if (controller.signal.aborted) return;
        setSource(src);
        const svg = await renderPlantUML(src);
        if (controller.signal.aborted) return;
        setRender({ kind: "ok", svg });
      } catch (e) {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : String(e);
        setRender({ kind: "error", message });
      }
    })();

    return () => controller.abort();
  }, [active, reloadKey]);

  return {
    source,
    render,
    reload: () => setReloadKey((k) => k + 1),
  };
}
