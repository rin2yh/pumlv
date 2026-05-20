import { useEffect, useState } from "react";
import { fetchFiles, type FileEntry } from "../api/files";

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
    void (async () => {
      const list = await fetchFiles();
      setFiles(list);
      setActive((prev) =>
        prev && list.some((f) => f.path === prev) ? prev : (list[0]?.path ?? null),
      );
    })();
  }, [reloadKey]);

  return {
    files,
    active,
    select: (path) => setActive(path),
    reload: () => setReloadKey((k) => k + 1),
  };
}
