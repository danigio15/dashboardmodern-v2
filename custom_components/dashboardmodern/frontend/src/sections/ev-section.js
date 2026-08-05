import { clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EV_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  lastUrl: "",
  attempts: 0,
  timer: 0,
  previousRefresh: null,
  previousApply: null,
});

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

function profiles() {
  const cars = readJson("cd_ev_cars", []);
  return Array.isArray(cars) ? cars : [];
}

function activeIndex() {
  const index = Number.parseInt(root.localStorage?.getItem("cd_ev_car_active") || "-1", 10);
  return Number.isFinite(index) ? index : -1;
}

function profileMeta(car = {}) {
  const overrides = car.ov || {};
  const batteryEntity =
    overrides["dm.ev_batteria_auto"] ||
    overrides["dm.ev_battery"] ||
    overrides["dm.ev_soc"] ||
    "";
  const current =
    batteryEntity && (root.STATES?.[batteryEntity] || root._RAW_STATES?.[batteryEntity]);
  const value = Number(current?.state);
  return Number.isFinite(value) ? `${Math.round(value)}%` : t("Profilo EV", "EV profile");
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
  root.queueMicrotask?.(() => {
    renderVehicleSelector();
    applyVehicleAsset();
  });
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
  if (cars.length < 2) {
    nav.replaceChildren();
    host.dataset.profileCount = String(cars.length);
    host.style.display = cars.length ? "" : "none";
    return Boolean(cars.length);
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
    button.innerHTML = `<span class="dm-vehicle-profile-icon">🚗</span><span class="dm-vehicle-profile-copy"><strong>${esc(car.name || `${t("Auto", "Vehicle")} ${index + 1}`)}</strong><small>${esc(profileMeta(car))}</small></span><span class="dm-vehicle-profile-check" aria-hidden="true">${index === selected ? "✓" : ""}</span>`;
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
      renderVehicleSelector();
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
      root.queueMicrotask?.(() => {
        renderVehicleSelector();
        applyVehicleAsset();
      });
      return result;
    }
    applyProfile.__dmEvSection = true;
    root.cdEvApplyCar = applyProfile;
  }
  return Boolean(root.cdEvCarsRefresh || root.cdEvApplyCar);
}

function schedule(delay = 0) {
  root.clearTimeout?.(state.timer);
  state.timer = root.setTimeout?.(() => {
    state.timer = 0;
    state.attempts += 1;
    installLegacyWrappers();
    const ready = renderVehicleSelector();
    applyVehicleAsset();
    if ((!ready || !nativeSelect()) && state.attempts < 80)
      schedule(state.attempts < 20 ? 50 : 250);
  }, delay);
}

function installStyles() {
  installStyle(
    "dm-ev-section-style",
    `
      #ev-mod-car-img[data-ev-image-error],#ev-new-car-img[data-ev-image-error],#ev-mod-car-img[data-ev-failed="1"],#ev-new-car-img[data-ev-failed="1"]{display:none!important}
      #ev-car-picker.dm-vehicle-profile-host{box-sizing:border-box!important;width:min(1000px,calc(100% - 32px))!important;margin:18px auto 12px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      #ev-car-picker.dm-vehicle-profile-host>.dm-vehicle-native-select{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}
      .dm-vehicle-profile-tabs{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:12px!important;width:100%!important}
      .dm-vehicle-profile-card{display:grid!important;grid-template-columns:48px minmax(0,1fr) 28px!important;align-items:center!important;gap:11px!important;box-sizing:border-box!important;min-height:72px!important;margin:0!important;padding:11px 14px!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:18px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--primary-text-color,var(--text,#0f172a))!important;box-shadow:0 8px 22px rgba(15,23,42,.08)!important;text-align:left!important;cursor:pointer!important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease!important}
      .dm-vehicle-profile-card:hover{transform:translateY(-2px)!important;box-shadow:0 13px 28px rgba(15,23,42,.12)!important}.dm-vehicle-profile-card.active{border-color:var(--accent,#0ea5e9)!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 9%,var(--ha-card-background,#fff))!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#0ea5e9) 20%,transparent),0 12px 28px rgba(14,165,233,.15)!important}
      .dm-vehicle-profile-icon{display:grid!important;place-items:center!important;width:48px!important;height:48px!important;border-radius:14px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 14%,transparent)!important;font-size:23px!important}.dm-vehicle-profile-copy{display:grid!important;gap:4px!important;min-width:0!important}.dm-vehicle-profile-copy strong,.dm-vehicle-profile-copy small{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-vehicle-profile-copy strong{font-size:15px!important;font-weight:900!important}.dm-vehicle-profile-copy small{font-size:11px!important;font-weight:750!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}.dm-vehicle-profile-check{display:grid!important;place-items:center!important;width:26px!important;height:26px!important;border-radius:50%!important;background:var(--accent,#0ea5e9)!important;color:#fff!important;font-size:14px!important;font-weight:900!important;opacity:0!important}.dm-vehicle-profile-card.active .dm-vehicle-profile-check{opacity:1!important}
      @media(max-width:620px){#ev-car-picker.dm-vehicle-profile-host{width:calc(100% - 20px)!important;margin:10px auto!important}.dm-vehicle-profile-tabs{display:flex!important;gap:9px!important;overflow-x:auto!important;padding:2px 2px 8px!important;scroll-snap-type:x mandatory!important}.dm-vehicle-profile-card{flex:0 0 min(82vw,300px)!important;scroll-snap-align:start!important;min-height:66px!important;border-radius:16px!important;grid-template-columns:42px minmax(0,1fr) 24px!important}.dm-vehicle-profile-icon{width:42px!important;height:42px!important;border-radius:12px!important}}
    `,
  );
}

export function installEvSection() {
  if (!doc) return;
  installStyles();
  installLegacyWrappers();
  schedule(0);
  if (!state.installed) {
    state.installed = true;
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.('[data-tab="ev"],[data-page="ev"],.ed-tab[data-tab="sez2"]')) {
          state.attempts = 0;
          schedule(0);
        }
      },
      true,
    );
    for (const event of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:state-changed",
      "pageshow",
    ]) {
      root.addEventListener?.(event, () => {
        state.attempts = 0;
        schedule(0);
      });
    }
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEvSection, { once: true });
else installEvSection();
