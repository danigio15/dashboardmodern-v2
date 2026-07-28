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
  assert.match(report, /t\("saveReport"\)/);
  assert.match(report, /data-state="clean"/);
  assert.match(report, /saveReport/);
  assert.match(report, /createEntityField/);
  assert.match(report, /report_order/);
  assert.match(report, /t\("addManual"\)/);
  assert.doesNotMatch(report, /dm-load-category/);
  assert.notEqual(report, loads);
  assert.match(report, /\[data-entity-field\] input/);
  assert.match(report, /\[data-entity-field\] \.dm-entity-picker/);
  assert.match(report, /renderReportEditor\(target\); mountReportEditor\("report", target\)/);
});

test("Energy coordinator never calls the legacy section renderer for Energy, Loads or Report", async () => {
  const source = await readFile(moduleUrl, "utf8");
  const coordinator = source.slice(
    source.indexOf("createRenderCoordinator"),
    source.indexOf("function renderEnergyEditorTab"),
  );
  assert.match(coordinator, /tab === "sez1" && section === "energy"/);
  assert.match(coordinator, /tab === "sez1" && section === "loads"/);
  assert.match(coordinator, /tab === "sez1" && section === "report"/);
  assert.match(coordinator, /tab !== "sez1"/);
});

test("public report and multi-device sync consume canonical state only", async () => {
  for (const variant of ["dashboard.html", "dashboard-en.html"]) {
    const source = await readFile(new URL(`../legacy/${variant}`, import.meta.url), "utf8");
    const reportStart = source.indexOf("function cdRebuildReportDevices");
    const report = source.slice(
      reportStart,
      source.indexOf("cdRebuildReportDevices();", reportStart),
    );
    assert.match(report, /canonicalReportDevices/);
    assert.match(report, /getSection\('appliances'\)/);
    assert.match(report, /getSection\('loads'\)/);
    assert.doesNotMatch(report, /cd_report_devices|cdApplReportEntries/);
    const sync = source.slice(
      source.indexOf("const CD_SYNC_KEYS"),
      source.indexOf("function cdMarkDirty"),
    );
    assert.match(sync, /dm_dashboard_state/);
    assert.doesNotMatch(sync, /cd_subloads_extra|cd_report_devices/);
    assert.match(sync, /applySnapshot/);
  }
});

test("custom device cards use devs emptiness and never reference the Temperature visible list", async () => {
  for (const variant of ["dashboard.html", "dashboard-en.html"]) {
    const source = await readFile(new URL(`../legacy/${variant}`, import.meta.url), "utf8");
    const start = source.indexOf("function buildDeviceCards()");
    const block = source.slice(start, source.indexOf("function updateDeviceCards()", start));
    assert.match(block, /const devs = getDevices\(\)/);
    assert.match(block, /if \(!devs\.length\)/);
    assert.doesNotMatch(block, /visible/);
    assert.doesNotMatch(block, /stanza|room con sensore/i);
  }
});

test("Loads excludes manual Report entries and category controls", async () => {
  const source = await readFile(moduleUrl, "utf8");
  const start = source.indexOf("function mountLoadsEditor");
  const block = source.slice(start, source.indexOf("const DashboardModernModules", start));
  assert.doesNotMatch(block, /C\. VOCI REPORT MANUALI|dm-load-category/);
  assert.match(block, /category !== "manual-report"/);
});

test("manual Report rows use the shared renderer and mount every dynamic control", async () => {
  const source = await readFile(moduleUrl, "utf8");
  assert.match(source, /export function renderReportRow\(item, index\)/);
  const mountStart = source.indexOf("function mountReportEditor");
  const mount = source.slice(mountStart, source.indexOf("function renderDiagnostics", mountStart));
  assert.match(mount, /renderReportRow\(/);
  assert.match(mount, /mountReportRowControls\(added, list, dirty\)/);
  assert.match(source, /function mountReportRowControls/);
  for (const control of [
    "data-report-up",
    "data-report-down",
    "data-report-delete",
    "data-icon-target",
    "data-entity-target",
  ])
    assert.match(source, new RegExp(control));
  assert.match(mount, /list\.querySelector\("\.ed-empty"\)\?\.remove\(\)/);
  assert.match(mount, /const currentActions = target\.querySelector/);
});
