import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sections = path.resolve(here, "../src/sections");
const runtime = fs.readFileSync(path.join(sections, "section-runtime.js"), "utf8");

const modules = [
  ["home", "home-section.js", "installHomeSection"],
  ["climate", "climate-section.js", "installClimateSection"],
  ["security", "security-section.js", "installSecuritySection"],
  ["solar-thermal", "solar-thermal-section.js", "installSolarThermalSection"],
  ["pool", "pool-section.js", "installPoolSection"],
  ["irrigation", "irrigation-section.js", "installIrrigationSection"],
  ["minipc", "minipc-section.js", "installMiniPcSection"],
];

for (const [key, file, installer] of modules) {
  test(`${key} has an autonomous registered section module`, () => {
    const source = fs.readFileSync(path.join(sections, file), "utf8");
    assert.match(source, new RegExp(`export function ${installer}\\(`));
    assert.ok(runtime.includes(`from "./${file}"`));
    assert.ok(runtime.includes(`${installer}();`));
    assert.ok(runtime.includes(`"${key}"`));
  });
}

test("standalone section adapters expose a stable namespaced API", () => {
  const source = fs.readFileSync(path.join(sections, "legacy-section-adapter.js"), "utf8");
  for (const method of ["isVisible", "render", "refresh", "snapshot"]) {
    assert.match(source, new RegExp(`${method}\\(`));
  }
  assert.match(source, /__DASHBOARDMODERN_SECTIONS__/);
});
