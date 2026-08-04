/* Canonical vehicle-image resolver for Home Assistant and integration assets. */
const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_VEHICLE_IMAGE_RUNTIME__";
const state = (root[KEY] ||= { installed: true, lastUrl: "" });
const clean = (value) => String(value ?? "").trim();

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

function schedule() {
  root.queueMicrotask?.(applyVehicleAsset);
  root.setTimeout?.(applyVehicleAsset, 40);
}

function install() {
  if (!doc || doc.documentElement.dataset.dmVehicleImageRuntime === "1") return;
  doc.documentElement.dataset.dmVehicleImageRuntime = "1";
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="ev"],[data-page="ev"]')) schedule();
    },
    true,
  );
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("pageshow", schedule);
  schedule();
}

state.apply = applyVehicleAsset;
state.resolve = resolveVehicleAsset;
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
