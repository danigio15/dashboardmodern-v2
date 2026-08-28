/* DM-FIX-20260815D
 * Beta 22 corrective owner:
 * - the existing canonical Loads editor owns the five flow bubbles below Home;
 * - the temporary energyLoads editor/runtime introduced in beta.22 is suppressed;
 * - unconfigured load bubbles/connectors are hidden in instant/day/month views;
 * - battery SOC uses energy.battery.soc in the instant flow;
 * - Temperature configured rows keep the canonical room name visible;
 * - Energy settings keep import/export price controls visible and labelled.
 *
 * Event driven only: no setInterval and no document-wide MutationObserver.
 */

import { t } from "./shared.js";
import { intlLocale } from "../core/i18n.js";
import { IMPIANTO_SCELTO_KEY, plantAt, plantLoads } from "../core/energy-plants.js";

const root = globalThis;
const doc = root.document;
const SLOT_KEYS = Object.freeze(["boiler", "wb", "clima", "lav", "cuc"]);
const SECTION_STORAGE = Object.freeze({ loads: "cd_loads", energy: "cd_energy_model" });
const MARKER = "__DASHBOARDMODERN_BETA22_LOAD_SLOTS_HOTFIX__";

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const escapeHtml = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function store() {
  return root.DashboardModernModules?.store || null;
}

function readSection(name, fallback) {
  try {
    const holder = store();
    const value = holder?.peekSection ? holder.peekSection(name) : holder?.getSection?.(name);
    if (value !== undefined && value !== null) return value;
  } catch (_error) {}
  try {
    return JSON.parse(root.localStorage?.getItem?.(SECTION_STORAGE[name]) || "null") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function states() {
  const values = {
    ...(root.__HASS__?.states || {}),
    ...(root.hass?.states || {}),
  };
  for (const name of ["_RAW_STATES", "STATES"]) {
    let lexical = null;
    try {
      lexical = root.eval?.(`typeof ${name} !== "undefined" && ${name} ? ${name} : null`);
    } catch (_error) {}
    if (lexical && typeof lexical === "object") {
      Object.assign(values, lexical);
      continue;
    }
    if (root[name] && typeof root[name] === "object") Object.assign(values, root[name]);
  }
  return values;
}

/* I carichi dell'impianto scelto. Con un impianto solo — chi non ne ha mai
 * chiesto un secondo — passa tutto, esattamente come prima. */
function carichiDellImpianto(loads = []) {
  let scelto = "";
  try {
    scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  } catch (_error) {
    scelto = "";
  }
  const { plant, index } = plantAt(readSection("energy", {}) || {}, scelto);
  return plant ? plantLoads(loads, plant, index) : loads;
}

export function configuredFlowLoads(loads = []) {
  return (Array.isArray(loads) ? loads : [])
    .filter(
      (item) =>
        item &&
        item.category !== "manual-report" &&
        item.show_in_dashboard !== false &&
        (clean(item.name) ||
          clean(item.power_entity) ||
          clean(item.daily_energy_entity) ||
          clean(item.monthly_energy_entity) ||
          clean(item.total_energy_entity) ||
          clean(item.history_entity)),
    )
    .slice()
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0))
    .slice(0, SLOT_KEYS.length);
}

export function loadPeriodEntity(load = {}, period = "instant") {
  if (period === "day") return clean(load.daily_energy_entity);
  if (period === "month")
    return clean(load.monthly_energy_entity || load.history_entity || load.total_energy_entity);
  return clean(load.power_entity);
}

export function socEntity(energy = {}) {
  return clean(
    energy?.battery?.soc ||
      energy?.battery?.battery_soc_entity ||
      energy?.battery?.battery_soc,
  );
}

function stateNumber(entity) {
  if (!entity) return null;
  const source = states()?.[entity];
  return finite(source?.state ?? source);
}

function formatValue(value, period) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  const tag = intlLocale();
  const digits = period === "instant" ? 0 : 1;
  return `${new Intl.NumberFormat(tag, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value))} ${period === "instant" ? "W" : "kWh"}`;
}

const flowState = (root[MARKER] ||= {
  installed: false,
  frame: 0,
  timer: 0,
  bundle: null,
  storeBound: false,
  wrappersBound: false,
});

function periodDeviceValue(load, period) {
  if (period !== "month") return stateNumber(loadPeriodEntity(load, period));
  const bundle = flowState.bundle;
  const devices = bundle?.deviceMonth?.devices || [];
  const values = bundle?.deviceMonth?.values;
  if (values?.get) {
    const device = devices.find(
      (item) =>
        clean(item.id) === clean(load.id) ||
        clean(item.key) === clean(load.id) ||
        clean(item.name) === clean(load.name),
    );
    const source = clean(device?.history || device?.entity);
    if (source) {
      const value = finite(values.get(source));
      if (value !== null) return value;
    }
  }
  return stateNumber(loadPeriodEntity(load, period));
}

function viewConfig(period) {
  if (period === "day") return { id: "view-day", suffix: "-day" };
  if (period === "month") return { id: "view-month", suffix: "-month" };
  return { id: "view-ist", suffix: "" };
}

function slotNode(scope, slot, suffix, index) {
  return (
    scope?.querySelector?.(`#n-${slot}${suffix}`) ||
    scope?.querySelector?.(`#n-${slot}`) ||
    [...(scope?.querySelectorAll?.(".node.n-load") || [])][index] ||
    null
  );
}

function valueNode(scope, slot, period, node) {
  const id =
    period === "instant" ? `v-${slot}-p` : period === "day" ? `v-${slot}-day` : `v-${slot}-month`;
  return (
    scope?.querySelector?.(`#${id}`) ||
    node?.querySelector?.(".node-value,[data-node-value],.n-value") ||
    null
  );
}

function setVisible(node, visible) {
  if (!node) return;
  node.hidden = !visible;
  if (visible) {
    node.style.removeProperty("display");
    node.style.setProperty("visibility", "visible", "important");
    node.style.setProperty("opacity", "1", "important");
  } else {
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
  }
}

function setConnector(scope, slot, suffix, visible, loadId = "") {
  for (const id of [`line-home-${slot}${suffix}`, `m-line-home-${slot}${suffix}`]) {
    const line = scope?.querySelector?.(`#${id}`) || doc?.getElementById?.(id);
    if (!line) continue;
    line.hidden = !visible;
    if (visible) {
      line.style.setProperty("display", "inline", "important");
      line.style.setProperty("visibility", "visible", "important");
      line.dataset.dmCanonicalLoad = loadId;
    } else {
      line.style.setProperty("display", "none", "important");
      line.style.setProperty("visibility", "hidden", "important");
      delete line.dataset.dmCanonicalLoad;
    }
  }
}

function writeLoadNode(node, load, period, value) {
  if (!node || !load) return;
  const name = clean(load.name) || (t("Carico", "Load"));
  const icon = clean(load.emoji_icon || load.icon || "🔌");
  const label = node.querySelector?.(".node-label,.n-label,[data-node-label]");
  const iconNode = node.querySelector?.(".node-icon,.n-icon,[data-node-icon]");
  if (label) label.textContent = name;
  if (iconNode) {
    if (/^mdi:/i.test(icon) && typeof root.cdIconMarkup === "function")
      iconNode.innerHTML = root.cdIconMarkup(icon, 28);
    else iconNode.textContent = icon;
  }
  const valueTarget = valueNode(node.closest?.("#view-ist,#view-day,#view-month") || doc, node.dataset.dmFlowSlot || "", period, node);
  if (valueTarget) valueTarget.textContent = formatValue(value, period);
  node.dataset.dmCanonicalLoad = clean(load.id) || name;
  node.dataset.dmCanonicalLoadPeriod = period;
}

/* Beta 30 renders one computed bubble per configured Load and owns the whole
 * stage topology. When it is installed this corrective stands down instead of
 * re-showing the five fixed circles underneath it; the SOC, Temperature and
 * Energy-cost repairs below are untouched and still run. */
function dynamicFlowOwnerInstalled() {
  return root.__DM_20260817A__ === true;
}

function syncCanonicalLoadBubbles() {
  if (!doc || dynamicFlowOwnerInstalled()) return false;
  /* Anche il giro storico mostra un impianto per volta.
   *
   * Questo e' il disegno di ripiego — quello vero lo fa `energy-flow-section`,
   * e quando c'e' lui qui non si entra nemmeno. Ma dove non c'e' (una
   * plancia che non ha ancora ricaricato i moduli) i cerchi li fa questo, e
   * senza il filtro mostrerebbe i carichi di tutte e due le case insieme. */
  const loads = configuredFlowLoads(carichiDellImpianto(readSection("loads", [])));
  for (const period of ["instant", "day", "month"]) {
    const { id, suffix } = viewConfig(period);
    const scope = doc.getElementById(id);
    if (!scope) continue;
    const fallbackNodes = [...scope.querySelectorAll(".node.n-load")];
    SLOT_KEYS.forEach((slot, index) => {
      const node = slotNode(scope, slot, suffix, index);
      const load = loads[index] || null;
      if (!node) return;
      node.dataset.dmFlowSlot = slot;
      setVisible(node, Boolean(load));
      setConnector(scope, slot, suffix, Boolean(load), clean(load?.id));
      if (!load) return;
      const value = periodDeviceValue(load, period);
      const label = node.querySelector?.(".node-label,.n-label,[data-node-label]");
      const iconNode = node.querySelector?.(".node-icon,.n-icon,[data-node-icon]");
      if (label) label.textContent = clean(load.name) || "Carico";
      const icon = clean(load.emoji_icon || load.icon || "🔌");
      if (iconNode) {
        if (/^mdi:/i.test(icon) && typeof root.cdIconMarkup === "function")
          iconNode.innerHTML = root.cdIconMarkup(icon, 28);
        else iconNode.textContent = icon;
      }
      const target = valueNode(scope, slot, period, node);
      if (target) target.textContent = formatValue(value, period);
      node.dataset.dmCanonicalLoad = clean(load.id) || clean(load.name);
      node.dataset.dmCanonicalLoadPeriod = period;
    });
    // Any extra legacy/dynamic load nodes must not survive when canonical Loads
    // contains fewer entries than the fixed five-slot topology.
    fallbackNodes.slice(SLOT_KEYS.length).forEach((node) => setVisible(node, false));
    scope.dataset.dmCanonicalLoadCount = String(loads.length);
  }
  return true;
}

function syncBatterySoc() {
  if (!doc) return false;
  const energy = readSection("energy", {});
  const entity = socEntity(energy);
  const battery = doc.querySelector("#view-ist #n-battery,#n-battery");
  if (!battery) return false;
  let node = battery.querySelector("#v-battery-soc,.dm-battery-soc");
  if (!node) {
    node = doc.createElement("small");
    node.id = "v-battery-soc";
    node.className = "dm-battery-soc";
    battery.append(node);
  }
  if (!entity) {
    node.hidden = true;
    node.textContent = "";
    node.removeAttribute("data-entity");
    return true;
  }
  const value = stateNumber(entity);
  node.hidden = false;
  node.dataset.entity = entity;
  node.textContent = value === null ? "SOC —" : `SOC ${Math.round(value)}%`;
  return true;
}

function canonicalRoomName(row) {
  const id = clean(row?.dataset?.roomId);
  const rooms = readSection("rooms", []);
  const room = Array.isArray(rooms)
    ? rooms.find((item) => clean(item.id) === id || clean(item.room_id) === id)
    : null;
  return (
    clean(room?.name) ||
    clean(row?.dataset?.roomName) ||
    clean(row?.querySelector?.(".ed-row-new")?.textContent) ||
    (t("Stanza", "Room"))
  );
}

function repairTemperatureRows() {
  if (!doc) return false;
  const rows = doc.querySelectorAll(
    "#editor-modal [data-temperature-room],#ed-body [data-temperature-room]",
  );
  rows.forEach((row) => {
    let main = row.querySelector(".ed-row-main");
    if (!main) {
      main = doc.createElement("div");
      main.className = "ed-row-main";
      const icon = row.querySelector(".dm-temperature-card-icon,.ed-row-icon");
      if (icon) icon.after(main);
      else row.prepend(main);
    }
    let name = main.querySelector(".ed-row-new");
    if (!name) {
      name = doc.createElement("div");
      name.className = "ed-row-new";
      main.prepend(name);
    }
    const label = canonicalRoomName(row);
    name.textContent = label;
    row.dataset.roomName = label;
    row.dataset.dmTemperatureNameVisible = "true";
  });
  return rows.length > 0;
}

function configuredRate(key) {
  const value = root.cdCfg?.(key);
  if (value !== undefined && value !== null && value !== "") return clean(value);
  return clean(root.localStorage?.getItem?.(key));
}

function repairEnergyCostEditor() {
  if (!doc) return false;
  const editor = doc.querySelector('#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]');
  const settings = editor?.querySelector?.('[data-energy-panel="settings"]');
  if (!settings) return false;
  let card = settings.querySelector(".dm-energy-cost-card");
  if (!card) {
    card = doc.createElement("div");
    card.className = "ed-form dm-energy-cost-card";
    settings.append(card);
  }
  if (card.dataset.dmCostOwner === "beta22-hotfix") return true;
  const buy = configuredRate("cd_costo_kwh");
  const sell = configuredRate("cd_prezzo_immissione");
  card.dataset.dmCostOwner = "beta22-hotfix";
  card.innerHTML = `
    <div class="ed-sec-title">💶 ${t("Costo energia", "Energy cost")}</div>
    <div class="ed-hint">${t("Tariffe usate dal Report Energia.", "Rates used by the Energy Report.")}</div>
    <div class="dm-energy-cost-grid">
      <label class="dm-energy-cost-field"><span>${t("Energia acquistata", "Purchased energy")} <small>€/kWh</small></span><input id="ed-costo-kwh" class="ed-input" type="number" inputmode="decimal" step="0.001" min="0" value="${escapeHtml(buy)}" placeholder="0,000"></label>
      <label class="dm-energy-cost-field"><span>${t("Energia venduta", "Sold energy")} <small>€/kWh</small></span><input id="ed-prezzo-imm" class="ed-input" type="number" inputmode="decimal" step="0.001" min="0" value="${escapeHtml(sell)}" placeholder="0,000"></label>
    </div>
    <button type="button" class="ed-save-btn" data-dm-save-energy-costs>💾 ${t("Salva costi", "Save costs")}</button>`;
  card.querySelector("[data-dm-save-energy-costs]")?.addEventListener("click", () => {
    if (typeof root.edSaveCosti === "function") {
      root.edSaveCosti();
      return;
    }
    const importValue = clean(card.querySelector("#ed-costo-kwh")?.value);
    const exportValue = clean(card.querySelector("#ed-prezzo-imm")?.value);
    root.localStorage?.setItem?.("cd_costo_kwh", importValue);
    root.localStorage?.setItem?.("cd_prezzo_immissione", exportValue);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  });
  return true;
}

/* La scheda di configurazione c'e' o non c'e'.
 *
 * Non si nasconde: il runtime la crea quando si apre e la toglie dal documento
 * quando si chiude. Quindi cercarla e' la domanda giusta, e le due riparazioni
 * qui sotto — che parlano solo di quello che sta dentro la scheda — non hanno
 * niente da fare finche' la risposta e' no. Prima ci passavano lo stesso, a
 * ogni giro di stati: due giri completi del documento per non trovare mai
 * nulla, piu' volte al secondo. */
function schedaAperta() {
  return Boolean(doc?.getElementById?.("editor-modal") || doc?.getElementById?.("ed-body"));
}

function applyAll() {
  flowState.frame = 0;
  syncCanonicalLoadBubbles();
  syncBatterySoc();
  if (!schedaAperta()) return;
  repairTemperatureRows();
  repairEnergyCostEditor();
}

function schedule(delay = 0) {
  if (!doc) return;
  if (delay > 0) {
    root.setTimeout?.(() => schedule(), delay);
    return;
  }
  if (flowState.frame) return;
  flowState.frame = root.requestAnimationFrame?.(applyAll) || root.setTimeout?.(applyAll, 0);
}

function scheduleSettled() {
  schedule();
  schedule(90);
}

function wrapAfter(name) {
  const current = root[name];
  const marker = `__dmBeta22LoadSlots_${name}`;
  if (typeof current !== "function" || current[marker]) return false;
  const wrapped = function (...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") result.finally(scheduleSettled);
    else scheduleSettled();
    return result;
  };
  wrapped[marker] = true;
  wrapped.__dmWrappedOriginal = current;
  root[name] = wrapped;
  return true;
}

function installWrappers() {
  for (const name of [
    "dmRefreshEnergyFlows",
    "renderEnergyDashboard",
    "renderEnergyDay",
    "renderEnergyMonth",
    "switchEnergyView",
    "render",
    "editorSwitch",
  ])
    wrapAfter(name);
}

function bindStore() {
  if (flowState.storeBound) return;
  const currentStore = store();
  if (!currentStore?.subscribe) return;
  flowState.storeBound = true;
  currentStore.subscribe((change) => {
    if (["loads", "energy", "rooms"].includes(change?.section)) scheduleSettled();
  });
}

function rebindAndSchedule() {
  installWrappers();
  bindStore();
  scheduleSettled();
}

function installStyle() {
  if (!doc || doc.getElementById("dm-beta22-load-slots-hotfix-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-beta22-load-slots-hotfix-style";
  style.textContent = `
    #editor-modal [data-temperature-room],#ed-body [data-temperature-room]{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto auto!important;align-items:center!important;column-gap:12px!important}
    #editor-modal [data-temperature-room] .ed-row-main,#ed-body [data-temperature-room] .ed-row-main{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;width:auto!important;max-width:none!important;opacity:1!important;visibility:visible!important;overflow:visible!important}
    #editor-modal [data-temperature-room] .ed-row-new,#ed-body [data-temperature-room] .ed-row-new{display:block!important;position:static!important;width:auto!important;max-width:100%!important;min-width:0!important;height:auto!important;opacity:1!important;visibility:visible!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:var(--text,#0f172a)!important;font-weight:800!important;font-size:16px!important;line-height:1.25!important}
    #editor-modal [data-temperature-room] .ed-row-old,#ed-body [data-temperature-room] .ed-row-old{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:var(--muted,#64748b)!important}
    .dm-energy-cost-card{display:block!important;visibility:visible!important;opacity:1!important}
    .dm-energy-cost-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:12px!important;margin:12px 0!important}
    .dm-energy-cost-field{display:grid!important;gap:7px!important;min-width:0!important;color:var(--text,#0f172a)!important;font-weight:700!important}
    .dm-energy-cost-field .ed-input{display:block!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:48px!important;padding:10px 12px!important;color:var(--text,#0f172a)!important;background:var(--card-bg,#fff)!important;border:1px solid var(--border,rgba(15,23,42,.14))!important;border-radius:14px!important;font-size:16px!important}
    .dm-battery-soc{display:block;margin-top:3px;font-size:12px;font-weight:800;line-height:1.15;color:var(--success-color,#16a34a)}
    .dm-battery-soc[hidden]{display:none!important}
    @media(max-width:640px){.dm-energy-cost-grid{grid-template-columns:1fr!important}}
  `;
  doc.head?.append(style);
}

function install() {
  if (!doc || flowState.installed) return;
  flowState.installed = true;
  installStyle();
  installWrappers();
  bindStore();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:energy-stable",
    "dashboardmodern:energy-bundle",
    "dashboardmodern:temperature-editor-rendered",
  ])
    root.addEventListener?.(eventName, rebindAndSchedule);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    flowState.bundle = event?.detail || null;
    rebindAndSchedule();
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(
          "[data-energy-tab],.energy-tab,.sub-tab-btn,.ed-inner-tab,[data-temperature-edit],[data-tab='sez1'],[data-tab='sez7']",
        )
      )
        rebindAndSchedule();
    },
    true,
  );
  scheduleSettled();
  root.setTimeout?.(rebindAndSchedule, 250);
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();

export const beta22LoadSlotsHotfix = Object.freeze({
  configuredFlowLoads,
  loadPeriodEntity,
  socEntity,
  sync: () => {
    rebindAndSchedule();
    return true;
  },
});
