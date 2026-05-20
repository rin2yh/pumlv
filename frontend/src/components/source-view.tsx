import { useEffect, useMemo, useState, type JSX } from "react";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { computeFoldRanges, hiddenLines, type FoldRange } from "./source-fold";

interface ShikiToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

interface Highlighted {
  tokens: ShikiToken[][];
  fg: string;
  bg: string;
}

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
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [folded, setFolded] = useState<Set<number>>(() => new Set());

  const lines = useMemo(() => source.split(/\r?\n/), [source]);
  const ranges = useMemo<FoldRange[]>(() => computeFoldRanges(source), [source]);
  const rangeByStart = useMemo(() => {
    const m = new Map<number, FoldRange>();
    for (const r of ranges) m.set(r.startLine, r);
    return m;
  }, [ranges]);

  useEffect(() => {
    let cancelled = false;
    if (!source) {
      setHighlighted(null);
      setError(false);
      return;
    }
    setError(false);
    void getHighlighter().then((highlighter) => {
      if (cancelled) return;
      try {
        const result = highlighter.codeToTokens(source, {
          // PlantUML isn't a built-in shiki grammar; YAML produces
          // reasonable token coloring for arrow/keyword-like lines.
          lang: "yaml",
          theme: "github-light",
        });
        setHighlighted({
          tokens: result.tokens as ShikiToken[][],
          fg: result.fg ?? "",
          bg: result.bg ?? "",
        });
      } catch {
        setHighlighted(null);
        setError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source) {
    return <p className="px-4 py-3 text-sm text-slate-400">no source</p>;
  }

  if (error) {
    return <pre className="m-0 overflow-auto bg-white p-3 font-mono text-xs">{source}</pre>;
  }

  const toggle = (start: number): void => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(start)) next.delete(start);
      else next.add(start);
      return next;
    });
  };

  const hidden = hiddenLines(ranges, folded, lines.length);

  const tokenLines: ShikiToken[][] = highlighted?.tokens ?? lines.map((l) => [{ content: l }]);

  while (tokenLines.length < lines.length) {
    tokenLines.push([{ content: "" }]);
  }

  return (
    <div
      role="group"
      aria-label="source"
      className="overflow-auto font-mono text-xs leading-5"
      style={{
        color: highlighted?.fg || undefined,
        backgroundColor: highlighted?.bg || undefined,
      }}
    >
      <pre className="m-0 p-3">
        {tokenLines.map((tokens, i) => {
          if (hidden[i]) return null;
          const range = rangeByStart.get(i);
          const isFolded = range !== undefined && folded.has(i);
          return (
            <div key={i} className="flex items-start">
              <span
                className="inline-block w-4 shrink-0 select-none text-center text-slate-400"
                aria-hidden={range === undefined}
              >
                {range !== undefined && (
                  <button
                    type="button"
                    aria-label={isFolded ? "unfold block" : "fold block"}
                    aria-expanded={!isFolded}
                    onClick={() => toggle(i)}
                    className="cursor-pointer text-slate-400 hover:text-slate-700"
                  >
                    {isFolded ? "▶" : "▼"}
                  </button>
                )}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre">
                {tokens.map((t, j) => (
                  <span key={j} style={t.color ? { color: t.color } : undefined}>
                    {t.content}
                  </span>
                ))}
                {isFolded && <span className="text-slate-400"> … </span>}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
