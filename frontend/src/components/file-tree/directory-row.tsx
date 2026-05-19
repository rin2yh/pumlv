import { type JSX } from "react";
import { rowIndentPx, type DirNode } from "./tree";

interface Props {
  node: DirNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (key: string) => void;
}

export function DirectoryRow({ node, depth, isExpanded, onToggle }: Props): JSX.Element {
  const headerTextClass =
    depth === 0 ? "text-xs font-medium text-slate-500" : "text-sm text-slate-700";
  const groupSpacingClass = depth === 0 ? "mt-2 first:mt-0 " : "";

  return (
    <button
      type="button"
      onClick={() => onToggle(node.key)}
      className={`${groupSpacingClass}flex w-full items-center gap-1 py-1 pr-4 text-left hover:bg-slate-50 ${headerTextClass}`}
      style={{ paddingLeft: `${rowIndentPx(depth)}px` }}
      title={node.name}
      aria-expanded={isExpanded}
    >
      <span className="inline-block w-3 shrink-0 text-slate-400">{isExpanded ? "▾" : "▸"}</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}
