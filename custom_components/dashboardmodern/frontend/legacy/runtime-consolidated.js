/* DashboardModern 0.15.0 — one event-driven runtime owner. */
import {
  HomeAssistantBroker,
  PERIOD_SOURCES,
  isCumulativeEnergyEntity,
  periodConsumption,
  periodRange,
  sourcePlans,
} from "../src/core/period-service.js";
import {
  applianceArtwork,
  applianceArtwork0152,
  canonicalArtworkType,
} from "../src/core/appliance-artwork.js";

const VERSION = "0.15.0";
const KEY = "__DASHBOARDMODERN_RUNTIME_0150__";
const COMPAT_KEYS = [
  "__DASHBOARDMODERN_RELEASE_0152__",
  "__DASHBOARDMODERN_RELEASE_0154__",
  "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__",
  "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__",
  "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__",
  "__DASHBOARDMODERN_RELEASE_0157_FINAL__",
];

const broker = new HomeAssistantBroker();
const text = (it, en) => (document.documentElement.lang === "en" ? en : it);
const clean = (value) => String(value || "").trim();
const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const format = (value, digits = 1) => finite(value).toLocaleString(
  document.documentElement.lang === "en" ? "en-US" : "it-IT",
  { minimumFractionDigits: digits, maximumFractionDigits: digits },
);

function runtime() {
  const state = (globalThis[KEY] ||= {
    installed: true,
    ready: false,
    version: VERSION,
    generation: 0,
    selected: null,
    bundle: null,
    loading: false,
    refreshTimer: 0,
    wrappersInstalled: false,
    storeSubscribed: false,
    editorWrapped: false,
    pendingEnergy: {},
    editingApplianceId: "",
    metrics: {
      permanentIntervals: 0,
      documentObservers: 0,
      listeners: 0,
      lastRequestMs: 0,
      lastApplyMs: 0,
      bundles: 0,
    },
  });
  return state;
}

function selectedPeriod() {
  const now = new Date();
  const month = Number(document.getElementById("ed-sel-month")?.value);
  const year = Number(document.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function selectedDate(period = selectedPeriod()) {
  return new Date(Number(period.year), Number(period.month) - 1, 1);
}

function tokenFor(period) {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function dashboardStore() {
  return globalThis.DashboardModernModules?.store || null;
}

function section(name, fallback) {
  try {
    return dashboardStore()?.getSection?.(name) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function energyConfig() {
  return section("energy", {}) || {};
}

function allStates() {
  return { ...(globalThis._RAW_STATES || {}), ...(globalThis.STATES || {}) };
}

function entityOverrides() {
  try {
    if (typeof ENTITY_OVERRIDES !== "undefined" && ENTITY_OVERRIDES) return ENTITY_OVERRIDES;
  } catch (_error) {}
  return globalThis.ENTITY_OVERRIDES || {};
}

function canonicalDevices() {
  try {
    const modules = globalThis.DashboardModernModules;
    const build = modules?.data?.canonicalReportDevices;
    if (typeof build === "function") {
      return build(section("appliances", []), section("loads", []), allStates());
    }
  } catch (_error) {}
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

function writeDerived(slot, value, source, kind, selected) {
  if (!slot || !Number.isFinite(value)) return;
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  globalThis.CD_PERIOD ||= {};
  globalThis.CD_PERIOD[slot] = rounded;
  const stamp = new Date().toISOString();
  const state = {
    entity_id: slot,
    state: String(rounded),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      dashboardmodern_derived: true,
      dashboardmodern_source: source,
      dashboardmodern_period: kind,
      dashboardmodern_selected: selected.toISOString(),
      dashboardmodern_version: VERSION,
    },
    last_changed: stamp,
    last_updated: stamp,
  };
  broker.ingestState(state);
}

function periodData(values) {
  return {
    house: finite(values.get("house")),
    solar: finite(values.get("solar")),
    gridImport: finite(values.get("gridImport")),
    gridExport: finite(values.get("gridExport")),
    batteryCharged: finite(values.get("batteryCharged")),
    batteryDischarged: finite(values.get("batteryDischarged")),
  };
}

async function loadEnergyPeriod(kind, date) {
  const plans = sourcePlans(
    energyConfig(),
    kind,
    allStates(),
    entityOverrides(),
    globalThis.resolveEntity || ((value) => value),
  );
  const values = await broker.valuesForPlans(plans, date, allStates());
  plans.forEach((plan) => {
    const value = values.get(plan.key);
    if (Number.isFinite(value)) writeDerived(plan.slot, value, plan.entity, kind, date);
  });
  return periodData(values);
}

async function loadDevicePeriod(kind, date) {
  const devices = canonicalDevices();
  const ids = [...new Set(devices.map((device) => clean(device.entity)).filter(Boolean))];
  const values = await broker.valuesForEntities(ids, kind, date);
  return {
    devices,
    values,
  };
}

function rates() {
  const read = (key) => {
    try {
      const configured = globalThis.cdCfg?.(key);
      if (configured !== undefined && configured !== null && configured !== "") return finite(configured);
    } catch (_error) {}
    try {
      return finite(globalThis.localStorage?.getItem(key));
    } catch (_error) {
      return 0;
    }
  };
  return {
    importPrice: read("cd_costo_kwh"),
    exportPrice: read("cd_prezzo_immissione"),
  };
}

async function loadBundle(period = selectedPeriod()) {
  const state = runtime();
  const generation = ++state.generation;
  state.loading = true;
  const started = performance.now?.() ?? Date.now();
  const date = selectedDate(period);
  const [month, year, deviceMonth, deviceYear] = await Promise.all([
    loadEnergyPeriod("month", date),
    loadEnergyPeriod("year", date),
    loadDevicePeriod("month", date),
    loadDevicePeriod("year", date),
  ]);
  if (generation !== state.generation) return null;
  const bundle = {
    token: tokenFor(period),
    period: { ...period },
    month,
    year,
    deviceMonth,
    deviceYear,
    rates: rates(),
  };
  state.selected = { ...period };
  state.bundle = bundle;
  state.loading = false;
  state.metrics.lastRequestMs = Math.round((performance.now?.() ?? Date.now()) - started);
  state.metrics.bundles += 1;
  return bundle;
}

function setHtml(id, html) {
  const node = document.getElementById(id);
  if (!node || node.innerHTML === html) return false;
  node.innerHTML = html;
  return true;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (!node || node.textContent === value) return false;
  node.textContent = value;
  return true;
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
  const saved = Math.max(0, withoutSolar - realCost);
  return { importCost, exportIncome, withoutSolar, realCost, saved };
}

function applyOverview(bundle) {
  const data = bundle.month;
  const auto = autonomy(data);
  setHtml("ed-kpi-prod", `${format(data.solar)} <small>kWh</small>`);
  setHtml("ed-kpi-cons", `${format(data.house)} <small>kWh</small>`);
  setHtml("ed-kpi-auto", `${auto} <small>%</small>`);

  const chips = document.getElementById("ed-yoy-chips");
  if (chips) {
    chips.innerHTML = [
      `<span class="ed-yoy-chip dm-period-chip-0150">☀️ ${format(data.solar)} kWh</span>`,
      `<span class="ed-yoy-chip dm-period-chip-0150">🏠 ${format(data.house)} kWh</span>`,
      `<span class="ed-yoy-chip dm-period-chip-0150">⚡ ${format(data.gridImport)} kWh ${text("da Rete", "from Grid")}</span>`,
    ].join("");
  }

  const finance = financial(data, bundle);
  setText("ed-fin-pagato", `${format(finance.withoutSolar, 2)} €`);
  setText("ed-fin-pagato-sub", `${format(data.house)} kWh`);
  setText("ed-fin-costo", `${format(finance.realCost, 2)} €`);
  setText("ed-fin-costo-sub", `${format(data.gridImport)} kWh ${text("dalla rete", "from grid")}`);
  setText("ed-fin-risp", `${format(finance.saved, 2)} €`);
  setText("ed-fin-risp-sub", `${format(Math.max(0, data.house - data.gridImport))} kWh ${text("autoconsumati", "self-consumed")}`);
  setText("ed-fin-imm", `${format(finance.exportIncome, 2)} €`);
  setText("ed-fin-imm-sub", `${format(data.gridExport)} kWh`);
  setText("ed-fin-co2", `${format(data.solar * 0.233, 1)} kg`);
  setText("ed-fin-co2-sub", "CO₂");

  setText("ed-auto-big", `${auto}%`);
  setText("ed-auto-ring-val", `${auto}%`);
  const circle = document.getElementById("ed-auto-circle");
  if (circle) circle.setAttribute("stroke-dasharray", `${(201 * auto) / 100} 201`);
}

function applyAnnual(bundle) {
  const data = bundle.year;
  const finance = financial(data, bundle);
  setText("ed-year-summary-year", String(bundle.period.year));
  setText("ed-year-pagato", `${format(finance.importCost, 2)} €`);
  setText("ed-year-pagato-sub", `${format(data.gridImport)} kWh ${text("dalla rete", "from grid")}`);
  setText("ed-year-risparmio", `${format(finance.saved, 2)} €`);
  setText(
    "ed-year-risparmio-sub",
    `${text("su", "on")} ${format(data.house)} kWh ${text("consumati", "consumed")}`,
  );
  setText("ed-dkpi-year-lbl", String(bundle.period.year));
}

function deviceEntity(row, devices) {
  const direct = clean(row.dataset.entity || row.dataset.sensor);
  if (direct) return direct;
  const onclick = row.getAttribute("onclick") || "";
  const match = /apriStorico\s*\(\s*event\s*,\s*['\"]([^'\"]+)/.exec(onclick);
  if (match?.[1]) return match[1];
  const name = clean(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent);
  return clean(devices.find((device) => clean(device.name) === name)?.entity);
}

function applyDeviceRows(bundle) {
  if (!bundle?.deviceMonth) return;
  const list = document.getElementById("ed-device-list");
  if (!list) return;
  const { devices, values } = bundle.deviceMonth;
  const maximum = Math.max(0.001, ...devices.map((device) => finite(values.get(device.entity))));
  let total = 0;

  list.querySelectorAll(".ed-device-row").forEach((row) => {
    const entity = deviceEntity(row, devices);
    const value = values.get(entity) ?? values.get(globalThis.resolveEntity?.(entity) || entity);
    if (!Number.isFinite(value)) return;
    total += value;
    row.dataset.entity = entity;
    row.dataset.dmPeriodValue = String(value);
    const kwh = row.querySelector(".ed-dev-kwh");
    if (kwh) kwh.innerHTML = `${format(value)} <small>kWh</small>`;
    const eur = row.querySelector(".ed-dev-eur");
    if (eur) eur.textContent = `${format(value * bundle.rates.importPrice, 2)} €`;
    const fill = row.querySelector(".ed-dev-bar-fill,.ed-dev-bar");
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, (value / maximum) * 100))}%`;
    row.querySelectorAll(".ed-dev-name small,.ed-dev-live,.ed-dev-total-live").forEach((node) => {
      node.hidden = true;
    });
  });

  setText("ed-dev-total", `${format(total)} kWh`);
  const label = document.getElementById("ed-dev-period-label");
  if (label) {
    const option = document.getElementById("ed-sel-month")?.selectedOptions?.[0]?.textContent || bundle.period.month;
    label.textContent = `${option} ${bundle.period.year}`;
  }
}

function applyBundle(bundle = runtime().bundle) {
  if (!bundle) return false;
  const started = performance.now?.() ?? Date.now();
  applyOverview(bundle);
  applyAnnual(bundle);
  applyDeviceRows(bundle);
  removeDuplicateRoomNav();
  applyOptionalFlowVisibility();
  runtime().metrics.lastApplyMs = Math.round((performance.now?.() ?? Date.now()) - started);
  return true;
}

function showPeriodLoading(active) {
  const page = document.getElementById("view-panoramica");
  if (!page) return;
  page.classList.toggle("dm-period-loading-0150", active);
  page.toggleAttribute("aria-busy", active);
}

export async function refreshSelectedPeriod(period = selectedPeriod()) {
  const state = runtime();
  showPeriodLoading(true);
  try {
    const bundle = await loadBundle(period);
    if (!bundle) return false;
    applyBundle(bundle);
    globalThis.dispatchEvent?.(
      new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }),
    );
    return true;
  } catch (error) {
    state.loading = false;
    console.warn("[DashboardModern 0.15.0] period bundle", error);
    return false;
  } finally {
    showPeriodLoading(false);
  }
}

export async function refreshEnergyStatistics0152(selected = new Date()) {
  try {
    const [day, month, year] = await Promise.all([
      loadEnergyPeriod("day", new Date()),
      loadEnergyPeriod("month", selected),
      loadEnergyPeriod("year", selected),
    ]);
    const current = selectedPeriod();
    if (selected.getMonth() + 1 === current.month && selected.getFullYear() === current.year) {
      const state = runtime();
      if (state.bundle) {
        state.bundle.month = month;
        state.bundle.year = year;
        applyBundle(state.bundle);
      }
    }
    return Boolean(day || month || year);
  } catch (error) {
    console.warn("[DashboardModern 0.15.0] statistics refresh", error);
    return false;
  }
}

function scheduleRefresh(delay = 40, period = selectedPeriod()) {
  const state = runtime();
  globalThis.clearTimeout?.(state.refreshTimer);
  const captured = { month: Number(period.month), year: Number(period.year) };
  state.refreshTimer = globalThis.setTimeout?.(() => refreshSelectedPeriod(captured), delay);
}

function chainHas(fn, marker) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current[marker]) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function wrapRender(name, after) {
  const current = globalThis[name];
  if (typeof current !== "function" || chainHas(current, "__dm0150Consolidated")) return false;
  function consolidatedRender(...args) {
    const result = current.apply(this, args);
    const finish = () => globalThis.queueMicrotask?.(() => after?.(...args));
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }
  consolidatedRender.__dm0150Consolidated = true;
  consolidatedRender.__dmPrevious = current;
  globalThis[name] = consolidatedRender;
  return true;
}

function installArtworkOwner() {
  const current = globalThis.cdApplianceIcon;
  if (typeof current !== "function" || chainHas(current, "__dm0150Artwork")) return false;
  function consolidatedArtwork(type, size) {
    return applianceArtwork(type, size || 96) || current.call(this, type, size);
  }
  consolidatedArtwork.__dm0150Artwork = true;
  consolidatedArtwork.__dmPrevious = current;
  globalThis.cdApplianceIcon = consolidatedArtwork;
  return true;
}

function normalizeArtwork() {
  document.querySelectorAll("#page-appliances-main [data-appliance-id] .appl-visual").forEach((visual) => {
    if (visual.querySelector("img[src]:not([src=''])")) return;
    const card = visual.closest("[data-appliance-id]");
    const device = section("appliances", []).find((item) => String(item.id) === card?.dataset.applianceId);
    const token = device?.visual_key || device?.device_type || device?.icon || device?.name;
    const markup = applianceArtwork(token, 96);
    if (!markup) return;
    visual.innerHTML = markup;
    card.dataset.dmArtwork = canonicalArtworkType(token);
  });
}

function removeDuplicateRoomNav() {
  document.querySelectorAll("#dm-appliance-room-nav-0157,.dm-appliance-room-nav-0157").forEach((node) => node.remove());
  document.querySelectorAll("#page-appliances-main [data-dm-appliance-room-0157]").forEach((card) => {
    card.removeAttribute("data-dm-appliance-room-0157");
    card.hidden = false;
  });
}

function configuredEntityText() {
  const sections = ["energy", "ev", "loads", "appliances", "climate", "rooms"];
  return JSON.stringify(Object.fromEntries(sections.map((name) => [name, section(name, name === "energy" ? {} : [])]))).toLowerCase();
}

function nodeAvailability() {
  const energy = energyConfig();
  const textConfig = configuredEntityText();
  const hasGroup = (group) => Object.values(energy?.[group] || {}).some((value) => clean(value).includes("."));
  return {
    solar: hasGroup("solar"),
    grid: hasGroup("grid"),
    battery: hasGroup("battery"),
    home: hasGroup("house"),
    wb: /wallbox|evcc|charge[_ -]?power|charging[_ -]?power/.test(textConfig),
    boiler: /boiler|scaldabagno|water[_ -]?heater/.test(textConfig),
    clima: /climate\.|condizion|air[_ -]?condition/.test(textConfig),
    lav: /lavatrice|washer|washing[_ -]?machine|asciugatrice|dryer/.test(textConfig),
    cuc: /forno|oven|microonde|microwave|frigo|fridge|dishwasher|lavastoviglie|cooktop/.test(textConfig),
  };
}

function flowEndpoints(pathId) {
  const cleanId = String(pathId || "")
    .replace(/^m-/, "")
    .replace(/^line-/, "")
    .replace(/-(ist|day|month)$/, "");
  const tokens = cleanId.split("-").filter(Boolean);
  return tokens.slice(0, 2);
}

function applyOptionalFlowVisibility() {
  const available = nodeAvailability();
  for (const view of ["ist", "day", "month"]) {
    Object.entries(available).forEach(([token, present]) => {
      const node = document.getElementById(`n-${token}-${view}`);
      if (node) {
        node.hidden = !present;
        node.style.display = present ? "" : "none";
      }
    });
    document.querySelectorAll(`#view-${view} .flow-line`).forEach((path) => {
      const endpoints = flowEndpoints(path.id);
      const visible = endpoints.every((token) => available[token] !== false);
      path.hidden = !visible;
      path.style.display = visible ? "" : "none";
    });
  }
}

function energyTotalFields() {
  return [
    ["house", "total_energy", text("Energia totale casa", "Total home energy"), "sensor.casa_energia_totale"],
    ["grid", "total_import_energy", text("Energia totale prelevata", "Total imported energy"), "sensor.rete_prelievo_totale"],
    ["grid", "total_export_energy", text("Energia totale immessa", "Total exported energy"), "sensor.rete_immissione_totale"],
    ["solar", "total_energy", text("Energia totale fotovoltaico", "Total solar energy"), "sensor.fv_energia_totale"],
    ["battery", "total_charged_energy", text("Energia totale caricata", "Total charged energy"), "sensor.batteria_caricata_totale"],
    ["battery", "total_discharged_energy", text("Energia totale scaricata", "Total discharged energy"), "sensor.batteria_scaricata_totale"],
  ];
}

function decorateEnergyEditor() {
  const root = document.querySelector('[data-editor="energy"]');
  const store = dashboardStore();
  if (!root || !store) return false;
  const model = energyConfig();
  energyTotalFields().forEach(([group, key, label, placeholder]) => {
    const id = `dm-energy-${group}-${key}`;
    if (root.querySelector(`#${id}`)) return;
    const anchor = root.querySelector(`[name="${group}.power"],[name^="${group}."]`);
    const body = anchor?.closest(".ed-acc-body");
    if (!body) return;
    const field = document.createElement("label");
    field.className = "ed-slot dm-total-energy-field-0150";
    field.innerHTML = `<span class="ed-slot-lbl">${label} <span class="ed-acc-n">kWh</span></span><span class="ed-hint">${text("Contatore cumulativo Home Assistant", "Home Assistant cumulative meter")}</span><span class="dm-entity-field" data-entity-field><span class="ed-form-row"><input id="${id}" name="${group}.${key}" class="ed-input ed-slot-in mono" data-entity-input value="${clean(model?.[group]?.[key])}" placeholder="${placeholder}"><button type="button" class="dm-entity-picker" data-entity-target="${id}" aria-label="${label}">🔍</button></span></span>`;
    const input = field.querySelector("input");
    const remember = () => {
      runtime().pendingEnergy[`${group}.${key}`] = input.value;
    };
    input.addEventListener("input", remember);
    input.addEventListener("change", remember);
    body.append(field);
  });
  globalThis.DashboardModernModules?.render?.mountEntityPickers?.(root);
  return true;
}

function installStoreMerge() {
  const state = runtime();
  const store = dashboardStore();
  const original = store?.replaceSection;
  if (!store || typeof original !== "function" || original.__dm0150EnergyMerge) return Boolean(original?.__dm0150EnergyMerge);
  async function replaceSection0150(sectionName, value) {
    if (sectionName !== "energy") return original.apply(this, arguments);
    const merged = structuredClone(value || {});
    Object.entries(state.pendingEnergy).forEach(([path, entity]) => {
      const [group, key] = path.split(".");
      merged[group] ||= {};
      merged[group][key] = clean(entity);
    });
    return original.call(this, sectionName, merged);
  }
  replaceSection0150.__dm0150EnergyMerge = true;
  replaceSection0150.__dmPrevious = original;
  store.replaceSection = replaceSection0150;
  return true;
}

function applianceTotalField(value = "") {
  const label = text("Sensore energia totale", "Total energy sensor");
  return `<label class="ed-slot dm-total-energy-field-0150" data-entity-field><span class="ed-slot-lbl">${label}</span><span class="ed-form-row"><input id="appl-total-energy-entity" class="ed-input mono" data-entity-input value="${clean(value)}" placeholder="sensor.forno_energia_totale"><button type="button" class="dm-entity-picker" data-entity-target="appl-total-energy-entity" aria-label="${label}">🔍</button></span></label>`;
}

function installApplianceEditor() {
  const state = runtime();
  if (state.editorWrapped) return true;
  const render = globalThis.editorRenderAppliances;
  const save = globalThis.edApplSave;
  const edit = globalThis.edApplEdit;
  const cancel = globalThis.edApplCancel;
  if (![render, save, edit, cancel].every((fn) => typeof fn === "function")) return false;

  function edit0150(index) {
    state.editingApplianceId = clean(section("appliances", [])[Number(index)]?.id);
    return edit.apply(this, arguments);
  }
  edit0150.__dmPrevious = edit;
  globalThis.edApplEdit = edit0150;

  function cancel0150() {
    state.editingApplianceId = "";
    return cancel.apply(this, arguments);
  }
  cancel0150.__dmPrevious = cancel;
  globalThis.edApplCancel = cancel0150;

  function render0150() {
    const template = document.createElement("template");
    template.innerHTML = render.apply(this, arguments);
    const form = [...template.content.querySelectorAll(".ed-form")].at(-1);
    if (!form || form.querySelector("#appl-total-energy-entity")) return template.innerHTML;
    const item = section("appliances", []).find((entry) => clean(entry.id) === state.editingApplianceId) || {};
    const holder = form.querySelector("[data-appliance-canonical-fields] .dm-config-grid,[data-appliance-canonical-fields]") || form;
    holder.insertAdjacentHTML("beforeend", applianceTotalField(item.total_energy_entity || ""));
    return template.innerHTML;
  }
  render0150.__dmPrevious = render;
  globalThis.editorRenderAppliances = render0150;

  async function save0150() {
    const total = clean(document.getElementById("appl-total-energy-entity")?.value);
    const name = clean(document.getElementById("appl-name")?.value);
    const editingId = state.editingApplianceId;
    const result = await save.apply(this, arguments);
    const store = dashboardStore();
    if (!store?.getSection || !store?.updateItem) return result;
    const items = store.getSection("appliances") || [];
    const item = items.find((entry) => clean(entry.id) === editingId) ||
      [...items].reverse().find((entry) => !name || clean(entry.name) === name);
    if (item && total) {
      await store.updateItem("appliances", item.id, {
        total_energy_entity: total,
        report_entity: total,
        history_entity: total,
        entities: [...new Set([...(item.entities || []), total])],
      });
    }
    state.editingApplianceId = "";
    return result;
  }
  save0150.__dmPrevious = save;
  globalThis.edApplSave = save0150;
  state.editorWrapped = true;
  return true;
}

function subscribeStore() {
  const state = runtime();
  const store = dashboardStore();
  if (state.storeSubscribed || !store?.subscribe) return Boolean(state.storeSubscribed);
  store.subscribe((change) => {
    if (!["energy", "appliances", "loads", "ev", "climate", "rooms"].includes(change.section)) return;
    broker.cache.clear();
    if (["energy", "appliances", "loads"].includes(change.section)) scheduleRefresh(80);
    globalThis.queueMicrotask?.(() => {
      decorateEnergyEditor();
      removeDuplicateRoomNav();
      applyOptionalFlowVisibility();
    });
  });
  state.storeSubscribed = true;
  return true;
}

function installWrappers() {
  const state = runtime();
  wrapRender("renderEnergyDashboard", () => applyBundle());
  wrapRender("renderEdDeviceList", () => applyDeviceRows(state.bundle));
  wrapRender("renderApplianceSection", () => {
    removeDuplicateRoomNav();
    normalizeArtwork();
  });
  wrapRender("renderEnergy", applyOptionalFlowVisibility);
  wrapRender("switchEnergyView", applyOptionalFlowVisibility);
  wrapRender("editorSwitch", () => {
    decorateEnergyEditor();
    installApplianceEditor();
  });
  installArtworkOwner();
  installStoreMerge();
  installApplianceEditor();
  subscribeStore();
  state.wrappersInstalled = true;
  return true;
}

function disableLegacyRuntimes() {
  const timerNames = [
    "retryTimer",
    "wrapperTimer",
    "wrappersTimer",
    "sampleTimer",
    "timer",
    "restoreTimer",
    "periodTimer",
    "currentTimer",
  ];
  COMPAT_KEYS.forEach((key) => {
    const value = globalThis[key];
    if (!value || value === runtime()) return;
    timerNames.forEach((name) => {
      if (!value[name]) return;
      globalThis.clearInterval?.(value[name]);
      globalThis.clearTimeout?.(value[name]);
      value[name] = 0;
    });
    value.observer?.disconnect?.();
    value.pageObserver?.disconnect?.();
  });
}

function installStyles() {
  if (document.getElementById("dm-runtime-consolidated-style")) return;
  const style = document.createElement("style");
  style.id = "dm-runtime-consolidated-style";
  style.textContent = `
    .dm-period-loading-0150 .ed-kpi-banner,
    .dm-period-loading-0150 #ed-year-summary,
    .dm-period-loading-0150 #ed-device-list { opacity:.72; }
    .dm-total-energy-field-0150 { border-color:rgba(16,185,129,.35)!important; background:rgba(236,253,245,.55)!important; }
    #dm-appliance-room-nav-0157,.dm-appliance-room-nav-0157 { display:none!important; }
    #page-appliances-main .appl-wide-card[hidden] { display:none!important; }
  `;
  document.head.append(style);
}

function installCompatibility() {
  const state = runtime();
  const shared = {
    installed: true,
    ready: state.ready,
    version: VERSION,
    broker,
    statistics: broker.statistics.bind(broker),
    monthValues: (ids, month, year) => broker.valuesForEntities(ids, "month", new Date(year, month - 1, 1)),
    yearValues: (ids, year) => broker.valuesForEntities(ids, "year", new Date(year, 0, 1)),
    refreshCurrent: () => refreshEnergyStatistics0152(new Date()),
    refreshOverview: () => refreshSelectedPeriod(),
  };
  COMPAT_KEYS.forEach((key) => {
    globalThis[key] = { ...(globalThis[key] || {}), ...shared };
  });
  globalThis.fetchHAStatistics = broker.statistics.bind(broker);
  globalThis.__DASHBOARDMODERN_RELEASE_0152__.refreshEnergyStatistics0152 = refreshEnergyStatistics0152;
  globalThis.__DASHBOARDMODERN_RELEASE_0154__.refreshEnergyPeriods0154 = refreshEnergyStatistics0152;
}

function onPeriodChange(event) {
  if (!event.target?.matches?.("#ed-sel-month,#ed-sel-year")) return;
  const period = selectedPeriod();
  event.stopImmediatePropagation();
  scheduleRefresh(0, period);
}

function settle(attempt = 0) {
  installWrappers();
  decorateEnergyEditor();
  removeDuplicateRoomNav();
  normalizeArtwork();
  applyOptionalFlowVisibility();
  if (runtime().wrappersInstalled && dashboardStore()) return true;
  if (attempt >= 90) return false;
  globalThis.requestAnimationFrame?.(() => settle(attempt + 1));
  return false;
}

async function start() {
  const state = runtime();
  installStyles();
  disableLegacyRuntimes();
  installCompatibility();
  settle();
  try {
    await broker.startStateFeed();
  } catch (error) {
    console.warn("[DashboardModern 0.15.0] live state feed", error);
  }
  state.ready = true;
  installCompatibility();
  scheduleRefresh(0);
  globalThis.__DASHBOARDMODERN_RUNTIME_READY__ = true;
  globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:runtime-ready", { detail: { version: VERSION } }));
}

function install() {
  const state = runtime();
  if (state.eventsInstalled) return;
  state.eventsInstalled = true;
  document.addEventListener("change", onPeriodChange, true);
  state.metrics.listeners += 1;
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => settle(), { once: true });
  globalThis.addEventListener?.("pageshow", () => {
    settle();
    applyBundle();
  });
  state.metrics.listeners += 2;
  start();
}

export {
  PERIOD_SOURCES,
  applianceArtwork,
  applianceArtwork0152,
  canonicalArtworkType,
  isCumulativeEnergyEntity,
  periodConsumption,
  periodRange,
  sourcePlans,
};

export const DashboardModernRuntime0150 = Object.freeze({
  broker,
  refreshSelectedPeriod,
  refreshEnergyStatistics0152,
  applyBundle,
  applyOptionalFlowVisibility,
  removeDuplicateRoomNav,
  runtime,
});

globalThis.DashboardModernRuntime0150 = DashboardModernRuntime0150;

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
