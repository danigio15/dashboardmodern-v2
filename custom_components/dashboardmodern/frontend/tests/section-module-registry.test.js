import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const runtime = await read("../src/sections/section-runtime.js");
const registry = await read("../src/sections/legacy-sections-registry.js");

const keys = ["home", "climate", "security", "solar-thermal", "pool", "irrigation", "minipc"];
const obsolete = [
  "home-section.js",
  "climate-section.js",
  "security-section.js",
  "solar-thermal-section.js",
  "pool-section.js",
  "irrigation-section.js",
  "minipc-section.js",
  "legacy-section-adapter.js",
];

test("legacy-owned sections use one declarative registry instead of one wrapper file each", () => {
  assert.match(runtime, /installLegacySections/);
  assert.match(runtime, /LEGACY_SECTION_KEYS/);
  for (const key of keys) assert.match(registry, new RegExp(`key:\\s*"${key}"`));
  for (const method of ["isVisible", "render", "refresh", "snapshot"]) {
    assert.match(registry, new RegExp(`${method}\\(`));
  }
  assert.match(registry, /__DASHBOARDMODERN_SECTIONS__/);
});

for (const file of obsolete) {
  test(`${file} facade is physically absent`, async () => {
    await assert.rejects(access(new URL(`../src/sections/${file}`, import.meta.url)));
    assert.doesNotMatch(runtime, new RegExp(file.replaceAll(".", "\\.")));
  });
}
