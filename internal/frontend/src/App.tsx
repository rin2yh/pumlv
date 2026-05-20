import { useState, type JSX } from "react";
import { FileTree } from "./components/file-tree";
import { Preview } from "./components/preview";
import { SourceView } from "./components/source-view";
import { useActiveRender } from "./hooks/useActiveRender";
import { useFileList } from "./hooks/useFileList";
import { useServerEvents } from "./hooks/useServerEvents";
import { SOURCE_PANEL_ID, SOURCE_PANEL_NAME, SOURCE_TOGGLE_LABEL } from "./sourcePanel";

export default function App(): JSX.Element {
  const { files, active, select, reload: reloadFiles } = useFileList();
  const { source, render, reload: reloadActive } = useActiveRender(active);
  const [sourceOpen, setSourceOpen] = useState<boolean>(true);

  useServerEvents({
    onTree: reloadFiles,
    onChanged: (path) => {
      if (path === active) reloadActive();
    },
  });

  const activeName = files.find((f) => f.path === active)?.rel ?? "";
  const toggleLabel = sourceOpen ? SOURCE_TOGGLE_LABEL.open : SOURCE_TOGGLE_LABEL.closed;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h1 className="font-semibold text-violet-700">pumlv</h1>
          <p className="text-xs text-slate-500">{files.length} file(s)</p>
        </div>

        <FileTree files={files} active={active} onSelect={select} />
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

          <section
            id={SOURCE_PANEL_ID}
            aria-label={SOURCE_PANEL_NAME}
            hidden={!sourceOpen}
            className="w-[40ch] max-w-[50%] shrink-0 overflow-auto border-l border-slate-200 bg-white"
          >
            <SourceView source={source} />
          </section>
        </div>
      </main>
    </div>
  );
}
