// Copies the TeaVM-compiled PlantUML build (plantuml.js + viz-global.js) out of
// the @plantuml/core npm package into internal/frontend/public/plantuml/, so that
// Vite copies them into internal/static/dist/.
//
// @plantuml/core is the MIT-licensed flavor of the TeaVM build, published by the
// PlantUML project itself (plantuml/plantuml#2740). The js-plantuml-SNAPSHOT.zip
// asset on the GitHub releases page carries the same engine built from the GPL
// flavor; taking the MIT one keeps pumlv's own licensing simple. The only
// functional difference is that the Sudoku diagram is absent from the MIT build.
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// The TeaVM build rejects diagrams whose layout exceeds 4096px on either axis.
// This check fires before the SVG is emitted, and cannot be worked around from
// the diagram source (scale/dpi pragmas are applied as SVG post-processing,
// after the check, so they don't affect the raw layout dimensions).
//
// There is no external API to configure the limit: plantuml.js exports only
// `render` and `renderToString`, and neither accepts a size option. The limit is
// a constant compiled into the TeaVM output from the Java source, and the
// Java-side PLANTUML_LIMIT_SIZE JVM property is not surfaced to JavaScript.
// Other PlantUML tooling (VS Code extension, GitLab integration) sidesteps the
// problem by delegating to a Java server process, which is at odds with pumlv's
// "no Java, no external server" design.
//
// So we patch the constant in the vendored copy, raising it to 65536px — enough
// to cover large ER / sequence diagrams (observed max: ~56 000px) while still
// bounding pathological inputs. SVG is vector, so coordinate-system size has no
// meaningful effect on memory or rendering performance.
//
// We patch the float literal rather than a full comparison expression: the
// minifier renames the variables and rewrites the comparison between releases
// (it has emitted both `p<=4096.0` and `!(r>4096.0)` for this same check), but
// the literal is stable. Both occurrences are the width and height checks, so
// the count is asserted to catch the day a third `4096.0` appears for an
// unrelated reason.
const LIMIT_FROM = "4096.0";
const LIMIT_TO = "65536.0";
const LIMIT_OCCURRENCES = 2;

function patchDimensionLimit(filePath) {
  const src = readFileSync(filePath, "utf8");
  const found = src.split(LIMIT_FROM).length - 1;
  if (found !== LIMIT_OCCURRENCES) {
    // The upstream TeaVM build has changed. Bail out so the broken state is
    // visible rather than silently shipping the 4096px limit again.
    console.error(
      `plantuml.js patch failed: expected ${LIMIT_OCCURRENCES} occurrences of "${LIMIT_FROM}", found ${found}.\n` +
        "The upstream TeaVM build may have changed. Inspect plantuml.js and update vendor-plantuml-core.mjs.",
    );
    process.exit(1);
  }
  writeFileSync(filePath, src.replaceAll(LIMIT_FROM, LIMIT_TO));
  console.log(`plantuml.js: raised dimension limit ${LIMIT_FROM} -> ${LIMIT_TO}`);
}

// CREDITS-vendored carries the license texts for exactly the files vendored here,
// plus the modification notice naming the raised limit. Both are hand-written, so
// nothing but this check stops them from drifting out of sync with the code — and
// a stale modification notice is a false license-compliance statement, not just a
// stale comment.
function verifyCreditsCoverage(creditsPath) {
  const credits = readFileSync(creditsPath, "utf8");
  // The notice spells the limit as a plain pixel count ("65536 px"), not as the
  // float literal this script substitutes.
  const limit = LIMIT_TO.replace(/\.0$/, "");
  const missing = [...REQUIRED_FILES, limit].filter((needle) => !credits.includes(needle));
  if (missing.length > 0) {
    console.error(
      `${basename(creditsPath)} does not mention: ${missing.join(", ")}.\n` +
        "Every vendored file needs its license there, and the modification notice must " +
        "state the limit this script actually applies.",
    );
    process.exit(1);
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "..", "public", "plantuml");
mkdirSync(dest, { recursive: true });

const requireFrom = createRequire(import.meta.url);
const pkgDir = dirname(requireFrom.resolve("@plantuml/core/package.json"));

for (const name of REQUIRED_FILES) {
  const target = resolve(dest, name);
  copyFileSync(resolve(pkgDir, name), target);
  console.log(`copied ${name} (${statSync(target).size} bytes)`);
}

patchDimensionLimit(resolve(dest, "plantuml.js"));
verifyCreditsCoverage(resolve(here, "..", "..", "..", "CREDITS-vendored"));
