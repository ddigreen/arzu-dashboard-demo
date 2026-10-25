import { rm, mkdir, cp, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const scripts = [
  "app.js",
  "data.js",
  "store.js",
  "auth.js",
  "theme.js",
  "charts.js",
];
for (const f of scripts)
  execFileSync(process.execPath, ["--check", `src/${f}`]);
const html = await readFile("src/index.html", "utf8");
for (const asset of ["styles.css", ...scripts])
  if (!html.includes(asset)) throw new Error(`Missing ${asset}`);
const logos = ["assets/arzu-logo.svg", "assets/arzu-mark.svg"];
for (const asset of logos) {
  const svg = await readFile(`src/${asset}`, "utf8");
  if (!svg.includes("<svg")) throw new Error(`Invalid logo asset: ${asset}`);
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await cp("src", "dist", { recursive: true });

// One revision keeps scripts, styles and logos together after a Pages update.
const hash = createHash("sha256");
hash.update(await readFile("scripts/build.mjs"));
for (const asset of ["index.html", "styles.css", ...scripts, ...logos].sort()) {
  hash.update(asset);
  hash.update(await readFile(`src/${asset}`));
}
const revision = hash.digest("hex").slice(0, 12);
await writeFile(
  "dist/index.html",
  html.replace(
    /(src|href)="((?:assets\/)?[\w.-]+\.(?:js|css|svg))"/g,
    `$1="$2?v=${revision}"`,
  ),
);
let app = await readFile("dist/app.js", "utf8");
for (const asset of logos)
  app = app.replaceAll(`src="${asset}"`, `src="${asset}?v=${revision}"`);
await writeFile("dist/app.js", app);
console.log("ARZU: синтаксис и ресурсы проверены, сайт собран в dist/");
