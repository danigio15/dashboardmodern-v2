import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import {
  APPLIANCE_CATALOG,
  applianceCatalogLabel,
  canonicalApplianceVisualKey,
} from "../core/device-model.js";
import { isCumulativeEnergyEntity, resolveEntity } from "../core/period-service.js";
import { runtimeMetrics } from "../core/runtime-metrics.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";
const KEY = "__DASHBOARDMODERN_APPLIANCES_SECTION__";
const DAILY_REFRESH_MS = 5000;
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
  const directCandidates = [
    device.daily_energy_entity,
    device.energy_today,
    device.daily_energy,
  ]
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
        ? english() ? "Daily sensor" : "Sensore giornaliero"
        : english() ? "Total meter → Recorder" : "Contatore totale → Recorder";
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
    english() ? "Open today's appliance energy breakdown" : "Apri dettaglio energia elettrodomestici di oggi",
  );
  card.title = english() ? "Show devices and energy sources" : "Mostra dispositivi ed entità che hanno consumato";
  const value = card.querySelector(".g-val");
  if (value) value.textContent = formatDaily(breakdown.total);
  if (!card.dataset.dmDailyMounted) {
    card.dataset.dmDailyMounted = "true";
    card.addEventListener("click", () => refreshApplianceDailyKpi({ force: true, openPopup: true }));
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
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{
        min-width:88px!important;border:0!important;color:#fff!important;cursor:pointer!important;
        background:var(--success-color,#059669)!important
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
// --- ex appliance-editor-section.js ---

const APPLIANCE_EDITOR_KEY = "__DASHBOARDMODERN_APPLIANCE_EDITOR_SECTION__";
const applianceEditorState = (root[APPLIANCE_EDITOR_KEY] ||= { installed: false, previousEdit: null, previousPicker: null });

function locale() {
  return doc?.documentElement?.lang === "en" ? "en" : "it";
}

function appliances() {
  const stored = dashboardStore()?.getSection?.("appliances");
  return Array.isArray(stored) ? stored.slice() : readJson("cd_appliances", []);
}

function roomOptions(selected) {
  const rooms = section("rooms", readJson("cd_stanze", []));
  return [
    `<option value="">— ${t("Nessuna stanza", "No room")} —</option>`,
    ...rooms.map((room) => {
      const value = clean(room.id || room.name);
      const active = [room.id, room.name].map(clean).includes(clean(selected));
      return `<option value="${esc(value)}" ${active ? "selected" : ""}>${esc(room.icon || "🏠")} ${esc(room.name || value)}</option>`;
    }),
  ].join("");
}

function editorVisualKey(value) {
  return canonicalApplianceVisualKey(value) || "";
}

function deviceVisualKey(device = {}) {
  const explicit = [device.visual_key, device.device_type, device.icon, device.type]
    .map(editorVisualKey)
    .filter(Boolean);
  const specific = explicit.find((key) => key !== "generico");
  if (specific) return specific;
  // 0.15.19/0.15.20 could save the first select option (`generico`) when an
  // appliance type was absent from the short Edit-only list. Recover those
  // records from their human name without touching their entity links.
  const named = editorVisualKey(device.name);
  return named || explicit[0] || "generico";
}

function catalogItem(value) {
  const key = editorVisualKey(value) || "generico";
  return APPLIANCE_CATALOG.find((item) => item.key === key) || APPLIANCE_CATALOG.at(-1);
}

function typeIconMarkup(value, size = 42) {
  const key = editorVisualKey(value) || "generico";
  const legacy = root.cdApplianceIcon?.(key, size);
  if (legacy) return legacy;
  const artwork = applianceArtwork(key, size);
  if (artwork) return artwork;
  return `<span class="dm-appliance-editor-fallback">🔌</span>`;
}

function typeLabel(value) {
  return applianceCatalogLabel(value, locale());
}

function openTypePicker({ selected = "generico", onSelect } = {}) {
  doc?.getElementById("dm-applpick")?.remove();
  const selectedKey = editorVisualKey(selected) || "generico";
  const overlay = doc.createElement("div");
  overlay.id = "dm-applpick";
  overlay.className = "dm-appliance-type-picker";
  overlay.innerHTML = `<section class="dm-appliance-type-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-type-picker-title">
    <strong id="dm-appliance-type-picker-title">${t("Scegli l'elettrodomestico", "Choose appliance")}</strong>
    <div class="dm-appliance-type-grid" role="listbox"></div>
    <button type="button" class="dm-appliance-type-close">${t("Chiudi", "Close")}</button>
  </section>`;
  const grid = overlay.querySelector(".dm-appliance-type-grid");
  APPLIANCE_CATALOG.forEach((item) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-appliance-type-option";
    button.dataset.applianceType = item.key;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(item.key === selectedKey));
    button.innerHTML = `<span class="dm-appliance-type-option-icon">${typeIconMarkup(item.key, 30)}</span><span>${esc(item[locale()] || item.it)}</span>`;
    button.addEventListener("click", () => {
      overlay.remove();
      onSelect?.(item.key);
    });
    grid.append(button);
  });
  overlay.querySelector(".dm-appliance-type-close")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  doc.body.append(overlay);
  return overlay;
}

function installPickerOverride() {
  const current = root.dmAppliancePicker;
  if (typeof current !== "function" || current.__dmCanonicalAppliancePicker) return false;
  applianceEditorState.previousPicker ||= current;
  function canonicalAppliancePicker() {
    const hidden = doc.getElementById("appl-icon");
    const button = doc.getElementById("appl-icon-btn");
    const name = doc.getElementById("appl-name");
    openTypePicker({
      selected: hidden?.value || "generico",
      onSelect(key) {
        if (hidden) hidden.value = key;
        if (button) {
          button.innerHTML = typeIconMarkup(key, 30);
          button.dataset.applianceType = key;
          button.setAttribute("aria-label", typeLabel(key));
        }
        if (name && !clean(name.value)) name.value = typeLabel(key);
      },
    });
  }
  canonicalAppliancePicker.__dmCanonicalAppliancePicker = true;
  canonicalAppliancePicker.__dmPrevious = current;
  root.dmAppliancePicker = canonicalAppliancePicker;
  return true;
}

function entityCandidates(device = {}) {
  return [...new Set([
    device.control_entity,
    device.switch_entity,
    device.switch,
    device.light,
    device.fan,
    device.power_entity,
    device.power,
    device.power_sensor,
    ...(device.entities || []).map((entry) =>
      clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id),
    ),
  ].map(clean).filter(Boolean))];
}

function inferredControlEntity(device) {
  return entityCandidates(device).find((entity) => /^(switch|light|input_boolean|fan)\./i.test(entity)) || "";
}

function inferredPowerEntity(device) {
  const candidates = entityCandidates(device);
  const states = allStates();
  return candidates.find((entity) => {
    const current = states[entity];
    const unit = clean(current?.attributes?.unit_of_measurement).toLowerCase();
    return ["w", "kw", "mw"].includes(unit);
  }) || "";
}

function cumulativeEntity(value) {
  const entity = clean(value);
  if (!entity) return false;
  const current = allStates()[entity];
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  if (current && stateClass) return false;
  return /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(entity);
}

function entityField(name, label, value, help = "") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label}</span><span class="ed-form-row"><input class="ed-input mono" name="${name}" value="${esc(value)}"><button type="button" class="dm-entity-picker" data-pick="${name}" aria-label="${t("Seleziona entità", "Select entity")}">🔍</button></span>${help ? `<small>${help}</small>` : ""}</label>`;
}

function normalizeEntities(device, values) {
  return [...new Set([
    values.control_entity,
    values.power_entity,
    values.energy_entity,
    values.daily_energy_entity,
    values.monthly_energy_entity,
    values.total_energy_entity,
    values.history_entity,
    values.report_entity,
    ...(device.entities || []).map((entry) => clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id)),
  ].filter(Boolean))];
}

async function saveAppliance(index, next) {
  const list = appliances();
  list[index] = next;
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("appliances", list);
  else {
    writeJsonIfChanged("cd_appliances", list);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  root.renderAppliances?.();
  root.renderApplianceSection?.(true);
  root.cdRebuildReportDevices?.();
  root.buildReportSelect?.();
}

function updateEditType(modal, key) {
  const canonical = editorVisualKey(key) || "generico";
  const hidden = modal.querySelector('input[name="icon"]');
  const preview = modal.querySelector("[data-icon-preview]");
  const trigger = modal.querySelector("[data-type-trigger]");
  if (hidden) hidden.value = canonical;
  if (preview) {
    preview.innerHTML = typeIconMarkup(canonical, 58);
    preview.dataset.dmPreviewSource = "canonical-picker";
    preview.setAttribute("aria-label", typeLabel(canonical));
  }
  if (trigger) {
    trigger.dataset.applianceType = canonical;
    trigger.innerHTML = `<span class="dm-appliance-type-trigger-icon">${typeIconMarkup(canonical, 30)}</span><span class="dm-appliance-type-trigger-label">${esc(typeLabel(canonical))}</span><span class="dm-appliance-type-chevron" aria-hidden="true">⌄</span>`;
    trigger.setAttribute("aria-label", `${t("Tipo / immagine", "Type / artwork")}: ${typeLabel(canonical)}`);
  }
}

export function openApplianceEditor(index) {
  const device = appliances()[index];
  if (!device) return false;
  doc?.getElementById("dm-appliance-editor-modal")?.remove();
  const visual = deviceVisualKey(device);
  const totalInitial = [device.total_energy_entity, device.history_entity, device.report_entity]
    .map(clean)
    .find(cumulativeEntity) || "";
  const controlInitial = clean(device.control_entity || device.switch_entity) || inferredControlEntity(device);
  const powerInitial = clean(device.power_entity || device.power || device.power_sensor) || inferredPowerEntity(device);
  const modal = doc.createElement("div");
  modal.id = "dm-appliance-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-appliance-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-editor-title">
    <header><strong id="dm-appliance-editor-title">🔌 ${t("Modifica elettrodomestico", "Edit appliance")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <div class="dm-modal-grid dm-appliance-main-fields">
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(device.name)}" required></label>
        <label class="ed-slot dm-appliance-icon-field"><span class="ed-slot-lbl">${t("Tipo / immagine", "Type / artwork")}</span><input type="hidden" name="icon" value="${esc(visual)}"><span class="dm-appliance-icon-row"><span class="dm-appliance-icon-preview" data-icon-preview data-dm-preview-source="canonical-picker" aria-hidden="false"></span><button type="button" class="ed-input dm-appliance-type-trigger" data-type-trigger aria-haspopup="listbox"></button></span><small>${t("Usa lo stesso catalogo e la stessa icona azzurra della prima configurazione.", "Uses the same catalog and blue icon as the first configuration.")}</small></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room_id">${roomOptions(device.room_id || device.room)}</select></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Soglia in funzione", "Running threshold")}</span><input class="ed-input" type="number" step="0.1" min="0" name="threshold_run" value="${esc(device.threshold_run ?? device.metadata?.threshold_run ?? 5)}"><small>${t("Potenza in watt oltre la quale la card risulta accesa.", "Power in watts above which the card is shown as running.")}</small></label>
      </div>
      <section class="dm-appliance-entity-grid">
        ${entityField("control_entity", t("Entità comando", "Control entity"), controlInitial, t("Switch, light, fan o input_boolean usato dal pulsante Accendi/Spegni.", "Switch, light, fan or input_boolean used by the On/Off button."))}
        ${entityField("power_entity", t("Potenza istantanea", "Instant power"), powerInitial, t("Sensore W o kW mostrato nella card.", "W or kW sensor shown on the card."))}
        ${entityField("daily_energy_entity", t("Energia giornaliera", "Daily energy"), device.daily_energy_entity, t("Facoltativa: sostituisce il calcolo del giorno.", "Optional: overrides the daily calculation."))}
        ${entityField("monthly_energy_entity", t("Energia mensile", "Monthly energy"), device.monthly_energy_entity, t("Facoltativa: sostituisce il calcolo del mese corrente.", "Optional: overrides the current-month calculation."))}
        ${entityField("total_energy_entity", t("Energia totale per storico e Report", "Total energy for history and Report"), totalInitial, t("Deve essere un contatore cumulativo kWh con state_class total o total_increasing. Non usare qui il sensore mensile: questo campo serve per ricostruire anche i mesi precedenti.", "This must be a cumulative kWh meter with state_class total or total_increasing. Do not use the monthly sensor here: this field is required to reconstruct previous months."))}
      </section>
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const close = () => modal.remove();
  updateEditType(modal, visual);
  modal.querySelector("[data-type-trigger]")?.addEventListener("click", () => {
    openTypePicker({
      selected: form.elements.icon.value,
      onSelect: (key) => updateEditType(modal, key),
    });
  });
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelectorAll("[data-pick]").forEach((button) => button.addEventListener("click", () => root.wzPickEntity?.(form.elements[button.dataset.pick])));
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const name = clean(values.name);
    const total = clean(values.total_energy_entity);
    const totalState = allStates()[total];
    const stateClass = clean(totalState?.attributes?.state_class).toLowerCase();
    if (!name) { form.querySelector("[data-error]").textContent = t("Inserisci il nome.", "Enter a name."); return; }
    if (total && totalState && !["total", "total_increasing"].includes(stateClass)) {
      form.querySelector("[data-error]").textContent = t("Il sensore Energia totale deve avere state_class total o total_increasing.", "The Total energy sensor must have state_class total or total_increasing.");
      return;
    }
    const visualKey = editorVisualKey(values.icon) || deviceVisualKey(device);
    const existingReport = clean(device.report_entity);
    const next = {
      ...device,
      name,
      icon: visualKey,
      visual_key: visualKey,
      device_type: visualKey,
      visual_type: "asset",
      room_id: clean(values.room_id),
      threshold_run: Number.isFinite(Number(values.threshold_run)) ? Number(values.threshold_run) : 5,
      control_entity: clean(values.control_entity),
      power_entity: clean(values.power_entity),
      daily_energy_entity: clean(values.daily_energy_entity),
      monthly_energy_entity: clean(values.monthly_energy_entity),
      total_energy_entity: total,
      history_entity: total,
      // Report can intentionally use a monthly/current-period sensor. Editing
      // the lifetime meter must not overwrite that independent Report choice.
      report_entity: existingReport || total,
    };
    next.energy_entity = clean(device.energy_entity) || next.total_energy_entity || next.monthly_energy_entity || next.daily_energy_entity;
    next.entities = normalizeEntities(device, next);
    try {
      await saveAppliance(index, next);
      close();
      root.editorSwitch?.("appliances");
    } catch (error) {
      form.querySelector("[data-error]").textContent = error?.message || String(error);
    }
  });
  return true;
}

function installApplianceEditorStyles() {
  if (doc.getElementById("dm-appliance-editor-preview-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-appliance-editor-preview-style";
  style.textContent = `
    .dm-appliance-icon-row{display:grid!important;grid-template-columns:84px minmax(0,1fr)!important;gap:12px!important;align-items:center!important}
    .dm-appliance-icon-preview{display:grid!important;place-items:center!important;width:84px!important;height:84px!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important;border:1px solid var(--divider-color,#dbe4ee)!important;overflow:hidden!important;color:#0ea5e9!important}
    .dm-appliance-icon-preview svg{display:block!important;width:58px!important;height:58px!important;max-width:58px!important;max-height:58px!important}
    .dm-appliance-editor-fallback{font-size:36px!important;line-height:1!important}
    .dm-appliance-type-trigger{display:grid!important;grid-template-columns:38px minmax(0,1fr) 22px!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:58px!important;padding:8px 12px!important;text-align:left!important;cursor:pointer!important;color:var(--primary-text-color,#0f172a)!important;background:var(--card-background-color,#fff)!important}
    .dm-appliance-type-trigger-icon{display:grid!important;place-items:center!important;width:36px!important;height:36px!important;color:#0ea5e9!important}.dm-appliance-type-trigger-icon svg{width:30px!important;height:30px!important}.dm-appliance-type-trigger-label{min-width:0!important;font-weight:750!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-appliance-type-chevron{font-size:20px!important;justify-self:end!important}
    .dm-appliance-editor-dialog{max-height:min(92dvh,920px)!important;overflow:hidden!important}
    .dm-appliance-type-picker{position:fixed!important;inset:0!important;z-index:100002!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:16px!important;background:rgba(15,23,42,.60)!important}
    .dm-appliance-type-picker-dialog{display:flex!important;flex-direction:column!important;box-sizing:border-box!important;width:min(460px,100%)!important;max-height:80dvh!important;padding:18px!important;border-radius:22px!important;background:var(--card-background-color,#fff)!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 20px 60px rgba(0,0,0,.35)!important}
    .dm-appliance-type-picker-dialog>strong{margin-bottom:10px!important;font-size:14.5px!important;font-weight:900!important}.dm-appliance-type-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(88px,1fr))!important;gap:8px!important;overflow-y:auto!important;min-height:0!important}
    .dm-appliance-type-option{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;min-height:92px!important;padding:10px 4px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:14px!important;background:color-mix(in srgb,var(--secondary-background-color,#f1f5f9) 70%,transparent)!important;color:inherit!important;cursor:pointer!important}.dm-appliance-type-option[aria-selected="true"]{border-color:#0ea5e9!important;box-shadow:0 0 0 2px color-mix(in srgb,#0ea5e9 18%,transparent)!important}.dm-appliance-type-option-icon{display:grid!important;place-items:center!important;height:34px!important;color:#0ea5e9!important}.dm-appliance-type-option-icon svg{width:30px!important;height:30px!important}.dm-appliance-type-option>span:last-child{font-size:10px!important;font-weight:800!important;line-height:1.15!important;text-align:center!important}
    .dm-appliance-type-close{margin-top:10px!important;min-height:44px!important;padding:11px!important;border:0!important;border-radius:12px!important;background:#94a3b8!important;color:#fff!important;font-weight:800!important;cursor:pointer!important}
    @media(max-width:520px){.dm-appliance-icon-row{grid-template-columns:84px minmax(0,1fr)!important}.dm-appliance-type-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.dm-appliance-type-option{min-width:0!important;min-height:92px!important}}
  `;
  doc.head.append(style);
}

function installOverride() {
  if (typeof root.edApplEdit !== "function" || root.edApplEdit.__dmModalEditor) return false;
  applianceEditorState.previousEdit ||= root.edApplEdit;
  function modalApplianceEditor(index) { return openApplianceEditor(Number(index)); }
  modalApplianceEditor.__dmModalEditor = true;
  modalApplianceEditor.__dmPrevious = applianceEditorState.previousEdit;
  root.edApplEdit = modalApplianceEditor;
  return true;
}

function installRuntimeOverrides() {
  installOverride();
  installPickerOverride();
}

export function installApplianceEditorSection() {
  if (!doc) return;
  installApplianceEditorStyles();
  installRuntimeOverrides();
  if (!applianceEditorState.installed) {
    applianceEditorState.installed = true;
    root.addEventListener?.("dashboardmodern:legacy-ready", installRuntimeOverrides);
    root.addEventListener?.("dashboardmodern:runtime-ready", installRuntimeOverrides);
    root.addEventListener?.("pageshow", installRuntimeOverrides);
  }
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installApplianceEditorSection, { once: true });
else installApplianceEditorSection();
// --- ex appliance-layout-section.js ---

const APPLIANCE_LAYOUT_KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const applianceLayoutState = (globalThis[APPLIANCE_LAYOUT_KEY] ||= { installed: false, listeners: false });

function layoutConfiguredEntity(value) {
  return clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
}

function applianceEntities(device = {}) {
  return new Set(
    [
      device.daily_energy_entity,
      device.energy_today,
      device.daily_energy,
      device.total_energy_entity,
      device.history_entity,
      device.report_entity,
      device.energy_entity,
      device.energy,
      ...(device.entities || []),
    ]
      .map(layoutConfiguredEntity)
      .filter(Boolean),
  );
}

function popupDeviceForRow(row, appliances) {
  const entity = clean(row?.dataset?.dmDailyEntity);
  if (entity) {
    const direct = appliances.find((device) => applianceEntities(device).has(entity));
    if (direct) return direct;
  }
  const name = clean(row?.querySelector?.(".dm-appliance-daily-row-main strong")?.textContent).toLowerCase();
  if (!name) return null;
  return appliances.find((device) => clean(device?.name).toLowerCase() === name) || null;
}

function cardArtworkForDevice(device) {
  const id = clean(device?.id);
  const cards = [
    ...(doc?.querySelectorAll?.(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    ) || []),
  ];
  let card = id ? cards.find((candidate) => clean(candidate.dataset.applianceId) === id) : null;
  if (!card) {
    const name = clean(device?.name).toLowerCase();
    card = cards.find(
      (candidate) => clean(candidate.querySelector(".appl-wide-name")?.textContent).toLowerCase() === name,
    );
  }
  return card?.querySelector?.(".appl-visual .appl-ic") || null;
}

function syncDailyPopupArtwork() {
  const list = doc?.querySelector?.("#dm-appliance-daily-popup [data-dm-daily-popup-list]");
  if (!list) return false;
  const appliances = section("appliances", []);
  if (!Array.isArray(appliances) || !appliances.length) return false;

  list.querySelectorAll(".dm-appliance-daily-row").forEach((row) => {
    const device = popupDeviceForRow(row, appliances);
    if (!device) return;
    const source = cardArtworkForDevice(device);
    if (!source) return;

    let visual = row.querySelector(":scope > .dm-appliance-daily-visual");
    if (!visual) {
      visual = doc.createElement("span");
      visual.className = "dm-appliance-daily-visual";
      row.prepend(visual);
    }
    const deviceId = clean(device.id);
    if (visual.dataset.applianceId === deviceId && visual.firstElementChild) return;
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    visual.replaceChildren(clone);
    visual.dataset.applianceId = deviceId;
  });
  return true;
}

function syncAfterDailyPopupRefresh() {
  syncDailyPopupArtwork();
  const pending = root.__DASHBOARDMODERN_APPLIANCES_SECTION__?.dailyPromise;
  if (pending?.then) pending.then(() => syncDailyPopupArtwork()).catch(() => {});
}

function installPopupArtworkBridge() {
  if (!doc || applianceLayoutState.listeners) return;
  applianceLayoutState.listeners = true;
  doc.addEventListener("click", (event) => {
    if (!event.target?.closest?.('#appl-kpi-grid [data-dm-appliance-daily-total="true"]')) return;
    root.queueMicrotask?.(syncAfterDailyPopupRefresh);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target?.closest?.('#appl-kpi-grid [data-dm-appliance-daily-total="true"]')) return;
    root.queueMicrotask?.(syncAfterDailyPopupRefresh);
  });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    const popup = doc.getElementById("dm-appliance-daily-popup");
    if (!popup || popup.hidden) return;
    root.requestAnimationFrame?.(syncAfterDailyPopupRefresh);
  });
}

function installApplianceLayoutStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),370px))!important;justify-content:start!important;align-items:stretch!important;gap:14px!important}
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{display:grid!important;box-sizing:border-box!important;width:100%!important;max-width:370px!important;min-width:0!important;min-height:132px!important;height:auto!important;padding:0!important;gap:0!important;border:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 16%,var(--divider-color,#e2e8f0))!important;border-radius:22px!important;overflow:hidden!important;grid-template-columns:96px minmax(0,1fr)!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 10px 24px color-mix(in srgb,#0f172a 10%,transparent)!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,html[data-theme="dark"] #appl-grid-overview .appl-wide-card,body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{background:#172033!important;color:#f8fafc!important;border-color:#2b3a58!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{display:grid!important;place-items:center!important;box-sizing:border-box!important;min-width:96px!important;height:100%!important;min-height:132px!important;padding:7px!important;border-right:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 11%,var(--divider-color,#e2e8f0))!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 6%,var(--ha-card-background,#fff))!important}
      html[data-theme="dark"] #page-appliances-main .appl-visual,html[data-theme="dark"] #appl-grid-overview .appl-visual,body.dark #page-appliances-main .appl-visual,body.dark #appl-grid-overview .appl-visual{background:#202c43!important;border-color:#2b3a58!important}
      #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:84px!important;height:84px!important;min-width:84px!important;min-height:84px!important;margin:0!important;padding:0!important;border:0!important;border-radius:18px!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 7%,transparent)!important;box-shadow:none!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;overflow:hidden!important;border-radius:14px!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;object-fit:cover!important;object-position:center!important}
      #page-appliances-main .appl-wide-card .appl-ic svg,#appl-grid-overview .appl-wide-card .appl-ic svg,#page-appliances-main .appl-wide-card .appl-ic ha-icon,#appl-grid-overview .appl-wide-card .appl-ic ha-icon{display:block!important;width:68px!important;height:68px!important;max-width:100%!important;max-height:100%!important;--mdc-icon-size:68px}

      /* The legacy card body is .appl-info (not .appl-wide-body). Target the
         real DOM owner so padding and vertical rhythm cannot be bypassed. */
      #page-appliances-main .appl-wide-card>.appl-info,#appl-grid-overview .appl-wide-card>.appl-info{display:grid!important;box-sizing:border-box!important;grid-template-rows:auto auto minmax(0,1fr) auto!important;align-content:stretch!important;gap:5px!important;min-width:0!important;min-height:132px!important;height:auto!important;margin:0!important;padding:12px 12px 10px!important;overflow:hidden!important;color:inherit!important}
      #page-appliances-main .appl-heading,#appl-grid-overview .appl-heading{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important;min-width:0!important;margin:0!important;padding:0!important}
      #page-appliances-main .appl-heading>div,#appl-grid-overview .appl-heading>div{min-width:0!important;flex:1 1 auto!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:inherit!important;font-size:15px!important;font-weight:900!important;line-height:1.18!important}
      #page-appliances-main .appl-wide-cat,#appl-grid-overview .appl-wide-cat{min-width:0!important;margin:3px 0 0!important;color:var(--secondary-text-color,#64748b)!important;font-size:10px!important;font-weight:800!important;line-height:1.2!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #page-appliances-main .appl-st,#appl-grid-overview .appl-st{display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;width:max-content!important;max-width:92px!important;min-height:20px!important;margin:0!important;padding:3px 6px!important;border-radius:7px!important;font-size:9px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #page-appliances-main .appl-live,#appl-grid-overview .appl-live{display:flex!important;align-items:center!important;flex-wrap:wrap!important;column-gap:9px!important;row-gap:2px!important;min-width:0!important;margin:0!important;padding:0!important}
      #page-appliances-main .appl-primary,#appl-grid-overview .appl-primary{display:flex!important;align-items:baseline!important;gap:3px!important;min-width:0!important;margin:0!important;font-size:12.5px!important;line-height:1.2!important}
      #page-appliances-main .appl-primary strong,#appl-grid-overview .appl-primary strong{font-weight:900!important}
      #page-appliances-main .appl-mini,#appl-grid-overview .appl-mini{display:inline-flex!important;align-items:center!important;gap:3px!important;min-width:0!important;margin:0!important;color:var(--secondary-text-color,#64748b)!important;font-size:10.5px!important;font-weight:750!important;line-height:1.2!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-cat,html[data-theme="dark"] #appl-grid-overview .appl-wide-cat,html[data-theme="dark"] #page-appliances-main .appl-mini,html[data-theme="dark"] #appl-grid-overview .appl-mini,body.dark #page-appliances-main .appl-wide-cat,body.dark #appl-grid-overview .appl-wide-cat,body.dark #page-appliances-main .appl-mini,body.dark #appl-grid-overview .appl-mini{color:#cbd5e1!important}
      #page-appliances-main .appl-spark,#appl-grid-overview .appl-spark{min-height:8px!important;margin:0!important;align-self:end!important;opacity:.55!important}
      #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{display:grid!important;grid-template-columns:minmax(82px,.78fr) minmax(94px,1fr)!important;align-self:end!important;align-items:stretch!important;gap:6px!important;min-width:0!important;margin:2px 0 0!important;padding:0!important}
      #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-width:0!important;min-height:32px!important;height:32px!important;margin:0!important;padding:5px 8px!important;border-radius:9px!important;opacity:1!important;visibility:visible!important;font-size:10px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #page-appliances-main .appl-actions .appl-action-btn,#appl-grid-overview .appl-actions .appl-action-btn{background:color-mix(in srgb,var(--primary-color,#0284c7) 12%,transparent)!important;color:var(--primary-color,#0369a1)!important;border:0!important}
      #page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{width:100%!important;background:var(--success-color,#059669)!important;color:#fff!important;border:0!important}
      #page-appliances-main .appl-actions button[hidden],#appl-grid-overview .appl-actions button[hidden],#page-appliances-main [data-dm-power-toggle="true"][hidden],#appl-grid-overview [data-dm-power-toggle="true"][hidden]{display:none!important;visibility:hidden!important}

      /* The daily popup reuses the exact rendered artwork of each appliance
         card. This higher-specificity rule replaces the generic lightning
         pseudo-element installed by the dashboard-style popup layer. */
      html #dm-appliance-daily-popup .dm-appliance-daily-row::before{content:none!important;display:none!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual{position:absolute!important;left:18px!important;top:50%!important;width:54px!important;height:54px!important;transform:translateY(-50%)!important;display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:18px!important;background:linear-gradient(145deg,#e0f2fe,#f0f9ff)!important;box-shadow:inset 0 0 0 1px rgba(14,165,233,.12),0 8px 22px rgba(14,165,233,.09)!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual>.appl-ic{display:grid!important;place-items:center!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;margin:0!important;padding:0!important;border:0!important;border-radius:17px!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-image-wrap,#dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:15px!important;object-fit:cover!important;object-position:center!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual svg,#dm-appliance-daily-popup .dm-appliance-daily-visual ha-icon{display:block!important;width:50px!important;height:50px!important;max-width:50px!important;max-height:50px!important;--mdc-icon-size:50px}

      @media(max-width:520px){
        #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:minmax(0,370px)!important;justify-content:center!important;gap:12px!important;padding-inline:10px!important}
        #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{grid-template-columns:92px minmax(0,1fr)!important;width:100%!important;max-width:370px!important;min-height:126px!important;border-radius:18px!important}
        #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:92px!important;min-height:126px!important;padding:5px!important}
        #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{width:84px!important;height:84px!important;min-width:84px!important;min-height:84px!important;padding:0!important;border-radius:17px!important}
        #page-appliances-main .appl-wide-card>.appl-info,#appl-grid-overview .appl-wide-card>.appl-info{min-height:126px!important;padding:11px 10px 9px!important;gap:4px!important}
        #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{font-size:14.5px!important}
        #page-appliances-main .appl-st,#appl-grid-overview .appl-st{max-width:80px!important;font-size:8.5px!important;padding-inline:5px!important}
        #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{grid-template-columns:minmax(78px,.72fr) minmax(92px,1fr)!important;gap:5px!important}
        #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{min-height:31px!important;height:31px!important;padding:5px 6px!important;font-size:9.5px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual{left:14px!important;width:50px!important;height:50px!important;border-radius:17px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual>.appl-ic{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual svg,#dm-appliance-daily-popup .dm-appliance-daily-visual ha-icon{width:46px!important;height:46px!important;max-width:46px!important;max-height:46px!important;--mdc-icon-size:46px}
      }
    `,
  );
}

export function installApplianceLayoutSection() {
  if (!doc || applianceLayoutState.installed) return;
  applianceLayoutState.installed = true;
  installApplianceLayoutStyles();
  installPopupArtworkBridge();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installApplianceLayoutSection, { once: true });
else installApplianceLayoutSection();