#!/usr/bin/env node
/**
 * Bundle budget (E12): gzipped JavaScript each page loads up front, from the
 * static export in out/. Fails when a page goes over its budget, or when
 * three.js or the Anthropic SDK end up in the first load (they must be
 * lazy-loaded). Run after `npm run build`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const BUDGET_KB = { "/": 290, "/editor/": 340, "/project/": 340, "/settings/": 290, "/help/": 290 };
const FORBIDDEN = [
  ["three.js", /WebGLRenderer|THREE\.REVISION|"three"/],
  ["Anthropic SDK", /dangerouslyAllowBrowser|anthropic-version/],
];

function pageFiles(dir, base = "/") {
  const pages = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "_next") continue;
    if (statSync(p).isDirectory()) pages.push(...pageFiles(p, `${base}${name}/`));
    else if (name === "index.html") pages.push([base, p]);
  }
  return pages;
}

let failed = false;
const rows = [];
for (const [route, file] of pageFiles(OUT)) {
  if (!(route in BUDGET_KB)) continue;
  const html = readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  let gz = 0;
  const bad = new Set();
  for (const src of new Set(scripts)) {
    const path = join(OUT, src.replace(/^.*?\/_next\//, "_next/"));
    const code = readFileSync(path);
    gz += gzipSync(code).length;
    const text = code.toString("utf8");
    for (const [name, re] of FORBIDDEN) if (re.test(text)) bad.add(name);
  }
  const kb = Math.round(gz / 1024);
  const over = kb > BUDGET_KB[route];
  if (over || bad.size) failed = true;
  rows.push(
    `${route.padEnd(12)} ${String(kb).padStart(5)} KB / ${BUDGET_KB[route]} KB${over ? "  OVER BUDGET" : ""}${bad.size ? `  eager: ${[...bad].join(", ")}` : ""}`,
  );
}
console.log("First-load JS (gzip)\n" + rows.join("\n"));
if (!rows.length) {
  console.error("No pages found in out/. Run `npm run build` first.");
  process.exit(1);
}
process.exit(failed ? 1 : 0);
