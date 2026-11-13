// script/ensure-shell.mjs
//
// Runs AFTER `vite build` and `prerender`. Azure Static Web Apps needs these
// files in dist/ for the routes in staticwebapp.config.json to work:
//   - app-shell.html  (target of the "rewrite" routes)
//   - 404.html        (target of responseOverrides.404)
//   - staticwebapp.config.json
// If any is missing, Azure shows its own generic "404: Not Found" page.
// This script only fills gaps; it never overwrites files that already exist.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const indexHtml = path.join(dist, "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error("ensure-shell: dist/index.html not found. Run the build first.");
  process.exit(1);
}

function copyIfMissing(from, to, label) {
  if (fs.existsSync(to)) {
    console.log(`ensure-shell: ${label} already exists, kept`);
    return;
  }
  if (!fs.existsSync(from)) {
    console.error(`ensure-shell: cannot create ${label}, source missing: ${from}`);
    process.exitCode = 1;
    return;
  }
  fs.copyFileSync(from, to);
  console.log(`ensure-shell: created ${label}`);
}

copyIfMissing(indexHtml, path.join(dist, "app-shell.html"), "app-shell.html");
copyIfMissing(indexHtml, path.join(dist, "404.html"), "404.html");
copyIfMissing(
  path.join(root, "public", "staticwebapp.config.json"),
  path.join(dist, "staticwebapp.config.json"),
  "staticwebapp.config.json",
);

console.log("ensure-shell: done");
//update