import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("host installs the bridge before any dashboard script executes", async () => {
  const source = await read("src/legacy/host.js");
  assert.match(source, /srcdoc/);
  assert.match(source, /injectHostedPrelude/);
  assert.match(source, /window\.WebSocket=bridge/);
  assert.match(source, /BlockedSocket/);
  assert.doesNotMatch(source, /frame\.setAttribute\("src"/);
});

test("section runtime owns energy configuration and flow rendering", async () => {
  const runtime = await read("src/sections/section-runtime.js");
  assert.match(runtime, /energy-config-section\.js/);
  assert.match(runtime, /energy-flow-section\.js/);
  assert.match(runtime, /installEnergyConfigSection\(\)/);
  assert.match(runtime, /installEnergyFlowSection\(\)/);
});

test("energy config explains cumulative totals and optional period sensors", async () => {
  const source = await read("src/sections/energy-config-section.js");
  assert.match(source, /state_class total o total_increasing/);
  assert.match(source, /mesi precedenti e Report/);
  assert.match(source, /Sensori facoltativi del periodo/);
  assert.match(source, /non usare un sensore W\/kW/i);
});

test("energy flow module restores active source colors", async () => {
  const source = await read("src/sections/energy-flow-section.js");
  assert.match(source, /solar: "#ff9f0a"/);
  assert.match(source, /grid: "#2563eb"/);
  assert.match(source, /battery: "#14b8a6"/);
  assert.match(source, /dm-energy-flow-active/);
});

test("appliance editor and cards keep icon and controls visible", async () => {
  const editor = await read("src/sections/appliance-editor-section.js");
  const layout = await read("src/sections/appliance-layout-section.js");
  assert.match(editor, /dm-appliance-icon-preview/);
  assert.match(editor, /visual_key: visualKey/);
  assert.match(editor, /device_type: visualKey/);
  assert.match(layout, /data-dm-power-toggle/);
  assert.match(layout, /visibility:visible/);
  assert.doesNotMatch(layout, /max-height:188px/);
});
