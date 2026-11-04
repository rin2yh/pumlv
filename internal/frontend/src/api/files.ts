export interface FileEntry {
  path: string;
  rel: string;
  name: string;
  source: string;
  diagrams?: { line: number; title?: string }[];
}

export async function fetchFiles(): Promise<FileEntry[]> {
  const res = await fetch("/api/files");
  if (!res.ok) {
    throw new Error(`failed to load files: ${res.status}`);
  }
  return (await res.json()) as FileEntry[];
}

export async function fetchFileSource(path: string, signal?: AbortSignal): Promise<string> {
  const target = parseSelection(path);
  const query = `path=${encodeURIComponent(target.path)}${target.line !== undefined ? `&line=${target.line}` : ""}`;
  const res = await fetch(`/api/file?${query}`, { signal });
  if (!res.ok) {
    throw new Error(`failed to load source: ${res.status}`);
  }
  return res.text();
}

export function sameFilePaths(a: FileEntry[], b: FileEntry[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (f, i) =>
        f.path === b[i]!.path && JSON.stringify(f.diagrams) === JSON.stringify(b[i]!.diagrams),
    )
  );
}

export function diagramKey(path: string, line: number): string {
  return `markdown:${encodeURIComponent(path)}:${line}`;
}

export function parseSelection(key: string): { path: string; line?: number } {
  const match = /^markdown:(.*):(\d+)$/.exec(key);
  return match ? { path: decodeURIComponent(match[1]!), line: Number(match[2]) } : { path: key };
}

export function firstSelection(file: FileEntry): string {
  return file.diagrams?.[0] ? diagramKey(file.path, file.diagrams[0].line) : file.path;
}

export function selections(files: FileEntry[]): string[] {
  return files.flatMap((file) =>
    file.diagrams?.length
      ? file.diagrams.map((diagram) => diagramKey(file.path, diagram.line))
      : [file.path],
  );
}
