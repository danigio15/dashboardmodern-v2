import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const productionEntries = Object.freeze([
  "legacy/report-mobile-fixes.js",
  "legacy/modules-entry.js",
  "panel.js",
  "dashboard-card.js",
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
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
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

test("production has one dedicated owner per section and no patch cascade", async () => {
  const { seen: graph, edges } = await productionGraph();
  const relative = [...graph.keys()].map((file) =>
    path.relative(frontendRoot, file).replaceAll("\\", "/"),
  );
  const combined = [...graph.values()].join("\n");
  const sectionOwners = [
    "sections/data-contracts-section.js",
    "sections/energy-section.js",
    "sections/energy-stability-section.js",
    "sections/energy-guidance-section.js",
    "sections/temperature-section.js",
    "sections/temperature-layout-section.js",
    "sections/appliances-section.js",
    "sections/appliance-layout-section.js",
    "sections/appliance-editor-section.js",
    "sections/lights-alerts-section.js",
    "sections/alerts-section.js",
    "sections/unified-editors-section.js",
    "sections/editor-crud-section.js",
    "sections/editor-contracts-section.js",
    "sections/report-editor-section.js",
    "sections/shutter-section.js",
    "sections/ev-section.js",
  ];

  assert.equal(relative.filter((file) => file.endsWith("section-runtime.js")).length, 1);
  assert.equal(relative.filter((file) => file.endsWith("runtime-consolidated.js")).length, 0);
  for (const owner of sectionOwners) {
    assert.equal(
      relative.filter((file) => file.endsWith(owner)).length,
      1,
      `${owner} must have exactly one production owner`,
    );
  }
  assert.equal(relative.some((file) => file.endsWith("shutter-alert-layout-section.js")), false);
  assert.deepEqual(relative.filter((file) => /legacy\/release-\d+/.test(file)), []);
  assert.deepEqual(
    relative.filter((file) =>
      /runtime-real-ha|runtime-residual|runtime-release-owner|runtime-regression-guard/.test(file),
    ),
    [],
  );
  assert.deepEqual(
    relative.filter((file) =>
      /mobile-ui-fixes|alerts-runtime|vehicle-image-runtime|runtime-startup-coordinator/.test(file),
    ),
    [],
  );
  assert.ok(relative.length <= 60, `production graph unexpectedly grew to ${relative.length} modules`);
  assertAcyclic(edges);
  assert.doesNotMatch(combined, /setInterval\s*\(/);

  const observers = [...graph.entries()].filter(([, source]) =>
    /new\s+MutationObserver\s*\(/.test(source),
  );
  assert.ok(observers.length <= 2, `too many section observers: ${observers.length}`);
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
