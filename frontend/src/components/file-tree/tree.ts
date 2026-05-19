import type { FileEntry } from "../../api/files";

export type Node =
  | { kind: "dir"; key: string; name: string; children: Node[] }
  | { kind: "file"; key: string; name: string; entry: FileEntry };

export type DirNode = Extract<Node, { kind: "dir" }>;

export interface TreeRow {
  node: Node;
  depth: number;
}

export const CHEVRON_INDENT_PX = 24;

export function rowIndentPx(depth: number): number {
  return 16 + depth * 12;
}

export function buildTree(files: FileEntry[]): DirNode[] {
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

export function flatten(tree: DirNode[], collapsed: Set<string>): TreeRow[] {
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
