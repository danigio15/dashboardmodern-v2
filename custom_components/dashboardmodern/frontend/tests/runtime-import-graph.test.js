import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const roots = [
  path.join(frontendRoot, "panel.js"),
  path.join(frontendRoot, "dashboard-card.js"),
  path.join(frontendRoot, "legacy", "dashboard.html"),
  path.join(frontendRoot, "legacy", "dashboard-en.html"),
];

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(resolved)));
    else files.push(resolved);
  }
  return files;
}

function cleanSpecifier(specifier) {
  return String(specifier || "")
    .split(/[?#]/, 1)[0]
    .trim();
}

function staticSpecifiers(source) {
  const found = new Set();
  const patterns = [
    /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) found.add(cleanSpecifier(match[1]));
  }
  return [...found];
}

function htmlSpecifiers(source) {
  const found = new Set();
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(source))) found.add(cleanSpecifier(match[1]));
  return [...found];
}

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const candidates = path.extname(resolved)
    ? [resolved]
    : [resolved, `${resolved}.js`, path.join(resolved, "index.js")];
  return candidates.find((candidate) => candidate.startsWith(frontendRoot)) || null;
}

async function productionGraph() {
  const seen = new Map();
  const edges = new Map();
  const queue = [...roots];
  while (queue.length) {
    const file = path.normalize(queue.shift());
    if (seen.has(file)) continue;
    const source = await readFile(file, "utf8");
    seen.set(file, source);
    const specifiers = file.endsWith(".html") ? htmlSpecifiers(source) : staticSpecifiers(source);
    const dependencies = specifiers
      .map((specifier) => resolveSpecifier(file, specifier))
      .filter(Boolean)
      .map(path.normalize);
    edges.set(file, dependencies);
    for (const dependency of dependencies) if (!seen.has(dependency)) queue.push(dependency);
  }
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
  // v1 beta adds the persistence owner plus substantive UI owners. Beta4/Beta5
  // keep one scoped mobile-polish owner; Beta6 adds one event-driven feedback
  // owner. Beta7 adds exactly two scoped, event-driven guards for real WebView
  // failures: brand-image fallback and the final mobile regression polish.
  // Beta9 adds one final scoped event-driven real-device reconciler for the
  // screenshot-proven EV/editor/shutter conflicts, with no polling or observer.
  // Beta11 intentionally adds one final, scoped and event-driven owner for the
  // screenshot-proven EV logo, alert picker and room-label regressions.
  // Beta12 keeps its final action/room first-paint contract inside the existing
  // room-color lock; reset, temperature, shutters and energy flows were
  // consolidated into their existing production owners rather than new modules.
  // Beta16 intentionally adds one scoped owner for the screenshot-proven room
  // label, Temperature tab, compact Climate and Pool responsive contracts.
  // Beta17 keeps the scoped Temperature progress-copy guard. Beta18 adds one
  // canonical icon-engine owner while historical beta modules delegate instead
  // of repainting the same icon DOM. Beta20.2 adds exactly one canonical save
  // owner to close the legacy editor -> store -> visibility -> HA persistence
  // transaction. Beta22 adds one final scoped, event-driven corrective owner
  // that binds canonical Loads to the existing Energy flow slots, restores SOC,
  // Temperature room labels and Energy cost fields, without polling or a global
  // observer. Beta24 adds one boot-time recovery module for schema-v4 snapshots
  // that crossed the persistence rewrite; its only observer is scoped to the
  // single Battery SOC text node so competing legacy writes cannot visibly win.
  // Beta25 adds one event-driven owner for the three screenshot-proven real-device
  // regressions plus one compatibility owner that restores stable DOM/runtime
  // contracts after those targeted renders. Neither adds polling or observers.
  // Beta26 adds exactly one real-device stability owner; its only observer is
  // scoped to #temp-grid so saved primary labels win over delayed legacy repaints.
  // This screenshot-driven follow-up adds one scoped configuration owner for the
  // hierarchical load flow, save-to-visible contract and delayed Temperature
  // reconciliation. Its single observer is restricted to #temp-grid and #ed-body.
  // All facade/cycle/orphan/polling/global-observer checks stay active.
  assert.ok(relative.length <= 79, `production graph unexpectedly grew to ${relative.length} modules`);
  assertAcyclic(edges);
  assert.doesNotMatch(combined, /setInterval\s*\(/);

  const observers = [...graph.entries()].filter(([, source]) => /new\s+(?:root\.)?MutationObserver\s*\(/.test(source));
  // Beta17 contributes one page-scoped observer so delayed legacy writes on
  // #page-temp cannot resurrect the progress placeholder. Beta24 may add one
  // node-scoped SOC observer. Beta26 adds one #temp-grid-scoped observer. The
  // follow-up contributes one editor/grid-scoped observer shared by both targets.
  // The loop below still rejects observers rooted at document/body/documentElement.
  assert.ok(observers.length <= 5, `too many production observers: ${observers.length}`);
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
