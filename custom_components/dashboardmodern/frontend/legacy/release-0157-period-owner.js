/* DashboardModern 0.14.17: single owner for current slots and selected-period KPIs. */
const OWNER_KEY = "__DASHBOARDMODERN_RELEASE_0157_PERIOD_OWNER__";
const RUNTIME_KEY = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const LOCK_KEY = "__DASHBOARDMODERN_RELEASE_0156_CURRENT_PERIOD_LOCK__";
const SOURCES = Object.freeze([
  ["cons", "dm.energy_consumo_casa_mese", "house", "total_energy", "monthly_energy"],
  ["prelevato", "dm.energy_rete_acquistata_mese", "grid", "total_import_energy", "monthly_import_energy"],
  ["immesso", "dm.energy_rete_venduta_mese", "grid", "total_export_energy", "monthly_export_energy"],
  ["prod", "dm.energy_produzione_solare_mese", "solar", "total_energy", "monthly_energy"],
  ["batCar", "dm.energy_batteria_caricata_mese", "battery", "total_charged_energy", "monthly_charged_energy"],
  ["batScar", "dm.energy_batteria_usata_mese", "battery", "total_discharged_energy", "monthly_discharged_energy"],
]);

function owner() {
  const value = (globalThis[OWNER_KEY] ||= {});
  value.installed = true;
  value.retry ||= 0;
  value.currentTimer ||= 0;
  value.periodTimer ||= 0;
  value.currentGeneration ||= 0;
  value.periodGeneration ||= 0;
  value.currentSlots ||= new Map();
  value.expected ||= new Map();
  value.periodToken ||= "";
  value.writing ||= false;
  value.observer ||= null;
  return value;
}

const clean = (value) => String(value || "").trim();

function selectedPeriod() {
  const now = new Date();
  const month = Number(document.getElementById("ed-sel-month")?.value);
  const year = Number(document.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function configuredSources() {
  let energy = {};
  try { energy = globalThis.DashboardModernModules?.store?.getSection?.("energy") || {}; }
  catch (_error) {}
  return SOURCES.map(([key, slot, group, totalKey, monthlyKey]) => {
    const config = energy?.[group] || {};
    return { key, slot, entity: clean(config[totalKey] || config[monthlyKey]) };
  }).filter(({ entity }) => entity);
}

function registry() {
  try { if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD; }
  catch (_error) {}
  return (globalThis.CD_PERIOD ||= {});
}

function cloneState(state) {
  return state ? { ...state, attributes: { ...(state.attributes || {}) } } : null;
}

function publishSlot(slot, value, source, month, year) {
  const stamp = new Date().toISOString();
  const next = {
    entity_id: slot,
    state: String(value),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      dashboardmodern_derived: true,
      dashboardmodern_source: source,
      dashboardmodern_selected: `${year}-${String(month).padStart(2, "0")}`,
      dashboardmodern_owner: "0.14.17",
    },
    last_changed: stamp,
    last_updated: stamp,
  };
  try { if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) _RAW_STATES[slot] = cloneState(next); }
  catch (_error) {}
  try { globalThis._RAW_STATES ||= {}; globalThis._RAW_STATES[slot] = cloneState(next); }
  catch (_error) {}
  try { if (typeof STATES !== "undefined" && STATES) STATES[slot] = cloneState(next); }
  catch (_error) {}
  try { if (globalThis.STATES) globalThis.STATES[slot] = cloneState(next); }
  catch (_error) {}
  return next;
}

function stopLegacyWriters() {
  const runtime = globalThis[RUNTIME_KEY];
  if (runtime?.retryTimer) {
    clearInterval(runtime.retryTimer);
    clearTimeout(runtime.retryTimer);
    runtime.retryTimer = 0;
  }
  const lock = globalThis[LOCK_KEY];
  if (!lock) return;
  clearInterval(lock.timer);
  clearTimeout(lock.timer);
  clearTimeout(lock.restoreTimer);
  lock.timer = 0;
  lock.restoreTimer = 0;
  lock.locked = new Set(SOURCES.map(([, slot]) => slot));
}

function installCurrentOwners(values, sources, month, year) {
  const state = owner();
  const target = registry();
  const lock = globalThis[LOCK_KEY];
  sources.forEach(({ slot, entity }) => {
    const parsed = Number(values.get(entity));
    if (!Number.isFinite(parsed)) return;
    let entry = state.currentSlots.get(slot);
    if (!entry) {
      entry = { value: 0, source: entity };
      state.currentSlots.set(slot, entry);
    }
    entry.value = Math.max(0, parsed);
    entry.source = entity;
    try {
      Object.defineProperty(target, slot, {
        configurable: true,
        enumerable: true,
        get: () => entry.value,
        set: () => {},
      });
    } catch (_error) {}
    const snapshot = publishSlot(slot, entry.value, entity, month, year);
    lock?.snapshots?.set?.(slot, cloneState(snapshot));
  });
  stopLegacyWriters();
}

async function refreshCurrent() {
  const state = owner();
  const runtime = globalThis[RUNTIME_KEY];
  const sources = configuredSources();
  if (typeof runtime?.monthValues !== "function" || !sources.length) return false;
  const generation = ++state.currentGeneration;
  const now = new Date();
  try {
    const raw = await runtime.monthValues(
      sources.map(({ entity }) => entity),
      now.getMonth() + 1,
      now.getFullYear(),
    );
    if (generation !== state.currentGeneration) return false;
    const values = new Map();
    sources.forEach(({ entity }) => {
      const value = Number(raw.get(entity));
      if (Number.isFinite(value)) values.set(entity, value);
    });
    installCurrentOwners(values, sources, now.getMonth() + 1, now.getFullYear());
    return values.size > 0;
  } catch (error) {
    console.warn("[DashboardModern] current-period owner", error);
    return false;
  }
}

function scheduleCurrent(delay = 0) {
  const state = owner();
  clearTimeout(state.currentTimer);
  state.currentTimer = setTimeout(refreshCurrent, delay);
}

function clearPeriodOwner() {
  const state = owner();
  state.observer?.disconnect?.();
  state.observer = null;
  state.expected.clear();
  state.periodToken = "";
}

function restoreKpis() {
  const state = owner();
  if (state.writing || !state.periodToken) return;
  state.writing = true;
  try {
    state.expected.forEach((html, id) => {
      const node = document.getElementById(id);
      if (node && node.innerHTML !== html) node.innerHTML = html;
    });
  } finally {
    state.writing = false;
  }
}

function observeKpis() {
  const state = owner();
  state.observer?.disconnect?.();
  if (typeof MutationObserver !== "function" || !state.expected.size) return;
  state.observer = new MutationObserver(() => queueMicrotask(restoreKpis));
  state.expected.forEach((_html, id) => {
    const node = document.getElementById(id);
    if (node) state.observer.observe(node, { childList: true, subtree: true, characterData: true });
  });
}

async function refreshSelected(generation, period) {
  const state = owner();
  const runtime = globalThis[RUNTIME_KEY];
  const sources = configuredSources().filter(({ key }) => ["prod", "cons", "prelevato"].includes(key));
  if (generation !== state.periodGeneration || typeof runtime?.monthValues !== "function" || !sources.length) return false;
  const token = `${period.year}-${period.month}`;
  try {
    const raw = await runtime.monthValues(
      sources.map(({ entity }) => entity),
      period.month,
      period.year,
    );
    if (generation !== state.periodGeneration) return false;
    const values = Object.fromEntries(sources.map(({ key, entity }) => [key, Number(raw.get(entity))]));
    const prod = Number.isFinite(values.prod) ? Math.max(0, values.prod) : 0;
    const cons = Number.isFinite(values.cons) ? Math.max(0, values.cons) : 0;
    const imported = Number.isFinite(values.prelevato) ? Math.max(0, values.prelevato) : 0;
    const autonomy = cons > 0 ? Math.max(0, Math.min(100, Math.round(((cons - imported) / cons) * 100))) : 0;
    state.expected = new Map([
      ["ed-kpi-prod", `${prod.toFixed(1)} <small>kWh</small>`],
      ["ed-kpi-cons", `${cons.toFixed(1)} <small>kWh</small>`],
      ["ed-kpi-auto", `${autonomy} <small>%</small>`],
    ]);
    state.periodToken = token;
    restoreKpis();
    observeKpis();
    return true;
  } catch (error) {
    console.warn("[DashboardModern] selected-period owner", error);
    return false;
  }
}

function scheduleSelected(delay = 120, period = selectedPeriod()) {
  const state = owner();
  const generation = ++state.periodGeneration;
  const captured = { month: Number(period.month), year: Number(period.year) };
  clearTimeout(state.periodTimer);
  clearPeriodOwner();
  state.periodTimer = setTimeout(() => refreshSelected(generation, captured), delay);
}

function settle() {
  const runtime = globalThis[RUNTIME_KEY];
  if (typeof runtime?.monthValues !== "function") return false;
  stopLegacyWriters();
  scheduleCurrent(0);
  return true;
}

function retry(attempt = 0) {
  const state = owner();
  if (settle() || attempt >= 16) return;
  clearTimeout(state.retry);
  state.retry = setTimeout(() => retry(attempt + 1), 75);
}

globalThis.__DASHBOARDMODERN_RELEASE_0157_PERIOD_OWNER_SETTLE__ = settle;

function install() {
  owner();
  document.addEventListener("change", (event) => {
    if (!event.target?.matches?.("#ed-sel-month,#ed-sel-year")) return;
    scheduleSelected(120, selectedPeriod());
  }, true);
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.('.tab[data-tab="energy"],.tab[data-tab="energia"]')) return;
    scheduleCurrent(40);
  }, true);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => retry(0));
  globalThis.addEventListener?.("pageshow", () => retry(0));
  retry(0);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
