export interface FileEntry {
  path: string;
  rel: string;
  name: string;
  source: string;
}

export async function fetchFiles(): Promise<FileEntry[]> {
  const res = await fetch("/api/files");
  if (!res.ok) {
    throw new Error(`failed to load files: ${res.status}`);
  }
  return (await res.json()) as FileEntry[];
}

export async function fetchFileSource(path: string): Promise<string> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    throw new Error(`failed to load source: ${res.status}`);
  }
  return res.text();
}
