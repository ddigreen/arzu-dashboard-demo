import { rm, mkdir, cp, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
for (const f of [
  "app.js",
  "data.js",
  "store.js",
  "auth.js",
  "theme.js",
  "charts.js",
])
  execFileSync(process.execPath, ["--check", `src/${f}`]);
const html = await readFile("src/index.html", "utf8");
for (const asset of [
  "styles.css",
  "data.js",
  "store.js",
  "auth.js",
  "theme.js",
  "charts.js",
  "app.js",
])
  if (!html.includes(asset)) throw new Error(`Missing ${asset}`);
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await cp("src", "dist", { recursive: true });
console.log("ARZU: синтаксис проверен, 8 файлов собраны в dist/");
