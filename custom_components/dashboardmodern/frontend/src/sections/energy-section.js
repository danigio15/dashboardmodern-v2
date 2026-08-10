import {
  HomeAssistantBroker,
  PERIOD_SOURCES,
  periodConsumption,
  recorderBucketConsumptions,
  sourcePlans,
} from "../core/period-service.js";
import { reconcileEnergyBundle } from "./energy-calculations-section.js";
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
import { BUILD_INFO } from "../../legacy/build-info.js";

const KEY = "__DASHBOARDMODERN_RUNTIME_ROOT__";
const VERSION = BUILD_INFO.dashboardVersion || BUILD_INFO.integrationVersion || "UNBUILT";
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
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;

function energyModel() {
  return section("energy", {});
}

function entityOverrides() {
  const current = section("entityOverrides", null);
  return current && typeof current === "object"
    ? current
    : readJson("cd_entity_overrides", {});
}

function configuredReference(value) {
  const raw = clean(value);
  if (!raw) return "";
  const override = clean(entityOverrides()[raw]);
  return override || raw;
}

function sourceFor(key) {
  const energy = energyModel();
  const plan = sourcePlans(energy)[key] || [];
  return plan.map(configuredReference).filter(Boolean);
}

function sourceId(key) {
  return sourceFor(key)[0] || "";
}

function allEnergyEntityIds() {
  const ids = new Set();
  for (const key of ENERGY_KEYS) {
    sourceFor(key).forEach((id) => ids.add(id));
  }
  return ids;
}

function hasConfiguredEnergy() {
  return allEnergyEntityIds().size > 0;
}

function eventEntityIds(event) {
  const detail = event?.detail || {};
  const values = detail.entity_ids || [detail.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function stateChangeAffectsEnergy(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = allEnergyEntityIds();
  return [...changed].some((id) => configured.has(id));
}

function configuredRates() {
  const cfg = (key, fallback = 0) => {
    const value = root.cdCfg?.(key);
    const raw = value !== undefined && value !== null && value !== ""
      ? value
      : root.localStorage?.getItem?.(key);
    const parsed = Number(String(raw ?? fallback).replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    importPrice: cfg("cd_costo_kwh", 0),
    exportPrice: cfg("cd_prezzo_immissione", 0),
  };
}

function bucketPeriod(period) {
  const selected = selectedPeriod(period);
  const year = Number(selected.year) || new Date().getFullYear();
  const month = Math.max(1, Math.min(12, Number(selected.month) || new Date().getMonth() + 1));
  const day = Math.max(1, Math.min(31, Number(selected.day) || new Date().getDate()));
  const startDay = new Date(year, month - 1, day);
  const endDay = new Date(year, month - 1, day + 1);
  const startMonth = new Date(year, month - 1, 1);
  const endMonth = new Date(year, month, 1);
  const startYear = new Date(year, 0, 1);
  const endYear = new Date(year + 1, 0, 1);
  return { selected: { year, month, day }, startDay, endDay, startMonth, endMonth, startYear, endYear };
}

async function fetchPeriodData(start, end, period) {
  const energy = energyModel();
  const plans = sourcePlans(energy);
  const ids = [...new Set(Object.values(plans).flat().map(configuredReference).filter(Boolean))];
  if (!ids.length) return null;
  const stats = await broker.statistics(ids, start, end, period);
  const values = {};
  for (const item of PERIOD_SOURCES) {
    const candidates = (plans[item.key] || []).map(configuredReference).filter(Boolean);
    let value = null;
    for (const entity of candidates) {
      const rows = stats[entity] || [];
      const amount = periodConsumption(rows);
      if (Number.isFinite(amount)) {
        value = amount;
        break;
      }
    }
    values[item.key] = Number.isFinite(value) ? value : 0;
  }
  return reconcileEnergyBundle(values);
}

function normalizedDeviceSource(item = {}) {
  const source = clean(item.history || item.history_entity || item.total_energy_entity || item.monthly_energy_entity || item.report_entity || item.entity);
  return configuredReference(source);
}

function reportDevices() {
  const appliances = section("appliances", []);
  const loads = section("loads", []);
  return [...(Array.isArray(appliances) ? appliances : []), ...(Array.isArray(loads) ? loads : [])]
    .filter((item) => item.show_in_report !== false)
    .map((item) => ({ ...item, history: normalizedDeviceSource(item) }));
}

async function loadDevicePeriod(devices, start, end, period = "month") {
  const ids = [...new Set(devices.map((item) => item.history).filter(Boolean))];
  if (!ids.length) return { devices, values: new Map() };
  const rows = await broker.statistics(ids, start, end, period);
  const values = new Map();
  ids.forEach((id) => values.set(id, periodConsumption(rows[id] || [])));
  return { devices, values };
}

async function loadAtomicEnergyBundle(period = selectedPeriod()) {
  const range = bucketPeriod(period);
  const devices = reportDevices();
  const [day, month, year, deviceMonth, deviceYear] = await Promise.all([
    fetchPeriodData(range.startDay, range.endDay, "hour"),
    fetchPeriodData(range.startMonth, range.endMonth, "day"),
    fetchPeriodData(range.startYear, range.endYear, "month"),
    loadDevicePeriod(devices, range.startMonth, range.endMonth, "day"),
    loadDevicePeriod(devices, range.startYear, range.endYear, "month"),
  ]);
  return {
    generation: ++state.generation,
    period: range.selected,
    day: day || reconcileEnergyBundle({}),
    month: month || reconcileEnergyBundle({}),
    year: year || reconcileEnergyBundle({}),
    rates: configuredRates(),
    deviceMonth,
    deviceYear,
  };
}

function commitDerived(bundle) {
  const current = dashboardStore()?.getSection?.("energy") || {};
  const next = {
    ...(current.derived || {}),
    selected_period: bundle.period,
    day: bundle.day,
    month: bundle.month,
    year: bundle.year,
    rates: bundle.rates,
    updated_at: new Date().toISOString(),
  };
  dashboardStore()?.updateSection?.("energy", { derived: next }, { persist: false });
}

function setText(id, value) {
  const node = doc?.getElementById(id);
  if (node && node.textContent !== String(value)) node.textContent = String(value);
}

function setHtml(id, value) {
  const node = doc?.getElementById(id);
  if (node && node.innerHTML !== value) node.innerHTML = value;
}

function kwh(value, digits = 1) {
  return `${formatNumber(finite(value), digits)} kWh`;
}

function setFlowActive(id, active) {
  const node = doc?.getElementById(id);
  if (!node) return;
  node.classList.toggle("active", Boolean(active));
}

function applyFlow(period, data) {
  if (!data) return;
  const suffix = period === "day" ? "day" : "month";
  setText(`v-solar-${suffix}`, kwh(data.solar));
  setText(`v-home-${suffix}`, kwh(data.house));
  setHtml(`v-grid-${suffix}`, `<span class="down">↓ ${kwh(data.gridImport)}</span><span class="up">↑ ${kwh(data.gridExport)}</span>`);
  setHtml(`v-battery-${suffix}`, `<span class="down">↓ ${kwh(data.batteryCharge)}</span><span class="up">↑ ${kwh(data.batteryDischarge)}</span>`);
  setFlowActive(`line-grid-home-${suffix}`, data.gridImport > 0.0005);
  setFlowActive(`line-solar-grid-${suffix}`, data.gridExport > 0.0005);
  setFlowActive(`line-solar-home-${suffix}`, data.solar > 0.0005 && data.house > 0.0005);
  setFlowActive(`line-solar-battery-${suffix}`, data.batteryCharge > 0.0005);
  setFlowActive(`line-battery-home-${suffix}`, data.batteryDischarge > 0.0005);
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
  // Sale income is displayed independently in "Venduto". It must not cancel
  // the electricity bill shown as "Costo reale".
  const realCost = importCost;
  return {
    importCost,
    exportIncome,
    withoutSolar,
    realCost,
    saved: Math.max(0, withoutSolar - importCost),
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
    .map((device) => values.get(device.history || device.entity))
    .filter((value) => Number.isFinite(value));
  const maximum = Math.max(0.001, ...available);
  let total = 0;
  list.querySelectorAll(".ed-device-row").forEach((row) => {
    const direct = clean(row.dataset.entity || row.dataset.sensor);
    const name = clean(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent);
    const device = devices.find((item) => clean(item.name) === name || clean(item.entity) === direct);
    const entity = clean(device?.history || device?.entity || direct);
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
  const device = bundle.deviceMonth.devices.find((item) => item.entity === entity || item.history === entity);
  const source = clean(device?.history || entity);
  const monthValue = valueFrom(bundle.deviceMonth.values, source);
  const yearValue = valueFrom(bundle.deviceYear.values, source);
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
  picker.setAttribute("aria-label", `${t("Seleziona entità", "Choose entity")} ${label}`);
  row.append(input, picker);
  field.append(row);
  wrap.append(field);
  return wrap;
}

function groupPanel(form, group) {
  return form?.querySelector(`[data-energy-group="${group}"]`) ||
    form?.querySelector(`details[data-group="${group}"]`) ||
    [...(form?.querySelectorAll("details") || [])].find((details) => {
      const summary = clean(details.querySelector("summary")?.textContent).toLowerCase();
      const tokens = group === "house" ? ["casa", "house"] : group === "solar" ? ["solare", "solar", "fv"] : group === "grid" ? ["rete", "grid"] : ["batteria", "battery"];
      return tokens.some((token) => summary.includes(token));
    });
}

function injectTotalFields(form) {
  if (!form) return false;
  const energy = energyModel();
  let changed = false;
  for (const definition of TOTAL_FIELDS) {
    const [group, key] = definition;
    if (form.querySelector(`[data-energy-group="${group}"][data-energy-key="${key}"]`)) continue;
    const panel = groupPanel(form, group);
    const target = panel?.querySelector(".ed-acc-body") || panel || form;
    const field = createTotalField(definition, energy?.[group]?.[key] || "");
    target.append(field);
    changed = true;
  }
  return changed;
}

function readTotalFields(form) {
  const patch = {};
  form?.querySelectorAll(".dm-energy-total-field").forEach((field) => {
    const group = clean(field.dataset.energyGroup);
    const key = clean(field.dataset.energyKey);
    const value = clean(field.querySelector("input")?.value);
    if (!group || !key) return;
    patch[group] ||= {};
    patch[group][key] = value;
  });
  return patch;
}

function mergeEnergyPatch(base, patch) {
  const next = { ...base };
  Object.entries(patch).forEach(([group, values]) => {
    next[group] = { ...(base[group] || {}), ...values };
  });
  return next;
}

async function persistTotalFields(form) {
  const store = dashboardStore();
  if (!store?.getSection || !store?.updateSection) return false;
  const current = store.getSection("energy") || {};
  const next = mergeEnergyPatch(current, readTotalFields(form));
  await store.updateSection("energy", next);
  return true;
}

function bindEnergyEditor(form) {
  if (!form || form.dataset.dmEnergyTotalsBound === "true") return;
  form.dataset.dmEnergyTotalsBound = "true";
  form.addEventListener("submit", async () => {
    await persistTotalFields(form);
    scheduleEnergyRefresh(true);
  });
  form.querySelectorAll(".dm-entity-picker").forEach((button) => {
    if (button.dataset.dmPickerBound === "true") return;
    button.dataset.dmPickerBound = "true";
    button.addEventListener("click", () => {
      const input = doc.getElementById(button.dataset.entityTarget);
      if (input) root.wzPickEntity?.(input);
    });
  });
}

function installEnergyEditorTotals() {
  const form = doc?.querySelector("#ed-body [data-energy-form],#ed-body form.ed-energy-form,#ed-body form");
  if (!form) return false;
  injectTotalFields(form);
  bindEnergyEditor(form);
  return true;
}

function installStyles() {
  installStyle("dm-energy-section-style", `
    .dm-energy-total-field{display:grid!important;gap:7px!important;margin:10px 0!important;padding:11px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 16%,var(--divider-color,#dbe4ee))!important;border-radius:13px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 4%,var(--card-background-color,#fff))!important}
    .dm-energy-total-field>.ed-hint{display:block!important;font-size:10px!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-energy-total-field .ed-form-row{display:grid!important;grid-template-columns:minmax(0,1fr) 46px!important;gap:7px!important}
  `);
}

function installWrappers() {
  wrapFunction("editorSwitch", "__dmEnergyEditorTotals", () => root.setTimeout?.(installEnergyEditorTotals, 0));
  wrapFunction("renderEnergyDashboard", "__dmEnergyAtomicProjection", scheduleProjection);
}

export function installEnergySection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  installEnergyEditorTotals();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (stateChangeAffectsEnergy(event)) scheduleEnergyRefresh();
    });
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      installEnergyEditorTotals();
      scheduleEnergyRefresh(true);
    });
    root.addEventListener?.("dashboardmodern:runtime-ready", () => scheduleEnergyRefresh(true));
    root.addEventListener?.("dashboardmodern:states-ready", () => scheduleEnergyRefresh(true));
  }
  if (!state.brokerStarted) {
    state.brokerStarted = true;
    broker.connect().then(() => scheduleEnergyRefresh(true)).catch((error) => {
      state.lastError = clean(error?.message || error);
      root.console?.warn?.("[DashboardModern] Energy broker waiting for transport", error);
    });
  }
  scheduleEnergyRefresh(true);
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installEnergySection, { once: true });
} else {
  installEnergySection();
}