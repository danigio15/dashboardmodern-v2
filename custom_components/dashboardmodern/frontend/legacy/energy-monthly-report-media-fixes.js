/* DashboardModern: unify monthly Energy, Report statistics and appliance media. */
const FIX_FLAG = "__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__";
const REQUEST_TIMEOUT = 15000;
const REPORT_CACHE_MS = 30000;

function isEnglish() {
  return globalThis.document?.documentElement?.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowTime(row) {
  const value = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cumulativeValue(row) {
  for (const key of ["sum", "state", "max"]) {
    const value = numberOrNull(row?.[key]);
    if (value != null) return value;
  }
  return null;
}

export function periodValue0153(samples = [], baseline = null) {
  const rows = (Array.isArray(samples) ? samples : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTime(left) - rowTime(right));

  const changes = rows
    .map((row) => numberOrNull(row?.change))
    .filter((value) => value != null);
  if (changes.length) return Math.max(0, changes.reduce((total, value) => total + value, 0));

  const values = rows.map(cumulativeValue).filter((value) => value != null);
  const base = cumulativeValue(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;

  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    const previous = values[index - 1];
    const difference = current - previous;
    total += difference >= 0 ? difference : Math.max(0, current);
  }
  return Math.max(0, total);
}

function configuredToken() {
  const candidates = [
    globalThis.DASHBOARDMODERN_AUTH_TOKEN,
    globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
    globalThis.LONG_LIVED_TOKEN,
    globalThis.HA_TOKEN,
  ];
  try {
    const configured = JSON.parse(globalThis.localStorage?.getItem("cd_connection") || "{}");
    candidates.push(configured.token, configured.access_token);
  } catch (_error) {}
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function resolveStatisticsEntity(entityId) {
  const original = String(entityId || "").trim();
  if (!original) return "";
  try {
    const resolved = globalThis.resolveEntity?.(original);
    return String(resolved || original).trim();
  } catch (_error) {
    return original;
  }
}

export function statisticsRequest0153(entityIds, startISO, endISO, period = "day") {
  return {
    type: "recorder/statistics_during_period",
    start_time: new Date(startISO).toISOString(),
    end_time: new Date(endISO).toISOString(),
    statistic_ids: [...new Set(entityIds.map(resolveStatisticsEntity).filter(Boolean))],
    period,
    units: { energy: "kWh" },
  };
}

class RecorderBridge0153 {
  constructor() {
    this.socket = null;
    this.connection = null;
    this.pending = new Map();
    this.nextId = 153000;
  }

  url() {
    const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location?.host || "dashboardmodern-bridge"}/api/websocket`;
  }

  connect() {
    if (this.socket?.readyState === 1 && this.connection) return this.connection;
    if (this.connection) return this.connection;
    if (typeof globalThis.WebSocket !== "function") {
      return Promise.reject(new Error(copy("WebSocket non disponibile", "WebSocket unavailable")));
    }

    this.connection = new Promise((resolve, reject) => {
      let settled = false;
      const socket = new globalThis.WebSocket(this.url());
      this.socket = socket;
      const timer = globalThis.setTimeout(() => {
        if (!settled) reject(new Error(copy("Timeout canale statistiche", "Statistics channel timeout")));
      }, REQUEST_TIMEOUT);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        callback(value);
      };

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_error) {
          return;
        }
        if (message.type === "auth_required") {
          const token = configuredToken();
          if (!token) {
            finish(
              reject,
              new Error(copy("Bridge Home Assistant non autenticato", "Home Assistant bridge is not authenticated")),
            );
          } else {
            socket.send(JSON.stringify({ type: "auth", access_token: token }));
          }
          return;
        }
        if (message.type === "auth_ok") {
          finish(resolve, socket);
          return;
        }
        if (message.type === "auth_invalid") {
          finish(reject, new Error(copy("Autenticazione Home Assistant non valida", "Invalid Home Assistant authentication")));
          return;
        }
        if (message.type !== "result" || message.id == null) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        globalThis.clearTimeout(pending.timer);
        if (message.success === false) {
          pending.reject(new Error(message.error?.message || "Statistics error"));
        } else {
          pending.resolve(message.result || {});
        }
      };
      socket.onerror = () =>
        finish(reject, new Error(copy("Canale statistiche non disponibile", "Statistics channel unavailable")));
      socket.onclose = () => {
        this.socket = null;
        this.connection = null;
      };
    }).catch((error) => {
      this.connection = null;
      throw error;
    });
    return this.connection;
  }

  async request(payload) {
    const socket = await this.connect();
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(copy("Timeout risposta Recorder", "Recorder response timeout")));
      }, REQUEST_TIMEOUT);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, ...payload }));
    });
  }
}

const recorderBridge = new RecorderBridge0153();

export async function fetchHAStatistics0153(entityIds, startISO, endISO, period = "day") {
  const originals = [...new Set((Array.isArray(entityIds) ? entityIds : []).map(String).filter(Boolean))];
  if (!originals.length) return {};
  const resolvedByOriginal = new Map(
    originals.map((original) => [original, resolveStatisticsEntity(original)]),
  );
  const request = statisticsRequest0153(originals, startISO, endISO, period);
  const result = await recorderBridge.request(request);
  return Object.fromEntries(
    originals.map((original) => [original, result?.[resolvedByOriginal.get(original)] || []]),
  );
}

function installStatisticsOverride() {
  const previous = globalThis.fetchHAStatistics;
  if (typeof previous !== "function") return false;
  if (previous.__dm0153SafeStatistics) return true;

  async function safeFetchHAStatistics0153(entityIds, startISO, endISO, period = "day") {
    return fetchHAStatistics0153(entityIds, startISO, endISO, period);
  }
  safeFetchHAStatistics0153.__dm0153SafeStatistics = true;
  safeFetchHAStatistics0153.__dmPrevious = previous;
  globalThis.fetchHAStatistics = safeFetchHAStatistics0153;
  return true;
}

function periodRegistry() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  globalThis.CD_PERIOD ||= {};
  return globalThis.CD_PERIOD;
}

function canonicalReportDevices() {
  const modules = globalThis.DashboardModernModules;
  const store = modules?.store;
  const build = modules?.data?.canonicalReportDevices;
  if (!store?.getSection || typeof build !== "function") return [];
  return build(
    store.getSection("appliances") || [],
    store.getSection("loads") || [],
    globalThis.STATES || {},
  );
}

function monthRange(month, year, now = new Date()) {
  const safeMonth = Number.isInteger(+month) && +month >= 1 && +month <= 12 ? +month : now.getMonth() + 1;
  const safeYear = Number.isInteger(+year) && +year >= 2000 ? +year : now.getFullYear();
  const start = new Date(safeYear, safeMonth - 1, 1);
  const next = new Date(safeYear, safeMonth, 1);
  const end = next > now ? now : next;
  const baselineStart = new Date(start);
  baselineStart.setDate(baselineStart.getDate() - 2);
  return { start, end, baselineStart, month: safeMonth, year: safeYear };
}

const reportPeriodCache = new Map();

async function reportPeriodValues(month, year) {
  const devices = canonicalReportDevices();
  const ids = [...new Set(devices.map((device) => String(device.entity || "").trim()).filter(Boolean))];
  if (!ids.length) return new Map();
  const range = monthRange(month, year);
  if (range.end <= range.start) return new Map();
  const cacheKey = `${range.year}-${String(range.month).padStart(2, "0")}|${ids.join(",")}`;
  const cached = reportPeriodCache.get(cacheKey);
  if (cached && Date.now() - cached.at < REPORT_CACHE_MS) return cached.values;

  const rowsById = await fetchHAStatistics0153(
    ids,
    range.start.toISOString(),
    range.end.toISOString(),
    "day",
  );
  const needsBaseline = ids.filter((id) => periodValue0153(rowsById[id] || []) == null);
  let baselineById = {};
  if (needsBaseline.length) {
    baselineById = await fetchHAStatistics0153(
      needsBaseline,
      range.baselineStart.toISOString(),
      range.start.toISOString(),
      "day",
    );
  }

  const values = new Map();
  const registry = periodRegistry();
  ids.forEach((id) => {
    const baselineRows = (baselineById[id] || []).slice().sort((a, b) => rowTime(a) - rowTime(b));
    const value = periodValue0153(rowsById[id] || [], baselineRows.at(-1) || null);
    if (value == null) {
      delete registry[id];
      const resolved = resolveStatisticsEntity(id);
      if (resolved !== id) delete registry[resolved];
      return;
    }
    const rounded = Math.round(value * 1000) / 1000;
    values.set(id, rounded);
    values.set(resolveStatisticsEntity(id), rounded);
    registry[id] = rounded;
    registry[resolveStatisticsEntity(id)] = rounded;
  });
  reportPeriodCache.set(cacheKey, { at: Date.now(), values });
  return values;
}

function selectedMonthYear() {
  const now = new Date();
  const month = Number(globalThis.document?.getElementById?.("ed-sel-month")?.value);
  const year = Number(globalThis.document?.getElementById?.("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function wrapReportDeviceList() {
  const original = globalThis.renderEdDeviceList;
  if (typeof original !== "function") return false;
  if (original.__dm0153ReportPeriods) return true;

  async function renderEdDeviceList0153(month, year, isCurrentMonth, ...rest) {
    let values = new Map();
    try {
      values = await reportPeriodValues(month, year);
    } catch (error) {
      console.warn("[DashboardModern] Report device statistics", error);
    }

    const previousGetRawState = globalThis.getRawState;
    let replacement = null;
    if (isCurrentMonth && typeof previousGetRawState === "function" && values.size) {
      replacement = function getRawState0153(reference) {
        const key = String(reference || "");
        const resolved = resolveStatisticsEntity(key);
        const value = values.get(key) ?? values.get(resolved);
        if (value != null) return String(value);
        return previousGetRawState.apply(this, arguments);
      };
      replacement.__dm0153ReportValue = true;
      globalThis.getRawState = replacement;
    }

    try {
      return await original.call(this, month, year, isCurrentMonth, ...rest);
    } finally {
      if (replacement && globalThis.getRawState === replacement) {
        globalThis.getRawState = previousGetRawState;
      }
    }
  }

  renderEdDeviceList0153.__dm0153ReportPeriods = true;
  renderEdDeviceList0153.__dmPrevious = original;
  globalThis.renderEdDeviceList = renderEdDeviceList0153;
  return true;
}

function wrapReportDetail() {
  const original = globalThis.edCaricaDettaglio;
  if (typeof original !== "function") return false;
  if (original.__dm0153ReportPeriods) return true;

  async function edCaricaDettaglio0153(...args) {
    const { month, year } = selectedMonthYear();
    try {
      await reportPeriodValues(month, year);
    } catch (error) {
      console.warn("[DashboardModern] Report detail statistics", error);
    }
    return original.apply(this, args);
  }

  edCaricaDettaglio0153.__dm0153ReportPeriods = true;
  edCaricaDettaglio0153.__dmPrevious = original;
  globalThis.edCaricaDettaglio = edCaricaDettaglio0153;
  return true;
}

function applianceItems() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    if (Array.isArray(items)) return items;
  } catch (_error) {}
  return [];
}

function applianceType(item = {}) {
  return String(
    item.visual_key || item.device_type || item.type || item.icon || item.name || "generic",
  ).toLowerCase();
}

function applianceVisual(item = {}) {
  try {
    return globalThis.DashboardModernModules?.data?.getDeviceVisual?.(item) || null;
  } catch (_error) {
    return null;
  }
}

function normalizeApplianceMedia() {
  if (!globalThis.document) return;
  const items = applianceItems();
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  const cards = globalThis.document.querySelectorAll(
    "#appl-grid-overview .appl-wide-card, #page-appliances-main .appl-wide-card",
  );
  cards.forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
    if (!item) return;
    const visual = applianceVisual(item);
    const type = applianceType(item);
    card.dataset.dmMediaKind = visual?.kind || "icon";
    card.dataset.dmMediaType = type;
    if (visual?.kind === "asset") card.dataset.dmArtwork = String(visual.value || type);
    else card.removeAttribute("data-dm-artwork");

    const viewport = card.querySelector(".appl-visual");
    const media = viewport?.querySelector(".appl-ic");
    if (!viewport || !media) return;
    viewport.classList.add("dm-appliance-viewport-0153");
    media.classList.add("dm-appliance-media-0153");

    if (visual?.kind === "image" && visual.value) {
      let image = media.querySelector("img");
      if (!image) {
        image = globalThis.document.createElement("img");
        media.replaceChildren(image);
      }
      image.classList.add("dm-appliance-image", "dm-appliance-image-0153");
      if (image.getAttribute("src") !== visual.value) image.src = visual.value;
      image.alt = String(item.name || "");
      image.loading = "eager";
      image.decoding = "async";
    }
  });
}

function installMediaStyles() {
  const doc = globalThis.document;
  if (!doc || doc.getElementById("dm-energy-report-media-fixes-0153")) return;
  const style = doc.createElement("style");
  style.id = "dm-energy-report-media-fixes-0153";
  style.textContent = `
    html body #appl-grid-overview .appl-wide-card .appl-visual,
    html body #page-appliances-main .appl-wide-card .appl-visual {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      min-width: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    html body #appl-grid-overview .appl-wide-card .appl-visual .appl-ic,
    html body #page-appliances-main .appl-wide-card .appl-visual .appl-ic {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 100% !important;
      max-height: 100% !important;
      padding: clamp(8px, 1.6vw, 14px) !important;
      margin: 0 !important;
      overflow: hidden !important;
      transform: none !important;
      flex: 1 1 auto !important;
    }

    html body #appl-grid-overview .appl-wide-card[data-dm-media-kind="image"] .appl-ic img,
    html body #page-appliances-main .appl-wide-card[data-dm-media-kind="image"] .appl-ic img {
      display: block !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 100% !important;
      max-height: 100% !important;
      object-fit: contain !important;
      object-position: center !important;
      border-radius: 12px !important;
      transform: none !important;
    }

    html body #appl-grid-overview .appl-wide-card [data-dm-art],
    html body #page-appliances-main .appl-wide-card [data-dm-art] {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 100% !important;
      max-height: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: hidden !important;
      transform: none !important;
    }

    html body #appl-grid-overview .appl-wide-card [data-dm-art] > svg,
    html body #page-appliances-main .appl-wide-card [data-dm-art] > svg {
      display: block !important;
      box-sizing: border-box !important;
      width: 82% !important;
      height: 82% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 82% !important;
      max-height: 82% !important;
      object-fit: contain !important;
      object-position: center !important;
      transform: none !important;
      overflow: visible !important;
      flex: 0 0 82% !important;
    }
  `;
  doc.head.append(style);
}

function installMediaObserver() {
  const doc = globalThis.document;
  if (!doc?.documentElement || globalThis[FIX_FLAG]?.observer) return;
  let frame = 0;
  const schedule = () => {
    globalThis.cancelAnimationFrame?.(frame);
    frame = globalThis.requestAnimationFrame?.(normalizeApplianceMedia) ||
      globalThis.setTimeout(normalizeApplianceMedia, 0);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  globalThis[FIX_FLAG].observer = observer;
  schedule();
}

function installRuntimeFixes() {
  if (!globalThis[FIX_FLAG]) globalThis[FIX_FLAG] = { installed: true, version: "0.14.13-dev" };
  installStatisticsOverride();
  wrapReportDeviceList();
  wrapReportDetail();
  installMediaStyles();
  installMediaObserver();
  normalizeApplianceMedia();
}

if (typeof globalThis.document !== "undefined") {
  installRuntimeFixes();
  globalThis.queueMicrotask?.(installRuntimeFixes);
  globalThis.setTimeout?.(installRuntimeFixes, 0);
  globalThis.setTimeout?.(installRuntimeFixes, 120);
  const timer = globalThis.setInterval?.(() => {
    if (installStatisticsOverride() && wrapReportDeviceList() && wrapReportDetail()) {
      globalThis.clearInterval?.(timer);
    }
  }, 100);
  globalThis.setTimeout?.(() => globalThis.clearInterval?.(timer), 15000);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installRuntimeFixes, { once: true });
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installRuntimeFixes, { once: true });
  }
}
