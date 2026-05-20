import { useEffect, useRef, useState } from "react";
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
  const renderSeq = useRef(0);

  useEffect(() => {
    if (!active) {
      renderSeq.current++;
      setSource("");
      setRender({ kind: "idle" });
      return;
    }

    const seq = ++renderSeq.current;
    setRender({ kind: "loading" });

    void (async () => {
      try {
        const src = await fetchFileSource(active);
        if (seq !== renderSeq.current) return;
        setSource(src);
        const svg = await renderPlantUML(src);
        if (seq !== renderSeq.current) return;
        setRender({ kind: "ok", svg });
      } catch (e) {
        if (seq !== renderSeq.current) return;
        const message = e instanceof Error ? e.message : String(e);
        setRender({ kind: "error", message });
      }
    })();
  }, [active, reloadKey]);

  return {
    source,
    render,
    reload: () => setReloadKey((k) => k + 1),
  };
}
