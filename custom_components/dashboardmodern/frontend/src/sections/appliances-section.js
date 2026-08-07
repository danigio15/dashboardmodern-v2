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

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function applianceEntityIds() {
  const ids = new Set();
  devices().forEach((device) => {
    for (const value of [
      device.control_entity,
      device.state_entity,
      device.status_entity,
      device.power_entity,
      device.energy_entity,
      device.daily_energy_entity,
      device.monthly_energy_entity,
      device.total_energy_entity,
      device.history_entity,
      device.report_entity,
      ...(device.entities || []),
    ]) {
      const id = clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
      if (id) ids.add(id);
    }
  });
  return ids;
}

export function stateChangeAffectsAppliances(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = applianceEntityIds();
  return [...changed].some((id) => configured.has(id));
}

function appliancesVisible() {
  return Boolean(doc?.getElementById("page-appliances-main")?.classList.contains("active"));
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
        if (child.nodeType === 3 && /🔋/.test(child.nodeValue || "")) {
          child.nodeValue = String(child.nodeValue || "").replaceAll("🔋", "⚡");
        }
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
  if (!current || current.dataset.dmArt !== kind || !current.querySelector(".dm-art-panel")) {
    media.innerHTML = markup;
  }
  card.dataset.dmArtwork = kind;
  card.dataset.dmMediaKind = "asset";
}

function normalizeStatus(card, model) {
  const badge = card.querySelector(
    ".appl-wide-status,.appl-status,.appl-state,.appl-st,[data-appliance-state],.appl-badge",
  );
  if (badge) {
    badge.dataset.state = model.badge;
    badge.classList.remove("run", "standby", "off", "unavailable");
    badge.classList.add(model.mode === "running" ? "run" : model.mode);
    setText(badge, model.label);
  }
  card.dataset.applianceState = model.mode;
}

function restoreLegacyActions(card) {
  card.querySelectorAll(".appl-action-btn").forEach((button) => {
    button.hidden = false;
    button.removeAttribute("aria-hidden");
    button.removeAttribute("tabindex");
  });
}

function hideLegacyPowerOnly(card) {
  const buttons = [...card.querySelectorAll(".appl-action-btn")];
  const legacyPower = buttons.find(
    (button) => !/storico|history/i.test(clean(button.textContent || button.getAttribute("aria-label"))),
  );
  if (!legacyPower) return;
  legacyPower.hidden = true;
  legacyPower.setAttribute("aria-hidden", "true");
  legacyPower.tabIndex = -1;
}

function ensureToggle(card, model) {
  const entity = clean(model.action.entity);
  restoreLegacyActions(card);
  let button = card.querySelector('[data-dm-power-toggle="true"]');
  if (!entity) {
    button?.remove();
    return;
  }

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
          if (appliancesVisible()) scheduleApplianceNormalization();
        }, 250);
      }
    });
  }

  button.dataset.entity = entity;
  button.dataset.state = model.action.pressed ? "on" : "off";
  button.setAttribute("aria-pressed", model.action.pressed ? "true" : "false");
  setText(button, model.action.label);
  hideLegacyPowerOnly(card);
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
      const model = createApplianceViewModel(
        device,
        states,
        section("rooms", []),
        english() ? "en" : "it",
      );
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
  if (!appliancesVisible() || state.frame) return;
  const run = () => {
    state.frame = 0;
    if (appliancesVisible()) normalizeApplianceCards();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle(
    "dm-appliances-section-style",
    `
      #page-appliances-main [data-state="running"],#appl-grid-overview [data-state="running"]{
        background:color-mix(in srgb,var(--success-color,#10b981) 14%,transparent)!important;color:var(--success-color,#047857)!important
      }
      #page-appliances-main [data-state="standby"],#appl-grid-overview [data-state="standby"]{
        background:color-mix(in srgb,var(--warning-color,#f59e0b) 16%,transparent)!important;color:var(--warning-color,#b45309)!important
      }
      #page-appliances-main [data-state="off"],#appl-grid-overview [data-state="off"]{
        background:color-mix(in srgb,var(--secondary-text-color,#64748b) 12%,transparent)!important;color:var(--secondary-text-color,#64748b)!important
      }
      #page-appliances-main [data-state="unavailable"],#appl-grid-overview [data-state="unavailable"]{
        background:color-mix(in srgb,var(--error-color,#dc2626) 12%,transparent)!important;color:var(--error-color,#b91c1c)!important
      }
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{
        min-width:88px!important;border:0!important;color:#fff!important;cursor:pointer!important;
        background:var(--success-color,#059669)!important
      }
      #page-appliances-main .dm-appliance-image,#appl-grid-overview .dm-appliance-image{
        object-fit:cover!important;object-position:center!important
      }
    `,
  );
}

function installWrappers() {
  wrapFunction("renderAppliances", "__dmAppliancesSection", () => {
    if (appliancesVisible()) scheduleApplianceNormalization();
  });
  wrapFunction("renderApplianceSection", "__dmAppliancesSection", () => {
    if (appliancesVisible()) scheduleApplianceNormalization();
  });
  wrapFunction("render", "__dmAppliancesRenderSection", () => {
    if (appliancesVisible()) scheduleApplianceNormalization();
  });
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (change.section === "appliances" && appliancesVisible()) scheduleApplianceNormalization();
  });
}

export function installAppliancesSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  subscribeStore();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (appliancesVisible() && stateChangeAffectsAppliances(event)) {
        scheduleApplianceNormalization();
      }
    });
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      if (appliancesVisible()) scheduleApplianceNormalization();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            "[data-tab='appliances-main'],[data-tab='appliances'],.tab[data-tab='appliances-main']",
          )
        ) {
          root.queueMicrotask?.(scheduleApplianceNormalization);
        }
      },
      true,
    );
  }
  state.installed = true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installAppliancesSection, { once: true });
} else {
  installAppliancesSection();
}
