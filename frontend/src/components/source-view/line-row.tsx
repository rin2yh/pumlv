import { type JSX } from "react";
import { FOLD_LABEL, UNFOLD_LABEL } from "./source-fold";
import type { ShikiToken } from "./highlighter";

interface Props {
  tokens: ShikiToken[];
  isFoldStart: boolean;
  isFolded: boolean;
  onToggle: () => void;
}

export function LineRow({ tokens, isFoldStart, isFolded, onToggle }: Props): JSX.Element {
  return (
    <div className="flex items-start">
      <span
        className="inline-block w-4 shrink-0 select-none text-center text-slate-400"
        aria-hidden={!isFoldStart}
      >
        {isFoldStart && (
          <button
            type="button"
            aria-label={isFolded ? UNFOLD_LABEL : FOLD_LABEL}
            aria-expanded={!isFolded}
            onClick={onToggle}
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
}
