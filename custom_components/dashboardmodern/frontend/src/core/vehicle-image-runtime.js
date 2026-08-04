/* Canonical vehicle-image resolver plus bounded 0.15.2 runtime finalization. */
import { applyAtomicEnergyBundle } from "../../legacy/runtime-consolidated.js";
import { HomeAssistantBroker, sourcePlans } from "./period-service.js";

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
});
const clean = (value) => String(value ?? "").trim();
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
const recoveryBroker = new HomeAssistantBroker({ timeout: 2500, cacheCurrentMs: 0, cacheHistoricalMs: 0 });

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

function energySection() {
  return dashboardStore()?.getSection?.("energy") || {};
}

function energyOverrides() {
  const fromStore = dashboardStore()?.getSection?.("entityOverrides");
  if (fromStore && typeof fromStore === "object") return fromStore;
  try {
    return JSON.parse(root.localStorage?.getItem("cd_entity_overrides") || "{}") || {};
  } catch (_error) {
    return root.ENTITY_OVERRIDES || {};
  }
}

function periodValues(values) {
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  return Object.freeze({
    house: finite(values.get("house")),
    solar: finite(values.get("solar")),
    gridImport: finite(values.get("gridImport")),
    gridExport: finite(values.get("gridExport")),
    batteryCharged: finite(values.get("batteryCharged")),
    batteryDischarged: finite(values.get("batteryDischarged")),
  });
}

async function recoverEnergyBundle() {
  await recoveryBroker.startStateFeed();
  const now = new Date();
  const period = { month: now.getMonth() + 1, year: now.getFullYear() };
  const selected = new Date(period.year, period.month - 1, 1);
  const energy = energySection();
  const overrides = energyOverrides();
  const resolver = root.resolveEntity || ((value) => value);
  const load = async (kind, date) => {
    const plans = sourcePlans(energy, kind, allStates(), overrides, resolver);
    const values = await recoveryBroker.valuesForPlans(plans, date, allStates());
    return periodValues(values);
  };
  const buildDevices = root.DashboardModernModules?.data?.canonicalReportDevices;
  const devices = typeof buildDevices === "function"
    ? buildDevices(
        dashboardStore()?.getSection?.("appliances") || [],
        dashboardStore()?.getSection?.("loads") || [],
        allStates(),
      )
    : [
        ...(dashboardStore()?.getSection?.("appliances") || []),
        ...(dashboardStore()?.getSection?.("loads") || []),
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
        .filter((item) => item.entity);
  const ids = [...new Set(devices.map((item) => clean(item.entity)).filter(Boolean))];
  const [day, month, year, deviceMonth, deviceYear] = await Promise.all([
    load("day", now),
    load("month", selected),
    load("year", selected),
    recoveryBroker.valuesForEntities(ids, "month", selected),
    recoveryBroker.valuesForEntities(ids, "year", selected),
  ]);
  const readRate = (key) => {
    const configured = root.cdCfg?.(key);
    const raw = configured !== undefined && configured !== null && configured !== ""
      ? configured
      : root.localStorage?.getItem(key);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  };
  const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
  if (!runtime) return false;
  const generation = Math.max(Number(runtime.generation) || 0, Number(runtime.bundle?.generation) || 0) + 1;
  const bundle = Object.freeze({
    generation,
    period: Object.freeze(period),
    day,
    month,
    year,
    deviceMonth: Object.freeze({ devices, values: deviceMonth }),
    deviceYear: Object.freeze({ devices, values: deviceYear }),
    rates: Object.freeze({
      importPrice: readRate("cd_costo_kwh"),
      exportPrice: readRate("cd_prezzo_immissione"),
    }),
  });
  runtime.generation = generation;
  runtime.bundle = bundle;
  runtime.selected = bundle.period;
  runtime.lastRefreshAt = Date.now();
  applyAtomicEnergyBundle(bundle);
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:period-bundle", { detail: bundle }));
  return true;
}

async function verifyEnergyBundle() {
  if (state.energyRunning || state.energyVerified || !dashboardStore()) return;
  if (root.WebSocket?.name === "StubSocket") {
    scheduleEnergyVerification();
    return;
  }
  state.energyRunning = true;
  try {
    const applied = await recoverEnergyBundle();
    const requests = root.__dmStatisticsRequests;
    const usedStatistics = !Array.isArray(requests) || requests.length > 0;
    if (applied && root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle && usedStatistics) {
      state.energyVerified = true;
    }
  } catch (_error) {
    recoveryBroker.reset?.();
  } finally {
    state.energyRunning = false;
    if (!state.energyVerified) scheduleEnergyVerification();
  }
}

function scheduleEnergyVerification(delay = 80) {
  if (state.energyTimer || state.energyVerified) return;
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
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
