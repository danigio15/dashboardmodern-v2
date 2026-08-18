// DM-FIX-20260813A
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticImportPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const productionEntries = Object.freeze([
  "legacy/config.js",
  "legacy/modules-entry.js",
  "panel.js",
  "dashboard-card.js",
]);
const obsoleteFacades = Object.freeze([
  "src/sections/home-section.js",
  "src/sections/climate-section.js",
  "src/sections/security-section.js",
  "src/sections/solar-thermal-section.js",
  "src/sections/pool-section.js",
  "src/sections/irrigation-section.js",
  "src/sections/minipc-section.js",
  "src/sections/legacy-section-adapter.js",
  "legacy/report-mobile-fixes.js",
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

function importSpecifiers(source) {
  return [
    ...[...source.matchAll(staticImportPattern)].map((match) => match[1]),
    ...[...source.matchAll(dynamicImportPattern)].map((match) => match[1]),
  ];
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
    for (const specifier of importSpecifiers(source)) {
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
  // Beta27 adds one final event-driven real-device owner for compact appliance
  // geometry/theme/media contracts and single-owner Temperature room tabs. It
  // adds no polling or document-wide observer.
  // The appliance showcase redesign adds exactly four owners: the pure card
  // view-model, the cycle tracker, the photorealistic hero artwork and the
  // showcase section renderer. All four are event-driven (state-changed +
  // legacy render loop), with no polling and no observers.
  // The dynamic energy-flow stage adds exactly one owner: the pure topology and
  // view-model. The renderer itself lives in the existing energy-flow section,
  // which stays the single owner of the Flows stage; the Beta 22 corrective
  // stands down instead of a second module arriving to arbitrate between them.
  // The rebuilt Loads config adds two: the pure config model and the panel that
  // edits it. The Beta 26/27 hierarchy editor stands down in the same way, so
  // the Loads panel keeps exactly one renderer. The circle popup adds two more,
  // the same split: a pure model and the owner that renders it over the legacy
  // list, which is what makes the circle total and the popup total one number.
  // The Pool/Irrigation redesign adds exactly one owner: the scene section that
  // replaces both legacy paint functions. Beta11's stylesheet block and the
  // Beta12/14/16 pool correctives stood down into it, so the two pages have one
  // renderer and one stylesheet instead of five competing layers.
  // The Tapparelle redesign adds exactly one owner: the scene section that
  // replaces the legacy paint function so the page can carry a summary header,
  // per-room headings and a position track. It renders per structural
  // signature rather than per tick, keeps commands on the legacy cdTappCmd
  // handler, and adds no polling and no observer. The window skin stays in the
  // existing shutter section, which is still the single owner of the
  // first-paint geometry, so the two modules split structure from paint rather
  // than competing over the same declarations.
  // All facade/cycle/orphan/polling/global-observer checks stay active.
  // The Solar Thermal redesign adds exactly one owner: a style-and-labels module
  // for #page-boiler. It installs one stylesheet, fills the decorative labels the
  // legacy markup left empty and reads no Home Assistant state, so the page keeps
  // the legacy runtime as its single behavioural owner. It adds no polling, and
  // its only listener is a media query that swaps the portrait scene in.
  // The Security redesign adds exactly one owner: the section renderer that
  // repaints the alarm console and the camera grid. It is event-driven
  // (state-changed + legacy render loop), adds no polling and no observer, and
  // keeps the camera engine — apriCamera, the streaming strategies and
  // toggleFullScreenCam — in the legacy runtime instead of forking it.
  // The EV redesign adds exactly one owner: the skin for #page-ev. It moves the
  // battery block into a charge ring, mirrors the active EVCC mode onto the page
  // as an attribute and restyles the picker that ev-section.js keeps building.
  // It reads no Home Assistant state — the ring reads #ev-mod-batt-fill, the
  // rows carry legacy value classes — and adds no polling and no observer.
  // The fast entity search adds exactly two: the pure search index (folding,
  // ranking and field auto-detection) and the section that installs it over the
  // vendored `cdEpFilter`. No new picker is introduced — the canonical dialog
  // stays the only one — and the section is event-driven, with no polling and
  // no observer.
  // The Climate redesign adds exactly one owner: the section renderer for
  // #page-clima. It replaces buildClimaCards/updateClimaCards instead of adding
  // a layer on top, so the Beta 4 / Beta 7 / Beta 16 / personalization
  // corrections for the old .cp-card markup stop matching and the page keeps one
  // renderer and one stylesheet. It is event-driven (state-changed + the legacy
  // render loop) and leaves every service call — setTemp, toggleClima and the
  // HVAC/fan popup — in the legacy runtime.
  // The editor slot rows add exactly one owner: it decorates the rows the legacy
  // editor prints, hides the raw entity field behind "Modifica manuale" and
  // routes the tap to the legacy wzPickEntity(), which the fast search above
  // owns. No polling, no observer.
  // All facade/cycle/orphan/polling/global-observer checks stay active.
  assert.ok(relative.length <= 97, `production graph unexpectedly grew to ${relative.length} modules`);
  assertAcyclic(edges);
  assert.doesNotMatch(combined, /setInterval\s*\(/);

  const observers = [...graph.entries()].filter(([, source]) => /new\s+(?:root\.)?MutationObserver\s*\(/.test(source));
  // Beta17 contributes one page-scoped observer so delayed legacy writes on
  // #page-temp cannot resurrect the progress placeholder. Beta24 may add one
  // node-scoped SOC observer. Beta26 adds one #temp-grid-scoped observer. The
  // loop below still rejects observers rooted at document/body/documentElement.
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

for (const relative of obsoleteFacades) {
  test(`${relative} is physically absent`, async () => {
    await assert.rejects(access(path.join(frontendRoot, relative)));
  });
}
