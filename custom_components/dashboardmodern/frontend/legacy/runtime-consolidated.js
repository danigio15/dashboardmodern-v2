/* DashboardModern 0.15.2 — single production runtime owner. */
import { HomeAssistantBroker, sourcePlans } from "../src/core/period-service.js";

const KEY = "__DASHBOARDMODERN_RUNTIME_ROOT__";
const VERSION = "0.15.2";
const broker = new HomeAssistantBroker();
const root = globalThis;
const doc = root.document;

const state = (root[KEY] ||= {
  installed: true,
  version: VERSION,
  ready: false,
  generation: 0,
  bundle: null,
  selected: null,
  refreshTimer: 0,
  lastRefreshAt: 0,
  wrappers: new Set(),
  storeUnsubscribe: null,
  brokerStarted: false,
});

const clean = (value) => String(value ?? "").trim();
const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const esc = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const locale = () => (doc?.documentElement?.lang === "en" ? "en-US" : "it-IT");
const format = (value, digits = 1) =>
  finite(value).toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const text = (it, en) => (doc?.documentElement?.lang === "en" ? en : it);

function readJson(key, fallback) {
  try {
    const value = JSON.parse(root.localStorage?.getItem(key) || "");
    return value ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeJson(key, value) {
  root.localStorage?.setItem(key, JSON.stringify(value));
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
}

function dashboardStore() {
  return root.DashboardModernModules?.store || null;
}

function section(name, fallback) {
  try {
    return dashboardStore()?.getSection?.(name) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function allStates() {
  return { ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
}

function entityOverrides() {
  const fromStore = section("entityOverrides", null);
  if (fromStore && typeof fromStore === "object") return fromStore;
  return readJson("cd_entity_overrides", root.ENTITY_OVERRIDES || {});
}

function selectedPeriod() {
  const now = new Date();
  const month = Number(doc?.getElementById("ed-sel-month")?.value);
  const year = Number(doc?.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function selectedDate(period = selectedPeriod()) {
  return new Date(period.year, period.month - 1, 1);
}

function periodRecord(values) {
  return Object.freeze({
    house: finite(values.get("house")),
    solar: finite(values.get("solar")),
    gridImport: finite(values.get("gridImport")),
    gridExport: finite(values.get("gridExport")),
    batteryCharged: finite(values.get("batteryCharged")),
    batteryDischarged: finite(values.get("batteryDischarged")),
  });
}

function writeDerived(plan, value, kind, date) {
  if (!Number.isFinite(value) || !plan?.slot) return;
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  root.CD_PERIOD ||= {};
  root.CD_PERIOD[plan.slot] = rounded;
  broker.ingestState({
    entity_id: plan.slot,
    state: String(rounded),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      dashboardmodern_derived: true,
      dashboardmodern_period: kind,
      dashboardmodern_source: plan.entity,
      dashboardmodern_version: VERSION,
    },
    last_changed: date.toISOString(),
    last_updated: new Date().toISOString(),
  });
}

async function loadEnergyPeriod(kind, date) {
  const plans = sourcePlans(
    section("energy", {}),
    kind,
    allStates(),
    entityOverrides(),
    root.resolveEntity || ((value) => value),
  );
  const values = await broker.valuesForPlans(plans, date, allStates());
  plans.forEach((plan) => writeDerived(plan, values.get(plan.key), kind, date));
  return periodRecord(values);
}

function canonicalDevices() {
  const build = root.DashboardModernModules?.data?.canonicalReportDevices;
  if (typeof build === "function") {
    return build(section("appliances", []), section("loads", []), allStates());
  }
  return [...section("appliances", []), ...section("loads", [])]
    .filter((item) => item?.show_in_report !== false)
    .map((item) => ({
      ...item,
      entity:
        clean(item.total_energy_entity) ||
        clean(item.report_entity) ||
        clean(item.history_entity) ||
        clean(item.energy_entity) ||
        clean(item.monthly_energy_entity),
    }))
    .filter((item) => item.entity);
}

async function loadDevicePeriod(kind, date) {
  const devices = canonicalDevices();
  const ids = [...new Set(devices.map((item) => clean(item.entity)).filter(Boolean))];
  return { devices, values: await broker.valuesForEntities(ids, kind, date) };
}

function rates() {
  const read = (key) => {
    const configured = root.cdCfg?.(key);
    if (configured !== undefined && configured !== null && configured !== "") return finite(configured);
    return finite(root.localStorage?.getItem(key));
  };
  return { importPrice: read("cd_costo_kwh"), exportPrice: read("cd_prezzo_immissione") };
}

export async function loadAtomicEnergyBundle(period = selectedPeriod()) {
  const generation = ++state.generation;
  const monthDate = selectedDate(period);
  const today = new Date();
  const [day, month, year, deviceMonth, deviceYear] = await Promise.all([
    loadEnergyPeriod("day", today),
    loadEnergyPeriod("month", monthDate),
    loadEnergyPeriod("year", monthDate),
    loadDevicePeriod("month", monthDate),
    loadDevicePeriod("year", monthDate),
  ]);
  if (generation !== state.generation) return null;
  return Object.freeze({
    generation,
    period: Object.freeze({ ...period }),
    day,
    month,
    year,
    deviceMonth,
    deviceYear,
    rates: Object.freeze(rates()),
  });
}

function setText(id, value) {
  const node = doc?.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

function setHtml(id, value) {
  const node = doc?.getElementById(id);
  if (node && node.innerHTML !== value) node.innerHTML = value;
}

function kwh(value, digits = 1) {
  return `${format(value, digits)} kWh`;
}

function dual(imported, exported, battery = false) {
  const down = battery ? "#10b981" : "#e11d48";
  const up = battery ? "#e11d48" : "#10b981";
  return `<span style="color:${down}">↓ ${format(imported, 1)} kWh</span><br><span style="color:${up}">↑ ${format(exported, 1)} kWh</span>`;
}

function applyFlow(kind, data) {
  const suffix = kind === "day" ? "day" : "month";
  setText(`v-solar-${suffix}`, kwh(data.solar));
  setText(`v-home-${suffix}`, kwh(data.house));
  setHtml(`v-grid-${suffix}`, dual(data.gridImport, data.gridExport));
  setHtml(`v-battery-${suffix}`, dual(data.batteryCharged, data.batteryDischarged, true));
  ["solar", "home", "grid", "battery"].forEach((key) => {
    const node = doc?.getElementById(`n-${key}-${suffix}`);
    if (node) node.dataset.dmPeriodOwner = VERSION;
  });
}

function autonomy(data) {
  if (data.house <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((data.house - data.gridImport) / data.house) * 100)));
}

function financial(data, bundle) {
  const importCost = data.gridImport * bundle.rates.importPrice;
  const exportIncome = data.gridExport * bundle.rates.exportPrice;
  const withoutSolar = data.house * bundle.rates.importPrice;
  const realCost = Math.max(0, importCost - exportIncome);
  return {
    importCost,
    exportIncome,
    withoutSolar,
    realCost,
    saved: Math.max(0, withoutSolar - realCost),
  };
}

function applyReportOverview(bundle) {
  const data = bundle.month;
  const auto = autonomy(data);
  setHtml("ed-kpi-prod", `${format(data.solar)} <small>kWh</small>`);
  setHtml("ed-kpi-cons", `${format(data.house)} <small>kWh</small>`);
  setHtml("ed-kpi-auto", `${auto} <small>%</small>`);
  const chips = doc?.getElementById("ed-yoy-chips");
  if (chips) {
    chips.innerHTML = [
      `<span class="ed-yoy-chip">☀️ ${kwh(data.solar)}</span>`,
      `<span class="ed-yoy-chip">🏠 ${kwh(data.house)}</span>`,
      `<span class="ed-yoy-chip">⚡ ${kwh(data.gridImport)} ${text("da Rete", "from Grid")}</span>`,
    ].join("");
  }
  const money = financial(data, bundle);
  setText("ed-fin-pagato", `${format(money.withoutSolar, 2)} €`);
  setText("ed-fin-pagato-sub", kwh(data.house));
  setText("ed-fin-costo", `${format(money.realCost, 2)} €`);
  setText("ed-fin-costo-sub", `${kwh(data.gridImport)} ${text("dalla rete", "from grid")}`);
  setText("ed-fin-risp", `${format(money.saved, 2)} €`);
  setText("ed-fin-imm", `${format(money.exportIncome, 2)} €`);
  setText("ed-auto-big", `${auto}%`);
  setText("ed-auto-ring-val", `${auto}%`);
  const circle = doc?.getElementById("ed-auto-circle");
  if (circle) circle.setAttribute("stroke-dasharray", `${(201 * auto) / 100} 201`);
}

function applyAnnual(bundle) {
  const data = bundle.year;
  const money = financial(data, bundle);
  setText("ed-year-summary-year", String(bundle.period.year));
  setText("ed-year-pagato", `${format(money.importCost, 2)} €`);
  setText("ed-year-pagato-sub", `${kwh(data.gridImport)} ${text("dalla rete", "from grid")}`);
  setText("ed-year-risparmio", `${format(money.saved, 2)} €`);
  setText("ed-year-risparmio-sub", `${text("su", "on")} ${kwh(data.house)}`);
  setText("ed-dkpi-year-lbl", String(bundle.period.year));
}

function applyDeviceRows(bundle) {
  const list = doc?.getElementById("ed-device-list");
  if (!list) return;
  const { devices, values } = bundle.deviceMonth;
  const maximum = Math.max(0.001, ...devices.map((device) => finite(values.get(device.entity))));
  let total = 0;
  list.querySelectorAll(".ed-device-row").forEach((row) => {
    const direct = clean(row.dataset.entity || row.dataset.sensor);
    const name = clean(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent);
    const entity = direct || clean(devices.find((device) => clean(device.name) === name)?.entity);
    const value = values.get(entity) ?? values.get(root.resolveEntity?.(entity) || entity);
    if (!Number.isFinite(value)) return;
    total += value;
    row.dataset.entity = entity;
    row.dataset.dmPeriodOwner = VERSION;
    const valueNode = row.querySelector(".ed-dev-kwh");
    if (valueNode) valueNode.innerHTML = `${format(value)} <small>kWh</small>`;
    const eur = row.querySelector(".ed-dev-eur");
    if (eur) eur.textContent = `${format(value * bundle.rates.importPrice, 2)} €`;
    const fill = row.querySelector(".ed-dev-bar-fill,.ed-dev-bar");
    if (fill) fill.style.width = `${Math.min(100, (value / maximum) * 100)}%`;
    row.querySelectorAll(".ed-dev-live,.ed-dev-total-live,.ed-dev-name small").forEach((node) => {
      node.hidden = true;
    });
  });
  setText("ed-dev-total", kwh(total));
}

export function applyAtomicEnergyBundle(bundle = state.bundle) {
  if (!bundle || !doc) return false;
  applyFlow("day", bundle.day);
  applyFlow("month", bundle.month);
  applyReportOverview(bundle);
  applyAnnual(bundle);
  applyDeviceRows(bundle);
  doc.querySelectorAll("#view-day,#view-month,#view-panoramica").forEach((node) => {
    node.dataset.dmEnergyBundle = String(bundle.generation);
    node.removeAttribute("aria-busy");
  });
  return true;
}

function setEnergyLoading(active) {
  doc?.querySelectorAll("#view-day,#view-month,#view-panoramica").forEach((node) => {
    node.toggleAttribute("aria-busy", active);
    node.classList.toggle("dm-energy-loading", active);
  });
}

export async function refreshEnergy(period = selectedPeriod()) {
  setEnergyLoading(true);
  try {
    const bundle = await loadAtomicEnergyBundle(period);
    if (!bundle) return false;
    state.bundle = bundle;
    state.selected = bundle.period;
    state.lastRefreshAt = Date.now();
    applyAtomicEnergyBundle(bundle);
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }));
    return true;
  } catch (error) {
    root.console?.warn?.("[DashboardModern] energy bundle", error);
    return false;
  } finally {
    setEnergyLoading(false);
  }
}

function scheduleEnergyRefresh(force = false) {
  root.clearTimeout?.(state.refreshTimer);
  const elapsed = Date.now() - state.lastRefreshAt;
  const delay = force ? 0 : Math.max(250, 15000 - elapsed);
  state.refreshTimer = root.setTimeout?.(() => refreshEnergy(), delay);
}

export function configuredLightGroups() {
  const lights = readJson("cd_luci", {});
  const assignments = readJson("cd_luci_rooms", {});
  const order = readJson("cd_luci_order", {});
  const preferredRooms = readJson("cd_luci_room_order", []);
  const ids = Object.keys(lights).filter((id) => id.includes("."));
  const grouped = new Map();
  ids.forEach((id) => {
    const room = clean(assignments[id]) || text("Altre zone", "Other areas");
    if (!grouped.has(room)) grouped.set(room, []);
    grouped.get(room).push(id);
  });
  const roomNames = [
    ...preferredRooms.filter((room) => grouped.has(room)),
    ...[...grouped.keys()].filter((room) => !preferredRooms.includes(room)),
  ];
  return roomNames.map((room) => {
    const current = grouped.get(room) || [];
    const saved = Array.isArray(order[room]) ? order[room] : [];
    const entities = [
      ...saved.filter((id) => current.includes(id)),
      ...current.filter((id) => !saved.includes(id)),
    ];
    return { room, entities, lights };
  });
}

function allRoomOptions(selected) {
  const rooms = section("rooms", readJson("cd_stanze", []));
  return [
    `<option value="">— ${text("Nessuna stanza", "No room")} —</option>`,
    ...rooms
      .filter((room) => clean(room?.name))
      .map((room) => `<option value="${esc(room.name)}" ${clean(selected) === clean(room.name) ? "selected" : ""}>${esc(room.icon || "🏠")} ${esc(room.name)}</option>`),
  ].join("");
}

export function renderCanonicalLightsEditor() {
  const groups = configuredLightGroups();
  const add = `<div class="ed-form"><div class="ed-form-row"><input id="luce-add-ent" class="ed-input mono" placeholder="light.salone"><button type="button" class="dm-entity-picker" onclick="wzPickEntity('#luce-add-ent')">🔍</button></div><input id="luce-add-name" class="ed-input" placeholder="${text("Nome luce", "Light name")}"><button class="ed-btn-add" onclick="cdLuceAdd()">＋ ${text("Aggiungi luce", "Add light")}</button></div>`;
  if (!groups.length) return `<div class="ed-empty">${text("Nessuna luce configurata.", "No configured lights.")}</div>${add}`;
  const assignments = readJson("cd_luci_rooms", {});
  const body = groups
    .map((group, groupIndex) => {
      const rows = group.entities
        .map((id, index) => {
          const name = group.lights[id] || allStates()?.[id]?.attributes?.friendly_name || id;
          return `<div class="ed-row dm-light-row" data-light-entity="${esc(id)}"><div style="display:flex;flex-direction:column;gap:2px"><button type="button" class="ed-del" ${index === 0 ? "disabled" : ""} onclick="dmLightMove('${esc(id)}',-1)">▲</button><button type="button" class="ed-del" ${index === group.entities.length - 1 ? "disabled" : ""} onclick="dmLightMove('${esc(id)}',1)">▼</button></div><div class="ed-row-main"><div class="ed-row-new">💡 ${esc(name)}</div><div class="ed-row-old mono">${esc(id)}</div></div><select class="ed-input dm-light-room" onchange="dmLightSetRoom('${esc(id)}',this.value)">${allRoomOptions(assignments[id])}</select><button type="button" class="ed-del" onclick="cdLuceRen('${esc(id)}')">✏️</button><button type="button" class="ed-del" onclick="cdLuceDel('${esc(id)}')">🗑️</button></div>`;
        })
        .join("");
      return `<section class="dm-light-group" data-light-room="${esc(group.room)}"><div class="ed-acc-head"><span>🏠 ${esc(group.room)} · ${group.entities.length}</span><span><button type="button" class="ed-del" ${groupIndex === 0 ? "disabled" : ""} onclick="dmLightRoomMove('${esc(group.room)}',-1)">▲</button><button type="button" class="ed-del" ${groupIndex === groups.length - 1 ? "disabled" : ""} onclick="dmLightRoomMove('${esc(group.room)}',1)">▼</button></span></div><div class="ed-list">${rows}</div></section>`;
    })
    .join("");
  return `<div class="ed-intro">${text("Sono mostrate solo le stanze che contengono almeno una luce configurata. Le frecce definiscono l'ordine usato anche nelle Azioni rapide.", "Only rooms containing configured lights are shown. Arrows also define Quick Action order.")}</div>${body}${add}`;
}

function persistLightOrder(groups) {
  writeJson(
    "cd_luci_order",
    Object.fromEntries(groups.map((group) => [group.room, group.entities])),
  );
  writeJson("cd_luci_room_order", groups.map((group) => group.room));
}

function rerenderEditor(tab = "luci") {
  root.editorSwitch?.(tab);
}

root.dmLightMove = (id, direction) => {
  const groups = configuredLightGroups();
  const group = groups.find((item) => item.entities.includes(id));
  if (!group) return;
  const index = group.entities.indexOf(id);
  const next = index + Number(direction);
  if (next < 0 || next >= group.entities.length) return;
  [group.entities[index], group.entities[next]] = [group.entities[next], group.entities[index]];
  persistLightOrder(groups);
  rerenderEditor();
};

root.dmLightRoomMove = (room, direction) => {
  const groups = configuredLightGroups();
  const index = groups.findIndex((item) => item.room === room);
  const next = index + Number(direction);
  if (index < 0 || next < 0 || next >= groups.length) return;
  [groups[index], groups[next]] = [groups[next], groups[index]];
  persistLightOrder(groups);
  rerenderEditor();
};

root.dmLightSetRoom = (id, room) => {
  const assignments = readJson("cd_luci_rooms", {});
  if (clean(room)) assignments[id] = clean(room);
  else delete assignments[id];
  writeJson("cd_luci_rooms", assignments);
  const groups = configuredLightGroups();
  persistLightOrder(groups);
  rerenderEditor();
};

function orderedLightIds() {
  return configuredLightGroups().flatMap((group) => group.entities);
}

export function openOrderedLightPicker(groupName, onDone, preselected = []) {
  doc?.getElementById("dm-light-picker-0152")?.remove();
  const names = readJson("cd_luci", {});
  const ordered = orderedLightIds();
  let selected = [...new Set(preselected.filter((id) => ordered.includes(id)))];
  const modal = doc.createElement("div");
  modal.id = "dm-light-picker-0152";
  modal.className = "modal show";
  modal.innerHTML = `<div class="modal-content" style="max-width:720px"><div class="ed-head"><strong>💡 ${esc(groupName)}</strong><button type="button" class="ed-head-close" data-close>✕</button></div><input class="ed-input" data-search placeholder="${text("Cerca luce", "Search light")}"><div class="ed-list" data-list></div><div class="ed-action-bar"><button type="button" class="ed-btn-add" data-cancel>${text("Annulla", "Cancel")}</button><button type="button" class="ed-save-btn" data-save>💾 ${text("Salva ordine", "Save order")}</button></div></div>`;
  doc.body.append(modal);
  const list = modal.querySelector("[data-list]");
  const render = () => {
    const query = clean(modal.querySelector("[data-search]").value).toLowerCase();
    const visible = ordered.filter((id) => `${names[id] || ""} ${id}`.toLowerCase().includes(query));
    list.innerHTML = visible.map((id) => {
      const checked = selected.includes(id);
      const index = selected.indexOf(id);
      return `<div class="ed-row" data-pick-light="${esc(id)}"><input type="checkbox" ${checked ? "checked" : ""}><div class="ed-row-main"><div class="ed-row-new">${esc(names[id] || id)}</div><div class="ed-row-old mono">${esc(id)}</div></div><button type="button" class="ed-del" data-up ${!checked || index <= 0 ? "disabled" : ""}>▲</button><button type="button" class="ed-del" data-down ${!checked || index >= selected.length - 1 ? "disabled" : ""}>▼</button></div>`;
    }).join("");
    list.querySelectorAll("[data-pick-light]").forEach((row) => {
      const id = row.dataset.pickLight;
      row.querySelector("input").addEventListener("change", (event) => {
        selected = event.target.checked ? [...selected, id] : selected.filter((item) => item !== id);
        render();
      });
      row.querySelector("[data-up]").addEventListener("click", () => {
        const index = selected.indexOf(id);
        if (index > 0) [selected[index - 1], selected[index]] = [selected[index], selected[index - 1]];
        render();
      });
      row.querySelector("[data-down]").addEventListener("click", () => {
        const index = selected.indexOf(id);
        if (index >= 0 && index < selected.length - 1) [selected[index + 1], selected[index]] = [selected[index], selected[index + 1]];
        render();
      });
    });
  };
  modal.querySelector("[data-search]").addEventListener("input", render);
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", () => modal.remove()));
  modal.querySelector("[data-save]").addEventListener("click", () => {
    onDone?.(selected);
    modal.remove();
  });
  render();
}

function synchronizeLightAlerts() {
  const lights = Object.keys(readJson("cd_luci", {})).filter((id) => id.includes("."));
  const removed = readJson("cd_gruppi_removed", {});
  const extras = readJson("cd_gruppi_extra", {});
  extras.luci = [...new Set([...(extras.luci || []), ...lights])].filter(
    (id) => !(removed.luci || []).includes(id),
  );
  root.localStorage?.setItem("cd_gruppi_extra", JSON.stringify(extras));
  try {
    root.eval?.("if (typeof GRUPPI_MONITORAGGIO !== 'undefined') GRUPPI_MONITORAGGIO.luci = [...new Set([...(GRUPPI_MONITORAGGIO.luci || []), ..." + JSON.stringify(extras.luci) + "])];");
  } catch (_error) {}
}

function normalizeAlertEditorDom() {
  const body = doc?.getElementById("ed-body");
  if (!body || doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return;
  body.querySelectorAll(".ed-row").forEach((row) => {
    const label = clean(row.querySelector(".ed-row-new")?.textContent);
    const entity = clean(row.querySelector(".ed-row-old")?.textContent);
    if (!label && !entity) row.remove();
  });
}

const EXTRA_SYNC_KEYS = Object.freeze([
  "cd_luci_order",
  "cd_luci_room_order",
  "cd_gruppi_extra",
  "cd_gruppi_removed",
  "cd_avvisi_names_extra",
]);

function installSyncBridge() {
  const collect = root.cdSyncCollect;
  if (typeof collect === "function" && !collect.__dmRoot0152) {
    function canonicalCollect() {
      const output = collect.apply(this, arguments) || {};
      EXTRA_SYNC_KEYS.forEach((key) => {
        const value = root.localStorage?.getItem(key);
        if (value !== null) output[key] = value;
      });
      return output;
    }
    canonicalCollect.__dmRoot0152 = true;
    root.cdSyncCollect = canonicalCollect;
  }
  const apply = root.cdSyncApply;
  if (typeof apply === "function" && !apply.__dmRoot0152) {
    function canonicalApply(data) {
      const count = finite(apply.apply(this, arguments));
      let extra = 0;
      EXTRA_SYNC_KEYS.forEach((key) => {
        if (data?.[key] !== undefined) {
          root.localStorage?.setItem(key, data[key]);
          extra += 1;
        }
      });
      return count + extra;
    }
    canonicalApply.__dmRoot0152 = true;
    root.cdSyncApply = canonicalApply;
  }
}

export function resolveVehicleImagePath(value, base = doc?.baseURI || root.location?.href || "") {
  let raw = typeof value === "string" ? value : value?.url || value?.path || "";
  raw = clean(raw).replaceAll("\\", "/");
  if (!raw) return "";
  if (/^(?:data:|blob:|https?:)/i.test(raw)) return raw;
  if (/^(?:file:|[a-z]:\/)/i.test(raw)) return "";
  if (raw.startsWith("/config/www/")) return `/local/${raw.slice("/config/www/".length)}`;
  if (raw.startsWith("config/www/")) return `/local/${raw.slice("config/www/".length)}`;
  if (raw.startsWith("www/")) return `/local/${raw.slice(4)}`;
  if (raw.startsWith("local/")) return `/${raw}`;
  if (raw.startsWith("/")) return raw;
  try {
    return new URL(raw.replace(/^\.\//, ""), base).href;
  } catch (_error) {
    return raw;
  }
}

function applyVehicleImage() {
  const stored = root.localStorage?.getItem("cd_ev_image") || "";
  let configured = readJson("cd_ev_image", "");
  if (!configured && stored && !stored.startsWith("{") && !stored.startsWith("[")) configured = stored.replace(/^"|"$/g, "");
  const url = resolveVehicleImagePath(configured);
  ["ev-mod-car-img", "ev-new-car-img"].forEach((id) => {
    const image = doc?.getElementById(id);
    if (!image) return;
    if (!url) {
      image.removeAttribute("src");
      image.style.display = "none";
      return;
    }
    image.onerror = () => {
      image.dataset.evImageError = url;
      image.style.display = "none";
    };
    image.onload = () => {
      delete image.dataset.evImageError;
      image.style.display = "block";
      image.style.opacity = "1";
    };
    image.style.display = "block";
    if (image.src !== url) image.src = url;
  });
  const hero = doc?.getElementById("lm-hero-card");
  if (hero) hero.dataset.evImage = url ? "configured" : "missing";
}

function normalizeTemperature() {
  doc?.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
    card.style.setProperty("min-height", "110px", "important");
    card.style.setProperty("height", "auto", "important");
    const walker = doc.createTreeWalker(card, root.NodeFilter?.SHOW_TEXT || 4);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.nodeValue?.includes("🔥")) node.nodeValue = node.nodeValue.replaceAll("🔥", "").trim();
    });
  });
}

function installThemeStyles() {
  if (!doc || doc.getElementById("dm-runtime-root-0152-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-runtime-root-0152-style";
  style.textContent = `
    #page-appliances-main .appl-wide-card{background:var(--dm-dashboard-card,#fff)!important;color:var(--text,#0f172a)!important}
    #page-appliances-main .dm-appliance-toggle,#page-appliances-main [data-dm-power-toggle]{border:0!important;border-radius:12px!important;padding:8px 14px!important;background:linear-gradient(135deg,#38bdf8,#0284c7)!important;color:#fff!important;font-weight:800!important}
    .dm-energy-loading{opacity:.72;transition:opacity .15s ease}
    .dm-light-group{margin:0 0 12px}.dm-light-row .dm-light-room{max-width:260px}
    #dm-light-picker-0152{z-index:10050}
    @media(max-width:720px){.dm-light-row{flex-wrap:wrap}.dm-light-row .dm-light-room{order:4;max-width:none;width:100%}}
  `;
  doc.head.append(style);
}

function installFunctionOwners() {
  if (typeof root.editorRenderLuci === "function") root.editorRenderLuci = renderCanonicalLightsEditor;
  if (typeof root.cdPickLights === "function") root.cdPickLights = openOrderedLightPicker;

  const alerts = root.editorRenderAvvisi;
  if (typeof alerts === "function" && !alerts.__dmRoot0152) {
    function canonicalAlerts() {
      synchronizeLightAlerts();
      return alerts.apply(this, arguments);
    }
    canonicalAlerts.__dmRoot0152 = true;
    root.editorRenderAvvisi = canonicalAlerts;
  }

  const wrapAfter = (name, callback) => {
    const current = root[name];
    if (typeof current !== "function" || current.__dmRoot0152 || state.wrappers.has(current)) return;
    function owned() {
      const result = current.apply(this, arguments);
      root.queueMicrotask?.(callback);
      return result;
    }
    Object.assign(owned, current);
    owned.__dmRoot0152 = true;
    owned.__dmPrevious = current;
    state.wrappers.add(current);
    state.wrappers.add(owned);
    root[name] = owned;
  };

  wrapAfter("render", () => {
    applyAtomicEnergyBundle();
    applyVehicleImage();
    normalizeTemperature();
  });
  wrapAfter("renderEnergyDashboard", () => applyAtomicEnergyBundle());
  wrapAfter("renderEdDeviceList", () => applyAtomicEnergyBundle());
  wrapAfter("buildTempCards", normalizeTemperature);
  wrapAfter("renderTemperature", normalizeTemperature);
  wrapAfter("editorSwitch", () => {
    installFunctionOwners();
    synchronizeLightAlerts();
    normalizeAlertEditorDom();
  });
}

function bindDomEvents() {
  if (!doc || doc.documentElement.dataset.dmRootEvents === VERSION) return;
  doc.documentElement.dataset.dmRootEvents = VERSION;
  doc.addEventListener("change", (event) => {
    if (event.target?.matches?.("#ed-sel-month,#ed-sel-year")) scheduleEnergyRefresh(true);
  });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-tab='energy'],.sub-tab-btn")) {
      root.queueMicrotask?.(() => applyAtomicEnergyBundle());
    }
    if (event.target?.closest?.(".ed-tab[data-tab='avvisi']")) {
      synchronizeLightAlerts();
      root.queueMicrotask?.(normalizeAlertEditorDom);
    }
    if (event.target?.closest?.("[data-tab='ev']")) root.queueMicrotask?.(applyVehicleImage);
  }, true);
  root.addEventListener?.("dashboardmodern:state-changed", () => scheduleEnergyRefresh(false));
  root.addEventListener?.("pageshow", () => {
    installFunctionOwners();
    applyAtomicEnergyBundle();
    applyVehicleImage();
  });
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (["energy", "appliances", "loads", "entityOverrides"].includes(change.section)) {
      scheduleEnergyRefresh(true);
    }
    if (["lights", "rooms"].includes(change.section)) {
      synchronizeLightAlerts();
      if (doc?.querySelector(".ed-tab.active")?.dataset?.tab === "luci") rerenderEditor();
    }
  });
}

function start() {
  if (!doc) return;
  installThemeStyles();
  installFunctionOwners();
  installSyncBridge();
  bindDomEvents();
  subscribeStore();
  if (!state.brokerStarted) {
    state.brokerStarted = true;
    broker.startStateFeed().catch((error) => {
      state.brokerStarted = false;
      root.console?.warn?.("[DashboardModern] state feed", error);
    });
  }
  synchronizeLightAlerts();
  applyVehicleImage();
  normalizeTemperature();
  if (!state.bundle) scheduleEnergyRefresh(true);
  state.ready = true;
}

function boot(attempt = 0) {
  start();
  if (attempt < 120 && (!dashboardStore() || typeof root.render !== "function")) {
    root.requestAnimationFrame?.(() => boot(attempt + 1));
  }
}

root.__DASHBOARDMODERN_RUNTIME_0150__ = state;
root.__DASHBOARDMODERN_RUNTIME_ROOT__ = state;
root.addEventListener?.("dashboardmodern:legacy-ready", start);
root.addEventListener?.("dashboardmodern:runtime-ready", start);
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => boot(), { once: true });
else boot();
