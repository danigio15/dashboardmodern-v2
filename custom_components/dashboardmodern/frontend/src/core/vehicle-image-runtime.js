/* DashboardModern 0.15.4 — canonical vehicle asset and live shutter UI owner. */

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__";
const state = (root[KEY] ||= {});
Object.assign(state, {
  installed: true,
  version: "0.15.4",
  lastUrl: state.lastUrl || "",
  contractTimer: 0,
  contractAttempts: 0,
  energyRunning: false,
  energyVerified: true,
  energyFailures: 0,
});

const clean = (value) => String(value ?? "").trim();
const dashboardStore = () => root.DashboardModernModules?.store || null;
const text = (it, en) =>
  clean(doc?.documentElement?.lang).toLowerCase().startsWith("en") ? en : it;

function legacyStates() {
  try {
    return root.eval?.("typeof STATES !== 'undefined' && STATES ? STATES : null") || {};
  } catch (_error) {
    return {};
  }
}

function allStates() {
  return {
    ...(root._RAW_STATES || {}),
    ...legacyStates(),
    ...(root.STATES || {}),
  };
}

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
  if (raw.startsWith("/loca/")) raw = `/local/${raw.slice(6)}`;
  else if (raw.startsWith("loca/")) raw = `/local/${raw.slice(5)}`;
  else if (raw.startsWith("/config/www/")) raw = `/local/${raw.slice(12)}`;
  else if (raw.startsWith("config/www/")) raw = `/local/${raw.slice(11)}`;
  else if (raw.startsWith("www/")) raw = `/local/${raw.slice(4)}`;
  else if (raw.startsWith("local/")) raw = `/${raw}`;

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
  if (raw.startsWith("/")) return raw.replace(/^\/local\/\/+/, "/local/");
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

function persistNormalizedImage(original, normalized) {
  if (!normalized || clean(original) === normalized) return;
  const serialized = JSON.stringify(normalized);
  if (root.localStorage?.getItem("cd_ev_image") !== serialized)
    root.localStorage?.setItem("cd_ev_image", serialized);
}

export function applyVehicleAsset() {
  if (!doc) return false;
  const original = configuredImage();
  const url = resolveVehicleAsset(original);
  persistNormalizedImage(original, url);
  state.lastUrl = url;
  let mounted = false;
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
      delete image.dataset.evFailed;
      image.style.display = "block";
      image.style.visibility = "visible";
      image.style.opacity = "1";
    };
    const resolved = new URL(url, doc.baseURI).href;
    if (image.src !== resolved) image.src = url;
    if (!image.dataset.evImageError) {
      image.style.display = "block";
      image.style.visibility = "visible";
      mounted = true;
    }
  });
  const hero = doc.getElementById("lm-hero-card");
  if (hero) hero.dataset.evImage = url ? "configured" : "missing";
  return mounted;
}

function installStyles() {
  if (!doc?.head || doc.getElementById("dm-vehicle-contracts-0154")) return;
  const style = doc.createElement("style");
  style.id = "dm-vehicle-contracts-0154";
  style.textContent = `
    #ev-mod-car-img[data-ev-image-error],#ev-new-car-img[data-ev-image-error],
    #ev-mod-car-img[data-ev-failed="1"],#ev-new-car-img[data-ev-failed="1"]{display:none!important}
    #editor-modal .dm-temperature-actions button{min-height:44px!important}
  `;
  doc.head.append(style);
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
      const isOpen =
        status === "open" ||
        status === "opening" ||
        (Number.isFinite(position) && position > 0);
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
      const label =
        item.status === "opening" ? text("In apertura", "Opening") : text("Aperta", "Open");
      detail.textContent = `${item.room ? `${item.room.name} · ` : ""}${label}${
        item.position == null ? "" : ` · ${Math.round(item.position)}%`
      }`;
    });
  }
  return true;
}

function exposeAlertEditors() {
  if (doc?.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return;
  doc.querySelectorAll("[data-dm-alert-edit]").forEach((button) => {
    const details = button.closest("details");
    if (details) details.open = true;
  });
}

function contractTick() {
  state.contractTimer = 0;
  state.contractAttempts += 1;
  installStyles();
  applyVehicleAsset();
  exposeAlertEditors();
  const shuttersActive = syncShutterState();
  if (state.contractAttempts < 180 || shuttersActive) scheduleContracts(shuttersActive ? 100 : 60);
}

function scheduleContracts(delay = 0) {
  if (state.contractTimer) return;
  state.contractTimer = root.setTimeout?.(contractTick, delay);
}

function schedule() {
  root.queueMicrotask?.(applyVehicleAsset);
  scheduleContracts(0);
}

function install() {
  if (!doc || doc.documentElement.dataset.dmVehicleImageRuntime === "2") return;
  doc.documentElement.dataset.dmVehicleImageRuntime = "2";
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="ev"],[data-page="ev"],.ed-tab[data-tab="sez2"]')) schedule();
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
state.verifyEnergy = async () => {
  state.energyRunning = false;
  state.energyVerified = true;
  return true;
};
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
