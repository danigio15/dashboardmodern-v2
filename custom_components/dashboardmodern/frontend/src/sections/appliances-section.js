// DM-FIX-20260815A
import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import { isCumulativeEnergyEntity, resolveEntity } from "../core/period-service.js";
import { runtimeMetrics } from "../core/runtime-metrics.js";
import { iconGlyph } from "./icon-engine-section.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCES_SECTION__";
const DAILY_REFRESH_MS = 5000;
/* "Spegni" / "Turn off" needs a button wide enough to hold it, and on a phone
 * that width is not there: the label was clipped mid-word against the history
 * button beside it. The glyph says the same thing in a square, and the words
 * survive as the button's accessible name. */
const POWER_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>';
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  normalizing: false,
  frame: 0,
  storeUnsubscribe: null,
  dailyBreakdown: Object.freeze({ total: 0, rows: [] }),
  dailyUpdatedAt: 0,
  dailyPromise: null,
  dailyGeneration: 0,
});
root.__DM_FIX_20260815A__ = true;

export function normalizeApplianceRoomTabs() {
  let normalized = false;
  doc
    ?.querySelectorAll?.("#page-appliances-main .sub-tabs-energy .appl-section-tab")
    .forEach((button) => {
      const label = button.textContent || "";
      const match = label.match(/^mdi:[a-z0-9][a-z0-9-]*/i);
      if (!match) return;
      button.textContent = `${iconGlyph("room", match[0])}${label.slice(match[0].length)}`;
      normalized = true;
    });
  return normalized;
}

function configuredEntity(value) {
  return clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
}

function resolvedEntity(value) {
  const entity = configuredEntity(value);
  return entity ? resolveEntity(entity) : "";
}

function energyValueKwh(entity, states = {}) {
  const id = resolvedEntity(entity);
  const snapshot = states[id] || states[configuredEntity(entity)];
  const numeric = Number(snapshot?.state);
  if (!Number.isFinite(numeric)) return null;
  const unit = clean(snapshot?.attributes?.unit_of_measurement).toLowerCase();
  if (unit === "wh") return Math.max(0, numeric / 1000);
  if (unit === "mwh") return Math.max(0, numeric * 1000);
  if (unit && unit !== "kwh") return null;
  return Math.max(0, numeric);
}

export function applianceDailySource(device = {}, states = {}) {
  const directCandidates = [device.daily_energy_entity, device.energy_today, device.daily_energy]
    .map(configuredEntity)
    .filter(Boolean);
  const direct = directCandidates.find((entity) => energyValueKwh(entity, states) != null);
  if (direct) {
    return {
      entity: resolvedEntity(direct),
      source: direct,
      direct: true,
      reason: "explicit-daily",
    };
  }

  const cumulativeCandidates = [
    device.total_energy_entity,
    device.history_entity,
    device.report_entity,
    device.energy_entity,
    device.energy,
    ...(device.entities || []),
  ]
    .map(configuredEntity)
    .filter(Boolean);
  const seen = new Set();
  const cumulative = cumulativeCandidates.find((entity) => {
    if (seen.has(entity)) return false;
    seen.add(entity);
    return isCumulativeEnergyEntity(entity, states, (value) => resolveEntity(value));
  });
  if (!cumulative) return null;
  return {
    entity: resolvedEntity(cumulative),
    source: cumulative,
    direct: false,
    reason: "cumulative-recorder",
  };
}

export async function buildApplianceDailyBreakdown(
  applianceList = [],
  states = {},
  broker = root.DashboardModernEnergyService?.broker,
  selected = new Date(),
) {
  const rows = [];
  const plans = [];
  const planRows = new Map();

  applianceList.forEach((device, index) => {
    const source = applianceDailySource(device, states);
    if (!source) return;
    const row = {
      id: clean(device.id) || `appliance-${index}`,
      name: clean(device.name) || (english() ? "Appliance" : "Elettrodomestico"),
      entity: source.entity,
      source: source.source,
      direct: source.direct,
      reason: source.reason,
      value: null,
    };
    if (source.direct) {
      row.value = energyValueKwh(source.source, states);
    } else {
      const key = `appliance:${row.id}:${index}`;
      plans.push({
        key,
        entity: source.entity,
        source: source.source,
        kind: "day",
        direct: false,
        reason: source.reason,
      });
      planRows.set(key, row);
    }
    rows.push(row);
  });

  if (plans.length && broker?.valuesForPlans) {
    try {
      const values = await broker.valuesForPlans(plans, selected, states);
      planRows.forEach((row, key) => {
        const value = Number(values?.get?.(key));
        row.value = Number.isFinite(value) ? Math.max(0, value) : null;
      });
    } catch (error) {
      root.console?.warn?.("[DashboardModern] appliance daily Recorder lookup failed", error);
    }
  }

  const consumed = rows
    .filter((row) => Number.isFinite(row.value) && row.value > 0.0005)
    .sort((left, right) => right.value - left.value);
  const total = consumed.reduce((sum, row) => sum + row.value, 0);
  return Object.freeze({
    total: Math.round(total * 1000) / 1000,
    rows: Object.freeze(consumed.map((row) => Object.freeze({ ...row }))),
  });
}

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
    kind === "power" ? /power|potenza|watt/i : /energy|energia|kwh|consum|total|totale|mese|month/i;
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
      const id = configuredEntity(value);
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
    (button) =>
      !/storico|history/i.test(clean(button.textContent || button.getAttribute("aria-label"))),
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
  // Rewritten rather than set once at creation: a button drawn by an earlier
  // build is reused here, and it still carries the old text label.
  if (button.dataset.dmIcon !== "power") {
    button.innerHTML = POWER_ICON;
    button.dataset.dmIcon = "power";
  }
  button.setAttribute("aria-label", model.action.label);
  button.setAttribute("title", model.action.label);
  hideLegacyPowerOnly(card);
}

function dailyCard() {
  const cards = [...(doc?.querySelectorAll?.("#appl-kpi-grid .glance-card") || [])];
  return (
    cards.find((card) => /energia giornaliera|daily energy/i.test(clean(card.textContent))) ||
    cards[2] ||
    null
  );
}

function formatDaily(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "— kWh";
  if (numeric >= 10) return `${numeric.toFixed(1)} kWh`;
  return `${numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} kWh`;
}

function renderDailyPopup(breakdown = state.dailyBreakdown, { loading = false } = {}) {
  const popup = doc?.getElementById("dm-appliance-daily-popup");
  if (!popup) return;
  const total = popup.querySelector("[data-dm-daily-popup-total]");
  const list = popup.querySelector("[data-dm-daily-popup-list]");
  if (total) total.textContent = loading ? "…" : formatDaily(breakdown.total);
  if (!list) return;
  if (loading) {
    list.innerHTML = `<div class="dm-appliance-daily-empty">${english() ? "Updating Recorder data…" : "Aggiornamento dati Recorder…"}</div>`;
    return;
  }
  if (!breakdown.rows.length) {
    list.innerHTML = `<div class="dm-appliance-daily-empty">${english() ? "No appliance has measurable consumption today." : "Nessun elettrodomestico ha un consumo giornaliero misurabile."}</div>`;
    return;
  }
  list.innerHTML = breakdown.rows
    .map((row) => {
      const pct = breakdown.total > 0 ? Math.round((row.value / breakdown.total) * 100) : 0;
      const source = row.direct
        ? english()
          ? "Daily sensor"
          : "Sensore giornaliero"
        : english()
          ? "Total meter → Recorder"
          : "Contatore totale → Recorder";
      return `<button type="button" class="dm-appliance-daily-row" data-dm-daily-entity="${esc(row.entity)}">
        <span class="dm-appliance-daily-row-main"><strong>${esc(row.name)}</strong><small>${esc(row.entity)}</small><small>${source}</small></span>
        <span class="dm-appliance-daily-row-value"><strong>${formatDaily(row.value)}</strong><small>${pct}%</small></span>
      </button>`;
    })
    .join("");
  list.querySelectorAll("[data-dm-daily-entity]").forEach((row) => {
    row.addEventListener("click", (event) => {
      const entity = clean(row.dataset.dmDailyEntity);
      if (!entity || typeof root.apriStorico !== "function") return;
      event.stopPropagation();
      root.apriStorico(event, entity, row.querySelector("strong")?.textContent || entity);
    });
  });
}

function ensureDailyPopup() {
  if (!doc?.body) return null;
  let popup = doc.getElementById("dm-appliance-daily-popup");
  if (popup) return popup;
  popup = doc.createElement("div");
  popup.id = "dm-appliance-daily-popup";
  popup.className = "dm-appliance-daily-overlay";
  popup.hidden = true;
  popup.innerHTML = `<div class="dm-appliance-daily-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-daily-title">
    <div class="dm-appliance-daily-head"><div><small>${english() ? "TODAY" : "OGGI"}</small><h3 id="dm-appliance-daily-title">${english() ? "Appliance energy" : "Energia elettrodomestici"}</h3></div><button type="button" data-dm-daily-close aria-label="${english() ? "Close" : "Chiudi"}">✕</button></div>
    <div class="dm-appliance-daily-total"><span>${english() ? "Measured total" : "Totale misurato"}</span><strong data-dm-daily-popup-total>— kWh</strong></div>
    <div class="dm-appliance-daily-list" data-dm-daily-popup-list></div>
    <div class="dm-appliance-daily-note">${english() ? "Only daily sensors or Recorder deltas from cumulative total meters are counted. Lifetime values are never added directly." : "Sono conteggiati solo sensori giornalieri o delta Recorder dei contatori cumulativi. I valori lifetime non vengono mai sommati direttamente."}</div>
  </div>`;
  const close = () => {
    popup.hidden = true;
    popup.classList.remove("show");
  };
  popup.addEventListener("click", (event) => {
    if (event.target === popup) close();
  });
  popup.querySelector("[data-dm-daily-close]")?.addEventListener("click", close);
  doc.body.append(popup);
  return popup;
}

async function refreshApplianceDailyKpi({ force = false, openPopup = false } = {}) {
  const card = dailyCard();
  if (!card) return state.dailyBreakdown;
  if (openPopup) {
    const popup = ensureDailyPopup();
    if (popup) {
      popup.hidden = false;
      popup.classList.add("show");
      renderDailyPopup(state.dailyBreakdown, { loading: true });
    }
  }
  const age = Date.now() - state.dailyUpdatedAt;
  if (!force && state.dailyUpdatedAt && age < DAILY_REFRESH_MS) {
    applyDailyKpi(state.dailyBreakdown);
    if (openPopup) renderDailyPopup(state.dailyBreakdown);
    return state.dailyBreakdown;
  }
  if (state.dailyPromise) return state.dailyPromise;
  const generation = ++state.dailyGeneration;
  const applianceList = devices();
  const states = allStates();
  const broker = root.DashboardModernEnergyService?.broker;
  state.dailyPromise = buildApplianceDailyBreakdown(applianceList, states, broker)
    .then((breakdown) => {
      if (generation !== state.dailyGeneration) return state.dailyBreakdown;
      state.dailyBreakdown = breakdown;
      state.dailyUpdatedAt = Date.now();
      applyDailyKpi(breakdown);
      if (!ensureDailyPopup()?.hidden) renderDailyPopup(breakdown);
      return breakdown;
    })
    .finally(() => {
      if (generation === state.dailyGeneration) state.dailyPromise = null;
    });
  return state.dailyPromise;
}

function applyDailyKpi(breakdown = state.dailyBreakdown) {
  const card = dailyCard();
  if (!card) return false;
  card.dataset.dmApplianceDailyTotal = "true";
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute(
    "aria-label",
    english()
      ? "Open today's appliance energy breakdown"
      : "Apri dettaglio energia elettrodomestici di oggi",
  );
  card.title = english()
    ? "Show devices and energy sources"
    : "Mostra dispositivi ed entità che hanno consumato";
  const value = card.querySelector(".g-val");
  if (value) value.textContent = formatDaily(breakdown.total);
  if (!card.dataset.dmDailyMounted) {
    card.dataset.dmDailyMounted = "true";
    card.addEventListener("click", () =>
      refreshApplianceDailyKpi({ force: true, openPopup: true }),
    );
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      refreshApplianceDailyKpi({ force: true, openPopup: true });
    });
  }
  return true;
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
    if (!appliancesVisible()) return;
    normalizeApplianceRoomTabs();
    normalizeApplianceCards();
    refreshApplianceDailyKpi();
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
      /* Square, the size of the .appl-action-btn beside it: the 88px floor
         existed to fit the word, and it is what pushed the button into the
         History control on a narrow card. beta27-release-stability-section
         sizes the same control and is deliberately last in the cascade, so
         the two must agree — see the note on its rule. */
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{
        min-width:0!important;width:32px!important;height:32px!important;padding:0!important;
        flex:0 0 auto!important;display:inline-grid!important;place-items:center!important;
        border:0!important;color:#fff!important;cursor:pointer!important;
        background:var(--success-color,#059669)!important
      }
      #page-appliances-main .dm-appliance-power-toggle svg,#appl-grid-overview .dm-appliance-power-toggle svg{
        width:18px!important;height:18px!important
      }
      #page-appliances-main .dm-appliance-image,#appl-grid-overview .dm-appliance-image{
        object-fit:cover!important;object-position:center!important
      }
      #appl-kpi-grid [data-dm-appliance-daily-total="true"]{cursor:pointer!important;outline-offset:3px}
      #appl-kpi-grid [data-dm-appliance-daily-total="true"]:active{transform:scale(.985)}
      .dm-appliance-daily-overlay[hidden]{display:none!important}
      .dm-appliance-daily-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(7px)}
      .dm-appliance-daily-dialog{width:min(560px,100%);max-height:min(78vh,720px);overflow:hidden;background:var(--card-bg,#fff);color:var(--text,#0f172a);border:1px solid var(--card-border,#e2e8f0);border-radius:24px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column}
      .dm-appliance-daily-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 20px 12px}.dm-appliance-daily-head small{font-size:10px;letter-spacing:2px;font-weight:900;color:var(--text-dim,#64748b)}.dm-appliance-daily-head h3{margin:2px 0 0;font-size:22px}.dm-appliance-daily-head button{width:40px;height:40px;border:0;border-radius:12px;background:rgba(148,163,184,.14);color:inherit;font-size:18px;cursor:pointer}
      .dm-appliance-daily-total{margin:0 20px 12px;padding:16px 18px;border-radius:18px;background:linear-gradient(135deg,rgba(14,165,233,.14),rgba(56,189,248,.05));display:flex;align-items:center;justify-content:space-between;gap:14px}.dm-appliance-daily-total span{font-size:12px;font-weight:800;color:var(--text-dim,#64748b);text-transform:uppercase;letter-spacing:1px}.dm-appliance-daily-total strong{font-size:24px;color:#0284c7;white-space:nowrap}
      .dm-appliance-daily-list{overflow:auto;padding:0 20px 10px;display:grid;gap:8px}.dm-appliance-daily-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;padding:13px 14px;border:1px solid var(--card-border,#e2e8f0);border-radius:15px;background:rgba(148,163,184,.06);color:inherit;cursor:pointer}.dm-appliance-daily-row-main,.dm-appliance-daily-row-value{display:flex;flex-direction:column;min-width:0}.dm-appliance-daily-row-main{gap:2px}.dm-appliance-daily-row-main strong{font-size:14px}.dm-appliance-daily-row-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-dim,#64748b);font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}.dm-appliance-daily-row-value{align-items:flex-end;flex:0 0 auto}.dm-appliance-daily-row-value strong{color:#0284c7;font-size:14px}.dm-appliance-daily-row-value small{color:var(--text-dim,#64748b);font-size:10px;font-weight:800}.dm-appliance-daily-empty{padding:22px;text-align:center;color:var(--text-dim,#64748b);font-weight:700}.dm-appliance-daily-note{margin:0 20px 18px;padding-top:10px;border-top:1px solid var(--card-border,#e2e8f0);color:var(--text-dim,#64748b);font-size:10px;line-height:1.45}
      @media(max-width:520px){.dm-appliance-daily-overlay{align-items:flex-end;padding:10px}.dm-appliance-daily-dialog{max-height:82vh;border-radius:24px 24px 18px 18px}.dm-appliance-daily-head{padding:18px 16px 10px}.dm-appliance-daily-total{margin:0 16px 10px}.dm-appliance-daily-list{padding:0 16px 10px}.dm-appliance-daily-note{margin:0 16px 16px}.dm-appliance-daily-row{padding:12px}}
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
    if (change.section === "appliances" && appliancesVisible()) {
      state.dailyUpdatedAt = 0;
      state.dailyGeneration += 1;
      scheduleApplianceNormalization();
    }
  });
}

export function installAppliancesSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  subscribeStore();
  ensureDailyPopup();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (appliancesVisible() && stateChangeAffectsAppliances(event)) {
        state.dailyUpdatedAt = 0;
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
