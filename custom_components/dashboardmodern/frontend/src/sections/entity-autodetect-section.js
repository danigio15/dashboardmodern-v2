/* The 🪄 button in Config: what it does while you wait, and what it decides.
 *
 * `edAutoRileva` in the vendored runtime opens a WebSocket, then polls every
 * 500 ms — up to forty times — for the entity list to appear, then runs
 * `wzAutoDetect` on the main thread, then writes and reloads. Three things go
 * wrong with that on a real installation:
 *
 *   - the poll adds up to half a second of waiting after the data has already
 *     arrived, and up to twenty seconds of nothing at all if it never does;
 *   - the detection itself re-tokenizes every entity once per slot, so with
 *     ninety-six slots and a few thousand entities the page simply stops
 *     answering until it is over;
 *   - the socket it opens asks for the states first and the area, device and
 *     entity registries after, but closes on the first array that comes back —
 *     which is the states. The registries therefore never arrive, and the
 *     "one room per Home Assistant area" detection they were added for has
 *     been falling back to guessing from names ever since.
 *
 * This section replaces that path. The entity universe is folded and tokenized
 * once by the same index the picker uses, the registries are fetched through
 * the runtime's own `cdRegEnrich` before detection instead of after it, and the
 * matching runs in `core/entity-autodetect.js` over posting lists, so a slot
 * only looks at the entities that share a word with it.
 *
 * The last difference is that it now shows its work: a progress line while it
 * runs, then what it found — how many lights, rooms, climate units, cameras and
 * links, and which slots it deliberately left alone because two candidates were
 * equally plausible — and it writes nothing until that summary is accepted.
 *
 * What it writes is what the runtime has always written, key for key and with
 * the same never-overwrite rule, followed by the same registry enrich and
 * reload. The one deliberate exception is the Energy slots, which schema 4 owns
 * through the canonical Energy model; `writeEnergyAssignments` explains why
 * writing them the old way loses them. If any of this fails, the vendored
 * `edAutoRileva` runs instead.
 */
import { ENERGY_SLOT_MAP } from "../core/energy-projection.js";
import { keptSemanticsVersion, scriviNellImpianto } from "../core/energy-writer.js";
import { impiantoScelto } from "./energy-section.js";
import { buildEntityIndex } from "../core/entity-search-index.js";
import { buildPostings, detectCategories, detectSlots, parseSlotPlan } from "../core/entity-autodetect.js";
import { allStates, clean, dashboardStore, doc, installStyle, lexicalGlobal, readJson, reloadDashboard, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITY_AUTODETECT__";
const HOSTED_ENOUGH = 200;
const WAIT_STEP = 80;
const WAIT_LIMIT = 6000;

const state = (root[KEY] ||= { installed: false, running: false, proposal: null });

/* ── Progress and summary ─────────────────────────────────────────────────── */

function outlet() {
  return doc?.getElementById("ed-rileva-out") || null;
}

function progress(step, total, message) {
  const target = outlet();
  if (!target) return;
  const percent = Math.max(4, Math.min(100, Math.round((step / total) * 100)));
  target.innerHTML =
    `<div class="dm-ad-progress"><div class="dm-ad-bar"><i style="width:${percent}%"></i></div>` +
    `<div class="dm-ad-step"></div></div>`;
  const line = target.querySelector(".dm-ad-step");
  if (line) line.textContent = message;
}

function failure(message) {
  const target = outlet();
  if (target) target.innerHTML = `<div class="ed-intro dm-ad-error"></div>`;
  const line = target?.querySelector(".dm-ad-error");
  if (line) line.textContent = `❌ ${message}`;
}

function countRow(icon, label, value, note = "") {
  const row = doc.createElement("div");
  row.className = "dm-ad-row";
  const left = doc.createElement("span");
  left.className = "dm-ad-row-label";
  left.textContent = `${icon} ${label}`;
  const right = doc.createElement("span");
  right.className = value ? "dm-ad-row-value" : "dm-ad-row-value is-empty";
  right.textContent = note || String(value);
  row.append(left, right);
  return row;
}

function renderSummary(proposal) {
  const target = outlet();
  if (!target) return;
  target.textContent = "";
  const panel = doc.createElement("div");
  panel.className = "dm-ad-summary";

  const title = doc.createElement("div");
  title.className = "dm-ad-title";
  title.textContent = t("🪄 Ecco cosa ho trovato", "🪄 Here is what I found");
  panel.append(title);

  const intro = doc.createElement("div");
  intro.className = "dm-ad-intro";
  intro.textContent = t(
    `${proposal.entities} entità analizzate in ${proposal.elapsed} ms. Niente è stato ancora salvato.`,
    `${proposal.entities} entities analysed in ${proposal.elapsed} ms. Nothing has been saved yet.`,
  );
  panel.append(intro);

  const kept = t("già configurato", "already configured");
  panel.append(
    countRow("🔗", t("Collegamenti alle entità", "Entity links"), proposal.assignments.length),
    countRow("💡", t("Luci", "Lights"), proposal.lightCount, proposal.skipped.lights ? kept : ""),
    countRow("🌡️", t("Stanze", "Rooms"), proposal.rooms.length, proposal.skipped.rooms ? kept : ""),
    countRow("❄️", t("Unità clima", "Climate units"), proposal.climate.length, proposal.skipped.climate ? kept : ""),
    countRow("📹", t("Telecamere", "Cameras"), proposal.cameras.length, proposal.skipped.cameras ? kept : ""),
    countRow("🔔", t("Entità nei gruppi avvisi", "Entities in alert groups"), proposal.groupCount),
  );

  if (proposal.assignments.length) {
    const list = doc.createElement("div");
    list.className = "dm-ad-list";
    for (const item of proposal.assignments.slice(0, 12)) {
      const row = doc.createElement("div");
      row.className = "dm-ad-link";
      const label = doc.createElement("b");
      label.textContent = item.label;
      const id = doc.createElement("span");
      id.className = "mono";
      id.textContent = item.id;
      row.append(label, id);
      list.append(row);
    }
    if (proposal.assignments.length > 12) {
      const more = doc.createElement("div");
      more.className = "dm-ad-more";
      more.textContent = t(
        `… e altri ${proposal.assignments.length - 12} collegamenti.`,
        `… and ${proposal.assignments.length - 12} more links.`,
      );
      list.append(more);
    }
    panel.append(list);
  }

  if (proposal.undecided.length) {
    const note = doc.createElement("div");
    note.className = "dm-ad-note";
    /* Being told what was left alone is the difference between a configuration
     * you can trust and one you have to re-read field by field. */
    note.textContent = t(
      `${proposal.undecided.length} campi hanno due candidati altrettanto probabili: li lascio a te, nelle altre schede.`,
      `${proposal.undecided.length} fields have two equally likely candidates: those are left for you, in the other tabs.`,
    );
    panel.append(note);
  }

  const actions = doc.createElement("div");
  actions.className = "dm-ad-actions";
  const apply = doc.createElement("button");
  apply.type = "button";
  apply.className = "ed-btn-add dm-ad-apply";
  apply.textContent = t("✅ Applica e ricarica", "✅ Apply and reload");
  apply.addEventListener("click", () => applyProposal(proposal));
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.className = "ed-btn-add dm-ad-cancel";
  cancel.textContent = t("Annulla", "Cancel");
  cancel.addEventListener("click", () => {
    state.proposal = null;
    const node = outlet();
    if (node) node.textContent = "";
  });
  actions.append(apply, cancel);
  panel.append(actions);
  target.append(panel);
}

/* ── Home Assistant data ──────────────────────────────────────────────────── */

/* `cdRegEnrich` already fetches the floor, area, entity and device registries
 * through whichever transport the page has — the bridge when hosted, a token
 * socket when standalone — and hands them to `cdRegApply`. Borrowing that call
 * gives the detector real areas without a second implementation of the same
 * fetch.
 *
 * What it must not do here is let `cdRegApply` run: applying it creates a room
 * for every Home Assistant area, and the detector would then find the rooms
 * already configured and propose none. The runtime applies the registries after
 * detection, and so does this section — through the same `cdRegEnrich` call,
 * once the proposal has been accepted. */
function loadRegistries(callback) {
  const apply = root.cdRegApply;
  if (typeof root.cdRegEnrich !== "function" || typeof apply !== "function") {
    callback(null);
    return;
  }
  let captured = null;
  let done = false;
  const capture = function capturedRegApply(payload) {
    captured = payload;
    return null;
  };
  const finish = () => {
    if (done) return;
    done = true;
    if (root.cdRegApply === capture) root.cdRegApply = apply;
    callback(captured);
  };
  root.cdRegApply = capture;
  try {
    root.cdRegEnrich(finish);
  } catch (_error) {
    finish();
  }
  root.setTimeout?.(finish, WAIT_LIMIT);
}

export function areaLookup(registries) {
  const areaName = new Map();
  for (const area of registries?.areas || []) areaName.set(area.area_id, clean(area.name));
  const deviceArea = new Map();
  for (const device of registries?.devs || []) if (device.area_id) deviceArea.set(device.id, device.area_id);
  const entityArea = new Map();
  for (const entity of registries?.ents || []) {
    const areaId = entity.area_id || deviceArea.get(entity.device_id);
    const name = areaId ? areaName.get(areaId) : "";
    if (name) entityArea.set(entity.entity_id, name);
  }
  /* The wizard may already hold the same three registries in its own shape. */
  const wiz = lexicalGlobal("WIZ");
  if (!entityArea.size && wiz?.entReg) {
    for (const [id, registry] of Object.entries(wiz.entReg)) {
      const areaId = registry?.a || (registry?.d && wiz.devArea?.[registry.d]) || "";
      const name = areaId ? clean(wiz.areaNames?.[areaId]) : "";
      if (name) entityArea.set(id, name);
    }
  }
  return entityArea;
}

function waitForMeta(callback) {
  const started = Date.now();
  const tick = () => {
    const meta = lexicalGlobal("WIZ")?.allMeta;
    if (Array.isArray(meta) && meta.length) {
      callback(meta);
      return;
    }
    if (Date.now() - started >= WAIT_LIMIT) {
      callback(null);
      return;
    }
    root.setTimeout?.(tick, WAIT_STEP);
  };
  tick();
}

/* `wzLoadAllEntities` reads its connection details from the wizard's own state,
 * which the runtime only fills when the wizard is opened. The vendored button
 * opens it and throws the markup away for exactly this reason, so the override
 * does the same rather than sending an unauthenticated socket. */
function primeWizard() {
  try {
    root.apriSetupWizard?.();
    doc?.getElementById("setup-wizard")?.remove();
  } catch (_error) {}
}

/* Hosted in Home Assistant, the panel already holds every state with its
 * attributes, so the detector can start without a round trip. Standalone, the
 * runtime's own loader is asked for the full list and polled at a rate that
 * notices it arriving, instead of every half second. */
function loadEntities(callback) {
  const live = allStates();
  if (Object.keys(live).length >= HOSTED_ENOUGH) {
    callback(live, null);
    return;
  }
  const meta = lexicalGlobal("WIZ")?.allMeta;
  if (Array.isArray(meta) && meta.length) {
    callback(live, meta);
    return;
  }
  primeWizard();
  try {
    root.wzLoadAllEntities?.();
  } catch (_error) {}
  waitForMeta((loaded) => callback(allStates(), loaded));
}

function buildIndex(live, meta, entityArea) {
  const entries = [];
  const seen = new Set();
  for (const entry of meta || []) {
    const id = clean(entry?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push(entry);
  }
  for (const [id, snapshot] of Object.entries(live || {})) {
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, ...snapshot, entity_id: id });
  }
  const enrich = (id, entry) => {
    const current = live?.[id];
    const area = entityArea.get(id) || entry?.area || "";
    if (!current) return area ? { area } : null;
    return {
      dc: current.attributes?.device_class || entry?.dc || "",
      unit: current.attributes?.unit_of_measurement || entry?.unit || "",
      sc: current.attributes?.state_class || entry?.sc || "",
      state: current.state,
      area,
    };
  };
  return buildEntityIndex(entries, { enrich, version: `autodetect|${entityArea.size}` });
}

/* ── Detection ────────────────────────────────────────────────────────────── */

function slotPlans() {
  const sections = lexicalGlobal("CD_SLOTS");
  if (!sections || typeof sections !== "object") return [];
  const plans = [];
  for (const [key, section] of Object.entries(sections)) {
    for (const slot of section?.slots || []) plans.push(parseSlotPlan(slot, key));
  }
  return plans;
}

function currentOverrides() {
  const stored = readJson("cd_entity_overrides", {});
  const lexical = lexicalGlobal("ENTITY_OVERRIDES");
  return { ...(lexical && typeof lexical === "object" ? lexical : {}), ...(stored || {}) };
}

function buildProposal(index, elapsedStart) {
  const overrides = currentOverrides();
  const configured = new Set(Object.values(overrides).filter((value) => clean(value).includes(".")));
  const plans = slotPlans().filter((plan) => !clean(overrides[plan.ref]));
  const postings = buildPostings(index.records);
  const slots = detectSlots(index.records, plans, { taken: configured, postings });
  const categories = detectCategories(index.records);

  const lights = readJson("cd_luci", {}) || {};
  const rooms = readJson("cd_stanze", []) || [];
  const climate = readJson("cd_clima_units", []) || [];
  const cameras = readJson("cd_cameras", []) || [];
  const skipped = {
    lights: Object.keys(lights).length > 0,
    rooms: Array.isArray(rooms) && rooms.length > 0,
    climate: Array.isArray(climate) && climate.length > 0,
    cameras: Array.isArray(cameras) && cameras.length > 0,
  };

  const groups = {};
  const existingGroups = readJson("cd_gruppi_extra", {}) || {};
  let groupCount = 0;
  for (const [name, ids] of Object.entries(categories.groups)) {
    if (Array.isArray(existingGroups[name]) && existingGroups[name].length) continue;
    if (!ids.length) continue;
    groups[name] = ids;
    groupCount += ids.length;
  }

  return {
    entities: index.size,
    elapsed: Math.max(1, Math.round(Date.now() - elapsedStart)),
    assignments: slots.assignments,
    undecided: slots.undecided,
    lights: skipped.lights ? {} : categories.lights,
    lightCount: skipped.lights ? Object.keys(lights).length : Object.keys(categories.lights).length,
    rooms: skipped.rooms ? [] : categories.rooms,
    climate: skipped.climate ? [] : categories.climate,
    cameras: skipped.cameras ? [] : categories.cameras,
    groups,
    groupCount,
    skipped,
  };
}

/* ── Applying ─────────────────────────────────────────────────────────────── */

/* In schema 4 the Energy slots are not owned by `cd_entity_overrides` at all:
 * the canonical `energy` section owns them, and the store projects it back over
 * the overrides — deleting any `dm.energy_*` entry the model does not contain.
 * Writing an Energy detection the way the runtime always did therefore lands a
 * value that the next projection removes, which is why auto-detected Energy
 * links did not survive. These go into the model instead, and the projection
 * puts them back into the overrides itself. */
const ENERGY_SLOT_PATHS = new Map(
  Object.entries(ENERGY_SLOT_MAP).map(([path, slot]) => [slot, path.split(".")]),
);

async function writeEnergyAssignments(assignments) {
  const energy = assignments.filter((item) => ENERGY_SLOT_PATHS.has(item.ref));
  if (!energy.length) return assignments;
  const store = dashboardStore();
  const rest = assignments.filter((item) => !ENERGY_SLOT_PATHS.has(item.ref));
  const salvato = store?.getSection
    ? { ...(store.getSection("energy") || {}) }
    : readJson("cd_energy_model", {}) || {};
  /* Quello che si riconosce va nell'impianto aperto.
   *
   * Scriveva sempre al primo livello, cioe' nella prima casa: con la seconda
   * davanti agli occhi, i sensori riconosciuti finivano sull'altra e la
   * maschera restava vuota. */
  const model = scriviNellImpianto(salvato, impiantoScelto(), (bersaglio) => {
    for (const item of energy) {
      const [group, key] = ENERGY_SLOT_PATHS.get(item.ref);
      bersaglio[group] = { ...(bersaglio[group] || {}) };
      if (!clean(bersaglio[group][key])) bersaglio[group][key] = item.id;
    }
  });
  model.metadata = { ...(model.metadata || {}), semantics_version: keptSemanticsVersion(model.metadata) };
  if (store?.replaceSection) await store.replaceSection("energy", model);
  else writeJson("cd_energy_model", model);
  return rest;
}

function writeJson(key, value) {
  try {
    root.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
}

export async function applyProposal(proposal) {
  const target = outlet();
  if (target) {
    target.innerHTML = '<div class="ed-intro dm-ad-saving"></div>';
    const line = target.querySelector(".dm-ad-saving");
    if (line) line.textContent = t("💾 Salvo e ricarico…", "💾 Saving and reloading…");
  }
  if (Object.keys(proposal.lights).length) writeJson("cd_luci", proposal.lights);
  if (proposal.rooms.length) writeJson("cd_stanze", proposal.rooms);
  if (proposal.climate.length) writeJson("cd_clima_units", proposal.climate);
  if (proposal.cameras.length) writeJson("cd_cameras", proposal.cameras);
  if (proposal.assignments.length) {
    const rest = await writeEnergyAssignments(proposal.assignments);
    if (rest.length) {
      const overrides = readJson("cd_entity_overrides", {}) || {};
      for (const item of rest) overrides[item.ref] = item.id;
      writeJson("cd_entity_overrides", overrides);
    }
  }
  if (Object.keys(proposal.groups).length) {
    const groups = readJson("cd_gruppi_extra", {}) || {};
    for (const [name, ids] of Object.entries(proposal.groups)) groups[name] = ids;
    writeJson("cd_gruppi_extra", groups);
  }
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
  const reload = () => root.setTimeout?.(() => reloadDashboard(), 400);
  try {
    if (typeof root.cdRegEnrich === "function") root.cdRegEnrich(reload);
    else reload();
  } catch (_error) {
    reload();
  }
}

/* ── Entry point ──────────────────────────────────────────────────────────── */

function run() {
  if (state.running) return;
  state.running = true;
  const started = Date.now();
  progress(1, 3, t("Leggo aree ed entità da Home Assistant…", "Reading areas and entities from Home Assistant…"));

  /* The two reads are independent sockets and were waited on one after the
   * other, so a slow answer to the first was paid on top of the second. */
  let pending = 2;
  let entityArea = new Map();
  let live = null;
  let meta = null;
  const ready = () => {
    if ((pending -= 1) > 0) return;
    const index = buildIndex(live, meta, entityArea);
    if (!index.size) {
      state.running = false;
      failure(
        t(
          "Non riesco a leggere le entità da Home Assistant. Controlla la connessione e riprova.",
          "I cannot read the entities from Home Assistant. Check the connection and try again.",
        ),
      );
      return;
    }
    progress(2, 3, t(`Analizzo ${index.size} entità…`, `Analysing ${index.size} entities…`));
    /* One frame between the message and the work, so the progress the user is
     * reading is the progress that is actually happening. */
    root.setTimeout?.(() => {
      try {
        const proposal = buildProposal(index, started);
        state.proposal = proposal;
        progress(3, 3, t("Fatto", "Done"));
        renderSummary(proposal);
      } catch (error) {
        failure(String(error?.message || error));
      } finally {
        state.running = false;
      }
    }, 0);
  };

  loadRegistries((registries) => {
    entityArea = areaLookup(registries);
    ready();
  });
  loadEntities((states, loaded) => {
    live = states;
    meta = loaded;
    ready();
  });
}

function installStyles() {
  installStyle(
    "dm-entity-autodetect-style",
    `
    #ed-rileva-out .dm-ad-progress{margin-top:10px}
    #ed-rileva-out .dm-ad-bar{height:8px;border-radius:999px;background:rgba(148,163,184,.22);overflow:hidden}
    #ed-rileva-out .dm-ad-bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(135deg,#38bdf8,#0369a1);transition:width .25s ease}
    #ed-rileva-out .dm-ad-step{margin-top:6px;color:var(--text-dim,#64748b);font-size:12px;font-weight:700}
    #ed-rileva-out .dm-ad-error{color:#b91c1c;font-weight:700}
    #ed-rileva-out .dm-ad-summary{margin-top:12px;padding:14px;border:1px solid rgba(148,163,184,.24);border-radius:18px;background:rgba(248,250,252,.75)}
    #ed-rileva-out .dm-ad-title{font-size:15px;font-weight:900;color:var(--text,#0f172a)}
    #ed-rileva-out .dm-ad-intro{margin:4px 0 10px;color:var(--text-dim,#64748b);font-size:11.5px;font-weight:700}
    #ed-rileva-out .dm-ad-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid rgba(148,163,184,.16);font-size:13px}
    #ed-rileva-out .dm-ad-row:last-of-type{border-bottom:0}
    #ed-rileva-out .dm-ad-row-label{font-weight:700;color:var(--text,#0f172a)}
    #ed-rileva-out .dm-ad-row-value{min-width:34px;padding:2px 10px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:900;text-align:center}
    #ed-rileva-out .dm-ad-row-value.is-empty{background:rgba(148,163,184,.16);color:var(--text-dim,#64748b)}
    #ed-rileva-out .dm-ad-list{margin-top:10px;display:flex;flex-direction:column;gap:5px;max-height:220px;overflow:auto}
    #ed-rileva-out .dm-ad-link{display:flex;flex-direction:column;gap:1px;padding:7px 10px;border-radius:11px;background:rgba(255,255,255,.85);font-size:12px}
    #ed-rileva-out .dm-ad-link .mono{color:var(--text-dim,#64748b);font-family:monospace;font-size:10.5px}
    #ed-rileva-out .dm-ad-more,#ed-rileva-out .dm-ad-note{margin-top:8px;color:var(--text-dim,#64748b);font-size:11.5px;font-weight:700}
    #ed-rileva-out .dm-ad-actions{display:flex;gap:8px;margin-top:14px}
    #ed-rileva-out .dm-ad-actions .ed-btn-add{flex:1}
    #ed-rileva-out .dm-ad-cancel{background:rgba(148,163,184,.28)!important;color:var(--text,#0f172a)!important}
  `,
  );
}

function installOverride() {
  const legacy = root.edAutoRileva;
  if (typeof legacy === "function" && legacy.__dmFastAutodetect) return false;
  const fast = function edAutoRileva() {
    try {
      installStyles();
      run();
      return;
    } catch (_error) {}
    try {
      legacy?.call(this);
    } catch (_ignore) {}
  };
  fast.__dmFastAutodetect = true;
  fast.__dmPrevious = legacy;
  root.edAutoRileva = fast;
  return true;
}

export function installEntityAutodetectSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  installOverride();
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(event, installOverride);
  }
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("#editor-modal,.ed-tab,#ed-body")) installOverride();
  }, true);
  return true;
}

installEntityAutodetectSection();
