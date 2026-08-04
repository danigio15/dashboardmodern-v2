/* Canonical vehicle-image resolver plus bounded 0.15.2 runtime finalization. */
import { refreshEnergy } from "../../legacy/runtime-consolidated.js";
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

async function verifyEnergyBundle() {
  if (state.energyRunning || state.energyVerified || !dashboardStore()) return;
  state.energyRunning = true;
  try {
    const applied = await refreshEnergy();
    const requests = root.__dmStatisticsRequests;
    const usedStatistics = !Array.isArray(requests) || requests.length > 0;
    if (applied && root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle && usedStatistics) {
      state.energyVerified = true;
    }
  } catch (_error) {
    /* the bounded retry below owns recovery */
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
