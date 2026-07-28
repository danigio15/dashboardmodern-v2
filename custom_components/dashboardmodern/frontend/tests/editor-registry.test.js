import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL("../legacy/modules-entry.js", import.meta.url);

test("real editor tab ids resolve to canonical ownership", async () => {
  const { resolveEditorTab } = await import(`${moduleUrl}?resolve=${Date.now()}`);
  assert.equal(resolveEditorTab("sez1"), "energy");
  assert.equal(resolveEditorTab("sez2"), "ev");
  assert.equal(resolveEditorTab("sez4"), "security");
  assert.equal(resolveEditorTab("runtime"), "diagnostics");
  assert.equal(resolveEditorTab("pool"), "pool");
});

test("registry dispatch performs exactly one render and one mount", async () => {
  const { dispatchEditorTab } = await import(`${moduleUrl}?dispatch=${Date.now()}`);
  let renders = 0;
  let mounts = 0;
  const target = { dataset: {} };
  assert.equal(
    dispatchEditorTab("sez1", target, {
      energy: { render: () => renders++, mount: () => mounts++ },
    }),
    true,
  );
  assert.deepEqual({ renders, mounts }, { renders: 1, mounts: 1 });
  assert.equal(target.dataset.renderer, "energy");
});

test("runtime tab is in each modal template and diagnostics expose distinct provenance", async () => {
  const moduleSource = await readFile(moduleUrl, "utf8");
  for (const variant of ["dashboard.html", "dashboard-en.html"]) {
    const source = await readFile(new URL(`../legacy/${variant}`, import.meta.url), "utf8");
    const modal = source.slice(
      source.indexOf("function apriConfigEntita"),
      source.indexOf("function editorSwitch"),
    );
    assert.equal((modal.match(/data-tab="runtime"/g) || []).length, 1);
    assert.match(modal, /registerEditorTabs/);
  }
  for (const label of [
    "Integration version",
    "Dashboard version",
    "Module version",
    "Schema version",
    "Git commit",
    "Static asset hash",
  ])
    assert.match(moduleSource, new RegExp(label));
});

test("Energy is registry-owned and edFilterSez no longer mounts Energy", async () => {
  for (const variant of ["dashboard.html", "dashboard-en.html"]) {
    const source = await readFile(new URL(`../legacy/${variant}`, import.meta.url), "utf8");
    const filter = source.slice(
      source.indexOf("function edFilterSez"),
      source.indexOf("function cdNavOrderHtml"),
    );
    assert.doesNotMatch(filter, /mountEnergyEditor|dm-energy-editor/);
  }
});

test("Report DOM has a save lifecycle, canonical pickers and differs from Loads", async () => {
  const source = await readFile(moduleUrl, "utf8");
  const report = source.slice(
    source.indexOf("function renderReportEditor"),
    source.indexOf("function renderDiagnostics"),
  );
  const loads = source.slice(source.indexOf("function mountLoadsEditor"));
  assert.match(report, /Salva Report/);
  assert.match(report, /data-state="clean"/);
  assert.match(report, /saveReport/);
  assert.match(report, /createEntityField/);
  assert.match(report, /report_order/);
  assert.match(report, /Aggiungi voce manuale/);
  assert.doesNotMatch(report, /dm-load-category/);
  assert.notEqual(report, loads);
});
