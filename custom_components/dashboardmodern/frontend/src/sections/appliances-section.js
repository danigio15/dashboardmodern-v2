import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import { runtimeMetrics } from "../core/runtime-metrics.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCES_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  normalizing: false,
  frame: 0,
  storeUnsubscribe: null,
});

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity || entry?.entity_id))
    .map(clean)
    .filter(Boolean);
  const unit = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh|mwh)$/i;
  const name =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((id) => unit.test(clean(states[id]?.attributes?.unit_of_measurement))) ||
    candidates.find((id) => name.test(id)) ||
    ""
  );
}

function devices() {
  const values = section("appliances", []);
  return Array.isArray(values) ? values : [];
}

function visualFor(device) {
  try {
    const visual = root.DashboardModernModules?.data?.getDeviceVisual?.(device);
    if (visual) return visual;
  } catch (_error) {}
  const image = clean(device?.image || device?.image_url);
  if (image) return { kind: "image", value: image };
  return {
    kind: "asset",
    value: clean(
      device?.visual_key || device?.device_type || device?.type || device?.icon || device?.name,
    ),
  };
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function normalizeEnergyGlyphs(card) {
  card
    .querySelectorAll(
      ".appl-wide-stat,.appl-stat,.appl-energy,.appl-kwh,[data-appliance-energy],small",
    )
    .forEach((node) => {
      if (!/🔋/.test(node.textContent || "")) return;
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3 && /🔋/.test(child.nodeValue || ""))
          child.nodeValue = String(child.nodeValue || "").replaceAll("🔋", "⚡");
      });
    });
}

function normalizeArtwork(card, device) {
  const media = card.querySelector(".appl-visual .appl-ic");
  if (!media) return;
  const visual = visualFor(device);
  if (visual.kind === "image" && clean(visual.value)) {
    let image = media.querySelector(":scope .dm-appliance-image");
    if (!image) {
      const wrap = doc.createElement("span");
      wrap.className = "dm-appliance-image-wrap";
      image = doc.createElement("img");
      image.className = "dm-appliance-image";
      wrap.append(image);
      media.replaceChildren(wrap);
    }
    const source = clean(visual.value);
    const resolved = new URL(source, doc.baseURI).href;
    if (image.src !== resolved) image.src = source;
    image.alt = clean(device.name);
    image.loading = "eager";
    image.decoding = "async";
    card.dataset.dmArtwork = "custom";
    card.dataset.dmMediaKind = "image";
    return;
  }
  const kind = canonicalArtworkType(clean(visual.value));
  const markup = kind && applianceArtwork(kind, 96);
  if (!markup) return;
  const current = media.querySelector(":scope>.dm-appliance-art");
  if (!current || current.dataset.dmArt !== kind || !current.querySelector(".dm-art-panel"))
    media.innerHTML = markup;
  card.dataset.dmArtwork = kind;
  card.dataset.dmMediaKind = "asset";
}

function normalizeStatus(card, model) {
  const badge = card.querySelector(
    ".appl-wide-status,.appl-status,.appl-state,[data-appliance-state],.appl-badge",
  );
  if (badge) {
    badge.dataset.state = model.badge;
    setText(badge, model.label);
  }
  card.dataset.applianceState = model.mode;
}

function ensureToggle(card, model) {
  const entity = model.action.entity;
  if (!entity) return;
  let button = card.querySelector('[data-dm-power-toggle="true"]');
  if (!button) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-appliance-power-toggle";
    button.dataset.dmPowerToggle = "true";
    (card.querySelector(".appl-wide-actions,.appl-actions,.appl-wide-body") || card).append(button);
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = clean(button.dataset.entity);
      if (!id || button.disabled) return;
      button.disabled = true;
      try {
        const on = allStates()[id]?.state === "on";
        await root.dmCallHaService?.(id.split(".")[0], on ? "turn_off" : "turn_on", {
          entity_id: id,
        });
      } finally {
        root.setTimeout?.(() => {
          button.disabled = false;
          scheduleApplianceNormalization();
        }, 250);
      }
    });
  }
  button.dataset.entity = entity;
  button.dataset.state = model.action.pressed ? "on" : "off";
  button.setAttribute("aria-pressed", model.action.pressed ? "true" : "false");
  setText(button, model.action.label);
}

export function normalizeApplianceCards() {
  if (!doc || state.normalizing) return false;
  const configured = devices();
  const cards = [
    ...doc.querySelectorAll(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    ),
  ];
  if (!configured.length || !cards.length) return false;
  state.normalizing = true;
  runtimeMetrics.increment("applianceRenders");
  try {
    const byId = new Map(configured.map((device) => [clean(device.id), device]));
    const states = allStates();
    cards.forEach((card, index) => {
      const device = byId.get(clean(card.dataset.applianceId)) || configured[index];
      if (!device) return;
      const model = createApplianceViewModel(device, states, section("rooms", []), english() ? "en" : "it");
      card.dataset.dmApplianceSection = "true";
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      normalizeArtwork(card, device);
      normalizeEnergyGlyphs(card);
      normalizeStatus(card, model);
      ensureToggle(card, model);
    });
    return true;
  } finally {
    state.normalizing = false;
  }
}

export function scheduleApplianceNormalization() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    normalizeApplianceCards();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle(
    "dm-appliances-section-style",
    `
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{
        --dm-appl-bg:var(--ha-card-background,var(--card-background-color,var(--card-bg,#fff)));
        --dm-appl-text:var(--primary-text-color,var(--text,#0f172a));
        --dm-appl-muted:var(--secondary-text-color,var(--text-dim,#475569));
        display:grid!important;grid-template-columns:minmax(108px,30%) minmax(0,1fr)!important;
        box-sizing:border-box!important;min-height:166px!important;overflow:hidden!important;
        background:var(--dm-appl-bg)!important;color:var(--dm-appl-text)!important;
        border-color:var(--divider-color,var(--card-border,#dbe4ee))!important
      }
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,
      html[data-theme="dark"] #appl-grid-overview .appl-wide-card,
      body.dark #page-appliances-main .appl-wide-card,
      body.dark #appl-grid-overview .appl-wide-card{
        --dm-appl-bg:var(--ha-card-background,var(--card-background-color,#162033));
        --dm-appl-text:var(--primary-text-color,#f8fafc);
        --dm-appl-muted:var(--secondary-text-color,#b7c3d4)
      }
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{
        position:relative!important;height:100%!important;overflow:hidden!important;
        background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 14%,var(--dm-appl-bg))!important
      }
      #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{
        display:grid!important;grid-template-rows:auto auto 1fr auto!important;min-width:0!important;
        padding:14px!important;color:var(--dm-appl-text)!important
      }
      #page-appliances-main .appl-wide-card strong,#appl-grid-overview .appl-wide-card strong,
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name,
      #page-appliances-main .appl-wide-title,#appl-grid-overview .appl-wide-title{
        color:var(--dm-appl-text)!important;opacity:1!important
      }
      #page-appliances-main .appl-wide-stat,#appl-grid-overview .appl-wide-stat,
      #page-appliances-main .appl-energy,#appl-grid-overview .appl-energy,
      #page-appliances-main .appl-kwh,#appl-grid-overview .appl-kwh,
      #page-appliances-main .appl-wide-card small,#appl-grid-overview .appl-wide-card small{
        color:var(--dm-appl-muted)!important;opacity:1!important;font-weight:750!important
      }
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,
      #page-appliances-main .appl-status,#appl-grid-overview .appl-status,
      #page-appliances-main [data-appliance-state],#appl-grid-overview [data-appliance-state]{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        min-width:68px!important;min-height:30px!important;margin:0!important;padding:6px 10px!important;
        border-radius:999px!important;line-height:1!important;font-weight:900!important
      }
      #page-appliances-main [data-state="running"],#appl-grid-overview [data-state="running"]{
        background:color-mix(in srgb,var(--success-color,#10b981) 14%,transparent)!important;
        color:var(--success-color,#047857)!important
      }
      #page-appliances-main [data-state="standby"],#appl-grid-overview [data-state="standby"]{
        background:color-mix(in srgb,var(--warning-color,#f59e0b) 16%,transparent)!important;
        color:var(--warning-color,#b45309)!important
      }
      #page-appliances-main [data-state="off"],#appl-grid-overview [data-state="off"]{
        background:color-mix(in srgb,var(--secondary-text-color,#64748b) 12%,transparent)!important;
        color:var(--dm-appl-muted)!important
      }
      #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,
      #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{
        display:flex!important;align-items:center!important;gap:8px!important;margin-top:10px!important
      }
      #page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button,
      #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        box-sizing:border-box!important;min-height:38px!important;margin:0!important;padding:8px 14px!important;
        border-radius:12px!important;line-height:1!important;font-weight:900!important
      }
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{
        min-width:88px!important;border:0!important;color:#fff!important;cursor:pointer!important;
        background:linear-gradient(135deg,var(--info-color,#38bdf8),var(--primary-color,#0284c7))!important
      }
      #page-appliances-main .dm-appliance-image-wrap,#appl-grid-overview .dm-appliance-image-wrap,
      #page-appliances-main .dm-appliance-image,#appl-grid-overview .dm-appliance-image,
      #page-appliances-main .dm-appliance-art,#appl-grid-overview .dm-appliance-art,
      #page-appliances-main .dm-appliance-art>svg,#appl-grid-overview .dm-appliance-art>svg{
        position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;
        max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important
      }
      #page-appliances-main .dm-appliance-image,#appl-grid-overview .dm-appliance-image{
        object-fit:cover!important;object-position:center!important
      }
      @media(max-width:560px){
        #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{
          grid-template-columns:1fr!important;grid-template-rows:140px auto!important;min-height:0!important
        }
        #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-height:140px!important}
        #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{padding:14px 12px!important}
        #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions{display:grid!important;grid-template-columns:1fr!important}
        #page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button{width:100%!important;min-height:44px!important}
      }
    `,
  );
}

function installWrappers() {
  wrapFunction("renderAppliances", "__dmAppliancesSection", scheduleApplianceNormalization);
  wrapFunction("renderApplianceSection", "__dmAppliancesSection", scheduleApplianceNormalization);
  wrapFunction("render", "__dmAppliancesRenderSection", scheduleApplianceNormalization);
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (change.section === "appliances") scheduleApplianceNormalization();
  });
}

export function installAppliancesSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  subscribeStore();
  scheduleApplianceNormalization();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", scheduleApplianceNormalization);
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      scheduleApplianceNormalization();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("[data-tab='appliances'],.tab[data-tab='appliances']"))
          scheduleApplianceNormalization();
      },
      true,
    );
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installAppliancesSection, { once: true });
else installAppliancesSection();
