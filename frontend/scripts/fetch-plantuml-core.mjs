// Downloads plantuml-core release assets (jar.js AOT bundle + raw jar) into
// frontend/public/ so Vite copies them into static/dist/. CheerpJ needs both:
// the raw .jar gives it a real classpath entry, and the .jar.js next to it
// provides the AOT-compiled JS that CheerpJ auto-loads.
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = [
  {
    name: "plantuml-core.jar",
    url: "https://api.github.com/repos/plantuml/plantuml-core/releases/assets/98017508",
    size: 4386892,
  },
];

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

for (const asset of ASSETS) {
  const dest = resolve(publicDir, asset.name);
  if (existsSync(dest) && statSync(dest).size === asset.size) {
    console.log(`${asset.name} already present (${asset.size} bytes)`);
    continue;
  }

  console.log(`downloading ${asset.name} from ${asset.url}`);
  const res = await fetch(asset.url, {
    headers: {
      Accept: "application/octet-stream",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      }),
    },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    console.error(`fetch failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const sink = createWriteStream(dest);
  const reader = res.body.getReader();
  let written = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    written += value.byteLength;
    sink.write(value);
  }
  await new Promise((r) => sink.end(r));
  console.log(`wrote ${written} bytes to ${dest}`);
}
