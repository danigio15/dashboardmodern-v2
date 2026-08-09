import { carBrandVisual } from "../core/personalization-catalog.js";
import { clean, doc, esc, installStyle, readJson, root, section, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EV_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  lastUrl: "",
  frame: 0,
  previousRefresh: null,
  previousApply: null,
});
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;

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
    const assetRoot = integrationAssetRoot(base);
    return assetRoot ? new URL(raw.slice(prefix.length), assetRoot).href : "";
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

export function applyVehicleAsset() {
  if (!doc) return false;
  const original = configuredImage();
  const url = resolveVehicleAsset(original);
  if (url && clean(original) !== url)
    root.localStorage?.setItem("cd_ev_image", JSON.stringify(url));
  state.lastUrl = url;
  let mounted = false;
  for (const id of ["ev-mod-car-img", "ev-new-car-img"]) {
    const image = doc.getElementById(id);
    if (!image) continue;
    if (!url) {
      image.removeAttribute("src");
      image.style.display = "none";
      continue;
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
    if (image.src !== resolved || image.dataset.evFailed === "1") {
      delete image.dataset.evFailed;
      delete image.dataset.evImageError;
      image.src = url;
    }
    image.style.display = "block";
    mounted = true;
  }
  const hero = doc.getElementById("lm-hero-card");
  if (hero) hero.dataset.evImage = url ? "configured" : "missing";
  return mounted;
}

function legacyProfiles() {
  const cars = readJson("cd_ev_cars", []);
  return Array.isArray(cars) ? cars : [];
}

function canonicalProfiles() {
  const cars = section("ev", []);
  return Array.isArray(cars) ? cars : [];
}

function profiles() {
  const legacy = legacyProfiles();
  return legacy.length ? legacy : canonicalProfiles();
}

function collectEntityIds(value, output, depth = 0) {
  if (depth > 10 || value == null) return;
  if (typeof value === "string") {
    const id = clean(value);
    if (ENTITY_ID.test(id)) output.add(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEntityIds(entry, output, depth + 1));
    return;
  }
  if (typeof value === "object")
    Object.values(value).forEach((entry) => collectEntityIds(entry, output, depth + 1));
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function configuredEvEntityIds() {
  const ids = new Set();
  collectEntityIds(legacyProfiles(), ids);
  collectEntityIds(canonicalProfiles(), ids);
  return ids;
}

export function stateChangeAffectsEv(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = configuredEvEntityIds();
  if (!configured.size) return false;
  return [...changed].some((id) => configured.has(id));
}

function activeIndex() {
  const index = Number.parseInt(root.localStorage?.getItem("cd_ev_car_active") || "-1", 10);
  return Number.isFinite(index) ? index : -1;
}

function profileMeta(car = {}) {
  const overrides = car.ov || car.overrides || {};
  const batteryEntity =
    overrides["dm.ev_batteria_auto"] ||
    overrides["dm.ev_battery"] ||
    overrides["dm.ev_soc"] ||
    car.battery_entity ||
    car.soc_entity ||
    "";
  const current =
    batteryEntity && (root.STATES?.[batteryEntity] || root._RAW_STATES?.[batteryEntity]);
  const value = Number(current?.state);
  return Number.isFinite(value) ? `${Math.round(value)}%` : t("Profilo EV", "EV profile");
}

function vehicleProfileVisual(car = {}) {
  const brand = clean(car.brand);
  if (brand) return carBrandVisual(brand, 30);
  const icon = clean(car.icon || "mdi:car-electric");
  try {
    return root.cdIconMarkup?.(icon, 28) || "🚗";
  } catch (_error) {
    return "🚗";
  }
}

function nativeHost() {
  return doc?.getElementById("ev-car-picker") || null;
}

function nativeSelect() {
  return doc?.getElementById("ev-car-sel") || nativeHost()?.querySelector("select") || null;
}

function chooseProfile(index) {
  const select = nativeSelect();
  if (select) select.value = String(index);
  if (typeof root.cdEvApplyCar === "function") root.cdEvApplyCar(index);
  else if (select) {
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  } else root.localStorage?.setItem("cd_ev_car_active", String(index));
  root.queueMicrotask?.(scheduleEvSync);
}

export function renderVehicleSelector() {
  const host = nativeHost();
  const cars = profiles();
  if (!host) return false;
  host.classList.add("dm-vehicle-profile-host");
  const select = nativeSelect();
  if (select) {
    select.classList.add("dm-vehicle-native-select");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
  }
  let nav = host.querySelector(".dm-vehicle-profile-tabs");
  if (!nav) {
    nav = doc.createElement("nav");
    nav.className = "dm-vehicle-profile-tabs";
    nav.setAttribute("aria-label", t("Seleziona auto", "Select vehicle"));
    host.append(nav);
  }
  if (!cars.length) {
    nav.replaceChildren();
    host.dataset.profileCount = "0";
    host.style.display = "none";
    return false;
  }
  host.style.display = "";
  host.dataset.profileCount = String(cars.length);
  const selected = Math.max(0, Math.min(cars.length - 1, activeIndex()));
  const buttons = cars.map((car, index) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-vehicle-profile-card";
    button.dataset.vehicleIndex = String(index);
    button.classList.toggle("active", index === selected);
    button.setAttribute("aria-pressed", String(index === selected));
    button.innerHTML = `<span class="dm-vehicle-profile-icon">${vehicleProfileVisual(car)}</span><span class="dm-vehicle-profile-copy"><strong>${esc(car.name || `${t("Auto", "Vehicle")} ${index + 1}`)}</strong><small>${esc(profileMeta(car))}</small></span><span class="dm-vehicle-profile-check" aria-hidden="true">${index === selected ? "✓" : ""}</span>`;
    button.addEventListener("click", () => chooseProfile(index));
    return button;
  });
  nav.replaceChildren(...buttons);
  return true;
}

function installLegacyWrappers() {
  if (typeof root.cdEvCarsRefresh === "function" && !root.cdEvCarsRefresh.__dmEvSection) {
    state.previousRefresh ||= root.cdEvCarsRefresh;
    const previous = root.cdEvCarsRefresh;
    function refreshProfiles(...args) {
      const result = previous.apply(this, args);
      root.queueMicrotask?.(scheduleEvSync);
      return result;
    }
    refreshProfiles.__dmEvSection = true;
    root.cdEvCarsRefresh = refreshProfiles;
  }
  if (typeof root.cdEvApplyCar === "function" && !root.cdEvApplyCar.__dmEvSection) {
    state.previousApply ||= root.cdEvApplyCar;
    const previous = root.cdEvApplyCar;
    function applyProfile(...args) {
      const result = previous.apply(this, args);
      root.queueMicrotask?.(scheduleEvSync);
      return result;
    }
    applyProfile.__dmEvSection = true;
    root.cdEvApplyCar = applyProfile;
  }
  return Boolean(root.cdEvCarsRefresh || root.cdEvApplyCar);
}

export function scheduleEvSync() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    installLegacyWrappers();
    renderVehicleSelector();
    applyVehicleAsset();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle(
    "dm-ev-section-style",
    `
      #ev-mod-car-img[data-ev-image-error],#ev-new-car-img[data-ev-image-error],#ev-mod-car-img[data-ev-failed="1"],#ev-new-car-img[data-ev-failed="1"]{display:none!important}
      #ev-car-picker.dm-vehicle-profile-host{box-sizing:border-box!important;width:fit-content!important;max-width:calc(100% - 28px)!important;margin:12px auto 10px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      #ev-car-picker.dm-vehicle-profile-host>.dm-vehicle-native-select{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}
      .dm-vehicle-profile-tabs{display:flex!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important;gap:8px!important;width:auto!important;max-width:100%!important}
      .dm-vehicle-profile-card{display:grid!important;grid-template-columns:34px minmax(0,max-content) 20px!important;align-items:center!important;gap:8px!important;box-sizing:border-box!important;width:max-content!important;max-width:min(100%,320px)!important;min-height:48px!important;margin:0!important;padding:6px 9px!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:15px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--primary-text-color,var(--text,#0f172a))!important;box-shadow:0 6px 16px rgba(15,23,42,.07)!important;text-align:left!important;cursor:pointer!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}
      .dm-vehicle-profile-card:hover{transform:translateY(-1px)!important;box-shadow:0 9px 20px rgba(15,23,42,.10)!important}.dm-vehicle-profile-card.active{border-color:var(--accent,#0ea5e9)!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,var(--ha-card-background,#fff))!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#0ea5e9) 18%,transparent),0 8px 20px rgba(14,165,233,.13)!important}
      .dm-vehicle-profile-icon{display:grid!important;place-items:center!important;width:34px!important;height:34px!important;border-radius:11px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 14%,transparent)!important;font-size:18px!important}.dm-vehicle-profile-copy{display:grid!important;gap:1px!important;min-width:0!important}.dm-vehicle-profile-copy strong,.dm-vehicle-profile-copy small{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-vehicle-profile-copy strong{max-width:210px!important;font-size:13px!important;font-weight:900!important;line-height:1.1!important}.dm-vehicle-profile-copy small{font-size:9px!important;font-weight:750!important;line-height:1.1!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}.dm-vehicle-profile-check{display:grid!important;place-items:center!important;width:20px!important;height:20px!important;border-radius:50%!important;background:var(--accent,#0ea5e9)!important;color:#fff!important;font-size:11px!important;font-weight:900!important;opacity:0!important}.dm-vehicle-profile-card.active .dm-vehicle-profile-check{opacity:1!important}
      @media(max-width:620px){#ev-car-picker.dm-vehicle-profile-host{width:auto!important;max-width:calc(100% - 20px)!important;margin:8px auto!important}.dm-vehicle-profile-tabs{justify-content:flex-start!important;flex-wrap:nowrap!important;gap:7px!important;max-width:calc(100vw - 20px)!important;overflow-x:auto!important;padding:2px 2px 5px!important;scrollbar-width:none!important}.dm-vehicle-profile-tabs::-webkit-scrollbar{display:none!important}.dm-vehicle-profile-card{flex:0 0 auto!important;width:max-content!important;max-width:76vw!important;min-height:44px!important;padding:5px 8px!important;border-radius:14px!important;grid-template-columns:30px minmax(0,max-content) 18px!important;gap:7px!important}.dm-vehicle-profile-icon{width:30px!important;height:30px!important;border-radius:10px!important;font-size:16px!important}.dm-vehicle-profile-copy strong{max-width:48vw!important;font-size:12px!important}.dm-vehicle-profile-copy small{font-size:8.5px!important}.dm-vehicle-profile-check{width:18px!important;height:18px!important;font-size:10px!important}}
    `,
  );
}

export function installEvSection() {
  if (!doc) return;
  root.dmRenderVehicleSelector = renderVehicleSelector;
  installStyles();
  installLegacyWrappers();
  scheduleEvSync();
  if (!state.installed) {
    state.installed = true;
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.('[data-tab="ev"],[data-page="ev"],.ed-tab[data-tab="sez2"]'))
          scheduleEvSync();
      },
      true,
    );
    for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"]) {
      root.addEventListener?.(eventName, scheduleEvSync);
    }
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (stateChangeAffectsEv(event)) scheduleEvSync();
    });
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEvSection, { once: true });
else installEvSection();