import { useMemo, useState, type JSX } from "react";
import type { FileEntry } from "../api/files";

interface Props {
  files: FileEntry[];
  active: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ files, active, onSelect }: Props): JSX.Element {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => flatten(tree, collapsed), [tree, collapsed]);

  if (files.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">no files found</p>;
  }

  const toggle = (key: string): void =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <nav className="py-2">
      {rows.map(({ node, depth }) => {
        const indentStyle = { paddingLeft: `${16 + depth * 12}px` };

        if (node.kind === "dir") {
          const isExpanded = !collapsed.has(node.key);
          const headerTextClass =
            depth === 0 ? "text-xs font-medium text-slate-500" : "text-sm text-slate-700";
          const groupSpacingClass = depth === 0 ? "mt-2 first:mt-0 " : "";
          return (
            <button
              key={node.key}
              type="button"
              onClick={() => toggle(node.key)}
              className={`${groupSpacingClass}flex w-full items-center gap-1 py-1 pr-4 text-left hover:bg-slate-50 ${headerTextClass}`}
              style={indentStyle}
              title={node.name}
              aria-expanded={isExpanded}
            >
              <span className="inline-block w-3 shrink-0 text-slate-400">
                {isExpanded ? "▾" : "▸"}
              </span>
              <span className="truncate">{node.name}</span>
            </button>
          );
        }

        const isSelected = active === node.entry.path;
        const selectionClass = isSelected
          ? "bg-violet-50 text-violet-800 font-medium"
          : "text-slate-700";
        return (
          <button
            key={node.key}
            type="button"
            onClick={() => onSelect(node.entry.path)}
            className={`block w-full truncate py-1.5 pr-4 text-left text-sm hover:bg-slate-100 ${selectionClass}`}
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

type Node =
  | { kind: "dir"; key: string; name: string; children: Node[] }
  | { kind: "file"; key: string; name: string; entry: FileEntry };

type DirNode = Extract<Node, { kind: "dir" }>;

interface TreeRow {
  node: Node;
  depth: number;
}

function buildTree(files: FileEntry[]): DirNode[] {
  const sourceRoots = new Map<string, DirNode>();
  for (const file of files) {
    let directory = sourceRoots.get(file.source);
    if (!directory) {
      directory = { kind: "dir", key: file.source, name: file.source, children: [] };
      sourceRoots.set(file.source, directory);
    }
    const segments = file.rel.split(/[/\\]/).filter(Boolean);
    for (let i = 0; i < segments.length - 1; i++) {
      directory = ensureChildDir(directory, `${directory.key}/${segments[i]}`, segments[i]!);
    }
    directory.children.push({ kind: "file", key: file.path, name: file.name, entry: file });
  }
  sourceRoots.forEach(sortDirectory);
  return [...sourceRoots.values()];
}

function ensureChildDir(parent: DirNode, key: string, name: string): DirNode {
  const existing = parent.children.find(
    (child): child is DirNode => child.kind === "dir" && child.key === key,
  );
  if (existing) return existing;
  const child: DirNode = { kind: "dir", key, name, children: [] };
  parent.children.push(child);
  return child;
}

function sortDirectory(directory: DirNode): void {
  directory.children.sort((a, b) => {
    const aIsDir = a.kind === "dir";
    const bIsDir = b.kind === "dir";
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of directory.children) {
    if (child.kind === "dir") sortDirectory(child);
  }
}

function flatten(tree: DirNode[], collapsed: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (node: Node, depth: number): void => {
    rows.push({ node, depth });
    if (node.kind === "dir" && !collapsed.has(node.key)) {
      for (const child of node.children) visit(child, depth + 1);
    }
  };
  for (const root of tree) visit(root, 0);
  return rows;
}
