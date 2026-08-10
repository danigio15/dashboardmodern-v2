import { ROOM_CATALOG, roomVisual } from "../core/personalization-catalog.js";
import { clean, doc, esc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA4_MOBILE_POLISH__";
const state = (root[KEY] ||= { installed: false, frame: 0, listeners: false });

const TAB_ICONS = Object.freeze({
  visib: "⚙️",
  sez0: "🏠",
  sez1: "⚡",
  sez2: "🚗",
  sez3: "🌞",
  sez4: "🛡️",
  sez6: "🖥️",
  sez7: "🌡️",
  sez8: "⚡",
  sez9: "❄️",
  appliances: "🧺",
  luci: "💡",
  stanze: "🏠",
  avvisi: "🔔",
  tapp: "🪟",
  irr: "💧",
  pool: "🏊",
});

const BRAND_SIGNS = Object.freeze({
  abarth: "♏",
  "alfa romeo": "AR",
  audi: "○○○○",
  bmw: "BMW",
  byd: "BYD",
  citroen: "⌃⌃",
  "citroën": "⌃⌃",
  cupra: "◇",
  dacia: "DACIA",
  ds: "DS",
  fiat: "FIAT",
  ford: "Ford",
  honda: "H",
  hyundai: "H",
  jeep: "Jeep",
  kia: "KIA",
  leapmotor: "LEAP",
  lexus: "L",
  mazda: "M",
  mercedes: "✦",
  "mercedes-benz": "✦",
  mini: "MINI",
  nissan: "NISSAN",
  opel: "⚡",
  peugeot: "♌",
  polestar: "✦",
  porsche: "PORSCHE",
  renault: "◇",
  seat: "S",
  skoda: "Š",
  "škoda": "Š",
  smart: "smart",
  tesla: "T",
  toyota: "TOYOTA",
  volkswagen: "VW",
  volvo: "VOLVO",
});

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function stripLeadingIcon(value) {
  return clean(value).replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

function syncConfigTabIcons() {
  doc?.querySelectorAll?.(".ed-tab[data-tab]").forEach((button) => {
    const tab = clean(button.dataset.tab);
    const icon = TAB_ICONS[tab];
    if (!icon) return;
    const existingLabel = button.querySelector("[data-dm-config-name]");
    const labelText = stripLeadingIcon(existingLabel?.textContent || button.textContent) || tab;
    let iconNode = button.querySelector(":scope > .dm-beta4-tab-icon");
    let labelNode = existingLabel;
    if (!iconNode || !labelNode) {
      button.replaceChildren();
      iconNode = doc.createElement("span");
      iconNode.className = "dm-beta4-tab-icon";
      iconNode.setAttribute("aria-hidden", "true");
      labelNode = doc.createElement("span");
      labelNode.dataset.dmConfigName = "true";
      labelNode.className = "dm-beta4-tab-label";
      button.append(iconNode, labelNode);
    }
    iconNode.textContent = icon;
    if (!clean(labelNode.textContent)) labelNode.textContent = labelText;
  });
}

function fixSectionRenameButtons() {
  const body = doc?.getElementById("ed-body");
  if (!body) return;
  body.querySelectorAll(".ed-row[data-section-key]").forEach((row) => {
    const button = row.querySelector(".dm-inline-rename");
    if (!button) return;
    button.classList.add("dm-beta4-section-rename");
    button.removeAttribute("style");
    if (button.parentElement !== row) row.append(button);
    const main = row.querySelector(".ed-row-main");
    if (main) main.style.paddingRight = "0";
  });
}

function brandWordmark(brand) {
  const name = clean(brand);
  const key = name.toLowerCase();
  const sign = BRAND_SIGNS[key] || name.toUpperCase();
  const compact = sign.length > 8 ? `${sign.slice(0, 8)}…` : sign;
  return `<span class="dm-beta4-brand-symbol">${esc(compact)}</span>`;
}

function polishCarBrandMarks() {
  const picker = doc?.querySelector?.('#dm-visual-picker[data-kind="car"]');
  picker?.querySelectorAll?.(".dm-picker-option").forEach((option) => {
    const brand = clean(option.querySelector("b")?.textContent);
    const mark = option.querySelector(".dm-car-brand");
    if (!brand || !mark || mark.dataset.dmBeta4Brand === brand) return;
    mark.dataset.dmBeta4Brand = brand;
    mark.innerHTML = brandWordmark(brand);
  });
  doc?.querySelectorAll?.("[data-brand-preview],.dm-ev-brand-badge").forEach((host) => {
    const brand = clean(host.querySelector("b")?.textContent);
    const mark = host.querySelector(".dm-car-brand");
    if (!brand || !mark || mark.dataset.dmBeta4Brand === brand) return;
    mark.dataset.dmBeta4Brand = brand;
    mark.innerHTML = brandWordmark(brand);
  });
}

function closeRoomPicker() {
  doc?.getElementById("dm-beta4-room-picker")?.remove();
}

function openRoomPicker(input) {
  if (!input) return;
  closeRoomPicker();
  const modal = doc.createElement("div");
  modal.id = "dm-beta4-room-picker";
  modal.className = "dm-section-modal dm-visual-picker";
  const english = doc.documentElement.lang === "en";
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>🏠 ${t("Scegli l'icona stanza", "Choose room icon")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${t("Cerca…", "Search…")}" data-search></div><div class="dm-picker-grid">${ROOM_CATALOG.map((item, index) => `<button type="button" class="dm-picker-option" data-index="${index}" data-search-text="${esc(`${item.it} ${item.en} ${item.keywords || ""}`.toLowerCase())}"><span class="dm-picker-visual">${roomVisual(item.mdi, 46)}</span><b>${esc(english ? item.en : item.it)}</b></button>`).join("")}</div></section>`;
  doc.body.append(modal);
  modal.querySelector("[data-close]")?.addEventListener("click", closeRoomPicker);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeRoomPicker(); });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const q = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-picker-option").forEach((button) => {
      button.hidden = Boolean(q) && !button.dataset.searchText.includes(q);
    });
  });
  modal.querySelectorAll(".dm-picker-option").forEach((button) => button.addEventListener("click", () => {
    const item = ROOM_CATALOG[Number(button.dataset.index)];
    if (!item) return;
    input.value = item.mdi;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closeRoomPicker();
    schedule();
  }));
  root.setTimeout?.(() => modal.querySelector("[data-search]")?.focus(), 20);
}

function polishRoomFirstInsert() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "stanze") return false;
  body.dataset.dmBeta4Rooms = "true";
  const input = body.querySelector("#ed-room-icon");
  const name = body.querySelector("#ed-room-name");
  if (!input || !name) return false;
  const row = input.parentElement;
  if (!row) return false;
  row.classList.add("dm-beta4-room-add-row");
  const legacyPreview = body.querySelector("#ed-room-icon-preview");
  if (legacyPreview) legacyPreview.hidden = true;
  const legacyPalette = [...row.querySelectorAll("button")].find((button) => /dmIconPicker|wzPickIcon/i.test(button.getAttribute("onclick") || "") || clean(button.textContent) === "🎨");
  if (!legacyPalette) return false;
  legacyPalette.removeAttribute("onclick");
  legacyPalette.removeAttribute("style");
  legacyPalette.className = "dm-beta4-room-icon-trigger";
  legacyPalette.type = "button";
  legacyPalette.setAttribute("aria-label", t("Scegli icona stanza", "Choose room icon"));
  const refresh = () => {
    const value = clean(input.value) || "mdi:home";
    legacyPalette.innerHTML = roomVisual(value, 46) || `<span class="dm-beta4-room-fallback">${esc(value.startsWith("mdi:") ? "🏠" : value)}</span>`;
  };
  if (legacyPalette.dataset.dmBeta4Bound !== "true") {
    legacyPalette.dataset.dmBeta4Bound = "true";
    legacyPalette.addEventListener("click", () => openRoomPicker(input));
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
  }
  if (row.firstElementChild !== legacyPalette) row.prepend(legacyPalette);
  refresh();
  return true;
}

function polishAlertIconField(custom) {
  const input = custom?.querySelector?.("#ed-avv-icon");
  if (!input) return;
  const row = input.parentElement;
  if (!row) return;
  row.classList.add("dm-beta4-alert-icon-row");
  const button = [...row.querySelectorAll("button")].at(-1);
  if (!button) return;
  button.removeAttribute("style");
  button.classList.add("dm-beta4-alert-icon-trigger");
  button.setAttribute("aria-label", t("Scegli icona avviso", "Choose alert icon"));
  const refresh = () => {
    const value = clean(input.value) || "⚠️";
    button.textContent = value.startsWith("mdi:") ? "⚠️" : value;
  };
  if (button.dataset.dmBeta4Bound !== "true") {
    button.dataset.dmBeta4Bound = "true";
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
  }
  refresh();
}

function polishAlertsFirstInsert() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "avvisi") return false;
  body.dataset.dmBeta4Alerts = "true";
  const group = body.querySelector("#ed-avv-grp");
  const entity = body.querySelector("#ed-avv-ent");
  const custom = body.querySelector("#ed-avv-custom");
  if (!group || !entity) return false;
  const entityRow = entity.parentElement;
  entityRow?.classList.add("dm-beta4-alert-entity-row");
  const syncCustom = () => {
    if (!custom) return;
    const visible = clean(group.value) === "custom";
    custom.style.display = visible ? "grid" : "none";
    custom.hidden = !visible;
    if (visible) polishAlertIconField(custom);
  };
  if (group.dataset.dmBeta4Bound !== "true") {
    group.dataset.dmBeta4Bound = "true";
    group.addEventListener("change", () => root.queueMicrotask?.(syncCustom));
  }
  syncCustom();
  body.querySelectorAll("button").forEach((button) => {
    if (clean(button.textContent) === "⚡" && !button.closest(".ed-row")) button.hidden = true;
  });
  return true;
}

function polishLightsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "luci") return false;
  body.dataset.dmBeta4Lights = "true";
  const input = body.querySelector("#luce-add-ent,[data-light-add-entity]");
  input?.parentElement?.classList.add("dm-beta4-light-entity-row");
  const form = input?.closest("form,.ed-form") || body.querySelector(".dm-light-add-form");
  form?.classList.add("dm-beta4-light-add-form");
  return true;
}

function restoreCasaSolarDailyChart() {
  const polish = root.__DASHBOARDMODERN_ENERGY_REPORT_POLISH__;
  const legacy = polish?.legacyDailyChart;
  if (typeof legacy !== "function") return false;
  if (root.renderEdDailyChart?.__dmBeta4CasaSolar === true) return true;
  const render = async (...args) => legacy(...args);
  render.__dmBeta4CasaSolar = true;
  // energy-report-polish treats this marker as already owned, so it cannot
  // wrap this function again and lose prodMese/consMese for the legacy fallback.
  render.__dmActualHistory = true;
  root.renderEdDailyChart = render;
  return true;
}

function polishClimateCards() {
  const page = doc?.getElementById("page-clima");
  if (!page) return false;
  page.dataset.dmBeta4Climate = "compact";
  return true;
}

function run() {
  state.frame = 0;
  syncConfigTabIcons();
  fixSectionRenameButtons();
  polishCarBrandMarks();
  polishRoomFirstInsert();
  polishAlertsFirstInsert();
  polishLightsEditor();
  polishClimateCards();
  restoreCasaSolarDailyChart();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle("dm-beta4-mobile-polish-style", `
    .ed-tab[data-tab]>.dm-beta4-tab-icon{display:inline-grid!important;place-items:center!important;flex:0 0 auto!important;min-width:1.2em!important;margin-right:5px!important;visibility:visible!important;opacity:1!important}
    .ed-tab[data-tab]>.dm-beta4-tab-label{display:inline!important;white-space:nowrap!important}

    #ed-body .ed-row[data-section-key] .ed-row-main{padding-right:0!important;min-width:0!important}
    #ed-body .ed-row[data-section-key]>.dm-inline-rename.dm-beta4-section-rename{position:static!important;inset:auto!important;transform:none!important;display:grid!important;place-items:center!important;flex:0 0 44px!important;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;margin:0 2px 0 8px!important;padding:0!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 28%,var(--divider-color,#dbe4ee))!important;border-radius:13px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;font-size:19px!important;line-height:1!important;box-shadow:none!important;overflow:visible!important;clip:auto!important}

    .dm-car-brand[data-dm-beta4-brand]{display:grid!important;place-items:center!important;width:76px!important;min-width:76px!important;height:48px!important;border-radius:14px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--info-color,#0ea5e9) 11%,#fff),color-mix(in srgb,var(--info-color,#0ea5e9) 4%,#fff))!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 24%,transparent)!important;color:var(--info-color,#0284c7)!important;overflow:hidden!important}
    .dm-beta4-brand-symbol{display:block!important;max-width:68px!important;padding:0 4px!important;font:900 11px/1.05 Inter,system-ui,sans-serif!important;letter-spacing:-.02em!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dm-visual-picker[data-kind="car"] .dm-picker-option{min-height:112px!important}

    #ed-body[data-dm-beta4-rooms="true"] .dm-beta4-room-add-row{display:grid!important;grid-template-columns:58px 138px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;margin-bottom:10px!important}
    #ed-body[data-dm-beta4-rooms="true"] #ed-room-icon-preview{display:none!important}
    #ed-body[data-dm-beta4-rooms="true"] .dm-beta4-room-icon-trigger{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;min-width:58px!important;padding:0!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 24%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 8%,var(--card-background-color,#fff))!important;cursor:pointer!important;overflow:hidden!important}
    #ed-body[data-dm-beta4-rooms="true"] .dm-beta4-room-icon-trigger .dm-room-visual{max-width:46px!important;max-height:46px!important}
    #ed-body[data-dm-beta4-rooms="true"] #ed-room-icon,#ed-body[data-dm-beta4-rooms="true"] #ed-room-name{margin:0!important;min-width:0!important;width:100%!important}

    #ed-body[data-dm-beta4-alerts="true"]{display:grid!important;gap:14px!important}
    #ed-body[data-dm-beta4-alerts="true"] #ed-avv-grp,#ed-body[data-dm-beta4-alerts="true"] #ed-avv-name,#ed-body[data-dm-beta4-alerts="true"] #ed-avv-cond,#ed-body[data-dm-beta4-alerts="true"] #ed-avv-val{width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta4-alerts="true"] .dm-beta4-alert-entity-row{display:grid!important;grid-template-columns:minmax(0,1fr) 50px!important;gap:8px!important;width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta4-alerts="true"] .dm-beta4-alert-entity-row>#ed-avv-ent{width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta4-alerts="true"] #ed-avv-custom{grid-template-columns:1fr!important;gap:10px!important;width:100%!important;min-width:0!important;margin-top:10px!important}
    #ed-body[data-dm-beta4-alerts="true"] #ed-avv-custom>.ed-btn-add{display:block!important;width:100%!important;min-height:48px!important;height:auto!important;margin:0!important;padding:12px 16px!important;white-space:normal!important;line-height:1.25!important}
    #ed-body[data-dm-beta4-alerts="true"] #ed-avv-ents{width:100%!important;min-width:0!important;margin:0!important;line-height:1.4!important}
    #ed-body[data-dm-beta4-alerts="true"] .dm-beta4-alert-icon-row{display:grid!important;grid-template-columns:minmax(0,1fr) 54px!important;gap:8px!important;width:100%!important;min-width:0!important}
    #ed-body[data-dm-beta4-alerts="true"] .dm-beta4-alert-icon-row>#ed-avv-icon{width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta4-alerts="true"] .dm-beta4-alert-icon-trigger{display:grid!important;place-items:center!important;width:54px!important;height:50px!important;min-width:54px!important;padding:0!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 24%,var(--divider-color,#dbe4ee))!important;border-radius:14px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 9%,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;font-size:24px!important;box-shadow:none!important}

    #ed-body[data-dm-beta4-lights="true"] .dm-light-group{overflow:visible!important}
    #ed-body[data-dm-beta4-lights="true"] .dm-light-row{min-height:0!important;padding:12px!important}
    #ed-body[data-dm-beta4-lights="true"] .dm-beta4-light-entity-row{display:grid!important;grid-template-columns:minmax(0,1fr) 50px!important;gap:8px!important;width:100%!important;min-width:0!important}
    #ed-body[data-dm-beta4-lights="true"] .dm-beta4-light-add-form{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;width:100%!important;min-width:0!important}
    #ed-body[data-dm-beta4-lights="true"] .ed-input,#ed-body[data-dm-beta4-lights="true"] select{min-width:0!important;max-width:100%!important}

    #page-clima[data-dm-beta4-climate="compact"] .clima-premium-grid{align-items:start!important}
    #page-clima[data-dm-beta4-climate="compact"] .cp-card{aspect-ratio:auto!important;min-height:0!important;height:auto!important;max-height:none!important;justify-content:flex-start!important;gap:14px!important;padding:16px!important;overflow:hidden!important}
    #page-clima[data-dm-beta4-climate="compact"] .cp-header{flex:0 0 auto!important}
    #page-clima[data-dm-beta4-climate="compact"] .cp-body{flex:0 0 auto!important;min-height:0!important;padding:8px 2px!important;align-items:center!important}
    #page-clima[data-dm-beta4-climate="compact"] .cp-controls{flex:0 0 auto!important;margin-top:0!important}
    #page-clima[data-dm-beta4-climate="compact"] .cp-temp-target .val{font-size:34px!important;line-height:1!important}

    @media(max-width:760px){
      #ed-body .ed-row[data-section-key]>.dm-inline-rename.dm-beta4-section-rename{flex-basis:42px!important;width:42px!important;min-width:42px!important;height:42px!important;min-height:42px!important;margin-left:7px!important}
      #ed-body[data-dm-beta4-rooms="true"] .dm-beta4-room-add-row{grid-template-columns:56px minmax(0,1fr)!important;gap:9px!important}
      #ed-body[data-dm-beta4-rooms="true"] #ed-room-icon{display:none!important}
      #ed-body[data-dm-beta4-rooms="true"] #ed-room-name{grid-column:2!important}
      #ed-body[data-dm-beta4-alerts="true"] .ed-form,#ed-body[data-dm-beta4-alerts="true"] .ed-form-row{min-width:0!important;max-width:100%!important}
      #ed-body[data-dm-beta4-lights="true"] .dm-light-row{grid-template-areas:"main edit delete" "room room room"!important;grid-template-columns:minmax(0,1fr) 44px 44px!important;gap:8px!important}
      #ed-body[data-dm-beta4-lights="true"] .dm-light-row .dm-light-order{display:none!important}
      #ed-body[data-dm-beta4-lights="true"] .dm-light-row .ed-row-main{grid-area:main!important;min-width:0!important}
      #ed-body[data-dm-beta4-lights="true"] .dm-light-row .dm-light-room{grid-area:room!important;width:100%!important;min-width:0!important}
      #ed-body[data-dm-beta4-lights="true"] .dm-light-row .dm-light-edit{grid-area:edit!important}
      #ed-body[data-dm-beta4-lights="true"] .dm-light-row .dm-light-delete{grid-area:delete!important}
      #page-clima[data-dm-beta4-climate="compact"] .clima-premium-grid{grid-template-columns:1fr!important;gap:12px!important}
      #page-clima[data-dm-beta4-climate="compact"] .cp-card{min-height:0!important;height:auto!important;max-height:none!important;padding:14px!important;gap:11px!important;border-radius:20px!important}
      #page-clima[data-dm-beta4-climate="compact"] .cp-body{padding:4px 2px!important}
      #page-clima[data-dm-beta4-climate="compact"] .cp-controls{min-height:52px!important}
    }
  `);
}

export function installBeta4MobilePolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    for (const name of ["editorSwitch", "edNavMove", "editorRenderStanze", "editorRenderLuci", "editorRenderAvvisi", "dmIconChoose", "renderEnergyDashboard"]) {
      wrapFunction(name, `__dmBeta4_${name}`, schedule);
    }
    restoreCasaSolarDailyChart();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("dashboardmodern:period-bundle", schedule);
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("click", (event) => {
      if (event.target?.closest?.(".ed-tab,.dm-inline-rename,[data-brand-preview],.dm-picker-option,.ed-btn-add,.dm-entity-picker")) root.setTimeout?.(schedule, 0);
    }, true);
    doc.addEventListener("change", (event) => {
      if (event.target?.closest?.("#editor-modal,#ed-body,#dm-visual-picker")) root.setTimeout?.(schedule, 0);
    }, true);
  }
  schedule();
}

installBeta4MobilePolishSection();
