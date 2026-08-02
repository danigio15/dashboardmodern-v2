/* DashboardModern 0.14.16 final runtime: bridge-safe periods, historical Report and event-driven states. */
const KEY = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const LEGACY_KEY = "__DASHBOARDMODERN_RELEASE_0156_PERIOD_RUNTIME__";
const PUBLIC_KEY = "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__";
const HOOK_KEY = "__DASHBOARDMODERN_ENERGY_REPORT_HOOKS__";
const TIMEOUT = 12000;
const SOURCES = Object.freeze([
  ["cons", "dm.energy_consumo_casa_mese", "house", "total_energy", "monthly_energy"],
  ["prelevato", "dm.energy_rete_acquistata_mese", "grid", "total_import_energy", "monthly_import_energy"],
  ["immesso", "dm.energy_rete_venduta_mese", "grid", "total_export_energy", "monthly_export_energy"],
  ["prod", "dm.energy_produzione_solare_mese", "solar", "total_energy", "monthly_energy"],
  ["batCar", "dm.energy_batteria_caricata_mese", "battery", "total_charged_energy", "monthly_charged_energy"],
  ["batScar", "dm.energy_batteria_usata_mese", "battery", "total_discharged_energy", "monthly_discharged_energy"],
]);

function rt() {
  return (globalThis[KEY] ||= {
    installed: false,
    ready: false,
    socket: null,
    connection: null,
    authenticated: false,
    nextId: 156600,
    pending: new Map(),
    inflight: new Map(),
    cache: new Map(),
    subscription: 0,
    reportGeneration: 0,
    deviceGeneration: 0,
    reportTimer: 0,
    retryTimer: 0,
    events: false,
  });
}
const tr = (it, en) => document.documentElement.lang === "en" ? en : it;
const resolveEntity = (id) => {
  const original = String(id || "").trim();
  try { return String(globalThis.resolveEntity?.(original) || original).trim(); }
  catch (_error) { return original; }
};
function socketCtor() {
  return typeof globalThis.__DASHBOARDMODERN_PRELUDE_WS__ === "function"
    ? globalThis.__DASHBOARDMODERN_PRELUDE_WS__
    : globalThis.WebSocket;
}
function bridgeReady() {
  return typeof globalThis.__DASHBOARDMODERN_PRELUDE_WS__ === "function" ||
    globalThis.__DASHBOARDMODERN_BRIDGED__ === true ||
    globalThis.__DASHBOARDMODERN_LEGACY_READY__ === true ||
    globalThis.__DASHBOARDMODERN_HOSTED__ !== true;
}
function token() {
  const values = [
    globalThis.DASHBOARDMODERN_AUTH_TOKEN,
    globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
    globalThis.LONG_LIVED_TOKEN,
    globalThis.HA_TOKEN,
  ];
  try {
    const cfg = JSON.parse(localStorage.getItem("cd_connection") || "{}");
    values.push(cfg.token, cfg.access_token);
  } catch (_error) {}
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}
function rejectPending(error) {
  const runtime = rt();
  runtime.pending.forEach((pending) => {
    clearTimeout(pending.timer);
    pending.reject(error);
  });
  runtime.pending.clear();
  runtime.inflight.clear();
}
function reset(error) {
  const runtime = rt();
  const socket = runtime.socket;
  runtime.socket = null;
  runtime.connection = null;
  runtime.authenticated = false;
  runtime.subscription = 0;
  if (error) rejectPending(error);
  try { if (socket?.readyState === 1) socket.close(); } catch (_error) {}
}
function syncLive() {
  const live = globalThis[PUBLIC_KEY];
  try { live?.syncTemperature?.(true); live?.syncAppliances?.(); } catch (_error) {}
}
function storeState(state) {
  const id = String(state?.entity_id || "").trim();
  if (!id) return false;
  try { if (typeof _RAW_STATES !== "undefined") _RAW_STATES[id] = state; } catch (_error) {}
  try { globalThis._RAW_STATES ||= {}; globalThis._RAW_STATES[id] = state; } catch (_error) {}
  try { if (typeof STATES !== "undefined") STATES[id] = state; } catch (_error) {}
  try { if (globalThis.STATES) globalThis.STATES[id] = state; } catch (_error) {}
  return true;
}
function ingestStates(states) {
  const list = Array.isArray(states) ? states : [];
  list.forEach(storeState);
  try { globalThis[PUBLIC_KEY]?.ingestStates?.(list); } catch (_error) {}
  syncLive();
  queueMicrotask(syncLive);
}
function ingestState(state) {
  if (!storeState(state)) return;
  try { globalThis[PUBLIC_KEY]?.ingestState?.(state); } catch (_error) {}
  queueMicrotask(syncLive);
}
function onMessage(event, resolveConnection, rejectConnection) {
  let message;
  try { message = JSON.parse(event?.data || event); } catch (_error) { return; }
  const runtime = rt();
  if (message.type === "auth_required") {
    const access = token();
    if (!access) return rejectConnection(new Error(tr("Token HA assente", "HA token missing")));
    runtime.socket?.send(JSON.stringify({ type: "auth", access_token: access }));
    return;
  }
  if (message.type === "auth_ok") {
    runtime.authenticated = true;
    resolveConnection(runtime.socket);
    return;
  }
  if (message.type === "auth_invalid") {
    rejectConnection(new Error(message.message || tr("Autenticazione non valida", "Invalid authentication")));
    return;
  }
  if (message.type === "event" && message.id === runtime.subscription) {
    ingestState(message.event?.data?.new_state);
    return;
  }
  if (message.type !== "result" || message.id == null) return;
  const pending = runtime.pending.get(message.id);
  if (!pending) return;
  runtime.pending.delete(message.id);
  clearTimeout(pending.timer);
  if (message.success === false) pending.reject(new Error(message.error?.message || "HA request failed"));
  else pending.resolve(message.result ?? null);
}
function connect() {
  const runtime = rt();
  if (runtime.authenticated && runtime.socket?.readyState === 1) return Promise.resolve(runtime.socket);
  if (runtime.connection) return runtime.connection;
  if (!bridgeReady()) return Promise.reject(new Error("bridge-not-ready"));
  const Socket = socketCtor();
  if (typeof Socket !== "function") return Promise.reject(new Error("websocket-unavailable"));
  runtime.connection = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error("HA connection timeout")), TIMEOUT);
    try {
      const socket = new Socket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/websocket`);
      runtime.socket = socket;
      socket.onmessage = (event) => onMessage(event, (value) => finish(resolve, value), (error) => finish(reject, error));
      socket.onerror = () => finish(reject, new Error("HA connection unavailable"));
      socket.onclose = () => { if (runtime.socket === socket) reset(); };
    } catch (error) { finish(reject, error); }
  }).catch((error) => { reset(error); throw error; }).finally(() => { runtime.connection = null; });
  return runtime.connection;
}
async function request(payload) {
  const runtime = rt();
  const socket = await connect();
  const id = ++runtime.nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      runtime.pending.delete(id);
      reject(new Error("HA response timeout"));
    }, TIMEOUT);
    runtime.pending.set(id, { resolve, reject, timer });
    try { socket.send(JSON.stringify({ id, ...payload })); }
    catch (error) { clearTimeout(timer); runtime.pending.delete(id); reject(error); }
  });
}
async function cached(payload, key, maxAge) {
  const runtime = rt();
  const hit = runtime.cache.get(key);
  if (hit && Date.now() - hit.at < maxAge) return hit.value;
  if (runtime.inflight.has(key)) return runtime.inflight.get(key);
  const promise = request(payload).then((value) => {
    runtime.cache.set(key, { at: Date.now(), value });
    return value;
  }).finally(() => runtime.inflight.delete(key));
  runtime.inflight.set(key, promise);
  return promise;
}
async function statistics(ids, start, end, period = "day") {
  const originals = [...new Set(ids.map(String).filter(Boolean))];
  const mapped = new Map(originals.map((id) => [id, resolveEntity(id)]));
  const statisticIds = [...new Set([...mapped.values()].filter(Boolean))];
  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();
  const old = Date.parse(endIso) < Date.now() - 86400000;
  const key = `stats|${period}|${startIso}|${endIso}|${statisticIds.join(",")}`;
  const result = await cached({
    type: "recorder/statistics_during_period",
    start_time: startIso,
    end_time: endIso,
    statistic_ids: statisticIds,
    period,
    units: { energy: "kWh" },
  }, key, old ? 600000 : 20000);
  return Object.fromEntries(originals.map((id) => [id, result?.[mapped.get(id)] || []]));
}
const rowTime = (row) => {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
};
const cumulative = (row) => {
  for (const key of ["sum", "state", "max"]) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
};
function periodValue(rows, baseline) {
  const ordered = (rows || []).filter(Boolean).slice().sort((a, b) => rowTime(a) - rowTime(b));
  const changes = ordered.map((row) => Number(row?.change)).filter(Number.isFinite);
  if (changes.length) return Math.max(0, changes.reduce((sum, value) => sum + value, 0));
  const values = ordered.map(cumulative).filter((value) => value != null);
  const base = cumulative(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;
  return Math.max(0, values.slice(1).reduce((sum, value, index) => {
    const delta = value - values[index];
    return sum + (delta >= 0 ? delta : Math.max(0, value));
  }, 0));
}
function range(month, year) {
  const now = new Date();
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const end = next > now ? now : next;
  const baselineStart = new Date(start);
  baselineStart.setDate(baselineStart.getDate() - 2);
  return { start, end, baselineStart };
}
async function monthValues(ids, month, year) {
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  const dates = range(month, year);
  if (!unique.length || dates.end <= dates.start) return new Map();
  const rows = await statistics(unique, dates.start, dates.end, "day");
  const missing = unique.filter((id) => periodValue(rows[id]) == null);
  const baselines = missing.length
    ? await statistics(missing, dates.baselineStart, dates.start, "day")
    : {};
  const values = new Map();
  unique.forEach((id) => {
    const baselineRows = (baselines[id] || []).slice().sort((a, b) => rowTime(a) - rowTime(b));
    const value = periodValue(rows[id], baselineRows.at(-1));
    if (value == null) return;
    const rounded = Math.round(value * 1000) / 1000;
    values.set(id, rounded);
    values.set(resolveEntity(id), rounded);
  });
  return values;
}
function energySources() {
  let energy = {};
  try { energy = globalThis.DashboardModernModules?.store?.getSection?.("energy") || {}; }
  catch (_error) {}
  return SOURCES.map(([key, slot, group, total, explicit]) => {
    const cfg = energy[group] || {};
    return { key, slot, entity: String(cfg[total] || cfg[explicit] || "").trim() };
  }).filter((source) => source.entity);
}
function registry() {
  try { if (typeof CD_PERIOD !== "undefined") return CD_PERIOD; } catch (_error) {}
  return (globalThis.CD_PERIOD ||= {});
}
function writeSlot(source, value, month, year) {
  if (!Number.isFinite(value)) return;
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  registry()[source.slot] = rounded;
  const stamp = new Date().toISOString();
  storeState({
    entity_id: source.slot,
    state: String(rounded),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      dashboardmodern_derived: true,
      dashboardmodern_source: source.entity,
      dashboardmodern_selected: `${year}-${String(month).padStart(2, "0")}`,
    },
    last_changed: stamp,
    last_updated: stamp,
  });
}
async function refreshCurrent() {
  const sources = energySources();
  if (!sources.length) return false;
  const now = new Date();
  const values = await monthValues(sources.map((source) => source.entity), now.getMonth() + 1, now.getFullYear());
  sources.forEach((source) => writeSlot(
    source,
    values.get(source.entity) ?? values.get(resolveEntity(source.entity)),
    now.getMonth() + 1,
    now.getFullYear(),
  ));
  try { globalThis.renderEnergy?.(); } catch (_error) {}
  return true;
}
function reportPeriod() {
  const now = new Date();
  const month = Number(document.getElementById("ed-sel-month")?.value);
  const year = Number(document.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}
async function refreshOverview() {
  const runtime = rt();
  const generation = ++runtime.reportGeneration;
  const selected = reportPeriod();
  const sources = energySources();
  const values = await monthValues(sources.map((source) => source.entity), selected.month, selected.year);
  if (generation !== runtime.reportGeneration) return false;
  const data = Object.fromEntries(sources.map((source) => [source.key, values.get(source.entity) ?? values.get(resolveEntity(source.entity)) ?? 0]));
  const prod = Number(data.prod) || 0;
  const cons = Number(data.cons) || 0;
  const grid = Number(data.prelevato) || 0;
  const auto = cons > 0 ? Math.max(0, Math.min(100, Math.round(((cons - grid) / cons) * 100))) : 0;
  const set = (id, html) => { const node = document.getElementById(id); if (node) node.innerHTML = html; };
  set("ed-kpi-prod", `${prod.toFixed(1)} <small>kWh</small>`);
  set("ed-kpi-cons", `${cons.toFixed(1)} <small>kWh</small>`);
  set("ed-kpi-auto", `${auto} <small>%</small>`);
  return true;
}
function devices() {
  try {
    const modules = globalThis.DashboardModernModules;
    return modules.data.canonicalReportDevices(
      modules.store.getSection("appliances") || [],
      modules.store.getSection("loads") || [],
      globalThis.STATES || {},
    );
  } catch (_error) { return []; }
}
function deepest(fn) {
  const seen = new Set();
  let current = fn;
  while (typeof current?.__dmPrevious === "function" && !seen.has(current)) {
    seen.add(current);
    current = current.__dmPrevious;
  }
  return current;
}
function rowEntity(row, list) {
  const direct = String(row.dataset.entity || row.dataset.sensor || "").trim();
  if (direct) return direct;
  const match = /apriStorico\s*\(\s*event\s*,\s*['\"]([^'\"]+)/.exec(row.getAttribute("onclick") || "");
  if (match?.[1]) return match[1];
  const name = String(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent || "").trim();
  return String(list.find((item) => String(item.name || "").trim() === name)?.entity || "");
}
function patchRows(values) {
  const listNode = document.getElementById("ed-device-list");
  if (!listNode) return;
  const list = devices();
  let total = 0;
  listNode.querySelectorAll(".ed-device-row").forEach((row) => {
    const entity = rowEntity(row, list);
    const value = values.get(entity) ?? values.get(resolveEntity(entity));
    if (!Number.isFinite(value)) return;
    total += value;
    row.dataset.entity = entity;
    row.dataset.dmPeriodValue = String(value);
    const node = row.querySelector(".ed-dev-kwh");
    if (node) node.innerHTML = `${value.toFixed(1)} <small style="font-size:10px">kWh</small>`;
  });
  const totalNode = document.getElementById("ed-dev-total");
  if (totalNode) totalNode.textContent = `${total.toFixed(1)} kWh`;
}
function installReportWrapper() {
  const current = globalThis.renderEdDeviceList;
  if (typeof current !== "function" || current.__dm0156Final) return false;
  const original = deepest(current);
  async function renderHistorical(month, year, _isCurrent, ...rest) {
    const runtime = rt();
    const generation = ++runtime.deviceGeneration;
    const list = devices();
    const ids = [...new Set(list.map((item) => String(item.entity || "").trim()).filter(Boolean))];
    let values = new Map();
    try { values = await monthValues(ids, month, year); }
    catch (error) { console.warn("[DashboardModern] historical device totals", error); }
    if (generation !== runtime.deviceGeneration) return false;
    values.forEach((value, entity) => { registry()[entity] = value; });
    const previous = globalThis.getRawState;
    if (typeof previous === "function") {
      globalThis.getRawState = function (reference) {
        const id = String(reference || "").trim();
        const value = values.get(id) ?? values.get(resolveEntity(id));
        return Number.isFinite(value) ? String(value) : previous.apply(this, arguments);
      };
    }
    try {
      const result = await original.call(this, month, year, true, ...rest);
      patchRows(values);
      return result;
    } finally {
      if (typeof previous === "function") globalThis.getRawState = previous;
    }
  }
  renderHistorical.__dm0156Final = true;
  renderHistorical.__dm0156HistoricalPeriods = true;
  renderHistorical.__dmPrevious = original;
  globalThis.renderEdDeviceList = renderHistorical;
  return true;
}
function stopLoops() {
  const live = globalThis[PUBLIC_KEY];
  if (live) {
    live.eventDrivenBy0156 = true;
    if (live.sampleTimer) clearInterval(live.sampleTimer);
    live.sampleTimer = 0;
  }
  const hooks = globalThis[HOOK_KEY];
  if (hooks) {
    hooks.observer?.disconnect?.();
    hooks.safeObserver?.disconnect?.();
    clearTimeout(hooks.timer);
    clearTimeout(hooks.safeTimer);
    hooks.disabledBy0156 = true;
    hooks.refreshing = true;
  }
}
async function startStates() {
  const states = await cached({ type: "get_states" }, "states", 5000);
  ingestStates(states);
  const runtime = rt();
  if (runtime.subscription) return true;
  const socket = await connect();
  const id = ++runtime.nextId;
  runtime.subscription = id;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("state subscription timeout")), TIMEOUT);
    runtime.pending.set(id, {
      timer,
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    socket.send(JSON.stringify({ id, type: "subscribe_events", event_type: "state_changed" }));
  });
  return true;
}
function scheduleOverview(delay = 20) {
  const runtime = rt();
  clearTimeout(runtime.reportTimer);
  runtime.reportTimer = setTimeout(() => refreshOverview().catch((error) => console.warn("[DashboardModern] Report period", error)), delay);
}
async function bootstrap() {
  if (!bridgeReady()) return false;
  stopLoops();
  installReportWrapper();
  const results = await Promise.allSettled([startStates(), refreshCurrent()]);
  const runtime = rt();
  runtime.ready = results.some((result) => result.status === "fulfilled");
  runtime.installed = true;
  scheduleOverview(0);
  return runtime.ready;
}
function install() {
  const runtime = rt();
  stopLoops();
  installReportWrapper();
  globalThis.fetchHAStatistics = Object.assign(statistics, { __dm0156SharedBroker: true });
  runtime.statistics = statistics;
  runtime.monthValues = monthValues;
  runtime.refreshCurrent = refreshCurrent;
  runtime.refreshOverview = refreshOverview;
  if (!runtime.events) {
    runtime.events = true;
    document.addEventListener("change", (event) => {
      if (!event.target?.matches?.("#ed-sel-month, #ed-sel-year")) return;
      runtime.reportGeneration += 1;
      runtime.deviceGeneration += 1;
      scheduleOverview();
    }, true);
    const reactivate = () => { stopLoops(); installReportWrapper(); bootstrap(); };
    addEventListener("dashboardmodern:legacy-ready", reactivate);
    addEventListener("pageshow", reactivate);
  }
  bootstrap();
  clearInterval(runtime.retryTimer);
  let attempts = 0;
  runtime.retryTimer = setInterval(() => {
    attempts += 1;
    stopLoops();
    installReportWrapper();
    if (!runtime.ready && bridgeReady()) bootstrap();
    if (attempts >= 40 || runtime.ready) {
      clearInterval(runtime.retryTimer);
      runtime.retryTimer = 0;
    }
  }, 100);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();
