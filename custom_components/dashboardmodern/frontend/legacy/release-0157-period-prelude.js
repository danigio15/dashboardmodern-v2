/* DashboardModern 0.14.17: first listener owns Report month changes before legacy locks. */
const PRELUDE_KEY_0157 = "__DASHBOARDMODERN_RELEASE_0157_PERIOD_PRELUDE__";
const FINAL_RUNTIME_KEY_0157 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const KPI_IDS_PRELUDE_0157 = ["ed-kpi-prod", "ed-kpi-cons", "ed-kpi-auto"];
const MIN_SNAPSHOT_MS_0157 = 650;
const FINAL_GUARD_MS_0157 = 650;

function preludeState0157() {
  const state = (globalThis[PRELUDE_KEY_0157] ||= {});
  state.installed = true;
  state.generation ||= 0;
  state.timer ||= 0;
  state.finishTimer ||= 0;
  state.observer ||= null;
  state.snapshots ||= new Map();
  state.expected ||= new Map();
  state.token ||= "";
  state.startedAt ||= 0;
  state.committed ||= false;
  state.writing ||= false;
  return state;
}

const clock0157 = () => globalThis.performance?.now?.() ?? Date.now();
const clean0157 = (value) => String(value || "").trim();

function selectedPeriodPrelude0157() {
  const now = new Date();
  const month = Number(document.getElementById("ed-sel-month")?.value);
  const year = Number(document.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function reportPagePrelude0157() {
  return document.getElementById("view-panoramica") ||
    document.getElementById("page-energy") ||
    document.getElementById("page-energia") ||
    document.getElementById("ed-kpi-prod")?.closest?.(".flow-view,.page") ||
    null;
}

function ensureStatusPrelude0157() {
  const page = reportPagePrelude0157();
  if (!page) return null;
  let status = page.querySelector("[data-dm-period-loading-0157]");
  if (!status) {
    status = document.createElement("div");
    status.className = "dm-period-loading-0157";
    status.setAttribute("data-dm-period-loading-0157", "");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const english = document.documentElement.lang === "en";
    status.innerHTML = `<span aria-hidden="true"></span><strong>${english ? "Updating month…" : "Aggiornamento mese…"}</strong>`;
    page.prepend(status);
  }
  return status;
}

function capturePrelude0157() {
  const state = preludeState0157();
  state.snapshots.clear();
  KPI_IDS_PRELUDE_0157.forEach((id) => {
    const node = document.getElementById(id);
    if (node) state.snapshots.set(id, node.innerHTML);
  });
}

function protectedValuesPrelude0157() {
  const state = preludeState0157();
  return state.committed && state.expected.size ? state.expected : state.snapshots;
}

function restorePrelude0157() {
  const state = preludeState0157();
  if (state.writing || !state.token) return;
  const values = protectedValuesPrelude0157();
  if (!values.size) return;
  state.writing = true;
  try {
    values.forEach((html, id) => {
      const node = document.getElementById(id);
      if (node && node.innerHTML !== html) node.innerHTML = html;
    });
  } finally {
    state.writing = false;
  }
}

function observePrelude0157() {
  const state = preludeState0157();
  state.observer?.disconnect?.();
  if (typeof MutationObserver !== "function") return;
  state.observer = new MutationObserver(() => {
    if (!state.writing) queueMicrotask(restorePrelude0157);
  });
  KPI_IDS_PRELUDE_0157.forEach((id) => {
    const node = document.getElementById(id);
    if (node) state.observer.observe(node, { childList: true, subtree: true, characterData: true });
  });
}

function beginPrelude0157(period) {
  const state = preludeState0157();
  clearTimeout(state.finishTimer);
  if (!state.token) capturePrelude0157();
  state.token = `${period.year}-${period.month}`;
  state.startedAt = clock0157();
  state.committed = false;
  state.expected.clear();
  const page = reportPagePrelude0157();
  page?.classList.add("dm-period-loading-active-0157");
  page?.setAttribute("aria-busy", "true");
  const status = ensureStatusPrelude0157();
  if (status) status.hidden = false;
  observePrelude0157();
  restorePrelude0157();
}

function finishPrelude0157(generation) {
  const state = preludeState0157();
  clearTimeout(state.finishTimer);
  state.finishTimer = setTimeout(() => {
    if (generation !== state.generation) return;
    state.observer?.disconnect?.();
    state.observer = null;
    state.snapshots.clear();
    state.expected.clear();
    state.token = "";
    state.committed = false;
    const page = reportPagePrelude0157();
    page?.classList.remove("dm-period-loading-active-0157");
    page?.removeAttribute("aria-busy");
    const status = page?.querySelector?.("[data-dm-period-loading-0157]");
    if (status) status.hidden = true;
  }, FINAL_GUARD_MS_0157);
}

function sourcesPrelude0157() {
  let energy = {};
  try { energy = globalThis.DashboardModernModules?.store?.getSection?.("energy") || {}; }
  catch (_error) {}
  return [
    ["prod", energy?.solar?.total_energy || energy?.solar?.monthly_energy],
    ["cons", energy?.house?.total_energy || energy?.house?.monthly_energy],
    ["grid", energy?.grid?.total_import_energy || energy?.grid?.monthly_import_energy],
  ].map(([key, entity]) => ({ key, entity: clean0157(entity) })).filter(({ entity }) => entity);
}

function sleepPrelude0157(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function waitForRuntimePrelude0157(generation) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (generation !== preludeState0157().generation) return null;
    const runtime = globalThis[FINAL_RUNTIME_KEY_0157];
    if (typeof runtime?.monthValues === "function") return runtime;
    await sleepPrelude0157(50);
  }
  return null;
}

function commitPrelude0157(values, generation, token) {
  const state = preludeState0157();
  if (generation !== state.generation || token !== state.token) return false;
  const production = Number(values.prod);
  const consumption = Number(values.cons);
  const imported = Number(values.grid);
  if (![production, consumption, imported].some(Number.isFinite)) return false;
  const prod = Number.isFinite(production) ? Math.max(0, production) : 0;
  const cons = Number.isFinite(consumption) ? Math.max(0, consumption) : 0;
  const grid = Number.isFinite(imported) ? Math.max(0, imported) : 0;
  const autonomy = cons > 0
    ? Math.max(0, Math.min(100, Math.round(((cons - grid) / cons) * 100)))
    : 0;
  state.expected = new Map([
    ["ed-kpi-prod", `${prod.toFixed(1)} <small>kWh</small>`],
    ["ed-kpi-cons", `${cons.toFixed(1)} <small>kWh</small>`],
    ["ed-kpi-auto", `${autonomy} <small>%</small>`],
  ]);
  state.committed = true;
  state.observer?.disconnect?.();
  restorePrelude0157();
  observePrelude0157();
  finishPrelude0157(generation);
  return true;
}

async function refreshPrelude0157(generation, period) {
  const state = preludeState0157();
  const token = `${period.year}-${period.month}`;
  const runtime = await waitForRuntimePrelude0157(generation);
  const sources = sourcesPrelude0157();
  if (!runtime || !sources.length || generation !== state.generation || token !== state.token) {
    finishPrelude0157(generation);
    return false;
  }
  try {
    const raw = await runtime.monthValues(
      sources.map(({ entity }) => entity),
      period.month,
      period.year,
    );
    if (generation !== state.generation || token !== state.token) return false;
    const remaining = MIN_SNAPSHOT_MS_0157 - (clock0157() - state.startedAt);
    if (remaining > 0) await sleepPrelude0157(remaining);
    if (generation !== state.generation || token !== state.token) return false;
    const values = Object.fromEntries(
      sources.map(({ key, entity }) => [key, Number(raw.get(entity))]),
    );
    return commitPrelude0157(values, generation, token);
  } catch (error) {
    console.warn("[DashboardModern] selected Report month", error);
    restorePrelude0157();
    finishPrelude0157(generation);
    return false;
  }
}

function schedulePrelude0157(period) {
  const state = preludeState0157();
  const generation = ++state.generation;
  const captured = { month: Number(period.month), year: Number(period.year) };
  clearTimeout(state.timer);
  beginPrelude0157(captured);
  state.timer = setTimeout(() => refreshPrelude0157(generation, captured), 0);
}

function installPrelude0157() {
  preludeState0157();
  document.addEventListener("change", (event) => {
    if (!event.target?.matches?.("#ed-sel-month,#ed-sel-year")) return;
    const period = selectedPeriodPrelude0157();
    event.stopImmediatePropagation();
    schedulePrelude0157(period);
  }, true);
}

if (typeof document !== "undefined") installPrelude0157();
