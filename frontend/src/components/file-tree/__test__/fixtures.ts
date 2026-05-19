import type { FileEntry } from "../../api/files";

export const flatFiles: FileEntry[] = [
  { path: "/a/x.puml", rel: "x.puml", name: "x.puml", source: "/a" },
  { path: "/a/y.puml", rel: "y.puml", name: "y.puml", source: "/a" },
  { path: "/b/z.puml", rel: "z.puml", name: "z.puml", source: "/b" },
];

export const nestedFiles: FileEntry[] = [
  { path: "/r/top.puml", rel: "top.puml", name: "top.puml", source: "/r" },
  { path: "/r/sub/a.puml", rel: "sub/a.puml", name: "a.puml", source: "/r" },
  { path: "/r/sub/deep/b.puml", rel: "sub/deep/b.puml", name: "b.puml", source: "/r" },
];
