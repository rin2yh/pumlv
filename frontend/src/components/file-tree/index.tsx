import { useMemo, useState, type JSX } from "react";
import type { FileEntry } from "../../api/files";
import { buildTree, flatten } from "./tree";
import { DirectoryRow } from "./directory-row";
import { FileRow } from "./file-row";

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
      {rows.map(({ node, depth }) =>
        node.kind === "dir" ? (
          <DirectoryRow
            key={node.key}
            node={node}
            depth={depth}
            isExpanded={!collapsed.has(node.key)}
            onToggle={toggle}
          />
        ) : (
          <FileRow
            key={node.key}
            entry={node.entry}
            depth={depth}
            isSelected={active === node.entry.path}
            onSelect={onSelect}
          />
        ),
      )}
    </nav>
  );
}
