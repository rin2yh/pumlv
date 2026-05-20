export interface FoldRange {
  startLine: number;
  endLine: number;
}

const NEWLINE = /\r?\n/;

export function computeFoldRanges(source: string): FoldRange[] {
  const lines = source.split(NEWLINE);
  const stack: number[] = [];
  const ranges: FoldRange[] = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inString = false;
    let j = 0;

    while (j < line.length) {
      const c = line[j];
      const next = line[j + 1];

      if (inBlockComment) {
        if (c === "'" && next === "/") {
          inBlockComment = false;
          j += 2;
          continue;
        }
        j++;
        continue;
      }

      if (inString) {
        if (c === "\\" && next !== undefined) {
          j += 2;
          continue;
        }
        if (c === '"') {
          inString = false;
        }
        j++;
        continue;
      }

      if (c === '"') {
        inString = true;
        j++;
        continue;
      }

      if (c === "/" && next === "'") {
        inBlockComment = true;
        j += 2;
        continue;
      }

      if (c === "'") {
        break;
      }

      if (c === "{") {
        stack.push(i);
      } else if (c === "}") {
        const start = stack.pop();
        if (start !== undefined && i > start) {
          ranges.push({ startLine: start, endLine: i });
        }
      }

      j++;
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
    for (let i = r.startLine + 1; i <= end; i++) {
      hidden[i] = true;
    }
  }
  return hidden;
}
