/* Canonical vehicle-image resolver plus bounded 0.15.2 runtime finalization. */
import { applyAtomicEnergyBundle } from "../../legacy/runtime-consolidated.js";
import { HomeAssistantBroker } from "./period-service.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__";
const state = (root[KEY] ||= { installed: true, lastUrl: "" });
Object.assign(state, {
  installed: true,
  lastUrl: state.lastUrl || "",
  energyRunning: Boolean(state.energyRunning),
  energyVerified: Boolean(state.energyVerified),
  energyTimer: state.energyTimer || 0,
  contractTimer: state.contractTimer || 0,
  contractAttempts: state.contractAttempts || 0,
  energyFailures: Number(state.energyFailures) || 0,
});
const clean = (value) => String(value ?? "").trim();
const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const dashboardStore = () => root.DashboardModernModules?.store || null;
function legacyStates() {
  try {
    return root.eval?.("typeof STATES !== 'undefined' && STATES ? STATES : null") || root.STATES || {};
  } catch (_error) {
    return root.STATES || {};
  }
}
const allStates = () => ({
  ...(root._RAW_STATES || {}),
  ...(root.STATES || {}),
  ...legacyStates(),
});
const text = (it, en) => (doc?.documentElement?.lang === "en" ? en : it);
const recoveryBroker = new HomeAssistantBroker({
  timeout: 3000,
  cacheCurrentMs: 0,
  cacheHistoricalMs: 0,
});

function installFastBridgeGuard() {
  const current = HomeAssistantBroker.prototype.connect;
  if (current?.__dmFastBridgeGuard0152) return;
  function guardedConnect() {
    if (root.WebSocket?.name === "StubSocket") {
      this.reset?.(new Error("DashboardModern bridge is not ready"));
      return Promise.reject(new Error("DashboardModern bridge is not ready"));
    }
    return current.apply(this, arguments);
  }
  guardedConnect.__dmFastBridgeGuard0152 = true;
  guardedConnect.__dmPrevious = current;
  HomeAssistantBroker.prototype.connect = guardedConnect;
}

installFastBridgeGuard();

function integrationAssetRoot(base) {
  try {
    const url = new URL(base);
    const match = url.pathname.match(/^(.*\/api\/dashboardmodern\/[^/]+\/)/);
    return match ? `${url.origin}${match[1]}` : "";
  } catch (_error) {
    return "";
  }
}

export function resolveVehicleAsset(value, base = doc?.baseURI || root.location?.href || "") {
  let raw = typeof value === "string" ? value : value?.url || value?.path || "";
  raw = clean(raw).replaceAll("\\", "/");
  if (!raw) return "";
  if (/^(?:data:|blob:|https?:)/i.test(raw)) return raw;
  if (/^(?:file:|[a-z]:\/)/i.test(raw)) return "";
  if (raw.startsWith("/config/www/")) return `/local/${raw.slice("/config/www/".length)}`;
  if (raw.startsWith("config/www/")) return `/local/${raw.slice("config/www/".length)}`;
  if (raw.startsWith("www/")) return `/local/${raw.slice(4)}`;
  if (raw.startsWith("local/")) return `/${raw}`;

  const integrationPrefixes = [
    "/config/custom_components/dashboardmodern/frontend/",
    "config/custom_components/dashboardmodern/frontend/",
    "/custom_components/dashboardmodern/frontend/",
    "custom_components/dashboardmodern/frontend/",
  ];
  const prefix = integrationPrefixes.find((candidate) => raw.startsWith(candidate));
  if (prefix) {
    const rootUrl = integrationAssetRoot(base);
    return rootUrl ? new URL(raw.slice(prefix.length), rootUrl).href : "";
  }
  if (raw.startsWith("/")) return raw;
  try {
    return new URL(raw.replace(/^\.\//, ""), base).href;
  } catch (_error) {
    return "";
  }
}

function configuredImage() {
  const stored = root.localStorage?.getItem("cd_ev_image") || "";
  try {
    const parsed = JSON.parse(stored);
    return typeof parsed === "string" ? parsed : parsed?.url || parsed?.path || "";
  } catch (_error) {
    return stored.replace(/^"|"$/g, "");
  }
}

export function applyVehicleAsset() {
  if (!doc) return false;
  const url = resolveVehicleAsset(configuredImage());
  state.lastUrl = url;
  ["ev-mod-car-img", "ev-new-car-img"].forEach((id) => {
    const image = doc.getElementById(id);
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
    const resolved = new URL(url, doc.baseURI).href;
    if (image.src !== resolved) image.src = url;
  });
  const hero = doc.getElementById("lm-hero-card");
  if (hero) hero.dataset.evImage = url ? "configured" : "missing";
  return Boolean(url);
}

function installFinalStyles() {
  if (!doc || doc.getElementById("dm-runtime-final-contracts-0152")) return;
  const style = doc.createElement("style");
  style.id = "dm-runtime-final-contracts-0152";
  style.textContent = `
    html body #page-appliances-main .appl-wide-card{
      box-sizing:border-box!important;width:min(100%,408px)!important;max-width:408px!important;
      max-height:190px!important;overflow:hidden!important
    }
    html body #page-appliances-main .appl-ic:has(img.dm-appliance-image){
      box-sizing:border-box!important;width:82px!important;height:82px!important;
      min-width:82px!important;min-height:82px!important;flex:0 0 82px!important;overflow:hidden!important
    }
    html body #page-appliances-main .dm-appliance-image-wrap,
    html body #page-appliances-main img.dm-appliance-image{
      display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;
      min-width:82px!important;min-height:82px!important;overflow:hidden!important;
      object-fit:cover!important;object-position:50% 50%!important
    }
    #editor-modal .dm-temperature-actions button{min-height:44px!important}
  `;
  doc.head.append(style);
}

function exposeAlertEditors() {
  if (doc?.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return;
  doc.querySelectorAll("[data-dm-alert-edit]").forEach((button) => {
    const details = button.closest("details");
    if (details) details.open = true;
  });
}

function inferredOpenCovers() {
  const states = allStates();
  const rooms = dashboardStore()?.getSection?.("rooms") || [];
  return Object.keys(states)
    .filter((entity) => entity.startsWith("cover."))
    .flatMap((entity) => {
      const current = states[entity];
      const positionValue = current?.attributes?.current_position;
      const position = positionValue == null ? null : Number(positionValue);
      const status = clean(current?.state).toLowerCase();
      const isOpen = status === "open" || status === "opening" || (Number.isFinite(position) && position > 0);
      if (!isOpen) return [];
      const suffix = clean(entity.split(".").pop()).replaceAll("_", " ").toLowerCase();
      const room = rooms.find((item) => clean(item.name).toLowerCase() === suffix) || null;
      return [{ entity, current, status, position: Number.isFinite(position) ? position : null, room }];
    });
}

function syncShutterState() {
  const popup = doc?.getElementById("dm-shutter-popup");
  const alertWrap = doc?.getElementById("tapp-avvisi");
  if (!popup && !alertWrap) return false;
  const items = inferredOpenCovers();
  if (!items.length) {
    popup?.remove();
    alertWrap?.remove();
    return false;
  }
  const count = alertWrap?.querySelector(".g-val");
  if (count) count.textContent = String(items.length);
  if (popup) {
    [...popup.querySelectorAll(".dm-shutter-popup-row")].forEach((row, index) => {
      const item = items[index];
      if (!item) {
        row.remove();
        return;
      }
      const detail = row.querySelector(".dm-shutter-details small");
      if (!detail) return;
      const label = item.status === "opening" ? text("In apertura", "Opening") : text("Aperta", "Open");
      detail.textContent = `${item.room ? `${item.room.name} · ` : ""}${label}${item.position == null ? "" : ` · ${Math.round(item.position)}%`}`;
    });
  }
  return true;
}

function energyConfiguration() {
  const energy = dashboardStore()?.getSection?.("energy") || {};
  const source = (group, periodKey, totalKey) =>
    clean(energy[group]?.[periodKey] || energy[group]?.[totalKey]);
  return {
    day: {
      house: source("house", "daily_energy", "total_energy"),
      solar: source("solar", "daily_energy", "total_energy"),
      gridImport: source("grid", "daily_import_energy", "total_import_energy"),
      gridExport: source("grid", "daily_export_energy", "total_export_energy"),
      batteryCharged: source("battery", "daily_charged_energy", "total_charged_energy"),
      batteryDischarged: source("battery", "daily_discharged_energy", "total_discharged_energy"),
    },
    month: {
      house: source("house", "monthly_energy", "total_energy"),
      solar: source("solar", "monthly_energy", "total_energy"),
      gridImport: source("grid", "monthly_import_energy", "total_import_energy"),
      gridExport: source("grid", "monthly_export_energy", "total_export_energy"),
      batteryCharged: source("battery", "monthly_charged_energy", "total_charged_energy"),
      batteryDischarged: source("battery", "monthly_discharged_energy", "total_discharged_energy"),
    },
    year: {
      house: source("house", "annual_energy", "total_energy"),
      solar: source("solar", "annual_energy", "total_energy"),
      gridImport: source("grid", "annual_import_energy", "total_import_energy"),
      gridExport: source("grid", "annual_export_energy", "total_export_energy"),
      batteryCharged: source("battery", "annual_charged_energy", "total_charged_energy"),
      batteryDischarged: source("battery", "annual_discharged_energy", "total_discharged_energy"),
    },
  };
}

function canonicalDevices() {
  const store = dashboardStore();
  const build = root.DashboardModernModules?.data?.canonicalReportDevices;
  if (typeof build === "function") {
    return build(
      store?.getSection?.("appliances") || [],
      store?.getSection?.("loads") || [],
      allStates(),
    );
  }
  return [
    ...(store?.getSection?.("appliances") || []),
    ...(store?.getSection?.("loads") || []),
  ]
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
    .filter((item) => clean(item.entity));
}

function periodRange(kind, now = new Date()) {
  let start;
  let baselineStart;
  let period;
  if (kind === "day") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    baselineStart = new Date(start);
    baselineStart.setHours(baselineStart.getHours() - 2);
    period = "hour";
  } else if (kind === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    baselineStart = new Date(start);
    baselineStart.setMonth(baselineStart.getMonth() - 1);
    period = "month";
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    baselineStart = new Date(start);
    baselineStart.setDate(baselineStart.getDate() - 2);
    period = "day";
  }
  return { start, baselineStart, end: now, period };
}

async function requestStatistics(ids, start, end, period) {
  const statisticIds = [...new Set((ids || []).map(clean).filter(Boolean))];
  if (!statisticIds.length) return {};
  const result = await recoveryBroker.request({
    type: "recorder/statistics_during_period",
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    statistic_ids: statisticIds,
    period,
    units: { energy: "kWh" },
  });
  return result && typeof result === "object" ? result : {};
}

function lastStatisticValue(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    for (const key of ["sum", "state", "max"]) {
      const value = numeric(list[index]?.[key]);
      if (value != null) return value;
    }
  }
  return null;
}

function periodConsumption(currentRows, baselineRows) {
  const current = lastStatisticValue(currentRows);
  const baseline = lastStatisticValue(baselineRows);
  if (current == null) return 0;
  if (baseline == null) return Math.max(0, current);
  const delta = current - baseline;
  return Math.max(0, delta >= 0 ? delta : current);
}

async function loadPeriod(kind, sources, now) {
  const range = periodRange(kind, now);
  const ids = Object.values(sources).filter(Boolean);
  const [current, baseline] = await Promise.all([
    requestStatistics(ids, range.start, range.end, range.period),
    requestStatistics(ids, range.baselineStart, range.start, range.period),
  ]);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(sources).map(([key, entity]) => [
        key,
        entity ? periodConsumption(current[entity], baseline[entity]) : 0,
      ]),
    ),
  );
}

async function loadDevicePeriod(kind, devices, now) {
  const range = periodRange(kind, now);
  const ids = [...new Set(devices.map((device) => clean(device.entity)).filter(Boolean))];
  const [current, baseline] = await Promise.all([
    requestStatistics(ids, range.start, range.end, range.period),
    requestStatistics(ids, range.baselineStart, range.start, range.period),
  ]);
  return new Map(
    ids.map((entity) => [
      entity,
      periodConsumption(current[entity], baseline[entity]),
    ]),
  );
}

function energyRates() {
  const read = (key) => {
    const configured = root.cdCfg?.(key);
    const raw = configured !== undefined && configured !== null && configured !== ""
      ? configured
      : root.localStorage?.getItem(key);
    return numeric(raw) || 0;
  };
  return Object.freeze({
    importPrice: read("cd_costo_kwh"),
    exportPrice: read("cd_prezzo_immissione"),
  });
}

function exposeEnergyState(label, detail = "") {
  if (!doc?.documentElement) return;
  doc.documentElement.dataset.dmVehicleEnergy = [
    label,
    root.WebSocket?.name || "none",
    state.energyFailures,
    detail,
  ].join("|");
}

async function recoverEnergyBundle() {
  const now = new Date();
  const configuration = energyConfiguration();
  if (!configuration.month.house) return false;
  const devices = canonicalDevices();
  const [day, month, year, deviceMonth, deviceYear] = await Promise.all([
    loadPeriod("day", configuration.day, now),
    loadPeriod("month", configuration.month, now),
    loadPeriod("year", configuration.year, now),
    loadDevicePeriod("month", devices, now),
    loadDevicePeriod("year", devices, now),
  ]);
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  if (!runtime) return false;
  const generation = Math.max(
    Number(runtime.generation) || 0,
    Number(runtime.bundle?.generation) || 0,
  ) + 1;
  const bundle = Object.freeze({
    generation,
    period: Object.freeze({ month: now.getMonth() + 1, year: now.getFullYear() }),
    day,
    month,
    year,
    deviceMonth: Object.freeze({ devices, values: deviceMonth }),
    deviceYear: Object.freeze({ devices, values: deviceYear }),
    rates: energyRates(),
  });
  runtime.generation = generation;
  runtime.bundle = bundle;
  runtime.selected = bundle.period;
  runtime.lastRefreshAt = Date.now();
  root.__DASHBOARDMODERN_RUNTIME_0150__ = runtime;
  applyAtomicEnergyBundle(bundle);
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }));
  exposeEnergyState("done", `${day.house}/${month.house}/${year.house}`);
  return true;
}

async function verifyEnergyBundle() {
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  const currentHouse = numeric(runtime?.bundle?.month?.house) || 0;
  if (currentHouse !== 0) {
    state.energyVerified = true;
    exposeEnergyState("existing", String(currentHouse));
    return;
  }
  if (state.energyRunning || !dashboardStore()) return;
  if (root.WebSocket?.name === "StubSocket") {
    state.energyVerified = false;
    scheduleEnergyVerification();
    return;
  }
  if (root.__DASHBOARDMODERN_STARTUP_COORDINATOR__?.running) {
    state.energyVerified = false;
    scheduleEnergyVerification();
    return;
  }

  state.energyRunning = true;
  state.energyVerified = false;
  exposeEnergyState("running", energyConfiguration().month.house);
  try {
    const applied = await recoverEnergyBundle();
    state.energyVerified = Boolean(applied);
  } catch (error) {
    state.energyFailures += 1;
    exposeEnergyState("error", clean(error?.message || error));
    recoveryBroker.reset?.(error);
  } finally {
    state.energyRunning = false;
    if (!state.energyVerified && state.energyFailures < 8) scheduleEnergyVerification();
  }
}

function scheduleEnergyVerification(delay = 80) {
  root.clearTimeout?.(state.energyTimer);
  state.energyTimer = root.setTimeout?.(() => {
    state.energyTimer = 0;
    verifyEnergyBundle();
  }, delay);
}

function contractTick() {
  state.contractTimer = 0;
  state.contractAttempts += 1;
  installFinalStyles();
  exposeAlertEditors();
  const shuttersActive = syncShutterState();
  scheduleEnergyVerification(0);
  if (state.contractAttempts < 1200 || shuttersActive || !state.energyVerified) {
    scheduleContracts(shuttersActive ? 100 : 50);
  }
}

function scheduleContracts(delay = 0) {
  if (state.contractTimer) return;
  state.contractTimer = root.setTimeout?.(contractTick, delay);
}

function schedule() {
  root.queueMicrotask?.(applyVehicleAsset);
  root.setTimeout?.(applyVehicleAsset, 40);
  scheduleContracts(0);
}

function install() {
  if (!doc || doc.documentElement.dataset.dmVehicleImageRuntime === "1") return;
  doc.documentElement.dataset.dmVehicleImageRuntime = "1";
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="ev"],[data-page="ev"]')) schedule();
      else scheduleContracts(0);
    },
    true,
  );
  root.addEventListener?.("dashboardmodern:state-changed", () => scheduleContracts(0));
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("pageshow", schedule);
  schedule();
}

state.apply = applyVehicleAsset;
state.resolve = resolveVehicleAsset;
state.scheduleContracts = scheduleContracts;
state.verifyEnergy = verifyEnergyBundle;
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
