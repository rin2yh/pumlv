import { useDeferredValue, useEffect, useState, type JSX } from "react";
import { useToggleSet } from "../../hooks/use-toggle-set";
import { splitLines } from "../../lib/lines";
import { highlight, type Highlighted, type ShikiToken } from "./highlighter";
import { computeFoldRanges, computeLineDepths, hiddenLines } from "./source-fold";
import { LineRow } from "./line-row";

interface Props {
  source: string;
}

export function SourceView({ source }: Props): JSX.Element {
  const deferredSource = useDeferredValue(source);
  const [highlighted, setHighlighted] = useState<{
    source: string;
    result: Highlighted | null;
  } | null>(null);
  const [folded, toggle] = useToggleSet<number>();

  const lines = splitLines(deferredSource);
  const ranges = computeFoldRanges(deferredSource);
  const foldStarts = new Set(ranges.map((r) => r.startLine));
  const depths = computeLineDepths(lines.length, ranges);

  const currentHighlight = highlighted?.source === deferredSource ? highlighted.result : null;
  const tokenLines: ShikiToken[][] =
    currentHighlight?.tokens ?? lines.map((l) => [{ content: l }]);

  const hidden = hiddenLines(ranges, folded);

  useEffect(() => {
    let cancelled = false;
    if (!deferredSource) {
      setHighlighted(null);
      return;
    }
    void highlight(deferredSource).then((result) => {
      if (!cancelled) setHighlighted({ source: deferredSource, result });
    });
    return () => {
      cancelled = true;
    };
  }, [deferredSource]);

  if (!source) {
    return <p className="px-4 py-3 text-sm text-slate-400">no source</p>;
  }

  return (
    <pre
      className="m-0 overflow-auto p-3 font-mono text-xs leading-5"
      style={{
        color: currentHighlight?.fg || undefined,
        backgroundColor: currentHighlight?.bg || undefined,
      }}
      aria-busy={source !== deferredSource}
    >
      {source !== deferredSource && (
        <span role="status" className="mb-2 block font-sans text-slate-500">
          Updating source…
        </span>
      )}
      {tokenLines.map((tokens, i) => {
        if (hidden.has(i)) return null;
        const isFoldStart = foldStarts.has(i);
        return (
          <LineRow
            key={i}
            tokens={tokens}
            depth={depths[i]}
            isFoldStart={isFoldStart}
            isFolded={isFoldStart && folded.has(i)}
            onToggle={() => toggle(i)}
          />
        );
      })}
    </pre>
  );
}
