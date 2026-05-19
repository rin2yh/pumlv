import { useMemo, useState, type JSX } from "react";
import type { FileEntry } from "../api/files";

interface Props {
  files: FileEntry[];
  active: string | null;
  onSelect: (path: string) => void;
}

type Node = DirNode | FileNode;

interface DirNode {
  kind: "dir";
  name: string;
  key: string;
  children: Node[];
}

interface FileNode {
  kind: "file";
  entry: FileEntry;
}

function sortDir(d: DirNode): void {
  d.children.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "dir" ? -1 : 1;
    }
    const an = a.kind === "dir" ? a.name : a.entry.name;
    const bn = b.kind === "dir" ? b.name : b.entry.name;
    return an.localeCompare(bn);
  });
  for (const c of d.children) {
    if (c.kind === "dir") {
      sortDir(c);
    }
  }
}

function buildTree(files: FileEntry[]): DirNode[] {
  const sources = new Map<string, DirNode>();
  for (const f of files) {
    let root = sources.get(f.source);
    if (!root) {
      root = { kind: "dir", name: f.source, key: f.source, children: [] };
      sources.set(f.source, root);
    }
    const parts = f.rel.split(/[/\\]/).filter((p) => p !== "");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]!;
      const childKey = `${cur.key}/${seg}`;
      let next = cur.children.find((c): c is DirNode => c.kind === "dir" && c.name === seg);
      if (!next) {
        next = { kind: "dir", name: seg, key: childKey, children: [] };
        cur.children.push(next);
      }
      cur = next;
    }
    cur.children.push({ kind: "file", entry: f });
  }

  for (const r of sources.values()) {
    sortDir(r);
  }
  return [...sources.values()];
}

export function FileTree({ files, active, onSelect }: Props): JSX.Element {
  const roots = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (files.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">no files found</p>;
  }

  return (
    <nav className="py-2">
      {roots.map((root) => (
        <div key={root.key} className="mb-2">
          <DirView
            node={root}
            depth={0}
            isRoot
            active={active}
            collapsed={collapsed}
            onToggle={toggle}
            onSelect={onSelect}
          />
        </div>
      ))}
    </nav>
  );
}

interface DirViewProps {
  node: DirNode;
  depth: number;
  isRoot?: boolean;
  active: string | null;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (path: string) => void;
}

function DirView({
  node,
  depth,
  isRoot,
  active,
  collapsed,
  onToggle,
  onSelect,
}: DirViewProps): JSX.Element {
  const isCollapsed = collapsed.has(node.key);
  const indent = 16 + depth * 12;
  const labelCls = isRoot ? "text-xs font-medium text-slate-500" : "text-sm text-slate-700";

  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(node.key)}
        className={
          "flex w-full items-center gap-1 pr-4 py-1 text-left hover:bg-slate-50 " + labelCls
        }
        style={{ paddingLeft: `${indent}px` }}
        title={node.name}
        aria-expanded={!isCollapsed}
      >
        <span className="inline-block w-3 shrink-0 text-slate-400">{isCollapsed ? "▸" : "▾"}</span>
        <span className="truncate">{node.name}</span>
      </button>

      {!isCollapsed && (
        <ul>
          {node.children.map((c) =>
            c.kind === "dir" ? (
              <li key={c.key}>
                <DirView
                  node={c}
                  depth={depth + 1}
                  active={active}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              </li>
            ) : (
              <li key={c.entry.path}>
                <button
                  type="button"
                  onClick={() => onSelect(c.entry.path)}
                  className={
                    "block w-full pr-4 py-1.5 text-left text-sm truncate hover:bg-slate-100 " +
                    (active === c.entry.path
                      ? "bg-violet-50 text-violet-800 font-medium"
                      : "text-slate-700")
                  }
                  style={{ paddingLeft: `${indent + 24}px` }}
                  title={c.entry.rel}
                >
                  {c.entry.name}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </>
  );
}
