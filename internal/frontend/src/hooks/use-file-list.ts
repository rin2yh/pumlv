import { useEffect, useState } from "react";
import {
  fetchFiles,
  sameFilePaths,
  firstSelection,
  selections,
  parseSelection,
  type FileEntry,
} from "../api/files";

export interface UseFileListResult {
  files: FileEntry[];
  active: string | null;
  select: (path: string) => void;
  reload: () => void;
}

export function useFileList(): UseFileListResult {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchFiles();
      if (cancelled) return;
      setFiles((prev) => (sameFilePaths(prev, list) ? prev : list));
      setActive((previous) => {
        if (previous && selections(list).includes(previous)) return previous;
        const previousPath = previous ? parseSelection(previous).path : null;
        const file = list.find((entry) => entry.path === previousPath) ?? list[0];
        return file ? firstSelection(file) : null;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return {
    files,
    active,
    select: (path) => setActive(path),
    reload: () => setReloadKey((k) => k + 1),
  };
}
