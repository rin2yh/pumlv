export interface FoldRange {
  startLine: number;
  endLine: number;
}

export const FOLD_LABEL = "fold block";
export const UNFOLD_LABEL = "unfold block";

// PlantUML block comments (/'...'/), strings ("..."), and line comments ('...).
// Matched together so brace counting only sees structural braces.
const STRING_OR_COMMENT = /\/'[\s\S]*?'\/|"(?:\\.|[^"\\])*"|'[^\n]*/g;

export function computeFoldRanges(source: string): FoldRange[] {
  const masked = source.replace(STRING_OR_COMMENT, (m) => m.replace(/[^\n]/g, " "));
  const stack: number[] = [];
  const ranges: FoldRange[] = [];
  let line = 0;

  for (const c of masked) {
    if (c === "\n") line++;
    else if (c === "{") stack.push(line);
    else if (c === "}") {
      const start = stack.pop();
      if (start !== undefined && line > start) {
        ranges.push({ startLine: start, endLine: line });
      }
    }
  }

  ranges.sort((a, b) => a.startLine - b.startLine);
  return ranges;
}

export function hiddenLines(
  ranges: FoldRange[],
  folded: ReadonlySet<number>,
  total: number,
): boolean[] {
  const hidden: boolean[] = Array.from({ length: total }, () => false);
  for (const r of ranges) {
    if (!folded.has(r.startLine)) continue;
    const end = Math.min(r.endLine, total - 1);
    for (let i = r.startLine + 1; i <= end; i++) hidden[i] = true;
  }
  return hidden;
}
