// Copies the TeaVM-compiled PlantUML engine out of @plantuml/core into
// public/plantuml/, from where Vite copies it into internal/static/dist/.
// @plantuml/core is the MIT-licensed flavor; the js-plantuml zip on the GitHub
// releases page is the same engine built from the GPL one (plantuml/plantuml#2740).
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = ["plantuml.js", "viz-global.js"];

// The notice in credits/vendored.txt is a license-compliance statement, so it must not
// go stale as this script changes.
function verifyCreditsCoverage(creditsPath) {
  const credits = readFileSync(creditsPath, "utf8");
  const missing = REQUIRED_FILES.filter((needle) => !credits.includes(needle));
  if (missing.length > 0) {
    console.error(
      `${basename(creditsPath)} does not mention: ${missing.join(", ")}.\n` +
        "Every vendored file needs its license there.",
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

verifyCreditsCoverage(resolve(here, "..", "..", "..", "credits", "vendored.txt"));
