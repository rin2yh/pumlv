import { useMemo, useState, type JSX } from "react";
import type { FileEntry } from "../api/files";

interface Props {
  files: FileEntry[];
  active: string | null;
  onSelect: (path: string) => void;
}

type Node =
  | { kind: "dir"; key: string; name: string; children: Node[] }
  | { kind: "file"; key: string; name: string; entry: FileEntry };

type DirNode = Extract<Node, { kind: "dir" }>;

function sortTree(n: DirNode): void {
  n.children.sort((a, b) => {
    const ad = a.kind === "dir";
    const bd = b.kind === "dir";
    return ad === bd ? a.name.localeCompare(b.name) : ad ? -1 : 1;
  });
  for (const c of n.children) {
    if (c.kind === "dir") sortTree(c);
  }
}

function ensureChild(parent: DirNode, key: string, name: string): DirNode {
  const found = parent.children.find((c): c is DirNode => c.kind === "dir" && c.key === key);
  if (found) return found;
  const child: DirNode = { kind: "dir", key, name, children: [] };
  parent.children.push(child);
  return child;
}

function buildTree(files: FileEntry[]): DirNode[] {
  const roots = new Map<string, DirNode>();
  for (const f of files) {
    let dir = roots.get(f.source);
    if (!dir) {
      dir = { kind: "dir", key: f.source, name: f.source, children: [] };
      roots.set(f.source, dir);
    }
    const parts = f.rel.split(/[/\\]/).filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      dir = ensureChild(dir, `${dir.key}/${parts[i]}`, parts[i]!);
    }
    dir.children.push({ kind: "file", key: f.path, name: f.name, entry: f });
  }

  roots.forEach(sortTree);
  return [...roots.values()];
}

function flatten(roots: DirNode[], collapsed: Set<string>): Array<{ node: Node; depth: number }> {
  const out: Array<{ node: Node; depth: number }> = [];
  const walk = (node: Node, depth: number): void => {
    out.push({ node, depth });
    if (node.kind === "dir" && !collapsed.has(node.key)) {
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
      {rows.map(({ node, depth }) => {
        const indent = { paddingLeft: `${16 + depth * 12}px` };
        if (node.kind === "dir") {
          const open = !collapsed.has(node.key);
          const size =
            depth === 0 ? "text-xs font-medium text-slate-500" : "text-sm text-slate-700";
          const gap = depth === 0 ? "mt-2 first:mt-0 " : "";
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
        const activeCls =
          active === node.entry.path
            ? "bg-violet-50 text-violet-800 font-medium"
            : "text-slate-700";
        return (
          <button
            key={node.key}
            type="button"
            onClick={() => onSelect(node.entry.path)}
            className={`block w-full truncate py-1.5 pr-4 text-left text-sm hover:bg-slate-100 ${activeCls}`}
            style={{ paddingLeft: `${16 + depth * 12 + 24}px` }}
            title={node.entry.rel}
          >
            {node.name}
          </button>
        );
      })}
    </nav>
  );
}
