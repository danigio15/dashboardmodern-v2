import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyRoot = path.join(frontendRoot, "legacy");
const importPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g;

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await filesBelow(absolute)));
    else output.push(absolute);
  }
  return output;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (_error) {
    return false;
  }
}

async function productionEntries() {
  const entries = new Set([path.join(legacyRoot, "modules-entry.js")]);
  for (const name of ["dashboard.html", "dashboard-en.html"]) {
    const html = await readFile(path.join(legacyRoot, name), "utf8");
    for (const match of html.matchAll(scriptPattern)) {
      const source = match[1].split(/[?#]/, 1)[0];
      if (!source || /^(?:https?:|data:|\/)/.test(source)) continue;
      const absolute = path.resolve(legacyRoot, source);
      if (absolute.endsWith(".js") && (await exists(absolute))) entries.add(absolute);
    }
  }
  return entries;
}

async function productionGraph() {
  const seen = new Set();
  async function visit(file) {
    const normalized = path.normalize(file);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const source = await readFile(normalized, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      let next = path.resolve(path.dirname(normalized), specifier);
      if (!path.extname(next)) next += ".js";
      await visit(next);
    }
  }
  for (const entry of await productionEntries()) await visit(entry);
  return seen;
}

test("every JavaScript file in legacy is reachable from a shipped HTML entry", async () => {
  const graph = await productionGraph();
  const all = (await filesBelow(legacyRoot)).filter((file) => file.endsWith(".js"));
  const orphans = all
    .filter((file) => !graph.has(path.normalize(file)))
    .map((file) => path.relative(frontendRoot, file).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(orphans, [], `orphan legacy modules:\n${orphans.join("\n")}`);
});
