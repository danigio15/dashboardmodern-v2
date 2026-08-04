import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

async function productionGraph(entry) {
  const seen = new Map();

  async function visit(file) {
    const normalized = path.normalize(file);
    if (seen.has(normalized)) return;
    const source = await readFile(normalized, "utf8");
    seen.set(normalized, source);
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      let next = path.resolve(path.dirname(normalized), specifier);
      if (!path.extname(next)) next += ".js";
      await visit(next);
    }
  }

  await visit(path.resolve(frontendRoot, entry));
  return seen;
}

test("production has one runtime owner and no numbered patch cascade", async () => {
  const graph = await productionGraph("legacy/modules-entry.js");
  const relative = [...graph.keys()].map((file) =>
    path.relative(frontendRoot, file).replaceAll("\\", "/"),
  );
  const combined = [...graph.values()].join("\n");

  assert.equal(relative.filter((file) => file.endsWith("runtime-consolidated.js")).length, 1);
  assert.deepEqual(relative.filter((file) => /legacy\/release-\d+/.test(file)), []);
  assert.deepEqual(relative.filter((file) => /runtime-real-ha|runtime-residual|runtime-release-owner|runtime-regression-guard/.test(file)), []);
  assert.ok(relative.length <= 18, `production graph unexpectedly grew to ${relative.length} modules`);
  assert.doesNotMatch(combined, /setInterval\s*\(/);
  assert.doesNotMatch(combined, /new\s+MutationObserver\s*\(/);
});
