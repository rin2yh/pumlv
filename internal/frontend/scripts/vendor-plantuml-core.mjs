// Copies the TeaVM-compiled PlantUML engine out of @plantuml/core into
// public/plantuml/, from where Vite copies it into internal/static/dist/.
// @plantuml/core is the MIT-licensed flavor; the js-plantuml zip on the GitHub
// releases page is the same engine built from the GPL one (plantuml/plantuml#2740).
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// The engine refuses to render past 4096px on either axis, and exposes no option
// to raise it (`render`/`renderToString` take none, and scale/dpi pragmas apply
// after the check), so the limit is patched into the vendored copy. We match the
// bare literal because the minifier rewrites the surrounding comparison between
// releases, and assert the count because only these two occurrences are the
// width and height guards.
const LIMIT_FROM = "4096.0";
const LIMIT_TO = "65536.0";
const LIMIT_OCCURRENCES = 2;

function patchDimensionLimit(filePath) {
  const src = readFileSync(filePath, "utf8");
  const found = src.split(LIMIT_FROM).length - 1;
  if (found !== LIMIT_OCCURRENCES) {
    console.error(
      `plantuml.js patch failed: expected ${LIMIT_OCCURRENCES} occurrences of "${LIMIT_FROM}", found ${found}.\n` +
        "The upstream TeaVM build may have changed. Inspect plantuml.js and update vendor-plantuml-core.mjs.",
    );
    process.exit(1);
  }
  writeFileSync(filePath, src.replaceAll(LIMIT_FROM, LIMIT_TO));
  console.log(`plantuml.js: raised dimension limit ${LIMIT_FROM} -> ${LIMIT_TO}`);
}

// The notice in credits/vendored.txt is a license-compliance statement, so it must not
// go stale as this script changes.
function verifyCreditsCoverage(creditsPath) {
  const credits = readFileSync(creditsPath, "utf8");
  const limitPx = LIMIT_TO.replace(/\.0$/, "");
  const missing = [...REQUIRED_FILES, limitPx].filter((needle) => !credits.includes(needle));
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
verifyCreditsCoverage(resolve(here, "..", "..", "..", "credits", "vendored.txt"));
