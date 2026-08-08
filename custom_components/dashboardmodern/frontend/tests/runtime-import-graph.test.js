import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticImportPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const productionEntries = Object.freeze([
  "legacy/config.js",
  "legacy/modules-entry.js",
  "panel.js",
  "dashboard-card.js",
]);
const obsoleteFacades = Object.freeze([
  "src/sections/home-section.js",
  "src/sections/climate-section.js",
  "src/sections/security-section.js",
  "src/sections/solar-thermal-section.js",
  "src/sections/pool-section.js",
  "src/sections/irrigation-section.js",
  "src/sections/minipc-section.js",
  "src/sections/legacy-section-adapter.js",
  "legacy/report-mobile-fixes.js",
]);

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await filesBelow(absolute)));
    else output.push(absolute);
  }
  return output;
}

function importSpecifiers(source) {
  return [
    ...[...source.matchAll(staticImportPattern)].map((match) => match[1]),
    ...[...source.matchAll(dynamicImportPattern)].map((match) => match[1]),
  ];
}

async function productionGraph(entries = productionEntries) {
  const seen = new Map();
  const edges = new Map();

  async function visit(file) {
    const normalized = path.normalize(file);
    if (seen.has(normalized)) return;
    const source = await readFile(normalized, "utf8");
    seen.set(normalized, source);
    const dependencies = [];
    edges.set(normalized, dependencies);
    for (const specifier of importSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      let next = path.resolve(path.dirname(normalized), specifier);
      if (!path.extname(next)) next += ".js";
      next = path.normalize(next);
      dependencies.push(next);
      await visit(next);
    }
  }

  for (const entry of entries) await visit(path.resolve(frontendRoot, entry));
  return { seen, edges };
}

function assertAcyclic(edges) {
  const active = new Set();
  const complete = new Set();
  function visit(file, chain = []) {
    if (complete.has(file)) return;
    if (active.has(file)) {
      const cycle = [...chain, file]
        .map((item) => path.relative(frontendRoot, item).replaceAll("\\", "/"))
        .join(" -> ");
      assert.fail(`production import cycle: ${cycle}`);
    }
    active.add(file);
    for (const dependency of edges.get(file) || []) visit(dependency, [...chain, file]);
    active.delete(file);
    complete.add(file);
  }
  for (const file of edges.keys()) visit(file);
}

test("production graph is single-owner, acyclic and contains no facade pass-throughs", async () => {
  const { seen: graph, edges } = await productionGraph();
  const relative = [...graph.keys()].map((file) =>
    path.relative(frontendRoot, file).replaceAll("\\", "/"),
  );
  const combined = [...graph.values()].join("\n");

  assert.equal(relative.filter((file) => file.endsWith("section-runtime.js")).length, 1);
  assert.equal(relative.filter((file) => file.endsWith("legacy-sections-registry.js")).length, 1);
  assert.deepEqual(relative.filter((file) => /legacy\/release-\d+/.test(file)), []);
  assert.deepEqual(
    relative.filter((file) =>
      /runtime-real-ha|runtime-residual|runtime-release-owner|runtime-regression-guard|runtime-consolidated/.test(file),
    ),
    [],
  );
  assert.deepEqual(
    relative.filter((file) =>
      /mobile-ui-fixes|alerts-runtime|vehicle-image-runtime|runtime-startup-coordinator|report-mobile-fixes/.test(file),
    ),
    [],
  );
  assert.ok(relative.length <= 52, `production graph unexpectedly grew to ${relative.length} modules`);
  assertAcyclic(edges);
  assert.doesNotMatch(combined, /setInterval\s*\(/);

  const observers = [...graph.entries()].filter(([, source]) => /new\s+(?:root\.)?MutationObserver\s*\(/.test(source));
  assert.ok(observers.length <= 2, `too many production observers: ${observers.length}`);
  for (const [file, source] of observers) {
    assert.doesNotMatch(
      source,
      /\.observe\s*\(\s*(?:document|doc|document\.body|doc\.body|document\.documentElement|doc\.documentElement)\b/,
      `${path.relative(frontendRoot, file)} must not observe the whole document`,
    );
  }

  const srcRoot = path.join(frontendRoot, "src");
  const srcFiles = (await filesBelow(srcRoot)).filter((file) => file.endsWith(".js"));
  const srcOrphans = srcFiles
    .filter((file) => !graph.has(path.normalize(file)))
    .map((file) => path.relative(frontendRoot, file).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(srcOrphans, [], `orphan src modules:\n${srcOrphans.join("\n")}`);
});

for (const relative of obsoleteFacades) {
  test(`${relative} is physically absent`, async () => {
    await assert.rejects(access(path.join(frontendRoot, relative)));
  });
}
