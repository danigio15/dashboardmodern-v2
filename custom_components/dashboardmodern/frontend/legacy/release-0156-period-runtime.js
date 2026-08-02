/* DashboardModern 0.14.16: one event-driven HA broker for periods, Report and live states. */
const RUNTIME_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__";
const PUBLIC_RUNTIME_KEY_0155 = "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__";
const REPORT_HOOK_KEY_0153 = "__DASHBOARDMODERN_ENERGY_REPORT_HOOKS__";
const REQUEST_TIMEOUT_0156 = 12000;
const CURRENT_CACHE_MS_0156 = 20000;
const HISTORICAL_CACHE_MS_0156 = 10 * 60 * 1000;

const ENERGY_SOURCES_0156 = Object.freeze([
  { key: "cons", group: "house", total: "total_energy", explicit: "monthly_energy" },
  { key: "prelevato", group: "grid", total: "total_import_energy", explicit: "monthly_import_energy" },
  { key: "immesso", group: "grid", total: "total_export_energy", explicit: "monthly_export_energy" },
  { key: "prod", group: "solar", total: "total_energy", explicit: "monthly_energy" },
  { key: "batCar", group: "battery", total: "total_charged_energy", explicit: "monthly_charged_energy" },
  { key: "batScar", group: "battery", total: "total_discharged_energy", explicit: "monthly_discharged_energy" },
]);

function runtime0156() {
  return (globalThis[RUNTIME_KEY_0156] ||= {
    installed: false,
    version: "0.14.16",
    socket: null,
    connection: null,
    authenticated: false,
    nextId: 156000,
    pending: new Map(),
    inflight: new Map(),
    cache: new Map(),
    stateSubscription: 0,
    stateFeedStarted: false,
    reportGeneration: 0,
    reportTimer: 0,
    wrappersTimer: 0,
  });
}

function isEnglish0156() {
  return globalThis.document?.documentElement?.lang === "en";
}

function copy0156(it, en) {
  return isEnglish0156() ? en : it;
}

function websocketUrl0156() {
  const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${globalThis.location?.host || "dashboardmodern-bridge"}/api/websocket`;
}

function accessToken0156() {
  const candidates = [
    globalThis.DASHBOARDMODERN_AUTH_TOKEN,
    globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
    globalThis.LONG_LIVED_TOKEN,
    globalThis.HA_TOKEN,
    globalThis.haToken,
    globalThis.authToken,
  ];
  try {
    const configured = JSON.parse(globalThis.localStorage?.getItem("cd_connection") || "{}");
    candidates.push(configured.token, configured.access_token);
  } catch (_error) {}
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function rejectPending0156(error) {
  const runtime = runtime0156();
  runtime.pending.forEach(({ reject, timer }) => {
    globalThis.clearTimeout?.(timer);
    reject(error);
  });
  runtime.pending.clear();
  runtime.inflight.clear();
}

function resetConnection0156(error) {
  const runtime = runtime0156();
  const socket = runtime.socket;
  runtime.socket = null;
  runtime.connection = null;
  runtime.authenticated = false;
  runtime.stateSubscription = 0;
  runtime.stateFeedStarted = false;
  if (error) rejectPending0156(error);
  try {
    if (socket?.readyState === 1) socket.close();
  } catch (_error) {}
}

function writeState0156(state) {
  const id = String(state?.entity_id || "").trim();
  if (!id) return false;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) _RAW_STATES[id] = state;
  } catch (_error) {}
  try {
    globalThis._RAW_STATES ||= {};
    globalThis._RAW_STATES[id] = state;
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES) STATES[id] = state;
  } catch (_error) {}
  try {
    if (globalThis.STATES) globalThis.STATES[id] = state;
  } catch (_error) {}

  const publicRuntime = globalThis[PUBLIC_RUNTIME_KEY_0155];
  if (typeof publicRuntime?.ingestState === "function") publicRuntime.ingestState(state);
  return true;
}

function writeStates0156(states) {
  const list = Array.isArray(states) ? states : [];
  list.forEach((state) => writeState0156(state));
  const publicRuntime = globalThis[PUBLIC_RUNTIME_KEY_0155];
  if (typeof publicRuntime?.ingestStates === "function") publicRuntime.ingestStates(list);
  return list.length > 0;
}

function handleMessage0156(event, resolveConnection, rejectConnection) {
  let message;
  try {
    message = JSON.parse(event?.data || event);
  } catch (_error) {
    return;
  }
  const runtime = runtime0156();
  if (message.type === "auth_required") {
    const token = accessToken0156();
    if (!token) {
      const error = new Error(copy0156("Bridge Home Assistant non autenticato", "Home Assistant bridge is not authenticated"));
      rejectConnection(error);
      resetConnection0156(error);
      return;
    }
    runtime.socket?.send(JSON.stringify({ type: "auth", access_token: token }));
    return;
  }
  if (message.type === "auth_ok") {
    runtime.authenticated = true;
    resolveConnection(runtime.socket);
    return;
  }
  if (message.type === "auth_invalid") {
    const error = new Error(message.message || copy0156("Autenticazione Home Assistant non valida", "Invalid Home Assistant authentication"));
    rejectConnection(error);
    resetConnection0156(error);
    return;
  }
  if (message.type === "event" && message.id === runtime.stateSubscription) {
    const state = message.event?.data?.new_state;
    if (state) writeState0156(state);
    return;
  }
  if (message.type !== "result" || message.id == null) return;
  const pending = runtime.pending.get(message.id);
  if (!pending) return;
  runtime.pending.delete(message.id);
  globalThis.clearTimeout?.(pending.timer);
  if (message.success === false) {
    pending.reject(new Error(message.error?.message || message.error?.code || "Home Assistant request failed"));
  } else {
    pending.resolve(message.result ?? null);
  }
}

function connect0156() {
  const runtime = runtime0156();
  if (runtime.authenticated && runtime.socket?.readyState === 1) {
    return Promise.resolve(runtime.socket);
  }
  if (runtime.connection) return runtime.connection;
  if (typeof globalThis.WebSocket !== "function") {
    return Promise.reject(new Error(copy0156("WebSocket non disponibile", "WebSocket unavailable")));
  }

  runtime.connection = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout?.(timer);
      callback(value);
    };
    const timer = globalThis.setTimeout?.(() => {
      const error = new Error(copy0156("Timeout connessione Home Assistant", "Home Assistant connection timeout"));
      finish(reject, error);
      resetConnection0156(error);
    }, REQUEST_TIMEOUT_0156);
    try {
      const socket = new globalThis.WebSocket(websocketUrl0156());
      runtime.socket = socket;
      socket.onmessage = (event) => handleMessage0156(
        event,
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
      socket.onerror = () => {
        const error = new Error(copy0156("Connessione Home Assistant non disponibile", "Home Assistant connection unavailable"));
        finish(reject, error);
        resetConnection0156(error);
      };
      socket.onclose = () => {
        const error = new Error(copy0156("Connessione Home Assistant chiusa", "Home Assistant connection closed"));
        finish(reject, error);
        resetConnection0156(error);
      };
    } catch (error) {
      finish(reject, error);
      resetConnection0156(error);
    }
  }).finally(() => {
    runtime.connection = null;
  });
  return runtime.connection;
}

async function sendRequest0156(payload) {
  const runtime = runtime0156();
  const socket = await connect0156();
  const id = ++runtime.nextId;
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout?.(() => {
      runtime.pending.delete(id);
      reject(new Error(copy0156("Timeout risposta Home Assistant", "Home Assistant response timeout")));
    }, REQUEST_TIMEOUT_0156);
    runtime.pending.set(id, { resolve, reject, timer });
    try {
      socket.send(JSON.stringify({ id, ...payload }));
    } catch (error) {
      globalThis.clearTimeout?.(timer);
      runtime.pending.delete(id);
      reject(error);
    }
  });
}

async function cachedRequest0156(payload, cacheKey, cacheMs = 0) {
  const runtime = runtime0156();
  if (cacheMs > 0) {
    const cached = runtime.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < cacheMs) return cached.value;
  }
  if (runtime.inflight.has(cacheKey)) return runtime.inflight.get(cacheKey);
  const promise = sendRequest0156(payload)
    .then((value) => {
      if (cacheMs > 0) runtime.cache.set(cacheKey, { at: Date.now(), value });
      return value;
    })
    .finally(() => runtime.inflight.delete(cacheKey));
  runtime.inflight.set(cacheKey, promise);
  return promise;
}

function resolveEntity0156(entity) {
  const original = String(entity || "").trim();
  if (!original) return "";
  try {
    return String(globalThis.resolveEntity?.(original) || original).trim();
  } catch (_error) {
    return original;
  }
}

export async function fetchHAStatistics0156(ids, start, end, period = "day") {
  const originals = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  if (!originals.length) return {};
  const resolved = new Map(originals.map((id) => [id, resolveEntity0156(id)]));
  const statisticIds = [...new Set([...resolved.values()].filter(Boolean))];
  const now = Date.now();
  const endMs = Date.parse(end);
  const cacheMs = Number.isFinite(endMs) && endMs < now - 86400000
    ? HISTORICAL_CACHE_MS_0156
    : CURRENT_CACHE_MS_0156;
  const key = `stats|${period}|${new Date(start).toISOString()}|${new Date(end).toISOString()}|${statisticIds.join(",")}`;
  const result = await cachedRequest0156(
    {
      type: "recorder/statistics_during_period",
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      statistic_ids: statisticIds,
      period,
      units: { energy: "kWh" },
    },
    key,
    cacheMs,
  );
  return Object.fromEntries(
    originals.map((id) => [id, result?.[resolved.get(id)] || []]),
  );
}

async function startStateFeed0156() {
  const runtime = runtime0156();
  if (runtime.stateFeedStarted) return true;
  runtime.stateFeedStarted = true;
  try {
    const states = await cachedRequest0156({ type: "get_states" }, "get_states", 5000);
    writeStates0156(states);
    const socket = await connect0156();
    const id = ++runtime.nextId;
    runtime.stateSubscription = id;
    await new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout?.(() => {
        runtime.pending.delete(id);
        reject(new Error(copy0156("Timeout sottoscrizione stati", "State subscription timeout")));
      }, REQUEST_TIMEOUT_0156);
      runtime.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, type: "subscribe_events", event_type: "state_changed" }));
    });
    return true;
  } catch (error) {
    runtime.stateFeedStarted = false;
    console.warn("[DashboardModern] shared live-state feed", error);
    return false;
  }
}

function rowTime0156(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

function cumulativeValue0156(row) {
  for (const key of ["sum", "state", "max"]) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function periodValue0156(rows = [], baseline = null) {
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTime0156(left) - rowTime0156(right));
  const changes = ordered
    .map((row) => Number(row?.change))
    .filter((value) => Number.isFinite(value));
  if (changes.length) return Math.max(0, changes.reduce((total, value) => total + value, 0));
  const values = ordered.map(cumulativeValue0156).filter((value) => value != null);
  const base = cumulativeValue0156(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];
    total += difference >= 0 ? difference : Math.max(0, values[index]);
  }
  return Math.max(0, total);
}

function monthRange0156(month, year, now = new Date()) {
  const safeMonth = Number.isInteger(+month) && +month >= 1 && +month <= 12
    ? +month
    : now.getMonth() + 1;
  const safeYear = Number.isInteger(+year) && +year >= 2000 ? +year : now.getFullYear();
  const start = new Date(safeYear, safeMonth - 1, 1);
  const next = new Date(safeYear, safeMonth, 1);
  const end = next > now ? now : next;
  const baselineStart = new Date(start);
  baselineStart.setDate(baselineStart.getDate() - 2);
  return { start, end, baselineStart, month: safeMonth, year: safeYear };
}

async function valuesForMonth0156(ids, month, year) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  const range = monthRange0156(month, year);
  if (!unique.length || range.end <= range.start) return new Map();
  const rows = await fetchHAStatistics0156(
    unique,
    range.start.toISOString(),
    range.end.toISOString(),
    "day",
  );
  const unresolved = unique.filter((id) => periodValue0156(rows[id] || []) == null);
  let baselines = {};
  if (unresolved.length) {
    baselines = await fetchHAStatistics0156(
      unresolved,
      range.baselineStart.toISOString(),
      range.start.toISOString(),
      "day",
    );
  }
  const values = new Map();
  unique.forEach((id) => {
    const baselineRows = (baselines[id] || [])
      .slice()
      .sort((left, right) => rowTime0156(left) - rowTime0156(right));
    const value = periodValue0156(rows[id] || [], baselineRows.at(-1) || null);
    if (value == null) return;
    const rounded = Math.round(value * 1000) / 1000;
    values.set(id, rounded);
    values.set(resolveEntity0156(id), rounded);
  });
  return values;
}

function selectedReportPeriod0156() {
  const now = new Date();
  const month = Number(globalThis.document?.getElementById?.("ed-sel-month")?.value);
  const year = Number(globalThis.document?.getElementById?.("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function energyConfig0156() {
  try {
    return globalThis.DashboardModernModules?.store?.getSection?.("energy") || {};
  } catch (_error) {
    return {};
  }
}

function energyEntities0156() {
  const energy = energyConfig0156();
  return ENERGY_SOURCES_0156.map((source) => {
    const group = energy?.[source.group] || {};
    const entity = String(group[source.total] || group[source.explicit] || "").trim();
    return { ...source, entity };
  }).filter((source) => source.entity);
}

async function reportEnergyValues0156(month, year) {
  const sources = energyEntities0156();
  const values = await valuesForMonth0156(sources.map((source) => source.entity), month, year);
  return Object.fromEntries(
    sources.map((source) => [
      source.key,
      values.get(source.entity) ?? values.get(resolveEntity0156(source.entity)) ?? 0,
    ]),
  );
}

function canonicalReportDevices0156() {
  try {
    const modules = globalThis.DashboardModernModules;
    const store = modules?.store;
    const build = modules?.data?.canonicalReportDevices;
    if (!store?.getSection || typeof build !== "function") return [];
    return build(
      store.getSection("appliances") || [],
      store.getSection("loads") || [],
      globalThis.STATES || {},
    );
  } catch (_error) {
    return [];
  }
}

async function reportDeviceValues0156(month, year) {
  const devices = canonicalReportDevices0156();
  const ids = [...new Set(devices.map((device) => String(device.entity || "").trim()).filter(Boolean))];
  return valuesForMonth0156(ids, month, year);
}

function periodRegistry0156() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  globalThis.CD_PERIOD ||= {};
  return globalThis.CD_PERIOD;
}

function setHtml0156(id, html) {
  const node = globalThis.document?.getElementById?.(id);
  if (!node || node.innerHTML === html) return false;
  node.innerHTML = html;
  return true;
}

function patchReportOverview0156(values) {
  const prod = Number(values?.prod) || 0;
  const cons = Number(values?.cons) || 0;
  const prelevato = Number(values?.prelevato) || 0;
  const auto = cons > 0
    ? Math.max(0, Math.min(100, Math.round(((cons - prelevato) / cons) * 100)))
    : 0;
  let changed = false;
  changed = setHtml0156("ed-kpi-prod", `${prod.toFixed(1)} <small>kWh</small>`) || changed;
  changed = setHtml0156("ed-kpi-cons", `${cons.toFixed(1)} <small>kWh</small>`) || changed;
  changed = setHtml0156("ed-kpi-auto", `${auto} <small>%</small>`) || changed;
  return changed;
}

function deepestFunction0156(fn) {
  const seen = new Set();
  let current = fn;
  while (typeof current?.__dmPrevious === "function" && !seen.has(current)) {
    seen.add(current);
    current = current.__dmPrevious;
  }
  return current;
}

function installReportDeviceWrapper0156() {
  const current = globalThis.renderEdDeviceList;
  if (typeof current !== "function" || current.__dm0156HistoricalPeriods) return false;
  const original = deepestFunction0156(current);
  if (typeof original !== "function") return false;

  async function renderEdDeviceList0156(month, year, _isCurrentMonth, ...rest) {
    const runtime = runtime0156();
    const generation = ++runtime.reportGeneration;
    let values = new Map();
    try {
      values = await reportDeviceValues0156(month, year);
    } catch (error) {
      console.warn("[DashboardModern] historical Report devices", error);
    }
    if (generation !== runtime.reportGeneration) return false;

    const registry = periodRegistry0156();
    values.forEach((value, entity) => {
      registry[entity] = value;
    });
    const previousGetRawState = globalThis.getRawState;
    if (typeof previousGetRawState === "function" && values.size) {
      globalThis.getRawState = function getRawState0156(reference) {
        const key = String(reference || "").trim();
        const value = values.get(key) ?? values.get(resolveEntity0156(key));
        if (Number.isFinite(value)) return String(value);
        return previousGetRawState.apply(this, arguments);
      };
    }
    try {
      return await original.call(this, month, year, true, ...rest);
    } finally {
      if (globalThis.getRawState !== previousGetRawState) globalThis.getRawState = previousGetRawState;
    }
  }

  renderEdDeviceList0156.__dm0156HistoricalPeriods = true;
  renderEdDeviceList0156.__dmPrevious = original;
  globalThis.renderEdDeviceList = renderEdDeviceList0156;
  return true;
}

function installReportDashboardWrapper0156() {
  const current = globalThis.renderEnergyDashboard;
  if (typeof current !== "function" || current.__dm0156HistoricalPeriods) return false;

  async function renderEnergyDashboard0156(...args) {
    const result = await current.apply(this, args);
    scheduleReportRefresh0156(0);
    return result;
  }

  renderEnergyDashboard0156.__dm0156HistoricalPeriods = true;
  renderEnergyDashboard0156.__dmPrevious = current;
  globalThis.renderEnergyDashboard = renderEnergyDashboard0156;
  return true;
}

async function refreshReport0156() {
  const runtime = runtime0156();
  const generation = ++runtime.reportGeneration;
  const { month, year } = selectedReportPeriod0156();
  try {
    const values = await reportEnergyValues0156(month, year);
    if (generation !== runtime.reportGeneration) return false;
    patchReportOverview0156(values);
    globalThis.__DASHBOARDMODERN_REPORT_PERIOD__ = { month, year, values };
    return true;
  } catch (error) {
    console.warn("[DashboardModern] historical Report overview", error);
    return false;
  }
}

function scheduleReportRefresh0156(delay = 40) {
  const runtime = runtime0156();
  globalThis.clearTimeout?.(runtime.reportTimer);
  runtime.reportTimer = globalThis.setTimeout?.(refreshReport0156, delay);
}

function disableLegacyLoops0156() {
  const publicRuntime = globalThis[PUBLIC_RUNTIME_KEY_0155];
  if (publicRuntime?.sampleTimer) {
    globalThis.clearInterval?.(publicRuntime.sampleTimer);
    publicRuntime.sampleTimer = 0;
  }
  const hooks = globalThis[REPORT_HOOK_KEY_0153];
  if (hooks) {
    hooks.observer?.disconnect?.();
    hooks.safeObserver?.disconnect?.();
    globalThis.clearTimeout?.(hooks.timer);
    globalThis.clearTimeout?.(hooks.safeTimer);
    hooks.observer = null;
    hooks.safeObserver = null;
    hooks.safeObserverInstalled = true;
    hooks.refreshing = true;
    hooks.disabledBy0156 = true;
  }
}

function installStatisticsOverride0156() {
  const previous = globalThis.fetchHAStatistics;
  if (previous?.__dm0156SharedBroker) return true;
  async function sharedStatistics0156(ids, start, end, period = "day") {
    return fetchHAStatistics0156(ids, start, end, period);
  }
  sharedStatistics0156.__dm0156SharedBroker = true;
  sharedStatistics0156.__dmPrevious = previous;
  globalThis.fetchHAStatistics = sharedStatistics0156;
  return true;
}

function installWrappers0156() {
  installReportDeviceWrapper0156();
  installReportDashboardWrapper0156();
}

function installEvents0156() {
  const runtime = runtime0156();
  if (runtime.eventsInstalled || !globalThis.document) return;
  runtime.eventsInstalled = true;
  globalThis.document.addEventListener(
    "change",
    (event) => {
      if (!event.target?.matches?.("#ed-sel-month, #ed-sel-year")) return;
      runtime.cache.clear();
      runtime.reportGeneration += 1;
      scheduleReportRefresh0156(30);
    },
    true,
  );
  globalThis.addEventListener?.("pageshow", () => {
    disableLegacyLoops0156();
    startStateFeed0156();
    installWrappers0156();
    scheduleReportRefresh0156(80);
  });
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    disableLegacyLoops0156();
    startStateFeed0156();
    installWrappers0156();
    scheduleReportRefresh0156(80);
  });
}

function install0156() {
  const runtime = runtime0156();
  runtime.installed = true;
  installStatisticsOverride0156();
  disableLegacyLoops0156();
  installWrappers0156();
  installEvents0156();
  startStateFeed0156();
  scheduleReportRefresh0156(120);

  if (!runtime.wrappersTimer) {
    let attempts = 0;
    runtime.wrappersTimer = globalThis.setInterval?.(() => {
      attempts += 1;
      disableLegacyLoops0156();
      installWrappers0156();
      if (attempts >= 30 || (
        globalThis.renderEdDeviceList?.__dm0156HistoricalPeriods &&
        globalThis.renderEnergyDashboard?.__dm0156HistoricalPeriods
      )) {
        globalThis.clearInterval?.(runtime.wrappersTimer);
        runtime.wrappersTimer = 0;
      }
    }, 100);
  }
}

if (typeof globalThis.document !== "undefined") {
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0156, { once: true });
  } else install0156();
}
