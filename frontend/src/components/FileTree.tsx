import { useMemo, useState, type JSX } from "react";
import type { FileEntry } from "../api/files";

interface Props {
  files: FileEntry[];
  active: string | null;
  onSelect: (path: string) => void;
}

interface Node {
  key: string;
  name: string;
  entry?: FileEntry;
  children?: Node[];
}

function sortTree(n: Node): void {
  n.children?.sort((a, b) => {
    const ad = !!a.children;
    const bd = !!b.children;
    return ad === bd ? a.name.localeCompare(b.name) : ad ? -1 : 1;
  });
  n.children?.forEach(sortTree);
}

function ensureChild(parent: Node, key: string, name: string): Node {
  const found = parent.children!.find((c) => c.children && c.key === key);
  if (found) return found;
  const child: Node = { key, name, children: [] };
  parent.children!.push(child);
  return child;
}

function buildTree(files: FileEntry[]): Node[] {
  const roots = new Map<string, Node>();
  for (const f of files) {
    const root = roots.get(f.source) ?? { key: f.source, name: f.source, children: [] };
    roots.set(f.source, root);
    let dir = root;
    const parts = f.rel.split(/[/\\]/).filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      dir = ensureChild(dir, `${dir.key}/${parts[i]}`, parts[i]!);
    }
    dir.children!.push({ key: f.path, name: f.name, entry: f });
  }

  roots.forEach(sortTree);
  return [...roots.values()];
}

function flatten(roots: Node[], collapsed: Set<string>): Array<{ node: Node; depth: number }> {
  const out: Array<{ node: Node; depth: number }> = [];
  const walk = (node: Node, depth: number): void => {
    out.push({ node, depth });
    if (node.children && !collapsed.has(node.key)) {
      for (const c of node.children) walk(c, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  return out;
}

export function FileTree({ files, active, onSelect }: Props): JSX.Element {
  const roots = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => flatten(roots, collapsed), [roots, collapsed]);

  if (files.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">no files found</p>;
  }

  const toggle = (key: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <nav className="py-2">
      {rows.map(({ node, depth }, i) => {
        const indent = { paddingLeft: `${16 + depth * 12}px` };
        if (node.children) {
          const open = !collapsed.has(node.key);
          const size =
            depth === 0 ? "text-xs font-medium text-slate-500" : "text-sm text-slate-700";
          const gap = depth === 0 && i > 0 ? "mt-2 " : "";
          return (
            <button
              key={node.key}
              type="button"
              onClick={() => toggle(node.key)}
              className={`${gap}flex w-full items-center gap-1 py-1 pr-4 text-left hover:bg-slate-50 ${size}`}
              style={indent}
              title={node.name}
              aria-expanded={open}
            >
              <span className="inline-block w-3 shrink-0 text-slate-400">{open ? "▾" : "▸"}</span>
              <span className="truncate">{node.name}</span>
            </button>
          );
        }
        const entry = node.entry!;
        const activeCls =
          active === entry.path ? "bg-violet-50 text-violet-800 font-medium" : "text-slate-700";
        return (
          <button
            key={node.key}
            type="button"
            onClick={() => onSelect(entry.path)}
            className={`block w-full truncate py-1.5 pr-4 text-left text-sm hover:bg-slate-100 ${activeCls}`}
            style={{ paddingLeft: `${16 + depth * 12 + 24}px` }}
            title={entry.rel}
          >
            {node.name}
          </button>
        );
      })}
    </nav>
  );
}
