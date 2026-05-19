import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { fetchFiles, fetchFileSource, type FileEntry } from "./api/files";
import { subscribe } from "./api/events";
import { renderPlantUML } from "./plantuml/renderer";
import { FileTree } from "./components/FileTree";
import { Preview } from "./components/Preview";
import { SourceView } from "./components/SourceView";
import { SOURCE_PANEL_ID, SOURCE_PANEL_NAME, SOURCE_TOGGLE_LABEL } from "./sourcePanel";

type RenderState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; svg: string }
  | { kind: "error"; message: string };

export default function App(): JSX.Element {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [render, setRender] = useState<RenderState>({ kind: "idle" });
  const [sourceOpen, setSourceOpen] = useState<boolean>(true);

  const activeRef = useRef<string | null>(null);
  activeRef.current = active;

  const renderSeq = useRef(0);

  const reloadFiles = useCallback(async () => {
    const list = await fetchFiles();

    setFiles(list);

    setActive((prev) => {
      if (prev && list.some((f) => f.path === prev)) {
        return prev;
      }

      return list[0]?.path ?? null;
    });
  }, []);

  const reloadActive = useCallback(async (path: string) => {
    const seq = ++renderSeq.current;

    setRender({ kind: "loading" });

    try {
      const src = await fetchFileSource(path);

      if (seq !== renderSeq.current) {
        return;
      }

      setSource(src);

      const svg = await renderPlantUML(src);

      if (seq !== renderSeq.current) {
        return;
      }

      if (activeRef.current === path) {
        setRender({ kind: "ok", svg });
      }
    } catch (e) {
      if (seq !== renderSeq.current) {
        return;
      }

      const message = e instanceof Error ? e.message : String(e);

      if (activeRef.current === path) {
        setRender({ kind: "error", message });
      }
    }
  }, []);

  useEffect(() => {
    void reloadFiles();
  }, [reloadFiles]);

  useEffect(() => {
    if (active) {
      void reloadActive(active);
    } else {
      renderSeq.current++;

      setSource("");
      setRender({ kind: "idle" });
    }
  }, [active, reloadActive]);

  useEffect(() => {
    const unsubscribe = subscribe((ev) => {
      if (ev.type === "changed") {
        if (ev.path === activeRef.current) {
          void reloadActive(ev.path);
        }
      } else if (ev.type === "tree") {
        void reloadFiles();
      }
    });

    return unsubscribe;
  }, [reloadActive, reloadFiles]);

  const activeName = files.find((f) => f.path === active)?.rel ?? "";
  const toggleLabel = sourceOpen ? SOURCE_TOGGLE_LABEL.open : SOURCE_TOGGLE_LABEL.closed;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h1 className="font-semibold text-violet-700">pumlv</h1>
          <p className="text-xs text-slate-500">{files.length} file(s)</p>
        </div>

        <FileTree files={files} active={active} onSelect={setActive} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-2 text-sm text-slate-600">
          <span className="min-w-0 truncate">{activeName || "no file selected"}</span>

          <button
            type="button"
            aria-expanded={sourceOpen}
            aria-controls={SOURCE_PANEL_ID}
            onClick={() => setSourceOpen((v) => !v)}
            className="shrink-0 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            {toggleLabel}
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="relative min-w-0 flex-1 bg-slate-100">
            {render.kind === "loading" && (
              <div className="absolute inset-0 grid place-items-center text-slate-500">
                rendering...
              </div>
            )}

            {render.kind === "error" && (
              <pre className="absolute inset-0 m-0 overflow-auto whitespace-pre-wrap p-4 text-sm text-red-700">
                {render.message}
              </pre>
            )}

            {render.kind === "ok" && <Preview svg={render.svg} />}

            {render.kind === "idle" && (
              <div className="absolute inset-0 grid place-items-center text-slate-400">
                select a file
              </div>
            )}
          </section>

          {sourceOpen && (
            <section
              id={SOURCE_PANEL_ID}
              aria-label={SOURCE_PANEL_NAME}
              className="w-[40ch] max-w-[50%] shrink-0 overflow-auto border-l border-slate-200 bg-white"
            >
              <SourceView source={source} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
