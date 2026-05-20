import { type JSX } from "react";
import type { FileEntry } from "../../api/files";
import { CHEVRON_INDENT_PX, rowIndentPx } from "./tree";

interface Props {
  entry: FileEntry;
  depth: number;
  isSelected: boolean;
  onSelect: (path: string) => void;
}

export function FileRow({ entry, depth, isSelected, onSelect }: Props): JSX.Element {
  const selectionClass = isSelected ? "bg-violet-50 text-violet-800 font-medium" : "text-slate-700";

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.path)}
      className={`block w-full truncate py-1.5 pr-4 text-left text-sm hover:bg-slate-100 ${selectionClass}`}
      style={{ paddingLeft: `${rowIndentPx(depth) + CHEVRON_INDENT_PX}px` }}
      title={entry.rel}
    >
      {entry.name}
    </button>
  );
}
