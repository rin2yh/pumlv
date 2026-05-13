import { useMemo, type JSX } from "react";
import type { FileEntry } from "../api/files";

interface Props {
  files: FileEntry[];
  active: string | null;
  onSelect: (path: string) => void;
}

interface Group {
  source: string;
  items: FileEntry[];
}

export function FileTree({ files, active, onSelect }: Props): JSX.Element {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, FileEntry[]>();
    for (const f of files) {
      const arr = m.get(f.source) ?? [];
      arr.push(f);
      m.set(f.source, arr);
    }
    return [...m.entries()].map(([source, items]) => ({ source, items }));
  }, [files]);

  if (files.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">no files found</p>;
  }

  return (
    <nav className="py-2">
      {groups.map((g) => (
        <div key={g.source} className="mb-2">
          <p className="px-4 py-1 text-xs font-medium text-slate-500 truncate" title={g.source}>
            {g.source}
          </p>
          <ul>
            {g.items.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => onSelect(f.path)}
                  className={
                    "block w-full text-left px-4 py-1.5 text-sm hover:bg-slate-100 truncate " +
                    (active === f.path
                      ? "bg-violet-50 text-violet-800 font-medium"
                      : "text-slate-700")
                  }
                  title={f.rel}
                >
                  {f.rel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
