import {
  HomeAssistantBroker,
  PERIOD_SOURCES,
  periodConsumption,
  recorderBucketConsumptions,
  sourcePlans,
} from "../core/period-service.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  finite,
  formatNumber,
  installStyle,
  readJson,
  root,
  section,
  selectedPeriod,
  t,
  wrapFunction,
} from "./shared.js";
import {
  isHostedDashboard,
  sanitizeHostedCredentials,
  waitForHostedBridge,
} from "../transport/hosted-bridge-guard.js";
import { runtimeMetrics } from "../core/runtime-metrics.js";

const KEY = "__DASHBOARDMODERN_RUNTIME_ROOT__";
const VERSION = "0.15.4";
const state = (root[KEY] ||= {});
Object.assign(state, {
  installed: true,
  version: VERSION,
  ready: Boolean(state.ready),
  generation: Number(state.generation) || 0,
  bundle: state.bundle || null,
  selected: state.selected || null,
  lastRefreshAt: Number(state.lastRefreshAt) || 0,
  refreshTimer: state.refreshTimer || 0,
  retryCount: Number(state.retryCount) || 0,
  projectionFrame: state.projectionFrame || 0,
  applying: false,
  brokerStarted: Boolean(state.brokerStarted),
  observer: state.observer || null,
  listeners: Boolean(state.listeners),
  wrappers: state.wrappers || new Set(),
  storeUnsubscribe: state.storeUnsubscribe || null,
  lastError: "",
});
root.__DASHBOARDMODERN_RUNTIME_0150__ = state;

const PLACEHOLDER = "__dashboardmodern_hosted__";

class SafeHomeAssistantBroker extends HomeAssistantBroker {
  token() {
    const token = clean(super.token());
    return token === PLACEHOLDER ? "" : token;
  }

  async connect() {
    if (isHostedDashboard()) {
      sanitizeHostedCredentials();
      await waitForHostedBridge({ timeout: 5000, interval: 25 });
    }
    return super.connect();
  }

  handleMessage(event, resolveConnection, rejectConnection) {
    let message = null;
    try {
      message = JSON.parse(event?.data || event);
    } catch (_error) {}
    if (message?.type === "auth_required" && isHostedDashboard()) {
      const error = new Error("Hosted DashboardModern transport requested native authentication");
      try {
        this.socket?.close?.();
      } catch (_error) {}
      rejectConnection(error);
      return;
    }
    return super.handleMessage(event, resolveConnection, rejectConnection);
  }
}

const broker = new SafeHomeAssistantBroker({
  timeout: 12000,
  cacheCurrentMs: 10000,
  cacheHistoricalMs: 600000,
});
root.DashboardModernEnergyService = Object.freeze({
  statistics: (ids, start, end, period) => broker.statistics(ids, start, end, period),
  async statisticsWithGrowth(ids, start, end, period = "day") {
    const boundary = new Date(start);
    const baselineStart = new Date(boundary);
    if (period === "hour") baselineStart.setHours(baselineStart.getHours() - 2);
    else if (period === "month") baselineStart.setMonth(baselineStart.getMonth() - 1);
    else baselineStart.setDate(baselineStart.getDate() - 2);
    const result = await broker.statistics(ids, baselineStart, end, period);
    return Object.fromEntries(ids.map((id) => {
      const ordered = (result[id] || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start));
      const before = ordered.filter((row) => new Date(row.start) < boundary);
      const within = ordered.filter((row) => new Date(row.start) >= boundary && new Date(row.start) < new Date(end));
      return [id, recorderBucketConsumptions(within, before.at(-1) || null)];
    }));
  },
  consumption: periodConsumption,
  buckets: recorderBucketConsumptions,
  broker,
  refresh: () => scheduleEnergyRefresh(true),
});

const ENERGY_KEYS = PERIOD_SOURCES.map((item) => item.key);
const FLOW_IDS = Object.freeze([
  "v-solar-day",
  "v-home-day",
  "v-grid-day",
  "v-battery-day",
  "v-solar-month",
  "v-home-month",
  "v-grid-month",
  "v-battery-month",
  "ed-kpi-prod",
  "ed-kpi-cons",
]);

function energyModel() {
  return section("energy", {});
}

function entityOverrides() {
  const current = section("entityOverrides", null);
  return current && typeof current === "object"
    ? current
    : readJson("cd_entity_overrides", root.ENTITY_OVERRIDES || {});
}

function hasConfiguredEnergy() {
  const energy = energyModel();
  return PERIOD_SOURCES.some((definition) => {
    const group = energy?.[definition.group] || {};
    return Boolean(
      clean(group[definition.totalKey]) ||
        Object.values(definition.periodKeys).some((key) => clean(group[key])),
    );
  });
}

function selectedDate(period = selectedPeriod()) {
  return new Date(period.year, period.month - 1, 1);
}

function emptyPeriod() {
  return Object.freeze(Object.fromEntries(ENERGY_KEYS.map((key) => [key, 0])));
}

function buildPeriodRecord(plans, values) {
  const byKey = new Map(plans.map((plan) => [plan.key, plan]));
  const missing = plans.filter((plan) => !values.has(plan.key));
  const data = {};
  ENERGY_KEYS.forEach((key) => {
    data[key] = byKey.has(key) ? finite(values.get(key)) : 0;
  });
  return {
    data: Object.freeze(data),
    plans,
    values,
    complete: missing.length === 0,
    missing,
  };
}

async function loadEnergyPeriod(kind, date) {
  const plans = sourcePlans(
    energyModel(),
    kind,
    allStates(),
    entityOverrides(),
    root.resolveEntity || ((value) => value),
  );
  if (!plans.length) {
    return { data: emptyPeriod(), plans, values: new Map(), complete: true, missing: [] };
  }
  const values = await broker.valuesForPlans(plans, date, allStates());
  return buildPeriodRecord(plans, values);
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
  if (!ids.length) return { devices, values: new Map() };
  return { devices, values: await broker.valuesForEntities(ids, kind, date) };
}

function rates() {
  const read = (key) => {
    const configured = root.cdCfg?.(key);
    if (configured !== undefined && configured !== null && configured !== "")
      return finite(configured);
    return finite(root.localStorage?.getItem(key));
  };
  return { importPrice: read("cd_costo_kwh"), exportPrice: read("cd_prezzo_immissione") };
}

function incompleteMessage(results) {
  return results
    .flatMap(([kind, result]) =>
      result.missing.map((plan) => `${kind}:${plan.group}.${plan.key}:${plan.entity}`),
    )
    .join(", ");
}

export async function loadAtomicEnergyBundle(period = selectedPeriod()) {
  runtimeMetrics.increment("energyRefreshes");
  const generation = ++state.generation;
  const monthDate = selectedDate(period);
  const today = new Date();
  const [dayResult, monthResult, yearResult, deviceMonth, deviceYear] = await Promise.all([
    loadEnergyPeriod("day", today),
    loadEnergyPeriod("month", monthDate),
    loadEnergyPeriod("year", monthDate),
    loadDevicePeriod("month", monthDate),
    loadDevicePeriod("year", monthDate),
  ]);
  if (generation !== state.generation) return null;

  const results = [
    ["day", dayResult],
    ["month", monthResult],
    ["year", yearResult],
  ];
  if (results.some(([, result]) => !result.complete)) {
    throw new Error(`Incomplete Home Assistant statistics: ${incompleteMessage(results)}`);
  }

  return Object.freeze({
    generation,
    period: Object.freeze({ ...period }),
    day: dayResult.data,
    month: monthResult.data,
    year: yearResult.data,
    sources: Object.freeze({ day: dayResult, month: monthResult, year: yearResult }),
    deviceMonth,
    deviceYear,
    rates: Object.freeze(rates()),
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

function commitDerived(bundle) {
  const dates = {
    day: new Date(),
    month: selectedDate(bundle.period),
    year: new Date(bundle.period.year, 0, 1),
  };
  for (const kind of ["day", "month", "year"]) {
    const result = bundle.sources[kind];
    result.plans.forEach((plan) => writeDerived(plan, result.values.get(plan.key), kind, dates[kind]));
  }
}

function setText(id, value) {
  const node = doc?.getElementById(id);
  if (!node || node.textContent === value) return false;
  node.textContent = value;
  return true;
}

function setHtml(id, value) {
  const node = doc?.getElementById(id);
  if (!node || node.innerHTML === value) return false;
  node.innerHTML = value;
  return true;
}

function kwh(value, digits = 1) {
  return `${formatNumber(value, digits)} kWh`;
}

function dual(imported, exported, battery = false) {
  const down = battery ? "var(--success-color,#10b981)" : "var(--error-color,#e11d48)";
  const up = battery ? "var(--error-color,#e11d48)" : "var(--success-color,#10b981)";
  return `<span style="color:${down}">↓ ${formatNumber(imported, 1)} kWh</span><br><span style="color:${up}">↑ ${formatNumber(exported, 1)} kWh</span>`;
}

function applyFlow(kind, data) {
  const suffix = kind === "day" ? "day" : "month";
  setText(`v-solar-${suffix}`, kwh(data.solar));
  setText(`v-home-${suffix}`, kwh(data.house));
  setHtml(`v-grid-${suffix}`, dual(data.gridImport, data.gridExport));
  setHtml(`v-battery-${suffix}`, dual(data.batteryCharged, data.batteryDischarged, true));
  for (const key of ["solar", "home", "grid", "battery"]) {
    const node = doc?.getElementById(`n-${key}-${suffix}`);
    if (node) node.dataset.dmPeriodOwner = VERSION;
  }
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
  setHtml("ed-kpi-prod", `${formatNumber(data.solar)} <small>kWh</small>`);
  setHtml("ed-kpi-cons", `${formatNumber(data.house)} <small>kWh</small>`);
  setHtml("ed-kpi-auto", `${auto} <small>%</small>`);
  const chips = doc?.getElementById("ed-yoy-chips");
  if (chips) {
    const value = [
      `<span class="ed-yoy-chip">☀️ ${kwh(data.solar)}</span>`,
      `<span class="ed-yoy-chip">🏠 ${kwh(data.house)}</span>`,
      `<span class="ed-yoy-chip">⚡ ${kwh(data.gridImport)} ${t("da Rete", "from Grid")}</span>`,
    ].join("");
    if (chips.innerHTML !== value) chips.innerHTML = value;
  }
  const money = financial(data, bundle);
  setText("ed-fin-pagato", `${formatNumber(money.withoutSolar, 2)} €`);
  setText("ed-fin-pagato-sub", kwh(data.house));
  setText("ed-fin-costo", `${formatNumber(money.realCost, 2)} €`);
  setText("ed-fin-costo-sub", `${kwh(data.gridImport)} ${t("dalla rete", "from grid")}`);
  setText("ed-fin-risp", `${formatNumber(money.saved, 2)} €`);
  setText("ed-fin-imm", `${formatNumber(money.exportIncome, 2)} €`);
  setText("ed-auto-big", `${auto}%`);
  setText("ed-auto-ring-val", `${auto}%`);
  const circle = doc?.getElementById("ed-auto-circle");
  if (circle) circle.setAttribute("stroke-dasharray", `${(201 * auto) / 100} 201`);
}

function applyAnnual(bundle) {
  const data = bundle.year;
  const money = financial(data, bundle);
  setText("ed-year-summary-year", String(bundle.period.year));
  setText("ed-year-pagato", `${formatNumber(money.importCost, 2)} €`);
  setText("ed-year-pagato-sub", `${kwh(data.gridImport)} ${t("dalla rete", "from grid")}`);
  setText("ed-year-risparmio", `${formatNumber(money.saved, 2)} €`);
  setText("ed-year-risparmio-sub", `${t("su", "on")} ${kwh(data.house)}`);
  setText("ed-dkpi-year-lbl", String(bundle.period.year));
}

function applyDeviceRows(bundle) {
  const list = doc?.getElementById("ed-device-list");
  if (!list) return;
  const { devices, values } = bundle.deviceMonth;
  const available = devices
    .map((device) => values.get(device.entity))
    .filter((value) => Number.isFinite(value));
  const maximum = Math.max(0.001, ...available);
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
    if (valueNode) valueNode.innerHTML = `${formatNumber(value)} <small>kWh</small>`;
    const eur = row.querySelector(".ed-dev-eur");
    if (eur) eur.textContent = `${formatNumber(value * bundle.rates.importPrice, 2)} €`;
    const fill = row.querySelector(".ed-dev-bar-fill,.ed-dev-bar");
    if (fill) fill.style.width = `${Math.min(100, (value / maximum) * 100)}%`;
    row.querySelectorAll(".ed-dev-live,.ed-dev-total-live,.ed-dev-name small").forEach((node) => {
      node.hidden = true;
    });
  });
  setText("ed-dev-total", kwh(total));
}

function valueFrom(values, entity) {
  const value = values instanceof Map ? values.get(entity) : values?.[entity];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function splitFor(period, value) {
  const house = finite(period?.house);
  const grid = finite(period?.gridImport);
  const gridShare = house > 0 ? Math.max(0, Math.min(1, grid / house)) : 1;
  return { grid: value * gridShare, solar: value * (1 - gridShare) };
}

function applyDeviceDetail(bundle) {
  const selector = doc?.getElementById("ed-dev-selector");
  const entity = clean(selector?.value);
  if (!entity || !bundle?.deviceMonth || !bundle?.deviceYear) return false;
  const monthValue = valueFrom(bundle.deviceMonth.values, entity);
  const yearValue = valueFrom(bundle.deviceYear.values, entity);
  if (monthValue == null || yearValue == null) return false;
  const selectedMonth = Number(bundle.period?.month) || new Date().getMonth() + 1;
  const selectedYear = Number(bundle.period?.year) || new Date().getFullYear();
  const days = new Date(selectedYear, selectedMonth, 0).getDate();
  const importPrice = finite(bundle.rates?.importPrice);
  const monthSplit = splitFor(bundle.month, monthValue);
  const yearSplit = splitFor(bundle.year, yearValue);

  setText("ed-dkpi-mese", `${formatNumber(monthValue, 1)} kWh`);
  setText("ed-dkpi-mese-eur", `€ ${formatNumber(monthValue * importPrice, 2)}`);
  setText("ed-dkpi-media", `${formatNumber(days ? monthValue / days : 0, 2)} kWh`);
  setText("ed-dkpi-media-sub", t("Media/giorno", "Daily average"));
  setText("ed-dkpi-risp-eur", `+ ${formatNumber(monthSplit.solar * importPrice, 2)} €`);
  setText("ed-dkpi-risp-kwh", `${formatNumber(monthSplit.solar, 1)} kWh ${t("da FV", "from solar")}`);
  setText("ed-dkpi-costo-eur", `- ${formatNumber(monthSplit.grid * importPrice, 2)} €`);
  setText("ed-dkpi-costo-kwh", `${formatNumber(monthSplit.grid, 1)} kWh ${t("dalla rete", "from grid")}`);
  setText("ed-dkpi-year-lbl", String(selectedYear));
  setText("ed-dkpi-anno-risp-eur", `+ ${formatNumber(yearSplit.solar * importPrice, 2)} €`);
  setText("ed-dkpi-anno-risp-kwh", `${formatNumber(yearSplit.solar, 1)} kWh ${t("da FV", "from solar")}`);
  setText("ed-dkpi-anno-costo-eur", `- ${formatNumber(yearSplit.grid * importPrice, 2)} €`);
  setText("ed-dkpi-anno-costo-kwh", `${formatNumber(yearSplit.grid, 1)} kWh ${t("dalla rete", "from grid")}`);

  const panel = doc?.querySelector(".ed-device-detail,#ed-device-detail");
  if (panel)
    panel.dataset.dmCanonicalDevicePeriod = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}|${monthValue}`;
  return true;
}

export function applyAtomicEnergyBundle(bundle = state.bundle) {
  if (!bundle || !doc || state.applying) return false;
  state.applying = true;
  try {
    applyFlow("day", bundle.day);
    applyFlow("month", bundle.month);
    applyReportOverview(bundle);
    applyAnnual(bundle);
    applyDeviceRows(bundle);
    applyDeviceDetail(bundle);
    doc.querySelectorAll("#view-day,#view-month,#view-panoramica").forEach((node) => {
      node.dataset.dmEnergyBundle = String(bundle.generation);
      node.classList.remove("dm-energy-awaiting");
      node.removeAttribute("aria-busy");
    });
    return true;
  } finally {
    state.applying = false;
  }
}

function setEnergyLoading(active) {
  doc?.querySelectorAll("#view-day,#view-month,#view-panoramica").forEach((node) => {
    node.toggleAttribute("aria-busy", active);
    node.classList.toggle("dm-energy-loading", active);
    node.classList.toggle("dm-energy-awaiting", active && !state.bundle && hasConfiguredEnergy());
  });
}

export async function refreshEnergy(period = selectedPeriod()) {
  setEnergyLoading(true);
  try {
    const bundle = await loadAtomicEnergyBundle(period);
    if (!bundle) return false;
    commitDerived(bundle);
    state.bundle = bundle;
    state.selected = bundle.period;
    state.lastRefreshAt = Date.now();
    state.retryCount = 0;
    state.lastError = "";
    state.ready = true;
    applyAtomicEnergyBundle(bundle);
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }));
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:energy-stable", { detail: bundle }));
    return true;
  } catch (error) {
    state.lastError = clean(error?.message || error);
    root.console?.warn?.("[DashboardModern] atomic energy refresh retained the last good bundle", error);
    if (!state.bundle && state.retryCount < 40) {
      state.retryCount += 1;
      scheduleEnergyRefresh(true, 250);
    }
    return false;
  } finally {
    setEnergyLoading(false);
  }
}

function scheduleProjection() {
  if (!state.bundle || state.projectionFrame) return;
  const callback = () => {
    state.projectionFrame = 0;
    applyAtomicEnergyBundle(state.bundle);
  };
  state.projectionFrame = root.requestAnimationFrame?.(callback) || root.setTimeout?.(callback, 0);
}

function scheduleEnergyRefresh(force = false, explicitDelay = null) {
  root.clearTimeout?.(state.refreshTimer);
  const elapsed = Date.now() - state.lastRefreshAt;
  const delay = explicitDelay ?? (force ? 0 : Math.max(250, 15000 - elapsed));
  state.refreshTimer = root.setTimeout?.(() => {
    state.refreshTimer = 0;
    refreshEnergy();
  }, delay);
}

const TOTAL_FIELDS = Object.freeze([
  ["house", "total_energy", "annual_energy", "Energia totale", "Total energy", "sensor.casa_totale"],
  ["solar", "total_energy", "annual_energy", "Energia totale", "Total energy", "sensor.fv_totale"],
  ["grid", "total_import_energy", "monthly_import_energy", "Energia totale prelevata", "Total imported energy", "sensor.rete_prelievo_totale"],
  ["grid", "total_export_energy", "monthly_export_energy", "Energia totale immessa", "Total exported energy", "sensor.rete_immissione_totale"],
  ["battery", "daily_discharged_energy", "daily_charged_energy", "Scaricata oggi", "Discharged today", "sensor.batteria_scaricata_oggi"],
  ["battery", "monthly_discharged_energy", "monthly_charged_energy", "Scaricata questo mese", "Discharged this month", "sensor.batteria_scaricata_mese"],
  ["battery", "total_charged_energy", "monthly_charged_energy", "Energia totale caricata", "Total charged energy", "sensor.batteria_caricata_totale"],
  ["battery", "total_discharged_energy", "monthly_discharged_energy", "Energia totale scaricata", "Total discharged energy", "sensor.batteria_scaricata_totale"],
]);

function createTotalField(definition, value) {
  const [group, key, _after, italian, englishLabel, example] = definition;
  const label = english() ? englishLabel : italian;
  const wrap = doc.createElement("label");
  wrap.className = "ed-slot dm-energy-total-field";
  wrap.dataset.dmInjectedEnergyTotal = "true";
  wrap.dataset.energyGroup = group;
  wrap.dataset.energyKey = key;
  wrap.innerHTML = `<span class="ed-slot-lbl">${esc(label)} <span class="ed-acc-n">kWh</span> <span class="ed-acc-n">${t("Facoltativo", "Optional")}</span></span><span class="ed-hint">${t("Entità Home Assistant, es.", "Home Assistant entity, e.g.")} ${esc(example)}</span>`;
  const field = doc.createElement("span");
  field.className = "dm-entity-field";
  field.dataset.entityField = "";
  const row = doc.createElement("span");
  row.className = "ed-form-row";
  const input = doc.createElement("input");
  input.id = `dm-energy-${group}-${key}`;
  input.name = `${group}.${key}`;
  input.className = "ed-input ed-slot-in mono";
  input.dataset.entityInput = "true";
  input.value = clean(value);
  input.placeholder = example;
  const picker = doc.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.dataset.entityTarget = input.id;
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `${t("Seleziona", "Select")} ${label}`);
  picker.addEventListener("click", () => root.wzPickEntity?.(input));
  row.append(input, picker);
  field.append(row);
  const stateValue = allStates()[input.value];
  if (input.value && stateValue) {
    const preview = doc.createElement("output");
    preview.className = "ed-row-old dm-entity-preview";
    preview.textContent = `${stateValue.state} kWh`;
    field.append(preview);
  }
  const note = doc.createElement("small");
  note.className = "dm-energy-total-note dm-energy-total-help";
  note.textContent = t(
    "Contatore cumulativo kWh con state_class total o total_increasing.",
    "Cumulative kWh meter with state_class total or total_increasing.",
  );
  wrap.append(field, note);
  return { wrap, input };
}

async function persistEnergyField(group, key, value) {
  const store = dashboardStore();
  if (!store?.getSection || !store?.replaceSection) return;
  const model = structuredClone(store.getSection("energy") || {});
  model[group] ||= {};
  model[group][key] = clean(value);
  model.metadata = { ...(model.metadata || {}), semantics_version: 3 };
  await store.replaceSection("energy", model);
}

function updateConfiguredCount(body) {
  const counter = body?.closest("details.ed-acc")?.querySelector("summary small");
  if (!counter) return;
  const inputs = [...body.querySelectorAll("input[name]")];
  counter.textContent = `${inputs.filter((input) => clean(input.value)).length}/${inputs.length} ${t("configurati", "configured")}`;
}

function installEnergyEditorContracts() {
  const editor = doc?.querySelector('#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]');
  if (!editor) return false;
  editor.querySelectorAll(".dm-energy-total-overview:not(.dm-energy-help-compact),.dm-energy-total-help:not(.dm-energy-total-note)").forEach((node) => node.remove());
  const flows = editor.querySelector('[data-energy-panel="flows"]') || editor;
  let overview = flows.querySelector(".dm-energy-help-compact");
  if (!overview) {
    overview = doc.createElement("div");
    overview.className = "dm-energy-help-compact dm-energy-total-overview";
    overview.innerHTML = t(
      "<strong>Storico Energia</strong><span>Per calcolare giorno, mese, anno e mesi precedenti usa un contatore cumulativo in kWh. I sensori giornalieri, mensili e annuali restano facoltativi.</span>",
      "<strong>Energy history</strong><span>Use a cumulative kWh meter to calculate day, month, year and previous months. Daily, monthly and annual sensors remain optional.</span>",
    );
    flows.prepend(overview);
  }

  const model = energyModel();
  TOTAL_FIELDS.forEach((definition) => {
    const [group, key, afterKey] = definition;
    if (editor.querySelector(`#dm-energy-${group}-${key}`)) return;
    const anchor = editor.querySelector(`#dm-energy-${group}-${afterKey}`);
    const body = anchor?.closest(".ed-acc-body");
    if (!body) return;
    const { wrap, input } = createTotalField(definition, model[group]?.[key]);
    const anchorField = anchor.closest("label.ed-slot");
    if (anchorField?.parentElement === body) anchorField.after(wrap);
    else body.append(wrap);
    input.addEventListener("input", () => {
      const actions = editor.querySelector("[data-energy-actions]");
      const save = actions?.querySelector("[data-energy-save]");
      if (actions) actions.dataset.state = "dirty";
      if (save) save.disabled = false;
      updateConfiguredCount(body);
    });
    input.addEventListener("change", async () => {
      input.dataset.validation = !input.value || allStates()[input.value] ? "valid" : "invalid";
      try {
        await persistEnergyField(group, key, input.value);
        scheduleEnergyRefresh(true);
      } catch (error) {
        input.dataset.validation = "invalid";
        root.console?.error?.("[DashboardModern] total energy field", error);
      }
    });
    updateConfiguredCount(body);
  });
  return true;
}

function installObserver() {
  if (!doc || state.observer || typeof root.MutationObserver !== "function") return;
  const nodes = FLOW_IDS.map((id) => doc.getElementById(id)).filter(Boolean);
  if (!nodes.length) return;
  state.observer = new root.MutationObserver(() => {
    if (!state.applying && state.bundle) scheduleProjection();
  });
  nodes.forEach((node) => state.observer.observe(node, { childList: true, characterData: true, subtree: true }));
}

function installStyles() {
  installStyle(
    "dm-energy-section-style",
    `
      .dm-energy-awaiting{position:relative!important}
      .dm-energy-awaiting #n-solar-day,.dm-energy-awaiting #n-home-day,.dm-energy-awaiting #n-grid-day,.dm-energy-awaiting #n-battery-day,
      .dm-energy-awaiting #n-solar-month,.dm-energy-awaiting #n-home-month,.dm-energy-awaiting #n-grid-month,.dm-energy-awaiting #n-battery-month{visibility:hidden!important}
      .dm-energy-awaiting::after{content:"${t("Caricamento dati Energia…", "Loading Energy data…")}";position:absolute;inset:0;display:grid;place-items:center;color:var(--secondary-text-color,#64748b);font-weight:800;letter-spacing:.04em;background:color-mix(in srgb,var(--card-bg,#fff) 88%,transparent);z-index:3}
      .dm-energy-loading:not(.dm-energy-awaiting){opacity:.92;transition:opacity .15s ease}
      .dm-energy-help-compact{display:grid;gap:4px;margin:0 0 14px;padding:12px 14px;border:1px solid var(--divider-color,rgba(15,23,42,.12));border-radius:14px;background:var(--secondary-background-color,rgba(14,165,233,.08));color:var(--primary-text-color,#0f172a);font-size:13px;line-height:1.45}
      .dm-energy-help-compact strong{font-size:14px}
      .dm-energy-total-note{display:block;margin-top:6px;color:var(--secondary-text-color,#64748b);font-size:11px;line-height:1.35}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-help-compact{background:var(--dm-editor-panel,#1b2540);border-color:var(--dm-editor-border,#263453);color:var(--dm-editor-text,#e6edf7)}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-total-note{color:var(--dm-editor-muted,#92a4c2)}
    `,
  );
}

function installWrappers() {
  for (const name of ["render", "renderEnergyDashboard", "renderEdDeviceList"]) {
    wrapFunction(name, "__dmEnergySection", scheduleProjection);
  }
  wrapFunction("edCaricaDettaglio", "__dmEnergyDetailSection", scheduleProjection);
  wrapFunction("editorSwitch", "__dmEnergyEditorSection", installEnergyEditorContracts);
}

function bindEvents() {
  if (!doc || state.listeners) return;
  state.listeners = true;
  doc.addEventListener("change", (event) => {
    if (event.target?.matches?.("#ed-sel-month,#ed-sel-year")) scheduleEnergyRefresh(true);
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab='energy'],.sub-tab-btn,.ed-tab[data-tab='sez1'],[data-energy-tab]")) {
        root.queueMicrotask?.(() => {
          installEnergyEditorContracts();
          scheduleProjection();
        });
      }
    },
    true,
  );
  root.addEventListener?.("dashboardmodern:state-changed", () => scheduleEnergyRefresh(false));
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installWrappers();
    installObserver();
    installEnergyEditorContracts();
    scheduleEnergyRefresh(true);
  });
  root.addEventListener?.("pageshow", () => {
    installWrappers();
    installObserver();
    if (state.bundle) scheduleProjection();
    else scheduleEnergyRefresh(true);
  });
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (["energy", "appliances", "loads", "entityOverrides"].includes(change.section)) {
      scheduleEnergyRefresh(true);
    }
  });
}

async function startBroker() {
  if (state.brokerStarted) return;
  state.brokerStarted = true;
  try {
    await broker.startStateFeed();
  } catch (error) {
    state.brokerStarted = false;
    state.lastError = clean(error?.message || error);
    if (state.retryCount < 40) scheduleEnergyRefresh(true, 250);
  }
}

export function installEnergySection() {
  if (!doc) return;
  sanitizeHostedCredentials();
  installStyles();
  installWrappers();
  bindEvents();
  subscribeStore();
  installObserver();
  installEnergyEditorContracts();
  startBroker();
  if (hasConfiguredEnergy()) {
    if (state.bundle) applyAtomicEnergyBundle(state.bundle);
    else scheduleEnergyRefresh(true);
  } else {
    state.ready = true;
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergySection, { once: true });
else installEnergySection();
