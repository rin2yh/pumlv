import { describe, expect, it } from "vitest";
import type { FileEntry } from "../../api/files";
import { flatFiles, nestedFiles } from "./test/fixtures";
import { buildTree, flatten } from "./tree";

describe("buildTree", () => {
  it("groups files by their source directory", () => {
    const roots = buildTree(flatFiles);
    expect(roots.map((r) => r.key)).toEqual(["/a", "/b"]);
    expect(roots[0]!.children.map((c) => c.key)).toEqual(["/a/x.puml", "/a/y.puml"]);
    expect(roots[1]!.children.map((c) => c.key)).toEqual(["/b/z.puml"]);
  });

  it("creates intermediate directory nodes for nested rel paths", () => {
    const [root] = buildTree(nestedFiles);
    const sub = root!.children.find((c) => c.kind === "dir" && c.name === "sub");
    expect(sub).toBeDefined();
    const deep = sub!.kind === "dir" && sub!.children.find((c) => c.kind === "dir");
    expect(deep && deep.name).toBe("deep");
  });

  it("sorts directories before files and alphabetically within each level", () => {
    const mixed: FileEntry[] = [
      { path: "/r/zzz.puml", rel: "zzz.puml", name: "zzz.puml", source: "/r" },
      { path: "/r/sub/a.puml", rel: "sub/a.puml", name: "a.puml", source: "/r" },
      { path: "/r/aaa.puml", rel: "aaa.puml", name: "aaa.puml", source: "/r" },
    ];
    const [root] = buildTree(mixed);
    const order = root!.children.map((c) => (c.kind === "dir" ? `[${c.name}]` : c.name));
    expect(order).toEqual(["[sub]", "aaa.puml", "zzz.puml"]);
  });
});

describe("flatten", () => {
  it("emits every node in DFS order when nothing is collapsed", () => {
    const rows = flatten(buildTree(nestedFiles), new Set());
    expect(rows.map(({ node }) => node.name)).toEqual([
      "/r",
      "sub",
      "deep",
      "b.puml",
      "a.puml",
      "top.puml",
    ]);
  });

  it("skips the children of a collapsed directory but still emits the directory itself", () => {
    const tree = buildTree(nestedFiles);
    const rows = flatten(tree, new Set(["/r/sub/deep"]));
    const names = rows.map(({ node }) => node.name);
    expect(names).toContain("deep");
    expect(names).not.toContain("b.puml");
  });

  it("hides descendant toggles when an ancestor is collapsed", () => {
    const rows = flatten(buildTree(nestedFiles), new Set(["/r/sub"]));
    expect(rows.map(({ node }) => node.name)).toEqual(["/r", "sub", "top.puml"]);
  });

  it("annotates each row with the correct depth", () => {
    const rows = flatten(buildTree(nestedFiles), new Set());
    const byName = Object.fromEntries(rows.map(({ node, depth }) => [node.name, depth]));
    expect(byName).toMatchObject({
      "/r": 0,
      sub: 1,
      deep: 2,
      "b.puml": 3,
      "top.puml": 1,
    });
  });
});
