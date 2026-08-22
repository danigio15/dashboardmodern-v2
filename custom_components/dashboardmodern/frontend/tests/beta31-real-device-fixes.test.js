// DM-FIX-20260818A
/* The Beta 31 round of real-device reports, one test per complaint.
 *
 * Everything here is either a pure function or a source contract: the parts
 * that need a live document are covered by the e2e specs of the same round.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

/* ── the dashboard was slow ───────────────────────────────────────────────── */

test("the live registry is handed over, not copied, when the runtime is the only source", async () => {
  const previous = {
    hass: globalThis.__HASS__,
    publicHass: globalThis.hass,
    states: globalThis.STATES,
    raw: globalThis._RAW_STATES,
  };
  try {
    delete globalThis.__HASS__;
    delete globalThis.hass;
    const registry = { "sensor.a": { state: "1" } };
    globalThis._RAW_STATES = registry;
    globalThis.STATES = registry;
    const { allStates } = await import(`../src/sections/shared.js?fix=${Date.now()}`);

    // The same object, so reading it is free and never a repaint behind.
    assert.equal(allStates(), registry);
    registry["sensor.b"] = { state: "2" };
    assert.equal(allStates()["sensor.b"].state, "2");
  } finally {
    globalThis.__HASS__ = previous.hass;
    globalThis.hass = previous.publicHass;
    globalThis.STATES = previous.states;
    globalThis._RAW_STATES = previous.raw;
  }
});

test("the Tapparelle page has one skin, and it is not the Beta 7 one", async () => {
  const beta7 = await read("../src/sections/beta7-regression-section.js");
  // Beta 7 declared left/right/top on the panel and nothing else did, so its
  // 9px inset survived every later redesign and detached the closed shutter
  // from the opening.
  assert.doesNotMatch(beta7, /#page-tapparelle[^\n]*\.tapp-(?:win|shutter|glass)/);

  const skin = await read("../src/sections/shutter-section.js");
  assert.match(skin, /\.tapp-shutter\{[^}]*z-index:3/);
  // The panel is positioned by the vendored rule alone: top/left/right 0.
  assert.doesNotMatch(skin, /\.tapp-shutter\{[^}]*\b(?:left|right|top):(?!0)/);
});

/* ── the cameras were black ───────────────────────────────────────────────── */

test("a rebuilt camera wall asks for its frames, and the frames keep coming", async () => {
  const wall = await read("../src/sections/security-showcase-section.js");
  // Rebuilding drops every <img> that held a frame, and no camera state change
  // follows to ask for another one.
  assert.match(wall, /if \(syncCards\(grid, models, labels\) && models\.length\) requestCameraFrames\(\)/);
  assert.match(wall, /function requestCameraFrames\(\)/);
  assert.match(wall, /state\.requestingFrames/);

  const live = await read("../src/sections/live-ui-section.js");
  assert.match(live, /const CAMERA_REFRESH_MS = 4000/);
  assert.match(live, /export function syncCameraTimer\(\)/);
  // Only while the page is on screen and the tab is not hidden.
  assert.match(live, /securityVisible\(\) && doc\?\.visibilityState !== "hidden"/);
  assert.match(live, /state\.building/);
});

/* ── the reset left a white screen and half a configuration ───────────────── */

test("a hosted dashboard is rebuilt by its host instead of reloading about:srcdoc", async () => {
  const host = await read("../src/legacy/host.js");
  assert.match(host, /export const HOST_MESSAGE_SOURCE = "dashboardmodern-host"/);
  assert.match(host, /window\.__DASHBOARDMODERN_RELOAD__=function/);
  assert.match(host, /const reboot = \(\) => \{/);
  assert.match(host, /function lostItsDocument\(\)|const lostItsDocument = \(\)/);

  const shared = await read("../src/sections/shared.js");
  assert.match(shared, /export function reloadDashboard\(\)/);
  assert.match(shared, /root\.__DASHBOARDMODERN_RELOAD__\?\.\(\)/);

  for (const path of [
    "../src/sections/config-persistence-section.js",
    "../src/sections/entity-autodetect-section.js",
  ]) {
    const source = await read(path);
    assert.match(source, /reloadDashboard\(\)/, path);
    assert.doesNotMatch(source, /location\?\.reload\?\.\(\)/, path);
  }
});

test("a light with no entity is not written back as a quick action", async () => {
  const { legacyLights } = await import("../src/core/dashboard-store.js");
  assert.deepEqual(
    legacyLights([
      { entities: ["light.salone"], name: "Salone" },
      { entities: [], name: "Vuota" },
      { entity: "switch.lampada", name: "" },
      null,
    ]),
    { "light.salone": "Salone", "switch.lampada": "switch.lampada" },
  );
  // A section that is not an array used to throw here, and the exception took
  // the whole bootstrap with it — the dashboard came back blank.
  assert.deepEqual(legacyLights({ a: { entity: "light.x", name: "X" } }), { "light.x": "X" });
  assert.deepEqual(legacyLights(undefined), {});
  assert.deepEqual(legacyLights("nonsense"), {});
});

test("the reset empties the configuration held in memory too", async () => {
  const { DashboardStore } = await import("../src/core/dashboard-store.js");
  const store = new DashboardStore({
    storage: {
      values: new Map(),
      getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
      },
      setItem(key, value) {
        this.values.set(key, value);
      },
      removeItem(key) {
        this.values.delete(key);
      },
    },
  });
  store.state.sections.lights = [{ entities: ["light.x"], name: "X" }];
  store.state.visibility = { home: true };
  const empty = store.reset();
  assert.deepEqual(empty.sections, {});
  assert.deepEqual(empty.visibility, {});
  assert.deepEqual(store.getState().sections, {});

  const persistence = await read("../src/sections/config-persistence-section.js");
  assert.match(persistence, /DashboardModernModules\?\.store\?\.reset\?\.\(\)/);
});

/* ── the Report showed different icons from the appliances ────────────────── */

test("a Report entry shows the icon of the appliance it is about", async () => {
  const { reportIconForDevice } = await import("../src/core/energy-projection.js");
  const washer = {
    name: "Lavatrice",
    device_type: "washing_machine",
    visual_type: "asset",
    visual_key: "washer",
    // The card never draws this one, so the Report must not draw it either.
    emoji_icon: "🏠",
  };
  assert.equal(reportIconForDevice(washer), "🧺");
  assert.equal(
    reportIconForDevice({ name: "Boiler", device_type: "water_heater", visual_type: "asset", visual_key: "boiler" }),
    "🚿",
  );
  // An icon deliberately given to the Report entry still wins.
  assert.equal(reportIconForDevice({ ...washer, report_icon: "⭐" }), "⭐");
  // And a device with nothing but a loose emoji keeps it.
  assert.equal(reportIconForDevice({ name: "Cosa", emoji_icon: "🛠️" }), "🛠️");

  const modules = await read("../legacy/modules-entry.js");
  assert.match(modules, /createIconField\(`dm-report-icon-\$\{fieldToken\}`, item\.report_icon \|\| reportIconForDevice\(item\)\)/);
});

/* ── two Home rows asked twice for the same thing ─────────────────────────── */

test("the retired Home rows are declared once and never rendered", async () => {
  const { RETIRED_EDITOR_SLOTS, isRetiredEditorSlot } = await import("../src/core/editor-slots.js");
  assert.deepEqual(RETIRED_EDITOR_SLOTS, [
    "dm.home_interruttore_antifurto",
    "dm.home_script_apertura_cancello",
  ]);
  assert.equal(isRetiredEditorSlot("dm.home_meteo"), false);
});

/* ── the car has two photos ───────────────────────────────────────────────── */

test("the hero shows the cable that is actually in", async () => {
  const { activeVehiclePhoto } = await import("../src/sections/ev-section.js");
  const both = { idle: "/local/auto.png", plugged: "/local/auto-cavo.png" };
  assert.equal(activeVehiclePhoto(both, false), "/local/auto.png");
  assert.equal(activeVehiclePhoto(both, true), "/local/auto-cavo.png");
  // One photo is enough: it stays whatever the cable does.
  const only = { idle: "/local/auto.png", plugged: "" };
  assert.equal(activeVehiclePhoto(only, true), "/local/auto.png");
  assert.equal(activeVehiclePhoto(only, false), "/local/auto.png");
  assert.equal(activeVehiclePhoto({ idle: "", plugged: "" }, true), "");
});

test("the cable is read from the wallbox, and 'disconnected' is not 'connected'", async () => {
  const { vehiclePlugged } = await import(`../src/sections/ev-section.js?fix=${Date.now()}`);
  const previous = globalThis._RAW_STATES;
  try {
    const registry = {};
    globalThis._RAW_STATES = registry;
    const say = (state) => {
      registry["dm.ev_stato_ricarica"] = { state };
      return vehiclePlugged();
    };
    assert.equal(say("Charging"), true);
    assert.equal(say("In ricarica"), true);
    assert.equal(say("Connected"), true);
    assert.equal(say("Disconnected"), false);
    assert.equal(say("Scollegato"), false);
    assert.equal(say("idle"), false);
    assert.equal(say("available"), false);

    // No usable text: a wallbox drawing power has a cable in it.
    delete registry["dm.ev_stato_ricarica"];
    registry["dm.ev_potenza_wallbox"] = { state: "0" };
    assert.equal(vehiclePlugged(), false);
    registry["dm.ev_potenza_wallbox"] = { state: "3200" };
    assert.equal(vehiclePlugged(), true);
  } finally {
    globalThis._RAW_STATES = previous;
  }
});

/* La seconda foto e' parte della configurazione condivisa — ma dentro l'auto.
 *
 * Prima viaggiava come casella sciolta, e questa prova pretendeva di trovarla
 * nell'elenco delle chiavi sincronizzate. Era il modo sbagliato: quelle due
 * caselle sono il disegno di adesso, ricavato dall'auto scelta su *questo*
 * dispositivo, e spedirle voleva dire portare in giro la foto dell'auto attiva
 * altrove. Adesso ogni auto si porta le sue dentro `cd_ev_cars`, che di
 * viaggiare non ha mai smesso. */
test("the second photo travels with the car, not loose", async () => {
  const { CONFIG_KEYS } = await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes("cd_ev_cars"), "le auto devono viaggiare");
  for (const key of ["cd_ev_image", "cd_ev_image_plugged"]) {
    assert.equal(CONFIG_KEYS.includes(key), false, `${key} non deve viaggiare da sola`);
  }
  const { PROFILE_PHOTO_FIELDS } = await import("../src/core/vehicle-photos.js");
  assert.deepEqual(PROFILE_PHOTO_FIELDS, { idle: "img", plugged: "imgPlugged" });
  const source = await read("../src/sections/ev-section.js");
  assert.match(source, /export const EV_PHOTO_KEYS/);
  assert.match(source, /export function ensureVehiclePhotoEditor\(\)/);
  assert.match(source, /Cavo staccato/);
  assert.match(source, /Cavo attaccato/);
});

/* ── the EV configuration came up two different ways ──────────────────────── */

test("brand and model have one place in the EV tab", async () => {
  const source = await read("../src/sections/personalization-section.js");
  assert.match(source, /evAccordionBody\(\)\.prepend\(panel\)/);
  assert.doesNotMatch(source, /body\.prepend\(panel\)/);
  assert.doesNotMatch(source, /visibleEvBlock/);
});

/* ── the menu behaved differently depending on the section ────────────────── */

test("the bottom bar answers the same gesture the same way on every page", async () => {
  const source = await read("../src/sections/navigation-section.js");
  assert.match(source, /export function hideNavigation\(\)/);
  assert.match(source, /export function showNavigation\(\)/);
  assert.match(source, /export function scheduleNavigationAutoHide\(/);
  // Capture phase: a redesigned page that stops propagation on its own cards
  // used to swallow the tap that closes the dock.
  assert.match(source, /doc\.addEventListener\(\s*"click",[\s\S]*?\n\s*true,\s*\n\s*\);/);
  // Delegated, so a tab reordered or reinserted later behaves like the others.
  assert.match(source, /target\?\.closest\?\.\("\.tab"\)/);
  // The "barra fissa" preference still wins.
  assert.match(source, /function navFixed\(\)/);
  assert.match(source, /if \(navFixed\(\)\) return false;/);
  // One room reservation for the bar, on every page.
  assert.match(source, /body\.nav-visible \.page\{padding-bottom/);
});

/* ── the lens was a lens in some sections and a row in others ─────────────── */

test("every entity field in the editors is the same readable row", async () => {
  const source = await read("../src/sections/editor-slots-section.js");
  assert.match(source, /export function decorateEntityFields\(/);
  // The lens becomes the row: same button, same handler, same target — so the
  // pair the picker guard and the editors reconcile is left intact.
  assert.match(source, /lens\.classList\.add\("dm-slot-chip"\)/);
  assert.match(source, /lens\.insertAdjacentElement\("afterend", manual\)/);
  assert.doesNotMatch(source, /lens\.remove\(\)/);
  assert.match(source, /input\.classList\.add\("dm-chip-raw"\)/);
  assert.match(source, /\[data-dm-entity-chip="true"\]:not\(\[data-dm-entity-raw="true"\]\)>\.dm-chip-raw\{display:none!important\}/);
});

/* ── the same light was listed twice in LUCI ATTIVE ───────────────────────── */

function legacyFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const end = source.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `unterminated ${name}`);
  return source.slice(start, end + 2);
}

test("a light configured in the Lights tab enters the monitoring list once", async () => {
  const source = await read("../legacy/dashboard-runtime-it.js");
  const context = vm.createContext({
    /* What the runtime builds at boot: the keys of cd_luci. */
    GRUPPI_MONITORAGGIO: { luci: ["light.sala_radio", "light.banco_radio"], win: [] },
  });
  vm.runInContext(legacyFunction(source, "cdGruppoMerge"), context);
  /* What cd_gruppi_extra holds: synchronizeLightAlerts copies every cd_luci
   * entity into it, so the two sources overlap completely. */
  vm.runInContext(
    `cdGruppoMerge('luci', ['light.sala_radio', 'light.banco_radio', 'light.autorilevata']);
     cdGruppoMerge('luci', ['light.sala_radio']);
     cdGruppoMerge('sconosciuto', ['light.x']);
     cdGruppoMerge('win', 'binary_sensor.porta');`,
    context,
  );
  assert.deepEqual(context.GRUPPI_MONITORAGGIO.luci, [
    "light.sala_radio",
    "light.banco_radio",
    "light.autorilevata",
  ]);
  assert.deepEqual(context.GRUPPI_MONITORAGGIO.win, []);
  assert.equal(context.GRUPPI_MONITORAGGIO.sconosciuto, undefined);
});

test("both runtimes merge the alert groups through the guarded path", async () => {
  for (const file of ["../legacy/dashboard-runtime-it.js", "../legacy/dashboard-runtime-en.js"]) {
    const source = await read(file);
    // cd_gruppi_extra and the avvisi of config.js: the two sources that used to
    // be concatenated as they were.
    assert.equal((source.match(/cdGruppoMerge\((?:k|grp), ids\);/g) || []).length, 2, file);
    assert.doesNotMatch(source, /GRUPPI_MONITORAGGIO\[(?:k|grp)\]\.push\(\.\.\.ids\)/, file);
  }
});

test("the lights tab keeps feeding cd_gruppi_extra, which is why the merge must dedupe", async () => {
  const source = await read("../src/sections/lights-alerts-section.js");
  assert.match(source, /const next = \[\.\.\.new Set\(\[\.\.\.\(extras\.luci \|\| \[\]\), \.\.\.lights\]\)\]/);
});
