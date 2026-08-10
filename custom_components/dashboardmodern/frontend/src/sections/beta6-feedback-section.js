import { ACTION_ICON_CATALOG, actionVisual } from "../core/personalization-catalog.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA6_FEEDBACK__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  chart: null,
  lightSignature: "",
});

const SIMPLE_ICONS_VERSION = "16.27.1";
const SIMPLE_ICON_SLUGS = Object.freeze({
  abarth: "abarth",
  "alfa-romeo": "alfaromeo",
  audi: "audi",
  bmw: "bmw",
  byd: "byd",
  citroen: "citroen",
  cupra: "cupra",
  dacia: "dacia",
  ds: "dsautomobiles",
  fiat: "fiat",
  ford: "ford",
  honda: "honda",
  hyundai: "hyundai",
  jeep: "jeep",
  kia: "kia",
  lancia: "lancia",
  lexus: "lexus",
  mazda: "mazda",
  "mercedes-benz": "mercedesbenz",
  mg: "mg",
  mini: "mini",
  nissan: "nissan",
  opel: "opel",
  peugeot: "peugeot",
  polestar: "polestar",
  porsche: "porsche",
  renault: "renault",
  seat: "seat",
  skoda: "skoda",
  smart: "smart",
  subaru: "subaru",
  suzuki: "suzuki",
  tesla: "tesla",
  toyota: "toyota",
  volkswagen: "volkswagen",
  volvo: "volvo",
  xpeng: "xpeng",
});

const BRAND_IMAGE_OVERRIDES = Object.freeze({
  leapmotor: "https://upload.wikimedia.org/wikipedia/commons/d/d8/Leapmotor_logo_en.svg",
});

const QUICK_ACTION_DEFAULTS = Object.freeze({
  lights: "mdi:lightbulb-group",
  script: "mdi:script-text-outline",
  scene: "mdi:palette-outline",
  cover: "mdi:window-shutter",
  climate: "mdi:thermostat",
  custom: "mdi:gesture-tap-button",
  popup: "mdi:view-dashboard-outline",
});

const RGB_MODES = new Set(["hs", "xy", "rgb", "rgbw", "rgbww"]);
const BRIGHTNESS_MODES = new Set([
  "brightness",
  "color_temp",
  "hs",
  "xy",
  "rgb",
  "rgbw",
  "rgbww",
]);

function normalizeBrandKey(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function brandImageSource(value) {
  const key = normalizeBrandKey(value);
  if (BRAND_IMAGE_OVERRIDES[key]) return BRAND_IMAGE_OVERRIDES[key];
  const slug = SIMPLE_ICON_SLUGS[key];
  return slug
    ? `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/${slug}.svg`
    : "";
}

function brandLabel(mark) {
  const host = mark.closest?.(".dm-picker-option,[data-brand-preview],.dm-ev-brand-badge");
  return clean(
    mark.dataset.dmBeta5Brand ||
      mark.dataset.brand ||
      mark.getAttribute("title") ||
      host?.querySelector?.("b")?.textContent,
  );
}

function polishVehicleBrandImages() {
  doc?.querySelectorAll?.(".dm-car-brand").forEach((mark) => {
    const brand = brandLabel(mark);
    const key = normalizeBrandKey(brand);
    const source = brandImageSource(key);
    if (!brand || !source) return;
    const current = mark.querySelector("img[data-dm-beta6-brand-image]");
    if (current?.dataset?.dmBeta6BrandKey === key) return;

    const fallback = mark.innerHTML;
    const wrapper = doc.createElement("span");
    wrapper.className = "dm-beta5-brand-logo dm-beta6-brand-image";
    wrapper.dataset.brandLogo = key;
    wrapper.title = brand;

    const image = doc.createElement("img");
    image.dataset.dmBeta6BrandImage = "true";
    image.dataset.dmBeta6BrandKey = key;
    image.alt = brand;
    image.decoding = "async";
    image.loading = "eager";
    image.referrerPolicy = "no-referrer";
    image.src = source;
    image.addEventListener(
      "error",
      () => {
        mark.innerHTML = fallback;
        mark.dataset.dmBeta6BrandImageError = key;
      },
      { once: true },
    );
    wrapper.append(image);
    mark.replaceChildren(wrapper);
    mark.dataset.dmBeta5Brand = brand;
    mark.dataset.dmBeta4Brand = brand;
    mark.dataset.dmBeta6BrandImage = key;
  });
}

function actionIconMarkup(value, size = 32) {
  const icon = clean(value) || "mdi:gesture-tap-button";
  return actionVisual(icon, size) || root.cdIconMarkup?.(icon, size) || esc(icon);
}

function closeActionPicker() {
  doc?.getElementById("dm-beta6-quick-icon-picker")?.remove();
}

function openActionPicker(input, preview) {
  if (!input) return;
  closeActionPicker();
  const modal = doc.createElement("div");
  modal.id = "dm-beta6-quick-icon-picker";
  modal.className = "dm-section-modal dm-visual-picker";
  const english = clean(doc.documentElement?.lang).toLowerCase().startsWith("en");
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true">
    <header><strong>${t("Scegli icona azione", "Choose action icon")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${t("Cerca…", "Search…")}" data-search></div>
    <div class="dm-picker-grid dm-beta6-quick-icon-grid">${ACTION_ICON_CATALOG.map(
      (item, index) =>
        `<button type="button" class="dm-picker-option" data-index="${index}" data-search-text="${esc(`${item.it} ${item.en} ${item.id} ${item.mdi}`.toLowerCase())}"><span class="dm-picker-visual">${actionVisual(item.mdi, 44)}</span><b>${esc(english ? item.en : item.it)}</b></button>`,
    ).join("")}</div>
  </section>`;
  doc.body.append(modal);
  const close = () => closeActionPicker();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const query = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-picker-option").forEach((button) => {
      button.hidden = Boolean(query) && !button.dataset.searchText.includes(query);
    });
  });
  modal.querySelectorAll(".dm-picker-option").forEach((button) =>
    button.addEventListener("click", () => {
      const item = ACTION_ICON_CATALOG[Number(button.dataset.index)];
      if (!item) return;
      input.value = item.mdi;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      if (preview) preview.innerHTML = actionIconMarkup(item.mdi);
      close();
    }),
  );
  root.setTimeout?.(() => modal.querySelector("[data-search]")?.focus(), 30);
}

function quickActionDefault(type) {
  return QUICK_ACTION_DEFAULTS[clean(type)] || "mdi:gesture-tap-button";
}

function polishQuickActionIcon() {
  const input = doc?.getElementById?.("ed-qa-icon");
  const type = doc?.getElementById?.("ed-qa-type");
  if (!input || !type) return false;
  const row = input.closest?.(".ed-qa-form-row") || input.parentElement;
  if (!row) return false;

  row.dataset.dmBeta6QuickAction = "true";
  let preview = row.querySelector(".dm-beta6-qa-icon-trigger");
  if (!preview) {
    preview = doc.createElement("button");
    preview.type = "button";
    preview.className = "dm-beta6-qa-icon-trigger";
    preview.setAttribute("aria-label", t("Scegli icona azione", "Choose action icon"));
    input.insertAdjacentElement("afterend", preview);
    preview.addEventListener("click", (event) => {
      event.preventDefault();
      openActionPicker(input, preview);
    });
    input.addEventListener("input", () => {
      preview.innerHTML = actionIconMarkup(input.value);
    });
    input.addEventListener("change", () => {
      preview.innerHTML = actionIconMarkup(input.value);
    });
  }

  const current = clean(input.value);
  if (!current || current === "⚡" || current === "mdi:flash" || current === "mdi:flash-outline") {
    input.value = quickActionDefault(type.value);
  }
  preview.innerHTML = actionIconMarkup(input.value || quickActionDefault(type.value));
  input.classList.add("dm-beta6-qa-icon-value");

  if (type.dataset.dmBeta6IconBound !== "true") {
    type.dataset.dmBeta6IconBound = "true";
    type.addEventListener("change", () => {
      const oldDefault = Object.values(QUICK_ACTION_DEFAULTS).includes(clean(input.value));
      if (!clean(input.value) || oldDefault) input.value = quickActionDefault(type.value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  return true;
}

function polishDailyChart() {
  const chart = root.__DASHBOARDMODERN_BETA5_ROOT_CAUSES__?.dailyChart;
  if (!chart?.canvas || !chart?.data?.datasets?.length) return false;
  const mobile = (root.innerWidth || doc.documentElement?.clientWidth || 900) <= 760;
  const production = chart.data.datasets[0];
  const consumption = chart.data.datasets[1];

  try {
    const context = chart.ctx || chart.canvas.getContext?.("2d");
    if (context?.createLinearGradient) {
      const gradient = context.createLinearGradient(
        0,
        0,
        0,
        Math.max(220, chart.canvas.clientHeight || 280),
      );
      gradient.addColorStop(0, "rgba(22,163,74,.24)");
      gradient.addColorStop(0.72, "rgba(22,163,74,.07)");
      gradient.addColorStop(1, "rgba(22,163,74,0)");
      production.backgroundColor = gradient;
    }
  } catch (_error) {
    production.backgroundColor = "rgba(22,163,74,.11)";
  }

  Object.assign(production, {
    fill: "origin",
    tension: 0.34,
    borderWidth: mobile ? 2.2 : 2.6,
    pointRadius: mobile ? 2.2 : 2.8,
    pointHoverRadius: 5,
    pointBorderWidth: 0,
  });
  if (consumption)
    Object.assign(consumption, {
      fill: false,
      tension: 0.34,
      borderWidth: mobile ? 2.2 : 2.6,
      pointRadius: mobile ? 2.2 : 2.8,
      pointHoverRadius: 5,
      pointBorderWidth: 0,
      backgroundColor: "rgba(14,165,233,0)",
    });

  chart.options ||= {};
  chart.options.maintainAspectRatio = false;
  chart.options.animation = false;
  chart.options.layout = { padding: { top: 10, right: 8, bottom: 2, left: 2 } };
  chart.options.interaction = { intersect: false, mode: "index" };
  chart.options.plugins ||= {};
  chart.options.plugins.legend = { display: false };
  chart.options.plugins.tooltip = {
    ...(chart.options.plugins.tooltip || {}),
    displayColors: true,
    padding: 10,
    cornerRadius: 10,
  };
  chart.options.scales ||= {};
  chart.options.scales.x = {
    ...(chart.options.scales.x || {}),
    border: { display: false },
    grid: { display: false, drawBorder: false },
    ticks: {
      ...(chart.options.scales.x?.ticks || {}),
      autoSkip: true,
      maxTicksLimit: mobile ? 6 : 10,
      maxRotation: 0,
      minRotation: 0,
      padding: 8,
      color: "#64748b",
      font: { size: mobile ? 11 : 12, weight: "700" },
    },
  };
  chart.options.scales.y = {
    ...(chart.options.scales.y || {}),
    beginAtZero: true,
    grace: "8%",
    border: { display: false },
    grid: { color: "rgba(100,116,139,.16)", drawBorder: false },
    ticks: {
      ...(chart.options.scales.y?.ticks || {}),
      maxTicksLimit: mobile ? 5 : 6,
      padding: 7,
      color: "#64748b",
      font: { size: mobile ? 11 : 12, weight: "650" },
    },
    title: {
      display: !mobile,
      text: "kWh",
      color: "#64748b",
      font: { weight: "700" },
    },
  };
  chart.canvas.dataset.dmBeta6ChartPolished = "true";
  state.chart = chart;
  try {
    chart.resize?.();
    chart.update?.("none");
  } catch (_error) {}
  return true;
}

function lightState(entityId) {
  return allStates()?.[entityId] || root.currentEntity?.(entityId) || root.haState?.(entityId) || null;
}

function configuredLights() {
  const names = readJson("cd_luci", {});
  return Object.keys(names || {})
    .filter((id) => /^light\./i.test(id))
    .map((id) => ({
      id,
      name: clean(names[id]) || clean(lightState(id)?.attributes?.friendly_name) || id,
    }));
}

function supportedModes(entity) {
  const raw = entity?.attributes?.supported_color_modes;
  return new Set(
    (Array.isArray(raw) ? raw : [])
      .map((value) => clean(value).toLowerCase())
      .filter(Boolean),
  );
}

function supportsBrightness(entity) {
  const modes = supportedModes(entity);
  if (entity?.attributes?.brightness != null) return true;
  return [...modes].some((mode) => BRIGHTNESS_MODES.has(mode));
}

function supportsRgb(entity) {
  return [...supportedModes(entity)].some((mode) => RGB_MODES.has(mode));
}

function rgbToHex(rgb) {
  const values = Array.isArray(rgb) ? rgb.slice(0, 3) : [];
  if (values.length < 3 || values.some((value) => !Number.isFinite(Number(value)))) return "#ffffff";
  return `#${values
    .map((value) => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex) {
  const value = clean(hex).replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return [255, 255, 255];
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function callLight(entityId, data) {
  const payload = { entity_id: entityId, ...data };
  try {
    if (typeof root.cdCallServiceJson === "function")
      return root.cdCallServiceJson("light", "turn_on", JSON.stringify(payload));
    if (typeof root.callService === "function") return root.callService("light", "turn_on", payload);
    const hass = root.hass || root._hass || doc?.querySelector?.("home-assistant")?.hass;
    if (typeof hass?.callService === "function") return hass.callService("light", "turn_on", payload);
  } catch (error) {
    root.console?.warn?.("[DashboardModern] light control failed", error);
  }
  return null;
}

function lightSignature(lights) {
  return lights
    .map(({ id }) => {
      const entity = lightState(id) || {};
      const attributes = entity.attributes || {};
      return [
        id,
        entity.state,
        attributes.brightness,
        (attributes.rgb_color || []).join(","),
        (attributes.supported_color_modes || []).join(","),
      ].join("|");
    })
    .join(";");
}

function renderAdvancedLightControls() {
  const list = doc?.getElementById?.("wz-lights-list");
  if (!list) return false;
  const popup = list.closest?.(".wz-popup,.popup,.modal,.wz-modal") || list.parentElement;
  if (!popup) return false;
  const lights = configuredLights().filter(({ id }) => {
    const entity = lightState(id);
    return entity && (supportsBrightness(entity) || supportsRgb(entity));
  });
  let panel = popup.querySelector?.(".dm-beta6-light-advanced");
  if (!lights.length) {
    panel?.remove();
    return false;
  }

  const signature = lightSignature(lights);
  if (panel && state.lightSignature === signature) return true;
  state.lightSignature = signature;
  if (!panel) {
    panel = doc.createElement("section");
    panel.className = "dm-beta6-light-advanced";
    list.insertAdjacentElement("afterend", panel);
  }
  panel.innerHTML = `<header><strong>${t("Dimmer e colori", "Dimmer & colors")}</strong><span>${t("Solo per luci compatibili", "Compatible lights only")}</span></header><div class="dm-beta6-light-control-list"></div>`;
  const body = panel.querySelector(".dm-beta6-light-control-list");

  lights.forEach(({ id, name }) => {
    const entity = lightState(id) || {};
    const attributes = entity.attributes || {};
    const dimmable = supportsBrightness(entity);
    const rgb = supportsRgb(entity);
    const brightness = Math.round(
      (Math.max(0, Math.min(255, Number(attributes.brightness) || 0)) / 255) * 100,
    );
    const row = doc.createElement("article");
    row.className = "dm-beta6-light-control";
    row.dataset.entity = id;
    row.innerHTML = `<div class="dm-beta6-light-head"><span class="dm-beta6-light-dot ${entity.state === "on" ? "is-on" : ""}"></span><div><strong>${esc(name)}</strong><small>${esc(id)}</small></div></div><div class="dm-beta6-light-tools">${
      dimmable
        ? `<label class="dm-beta6-dimmer"><span>${t("Luminosità", "Brightness")}</span><output>${brightness}%</output><input type="range" min="1" max="100" step="1" value="${Math.max(1, brightness || 1)}" data-brightness></label>`
        : ""
    }${
      rgb
        ? `<label class="dm-beta6-color"><span>RGB</span><input type="color" value="${rgbToHex(attributes.rgb_color)}" data-color aria-label="${t("Colore luce", "Light color")}"></label>`
        : ""
    }</div>`;
    body.append(row);

    const slider = row.querySelector("[data-brightness]");
    const output = row.querySelector(".dm-beta6-dimmer output");
    if (slider) {
      let timer = 0;
      slider.addEventListener("input", () => {
        if (output) output.value = `${slider.value}%`;
        root.clearTimeout?.(timer);
        timer =
          root.setTimeout?.(
            () => callLight(id, { brightness_pct: Number(slider.value) }),
            120,
          ) || 0;
      });
      slider.addEventListener("change", () => {
        root.clearTimeout?.(timer);
        callLight(id, { brightness_pct: Number(slider.value) });
      });
    }
    row.querySelector("[data-color]")?.addEventListener("change", (event) =>
      callLight(id, { rgb_color: hexToRgb(event.target.value) }),
    );
  });
  return true;
}

function run() {
  state.frame = 0;
  polishQuickActionIcon();
  polishVehicleBrandImages();
  polishDailyChart();
  renderAdvancedLightControls();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installOwners() {
  wrapFunction("wzOpenLightsPopup", "__dmBeta6LightControls", schedule);
  wrapFunction("editorSwitch", "__dmBeta6QuickAction", schedule);
  wrapFunction("renderEdDailyChart", "__dmBeta6DailyChart", schedule);
  wrapFunction("render", "__dmBeta6Runtime", schedule);
}

function installStyles() {
  installStyle(
    "dm-beta6-feedback-style",
    `
      .ed-qa-form-row[data-dm-beta6-quick-action="true"]{align-items:stretch!important}
      #ed-qa-icon.dm-beta6-qa-icon-value{display:none!important}
      .dm-beta6-qa-icon-trigger{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;min-width:62px!important;min-height:52px!important;margin:0!important;padding:8px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--card-background-color,#fff)!important;color:var(--info-color,#0284c7)!important;cursor:pointer!important;box-shadow:none!important}
      .dm-beta6-qa-icon-trigger svg{width:34px!important;height:34px!important;max-width:34px!important;max-height:34px!important}
      .dm-beta6-quick-icon-grid .dm-picker-option{min-height:104px!important}
      .dm-beta6-quick-icon-grid .dm-picker-visual svg{width:40px!important;height:40px!important;max-width:40px!important;max-height:40px!important}

      .dm-beta6-brand-image{display:grid!important;place-items:center!important;width:88px!important;height:58px!important;padding:5px!important;box-sizing:border-box!important}
      .dm-beta6-brand-image img{display:block!important;width:100%!important;height:100%!important;max-width:86px!important;max-height:50px!important;object-fit:contain!important;object-position:center!important;filter:none!important}
      [data-brand-preview] .dm-beta6-brand-image{width:104px!important;height:64px!important}
      [data-brand-preview] .dm-beta6-brand-image img{max-width:100px!important;max-height:56px!important}

      #ed-daily-chart{overflow:hidden!important}
      #ed-daily-chart .ed-chart-wrap{box-sizing:border-box!important;height:clamp(250px,52vw,320px)!important;min-height:0!important;max-height:320px!important;margin:8px 0 0!important;padding:0 8px 8px!important;overflow:hidden!important}
      #ed-daily-chart .ed-chart-wrap canvas,#ed-daily-canvas[data-dm-beta5-real-history]{box-sizing:border-box!important;width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;margin:0!important}

      .dm-beta6-light-advanced{display:grid!important;gap:10px!important;margin:14px 0 0!important;padding:14px!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 18%,var(--divider-color,#dbe4ee))!important;border-radius:18px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 4%,var(--card-background-color,#fff))!important}
      .dm-beta6-light-advanced>header{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:12px!important}.dm-beta6-light-advanced>header strong{font-size:15px!important}.dm-beta6-light-advanced>header span{font-size:11px!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-beta6-light-control-list{display:grid!important;gap:10px!important}
      .dm-beta6-light-control{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(220px,1.4fr)!important;align-items:center!important;gap:14px!important;padding:12px!important;border-radius:15px!important;background:var(--card-background-color,#fff)!important;box-shadow:0 5px 18px rgba(15,23,42,.05)!important}
      .dm-beta6-light-head{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}.dm-beta6-light-head>div{min-width:0!important}.dm-beta6-light-head strong,.dm-beta6-light-head small{display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-beta6-light-head small{margin-top:3px!important;font-size:10px!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-beta6-light-dot{width:10px!important;height:10px!important;flex:0 0 10px!important;border-radius:999px!important;background:#94a3b8!important;box-shadow:0 0 0 4px rgba(148,163,184,.12)!important}.dm-beta6-light-dot.is-on{background:#f59e0b!important;box-shadow:0 0 0 4px rgba(245,158,11,.14)!important}
      .dm-beta6-light-tools{display:grid!important;grid-template-columns:minmax(160px,1fr) auto!important;align-items:center!important;gap:12px!important}.dm-beta6-dimmer{display:grid!important;grid-template-columns:1fr auto!important;align-items:center!important;gap:6px 10px!important}.dm-beta6-dimmer span,.dm-beta6-color span{font-size:11px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}.dm-beta6-dimmer output{font-size:11px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}.dm-beta6-dimmer input{grid-column:1/-1!important;width:100%!important;accent-color:var(--info-color,#0ea5e9)!important}.dm-beta6-color{display:grid!important;place-items:center!important;gap:5px!important}.dm-beta6-color input{box-sizing:border-box!important;width:42px!important;height:34px!important;padding:2px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:10px!important;background:transparent!important}

      @media(max-width:760px){
        .ed-qa-form-row[data-dm-beta6-quick-action="true"]{grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr)!important}
        .dm-beta6-qa-icon-trigger{min-width:64px!important;width:64px!important;min-height:52px!important}
        #ed-daily-chart .ed-chart-wrap{height:252px!important;min-height:252px!important;max-height:252px!important;padding:0 4px 6px!important}
        .dm-beta6-light-control{grid-template-columns:1fr!important;gap:10px!important;padding:11px!important}.dm-beta6-light-tools{grid-template-columns:minmax(0,1fr) 48px!important}.dm-beta6-light-advanced>header{align-items:flex-start!important;flex-direction:column!important;gap:2px!important}
        .dm-beta6-brand-image{width:80px!important;height:54px!important}.dm-beta6-brand-image img{max-width:78px!important;max-height:46px!important}
      }
    `,
  );
}

export function installBeta6FeedbackSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installOwners();

  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installOwners();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    installOwners();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:period-bundle", schedule);
  root.addEventListener?.("dashboardmodern:energy-stable", schedule);
  root.addEventListener?.("resize", schedule, { passive: true });
  doc.addEventListener("change", schedule, true);
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(
          ".ed-tab,.sub-tab-btn,.dm-picker-option,.ed-btn-add,[data-brand-preview],#btn-lights",
        )
      )
        root.setTimeout?.(schedule, 0);
    },
    true,
  );
  schedule();
}

installBeta6FeedbackSection();
