import {
  PERIOD_SOURCES,
  isCumulativeEnergyEntity,
  resolveEntity,
} from "../core/period-service.js";
import {
  hasCompleteHomeFlow,
  reconcileEnergyPeriod,
} from "./energy-calculations-section.js";
import {
  allStates,
  clean,
  doc,
  formatNumber,
  installStyle,
  root,
  section,
  t,
} from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_ENERGY_ANALYSIS_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  loading: false,
  generation: 0,
  lastLoadedAt: 0,
  current: null,
  previous: null,
});

function startOfLocalDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

/** Monday-based local ranges used by the Energy Analysis comparison. */
export function weekRanges(now = new Date()) {
  const end = new Date(now);
  const today = startOfLocalDay(end);
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const currentStart = addDays(today, mondayOffset);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = new Date(currentStart);
  return Object.freeze({ currentStart, currentEnd: end, previousStart, previousEnd });
}

function energyModel() {
  const value = section("energy", {});
  return value && typeof value === "object" ? value : {};
}

function resolver(value) {
  return resolveEntity(value, root.resolveEntity || ((entry) => entry));
}

/**
 * Weekly history must come from cumulative Recorder-capable counters. Period
 * helpers (day/month/year) are only current-period overrides and cannot be
 * reused as a previous-week source.
 */
export function weeklySourcePlans(
  energy = {},
  states = {},
  resolve = (value) => value,
) {
  return PERIOD_SOURCES.flatMap((definition) => {
    const group = energy?.[definition.group] || {};
    const total = clean(group?.[definition.totalKey]);
    const periodCandidates = Object.values(definition.periodKeys || {})
      .map((key) => clean(group?.[key]))
      .filter(Boolean);
    const source =
      total ||
      periodCandidates.find((entity) =>
        isCumulativeEnergyEntity(entity, states, resolve),
      );
    if (!source) return [];
    const entity = resolveEntity(source, resolve);
    if (!entity) return [];
    return [{
      key: definition.key,
      group: definition.group,
      source,
      entity,
    }];
  });
}

function sumBucketChanges(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return null;
  let hasNumeric = false;
  const value = rows.reduce((total, row) => {
    const change = Number(row?.change);
    if (!Number.isFinite(change)) return total;
    hasNumeric = true;
    return total + Math.max(0, change);
  }, 0);
  return hasNumeric ? value : null;
}

export function weeklyHomeFromValues(values = new Map(), planKeys = new Set()) {
  const data = Object.fromEntries(
    PERIOD_SOURCES.map((definition) => [
      definition.key,
      Number.isFinite(Number(values.get(definition.key)))
        ? Math.max(0, Number(values.get(definition.key)))
        : 0,
    ]),
  );
  const canUseFlowBalance = hasCompleteHomeFlow(planKeys);
  const hasHouseFallback = planKeys.has("house");
  if (!canUseFlowBalance && !hasHouseFallback) return null;
  const reconciled = reconcileEnergyPeriod(data, planKeys);
  return Object.freeze({
    value: Math.max(0, Number(reconciled.house) || 0),
    source: canUseFlowBalance ? "home-assistant-flow-balance" : "house-total-fallback",
    data: reconciled,
  });
}

async function loadWeeklyHome(start, end) {
  const service = root.DashboardModernEnergyService;
  if (!service?.statisticsWithGrowth) throw new Error("Energy statistics service unavailable");
  const plans = weeklySourcePlans(
    energyModel(),
    allStates(),
    root.resolveEntity || ((value) => value),
  );
  if (!plans.length) return null;

  const ids = [...new Set(plans.map((plan) => plan.entity).filter(Boolean))];
  if (!ids.length) return null;
  const statistics = await service.statisticsWithGrowth(ids, start, end, "day");
  const values = new Map();
  const planKeys = new Set();
  for (const plan of plans) {
    const amount = sumBucketChanges(statistics?.[plan.entity]);
    if (amount == null) continue;
    values.set(plan.key, amount);
    planKeys.add(plan.key);
  }
  return weeklyHomeFromValues(values, planKeys);
}

function analysisVisible() {
  const pane = doc?.getElementById("ed-pane-analisi");
  if (!pane) return false;
  const hidden = pane.hidden || pane.style.display === "none";
  const report = doc?.getElementById("view-panoramica");
  return !hidden && (!report || report.classList.contains("active") || report.style.display !== "none");
}

function setText(id, value) {
  const node = doc?.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

function setBar(id, value, maximum) {
  const node = doc?.getElementById(id);
  if (!node) return;
  const percent = maximum > 0 ? Math.min(100, (Math.max(0, value) / maximum) * 100) : 0;
  node.style.width = `${percent}%`;
}

function ensureWeeklyHeader(card) {
  const title = card?.querySelector(".ed-weekly-title");
  if (!title) return;
  if (title.dataset.dmWeeklyTitle === "true") return;
  title.dataset.dmWeeklyTitle = "true";
  title.innerHTML = `<span>🔄 ${t("Confronto Settimanale", "Weekly comparison")}</span><small>🏠 ${t("Consumi Casa", "Home consumption")}</small>`;
  const labels = card.querySelectorAll(".ed-weekly-lbl");
  if (labels[0]) labels[0].textContent = t("Settimana scorsa", "Last week");
  if (labels[1]) labels[1].textContent = t("Questa settimana", "This week");
}

function renderWeeklyComparison(previous, current) {
  const card = doc?.querySelector("#ed-pane-analisi .ed-weekly-card");
  if (!card) return false;
  ensureWeeklyHeader(card);
  const prevValue = Number(previous?.value);
  const currValue = Number(current?.value);
  if (!Number.isFinite(prevValue) || !Number.isFinite(currValue)) return false;

  const maximum = Math.max(prevValue, currValue, 0.001);
  setText("ed-w-prev-val", `${formatNumber(prevValue, 1)} kWh`);
  setText("ed-w-curr-val", `${formatNumber(currValue, 1)} kWh`);
  setBar("ed-w-prev-bar", prevValue, maximum);
  setBar("ed-w-curr-bar", currValue, maximum);

  let delta = card.querySelector(".dm-weekly-delta");
  if (!delta) {
    delta = doc.createElement("div");
    delta.className = "dm-weekly-delta";
    card.append(delta);
  }
  if (prevValue > 0) {
    const percent = ((currValue - prevValue) / prevValue) * 100;
    const direction = percent > 0.05 ? "↑" : percent < -0.05 ? "↓" : "→";
    delta.dataset.direction = percent > 0.05 ? "up" : percent < -0.05 ? "down" : "same";
    delta.textContent = `${direction} ${formatNumber(Math.abs(percent), 1)}% ${t("rispetto alla settimana scorsa", "vs last week")}`;
  } else {
    delta.dataset.direction = "same";
    delta.textContent = t("Confronto disponibile dalla seconda settimana registrata", "Comparison is available from the second recorded week");
  }
  card.dataset.dmWeeklySource = current.source;
  card.dataset.dmWeeklyReady = "true";
  return true;
}

function renderUnavailable() {
  const card = doc?.querySelector("#ed-pane-analisi .ed-weekly-card");
  if (!card) return;
  ensureWeeklyHeader(card);
  setText("ed-w-prev-val", "— kWh");
  setText("ed-w-curr-val", "— kWh");
  setBar("ed-w-prev-bar", 0, 1);
  setBar("ed-w-curr-bar", 0, 1);
  card.dataset.dmWeeklyReady = "false";
}

export async function refreshWeeklyAnalysis({ force = false } = {}) {
  if (!doc || state.loading) return false;
  if (!force && !analysisVisible()) return false;
  if (!force && state.current && state.previous && Date.now() - state.lastLoadedAt < 60_000) {
    return renderWeeklyComparison(state.previous, state.current);
  }
  const generation = ++state.generation;
  state.loading = true;
  const card = doc.querySelector("#ed-pane-analisi .ed-weekly-card");
  if (card) card.dataset.dmWeeklyLoading = "true";
  try {
    const range = weekRanges();
    const [previous, current] = await Promise.all([
      loadWeeklyHome(range.previousStart, range.previousEnd),
      loadWeeklyHome(range.currentStart, range.currentEnd),
    ]);
    if (generation !== state.generation) return false;
    if (!previous || !current) {
      renderUnavailable();
      return false;
    }
    state.previous = previous;
    state.current = current;
    state.lastLoadedAt = Date.now();
    return renderWeeklyComparison(previous, current);
  } catch (error) {
    if (generation === state.generation) {
      root.console?.warn?.("[DashboardModern] weekly Energy analysis failed", error);
      renderUnavailable();
    }
    return false;
  } finally {
    state.loading = false;
    if (card) delete card.dataset.dmWeeklyLoading;
  }
}

function installStyles() {
  installStyle(
    "dm-energy-analysis-section-style",
    `
      #ed-pane-analisi .ed-weekly-card{display:grid!important;gap:14px!important}
      #ed-pane-analisi .ed-weekly-title{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;flex-wrap:wrap!important}
      #ed-pane-analisi .ed-weekly-title>span{font-weight:900!important}
      #ed-pane-analisi .ed-weekly-title>small{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:6px 10px!important;border-radius:999px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,transparent)!important;color:var(--info-color,#0369a1)!important;font-size:11px!important;font-weight:900!important;letter-spacing:.02em!important}
      #ed-pane-analisi .ed-weekly-row{display:grid!important;grid-template-columns:minmax(108px,140px) minmax(0,1fr) minmax(76px,96px)!important;align-items:center!important;gap:12px!important}
      #ed-pane-analisi .ed-weekly-lbl{font-size:12px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      #ed-pane-analisi .ed-weekly-val{text-align:right!important;font-weight:900!important;color:var(--text,#0f172a)!important}
      #ed-pane-analisi .ed-weekly-bar-bg{height:12px!important;border-radius:999px!important;overflow:hidden!important;background:var(--secondary-background-color,#eef2f7)!important}
      #ed-pane-analisi .ed-weekly-bar-fill{height:100%!important;border-radius:inherit!important;transition:width .25s ease!important}
      #ed-pane-analisi .dm-weekly-delta{justify-self:end!important;padding:6px 10px!important;border-radius:999px!important;background:color-mix(in srgb,var(--secondary-text-color,#64748b) 9%,transparent)!important;color:var(--secondary-text-color,#64748b)!important;font-size:11px!important;font-weight:800!important}
      #ed-pane-analisi .dm-weekly-delta[data-direction="up"]{background:color-mix(in srgb,var(--error-color,#ef4444) 10%,transparent)!important;color:var(--error-color,#dc2626)!important}
      #ed-pane-analisi .dm-weekly-delta[data-direction="down"]{background:color-mix(in srgb,var(--success-color,#10b981) 10%,transparent)!important;color:var(--success-color,#047857)!important}
      @media(max-width:620px){
        #ed-pane-analisi .ed-weekly-row{grid-template-columns:1fr auto!important;gap:7px 10px!important}
        #ed-pane-analisi .ed-weekly-bar-bg{grid-column:1/-1!important;grid-row:2!important}
        #ed-pane-analisi .ed-weekly-val{grid-column:2!important;grid-row:1!important}
        #ed-pane-analisi .dm-weekly-delta{justify-self:stretch!important;text-align:center!important}
      }
    `,
  );
}

function bindEvents() {
  if (state.installed) return;
  state.installed = true;
  root.addEventListener?.("dashboardmodern:period-bundle", () => {
    if (analysisVisible()) refreshWeeklyAnalysis();
  });
  root.addEventListener?.("pageshow", () => {
    if (analysisVisible()) refreshWeeklyAnalysis();
  });
  doc?.addEventListener(
    "click",
    (event) => {
      if (!event.target?.closest?.("#ed-tab-ana")) return;
      root.setTimeout?.(() => refreshWeeklyAnalysis({ force: true }), 0);
    },
    true,
  );
}

export function installEnergyAnalysisSection() {
  if (!doc) return;
  installStyles();
  bindEvents();
  if (analysisVisible()) refreshWeeklyAnalysis();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyAnalysisSection, { once: true });
else installEnergyAnalysisSection();
