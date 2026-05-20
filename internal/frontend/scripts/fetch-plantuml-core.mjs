// Downloads the TeaVM-compiled PlantUML build (plantuml.js + viz-global.js)
// from the upstream plantuml/plantuml release "snapshot" zip and places the
// two required files into internal/frontend/public/plantuml/ so Vite copies
// them into internal/static/dist/.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const SNAPSHOT_ZIP =
  "https://github.com/plantuml/plantuml/releases/download/snapshot/js-plantuml-SNAPSHOT.zip";
const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// The upstream TeaVM build rejects diagrams whose layout exceeds 4096px on
// either axis. This check fires before the SVG is emitted, and cannot be
// worked around from the diagram source (scale/dpi pragmas don't affect the
// raw layout dimensions that are checked).
//
// There is no external API to configure this limit: plantuml.js exports only
// `render` and `renderToString`, and neither accepts a size option. The limit
// is a constant compiled into the TeaVM output from the Java source, and the
// Java-side PLANTUML_LIMIT_SIZE JVM property is not surfaced to JavaScript.
// Other PlantUML tooling (VS Code extension, GitLab integration) sidestep the
// problem entirely by delegating to a Java server process, which is at odds
// with pumlv's "no Java, no external server" design.
//
// The only viable option for a pure-browser renderer is to patch the constant
// in the downloaded file. We raise it to 65536px — enough to cover large ER /
// sequence diagrams (observed max: ~56 000px) while still bounding pathological
// inputs. SVG is vector, so coordinate-system size has no meaningful effect on
// memory or rendering performance.
const PLANTUML_PATCHES = [
  { from: "p<=4096.0", to: "p<=65536.0" },
  { from: "q<=4096.0", to: "q<=65536.0" },
];

function patchPlantumlJs(filePath) {
  let src = readFileSync(filePath, "utf8");
  let changed = false;
  for (const { from, to } of PLANTUML_PATCHES) {
    if (src.includes(from)) {
      src = src.replaceAll(from, to);
      changed = true;
    } else if (!src.includes(to)) {
      // Neither the original string nor the patched string is present —
      // the upstream build has changed its minified variable names.
      // Bail out so the broken state is visible rather than silent.
      console.error(
        `plantuml.js patch failed: expected "${from}" or "${to}" not found.\n` +
          "The upstream TeaVM build may have changed. Update PLANTUML_PATCHES in fetch-plantuml-core.mjs.",
      );
      process.exit(1);
    }
  }
  if (changed) {
    writeFileSync(filePath, src);
    console.log("plantuml.js: raised dimension limit from 4096 to 65536px");
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "..", "public", "plantuml");
mkdirSync(dest, { recursive: true });

const haveAll = REQUIRED_FILES.every((f) => {
  const p = resolve(dest, f);
  if (!existsSync(p)) return false;
  console.log(`${f} already present (${statSync(p).size} bytes)`);
  return true;
});

if (!haveAll) {
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
}

patchPlantumlJs(resolve(dest, "plantuml.js"));
