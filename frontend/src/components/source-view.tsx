import { useEffect, useState, type JSX } from "react";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-light.mjs")],
      langs: [import("shiki/langs/yaml.mjs")],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  }
  return highlighterPromise;
}

interface Props {
  source: string;
}

export function SourceView({ source }: Props): JSX.Element {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!source) {
      setHtml("");
      return;
    }
    void getHighlighter().then((highlighter) => {
      if (cancelled) return;
      try {
        setHtml(
          highlighter.codeToHtml(source, {
            // PlantUML isn't a built-in shiki grammar; YAML produces
            // reasonable token coloring for arrow/keyword-like lines.
            lang: "yaml",
            theme: "github-light",
          }),
        );
      } catch {
        setHtml(`<pre>${escapeHtml(source)}</pre>`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source) {
    return <p className="px-4 py-3 text-sm text-slate-400">no source</p>;
  }
  return (
    <div
      className="text-xs [&_pre]:p-3 [&_pre]:bg-white [&_pre]:overflow-auto"
      dangerouslySetInnerHTML={{
        __html: html || `<pre>${escapeHtml(source)}</pre>`,
      }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
