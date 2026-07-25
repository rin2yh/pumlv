// Writes credits/frontend.txt: the license texts of every npm package that ends up in
// the SPA bundle, which go:embed then ships inside the binary. Mirrors what
// gocredits does for go.sum, in the same layout, so `pumlv credits` reads as one
// document. Regenerated on every frontend build; commit the result.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LICENSE_FILE = /^(licen[cs]e|copying)(\.|$)/i;
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "..", "..", "credits", "frontend.txt");

const listed = JSON.parse(
  execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
    cwd: resolve(here, ".."),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }),
);

const packages = Object.values(listed)
  .flat()
  .sort((a, b) => a.name.localeCompare(b.name));

const sections = packages.map((pkg) => {
  const dir = pkg.paths[0];
  const file = readdirSync(dir).find((name) => LICENSE_FILE.test(name));
  if (!file) {
    console.error(`no license file in ${dir} (${pkg.name}, ${pkg.license})`);
    process.exit(1);
  }
  const url = pkg.homepage ?? `https://www.npmjs.com/package/${pkg.name}`;
  const text = readFileSync(resolve(dir, file), "utf8").trimEnd();
  return `${pkg.name}\n${url}\n${"-".repeat(64)}\n${text}\n`;
});

writeFileSync(out, `${sections.join(`\n${"=".repeat(64)}\n\n`)}\n${"=".repeat(64)}\n`);
console.log(`credits/frontend.txt: ${packages.length} packages`);
