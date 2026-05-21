import { useEffect, useState, type JSX } from "react";
import { useToggleSet } from "../../hooks/use-toggle-set";
import { splitLines } from "../../lib/lines";
import { highlight, type Highlighted, type ShikiToken } from "./highlighter";
import { computeFoldRanges, computeLineDepths, hiddenLines } from "./source-fold";
import { LineRow } from "./line-row";

interface Props {
  source: string;
}

export function SourceView({ source }: Props): JSX.Element {
  const [highlighted, setHighlighted] = useState<Highlighted | null>(null);
  const [folded, toggle] = useToggleSet<number>();

  const lines = splitLines(source);
  const ranges = computeFoldRanges(source);
  const foldStarts = new Set(ranges.map((r) => r.startLine));
  const depths = computeLineDepths(lines.length, ranges);

  const tokenLines: ShikiToken[][] = highlighted?.tokens ?? lines.map((l) => [{ content: l }]);

  const hidden = hiddenLines(ranges, folded);

  useEffect(() => {
    let cancelled = false;
    if (!source) {
      setHighlighted(null);
      return;
    }
    void highlight(source).then((result) => {
      if (!cancelled) setHighlighted(result);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source) {
    return <p className="px-4 py-3 text-sm text-slate-400">no source</p>;
  }

  return (
    <pre
      className="m-0 overflow-auto p-3 font-mono text-xs leading-5"
      style={{
        color: highlighted?.fg || undefined,
        backgroundColor: highlighted?.bg || undefined,
      }}
    >
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
