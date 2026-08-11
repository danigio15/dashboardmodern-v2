import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const repoRoot = path.resolve(frontendRoot, "../../../..");

async function exists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

async function filesBelow(directory) {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...(await filesBelow(file)));
    else out.push(file);
  }
  return out;
}

function importTargets(source) {
  const values = new Set();
  for (const match of source.matchAll(/(?:import\s+(?:[^"']+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g))
    values.add(match[1]);
  return [...values];
}

async function productionGraph() {
  const roots = [
    path.join(frontendRoot, "legacy", "dashboard.html"),
    path.join(frontendRoot, "legacy", "dashboard-en.html"),
    path.join(frontendRoot, "dashboard-card.js"),
    path.join(frontendRoot, "panel.js"),
  ];
  const queue = [...roots];
  const seen = new Map();
  const edges = new Map();
  while (queue.length) {
    const file = path.resolve(queue.shift());
    if (seen.has(file) || !(await exists(file))) continue;
    const source = await readFile(file, "utf8");
    seen.set(file, source);
    const deps = [];
    for (const specifier of importTargets(source)) {
      if (!specifier.startsWith(".")) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      const candidates = [resolved, `${resolved}.js`, path.join(resolved, "index.js")];
      const dependency = candidates.find((candidate) => path.extname(candidate) === ".js" && path.relative(frontendRoot, candidate).startsWith("..") === false)
        || candidates.find((candidate) => path.extname(candidate) === ".html" && path.relative(frontendRoot, candidate).startsWith("..") === false);
      if (!dependency || !(await exists(dependency))) continue;
      deps.push(dependency);
      queue.push(dependency);
    }
    if (file.endsWith(".html")) {
      for (const match of source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
        const specifier = match[1].split(/[?#]/, 1)[0];
        if (!specifier.startsWith(".")) continue;
        const dependency = path.resolve(path.dirname(file), specifier);
        if (path.relative(frontendRoot, dependency).startsWith("..") === false && await exists(dependency)) {
          deps.push(dependency);
          queue.push(dependency);
        }
      }
    }
    edges.set(file, deps);
  }
  return { seen, edges };
}

function assertAcyclic(edges) {
  const complete = new Set();
  const active = new Set();
  function visit(file, chain = []) {
    if (complete.has(file)) return;
    if (active.has(file)) {
      assert.fail(`production import cycle: ${[...chain, file].map((value) => path.basename(value)).join(" -> ")}`);
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
  // failures. Beta9 adds one final event-driven real-device reconciler for the
  // screenshot-proven EV/editor/shutter conflicts; it adds no polling or global
  // observer and is intentionally the last visual authority in beta-entry.
  assert.ok(relative.length <= 65, `production graph unexpectedly grew to ${relative.length} modules`);
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
  const orphaned = srcFiles
    .filter((file) => !graph.has(path.resolve(file)))
    .map((file) => path.relative(frontendRoot, file).replaceAll("\\", "/"));
  assert.deepEqual(orphaned, [], `orphan production modules: ${orphaned.join(", ")}`);

  const forbiddenArtifacts = (await filesBelow(repoRoot))
    .map((file) => path.relative(repoRoot, file).replaceAll("\\", "/"))
    .filter((file) => /(?:^|\/)(?:playwright-report|test-results|node_modules)(?:\/|$)|\.(?:bak|orig|tmp|old)$/.test(file))
    .filter((file) => !file.startsWith(".git/"));
  assert.deepEqual(forbiddenArtifacts, []);
});
