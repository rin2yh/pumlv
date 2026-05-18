// Downloads the TeaVM-compiled PlantUML build (plantuml.js + viz-global.js)
// from the upstream plantuml/plantuml release "snapshot" zip and places the
// two required files into frontend/public/plantuml/ so Vite copies them into
// static/dist/.
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const SNAPSHOT_ZIP =
  "https://github.com/plantuml/plantuml/releases/download/snapshot/js-plantuml-SNAPSHOT.zip";
const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "..", "public", "plantuml");
mkdirSync(dest, { recursive: true });

const haveAll = REQUIRED_FILES.every((f) => {
  const p = resolve(dest, f);
  if (!existsSync(p)) return false;
  console.log(`${f} already present (${statSync(p).size} bytes)`);
  return true;
});
if (haveAll) process.exit(0);

console.log(`downloading ${SNAPSHOT_ZIP}`);
const res = await fetch(SNAPSHOT_ZIP, { redirect: "follow" });
if (!res.ok) {
  console.error(`fetch failed: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const buf = new Uint8Array(await res.arrayBuffer());
console.log(`downloaded ${buf.length} bytes`);

const wanted = new Set(REQUIRED_FILES);
const entries = unzipSync(buf, {
  filter: (file) => wanted.has(basename(file.name)),
});

const extracted = new Set(Object.keys(entries).map((name) => basename(name)));
const missing = REQUIRED_FILES.filter((f) => !extracted.has(f));
if (missing.length > 0) {
  console.error(`zip did not contain: ${missing.join(", ")}`);
  process.exit(1);
}

for (const [name, data] of Object.entries(entries)) {
  const base = basename(name);
  writeFileSync(resolve(dest, base), data);
  console.log(`extracted ${base} (${data.length} bytes)`);
}
