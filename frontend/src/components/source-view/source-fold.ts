export interface FoldRange {
  startLine: number;
  endLine: number;
}

export const FOLD_LABEL = "fold block";
export const UNFOLD_LABEL = "unfold block";

// PlantUML block comments, strings, line comments, and structural braces /
// newlines, in a single token alternation. Anything not matched (identifiers,
// whitespace, etc.) is simply skipped between matches.
const TOKEN = /\/'[\s\S]*?'\/|"(?:\\.|[^"\\])*"|'[^\n]*|[{}\n]/g;

export function computeFoldRanges(source: string): FoldRange[] {
  const stack: number[] = [];
  const ranges: FoldRange[] = [];
  let line = 0;

  for (const m of source.matchAll(TOKEN)) {
    const tok = m[0];
    if (tok === "{") {
      stack.push(line);
    } else if (tok === "}") {
      const start = stack.pop();
      if (start !== undefined && line > start) {
        ranges.push({ startLine: start, endLine: line });
      }
    } else {
      // Newline token, or a string / block comment that may straddle lines.
      for (let i = 0; i < tok.length; i++) {
        if (tok.charCodeAt(i) === 10) line++;
      }
    }
  }

  ranges.sort((a, b) => a.startLine - b.startLine);
  return ranges;
}

export function hiddenLines(ranges: FoldRange[], folded: ReadonlySet<number>): Set<number> {
  const hidden = new Set<number>();
  for (const r of ranges) {
    if (!folded.has(r.startLine)) continue;
    for (let i = r.startLine + 1; i <= r.endLine; i++) hidden.add(i);
  }
  return hidden;
}
