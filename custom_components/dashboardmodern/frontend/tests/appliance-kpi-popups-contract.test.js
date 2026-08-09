import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeUrl = new URL("../src/sections/section-runtime.js", import.meta.url);

test("appliance KPI runtime keeps running semantics, removes alerts and centers popups", async () => {
  const source = await readFile(runtimeUrl, "utf8");
  assert.match(source, /model\.mode === "running"/);
  assert.match(source, /alerts\.remove\(\)/);
  assert.match(source, /IN FUNZIONE/);
  assert.match(source, /const id = `dm-appliance-\$\{kind\}-popup`/);
  assert.match(source, /ensureApplianceKpiPopup\("running"\)/);
  assert.match(source, /ensureApplianceKpiPopup\("power"\)/);
  assert.match(source, /\.dm-appliance-kpi-overlay\{[^}]*place-items:center!important/);
  assert.match(
    source,
    /@media\(max-width:520px\)[\s\S]*#dm-appliance-daily-popup\.dm-appliance-daily-overlay\s*\{[^}]*align-items:center!important;[^}]*justify-content:center!important/,
  );
});
