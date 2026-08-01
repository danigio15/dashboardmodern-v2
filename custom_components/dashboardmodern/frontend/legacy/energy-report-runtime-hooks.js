/* DashboardModern: bridge the lexical legacy Report runtime to safe Recorder statistics. */
import {
  fetchHAStatistics0153,
  periodValue0153,
} from "./energy-monthly-report-media-fixes.js";

const HOOK_FLAG = "__DASHBOARDMODERN_ENERGY_REPORT_HOOKS__";
const CACHE_MS = 30000;
const cache = new Map();

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowTime(row) {
  const value = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeRecorderPayload0153(raw) {
  if (typeof raw !== "string") return raw;
  try {
    const message = JSON.parse(raw);
    if (message?.type !== "recorder/statistics_during_period" || !("types" in message)) {
      return raw;
    }
    delete message.types;
    return JSON.stringify(message);
  } catch (_error) {
    return raw;
  }
}

function installRecorderSanitizer() {
  const prototype = globalThis.WebSocket?.prototype;
  const previous = prototype?.send;
  if (typeof previous !== "function") return false;
  if (previous.__dm0153RecorderSanitizer) return true;

  function safeSend0153(raw) {
    return previous.call(this, sanitizeRecorderPayload0153(raw));
  }
  safeSend0153.__dm0153RecorderSanitizer = true;
  safeSend0153.__dmPrevious = previous;
  prototype.send = safeSend0153;
  return true;
}

function periodRegistry() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  globalThis.CD_PERIOD ||= {};
  return globalThis.CD_PERIOD;
}

function canonicalDevices() {
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

function resolveEntityId(entityId) {
  const original = String(entityId || "").trim();
  if (!original) return "";
  try {
    return String(globalThis.resolveEntity?.(original) || original).trim();
  } catch (_error) {
    return original;
  }
}

function selectedPeriod() {
  const now = new Date();
  const month = Number(globalThis.document?.getElementById?.("ed-sel-month")?.value);
  const year = Number(globalThis.document?.getElementById?.("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

function periodRange(month, year, now = new Date()) {
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const end = next > now ? now : next;
  const baselineStart = new Date(start);
  baselineStart.setDate(baselineStart.getDate() - 2);
  return { start, end, baselineStart };
}

export async function reportValues0153(month, year) {
  const devices = canonicalDevices();
  const ids = [...new Set(devices.map((device) => String(device.entity || "").trim()).filter(Boolean))];
  if (!ids.length) return new Map();

  const range = periodRange(month, year);
  if (range.end <= range.start) return new Map();
  const key = `${year}-${String(month).padStart(2, "0")}|${ids.join(",")}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.values;

  const rows = await fetchHAStatistics0153(
    ids,
    range.start.toISOString(),
    range.end.toISOString(),
    "day",
  );
  const needsBaseline = ids.filter((id) => periodValue0153(rows[id] || []) == null);
  let baselines = {};
  if (needsBaseline.length) {
    baselines = await fetchHAStatistics0153(
      needsBaseline,
      range.baselineStart.toISOString(),
      range.start.toISOString(),
      "day",
    );
  }

  const registry = periodRegistry();
  const values = new Map();
  ids.forEach((id) => {
    const baselineRows = (baselines[id] || []).slice().sort((a, b) => rowTime(a) - rowTime(b));
    const value = periodValue0153(rows[id] || [], baselineRows.at(-1) || null);
    const resolved = resolveEntityId(id);
    if (value == null) {
      delete registry[id];
      if (resolved !== id) delete registry[resolved];
      return;
    }
    const rounded = Math.round(value * 1000) / 1000;
    values.set(id, rounded);
    values.set(resolved, rounded);
    registry[id] = rounded;
    registry[resolved] = rounded;
  });
  cache.set(key, { at: Date.now(), values });
  return values;
}

function valueFor(values, entityId) {
  const original = String(entityId || "").trim();
  const value = values.get(original) ?? values.get(resolveEntityId(original));
  return Number.isFinite(value) ? value : null;
}

function sensorFromRow(row) {
  const source = String(row?.getAttribute?.("onclick") || "");
  const match = /apriStorico\s*\(\s*event\s*,\s*['\"]([^'\"]+)['\"]/.exec(source);
  return String(row?.dataset?.entity || row?.dataset?.sensor || match?.[1] || "").trim();
}

function parseLocalized(value) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^0-9.+-]/g, "");
  return numberOrNull(normalized);
}

function costPerKwh() {
  const text = String(globalThis.document?.getElementById?.("ed-dev-total")?.textContent || "");
  const kwh = parseLocalized(text.match(/([\d.,]+)\s*kWh/i)?.[1]);
  const match = /€\s*([\d.,]+)|([\d.,]+)\s*€/.exec(text);
  const euro = parseLocalized(match?.[1] || match?.[2]);
  return kwh != null && euro != null && kwh > 0 ? euro / kwh : 0;
}

function energySplit() {
  const registry = periodRegistry();
  const consumption = numberOrNull(registry["dm.energy_consumo_casa_mese"]);
  const grid = numberOrNull(registry["dm.energy_rete_acquistata_mese"]);
  if (consumption != null && consumption > 0 && grid != null) {
    const solar = Math.max(0, Math.min(1, (consumption - grid) / consumption));
    return { solar, grid: 1 - solar };
  }
  return { solar: 1, grid: 0 };
}

function patchList(values) {
  const doc = globalThis.document;
  const list = doc?.getElementById?.("ed-device-list");
  if (!list || !values.size) return false;
  const devices = canonicalDevices();
  const price = costPerKwh();
  const split = energySplit();
  const patched = [];

  list.querySelectorAll(".ed-device-row").forEach((row) => {
    let entity = sensorFromRow(row);
    let value = valueFor(values, entity);
    if (value == null) {
      const name = String(row.querySelector(".ed-dev-name")?.childNodes?.[0]?.textContent || "").trim();
      entity = devices.find((device) => String(device.name || "").trim() === name)?.entity || "";
      value = valueFor(values, entity);
    }
    if (value == null) return;

    row.dataset.dmPeriodValue = String(value);
    const valueNode = row.querySelector(".ed-dev-kwh");
    const html = `${value.toFixed(1)} <small style="font-size:10px;">kWh</small>`;
    if (valueNode && valueNode.innerHTML !== html) valueNode.innerHTML = html;

    const splitNodes = row.querySelectorAll(".ed-dev-name span");
    if (splitNodes[0]) splitNodes[0].textContent = `☀️ ${(value * split.solar).toFixed(1)} kWh`;
    if (splitNodes[1]) splitNodes[1].textContent = `🔌 ${(value * split.grid).toFixed(1)} kWh`;
    patched.push({ row, value });
  });

  if (!patched.length) return false;
  const maximum = Math.max(...patched.map((item) => item.value), 0);
  patched.forEach(({ row, value }) => {
    const percent = maximum > 0 ? (value / maximum) * 100 : 0;
    const bar = row.querySelector(".ed-dev-bar");
    if (bar) {
      bar.dataset.w = percent.toFixed(1);
      bar.style.width = `${percent.toFixed(1)}%`;
    }
  });

  const ordered = patched.slice().sort((left, right) => right.value - left.value).map((item) => item.row);
  const current = [...list.querySelectorAll(".ed-device-row")];
  if (ordered.some((row, index) => current[index] !== row)) ordered.forEach((row) => list.append(row));

  const totalKwh = patched.reduce((total, item) => total + item.value, 0);
  const totalNode = doc.getElementById("ed-dev-total");
  if (totalNode) {
    totalNode.innerHTML = price > 0
      ? `${totalKwh.toFixed(1)} kWh &nbsp;|&nbsp; € ${(totalKwh * price).toFixed(2)}`
      : `${totalKwh.toFixed(1)} kWh`;
  }
  if (totalKwh > 0) {
    list.querySelectorAll("div").forEach((node) => {
      if (/Long-Term Statistics|Statistiche a lungo termine/i.test(node.textContent || "")) node.remove();
    });
  }
  return true;
}

function patchDetail(values, month, year) {
  const doc = globalThis.document;
  const entity = String(doc?.getElementById?.("ed-dev-selector")?.value || "").trim();
  const value = valueFor(values, entity);
  if (value == null) return false;

  const now = new Date();
  const days = month === now.getMonth() + 1 && year === now.getFullYear()
    ? Math.max(1, now.getDate())
    : new Date(year, month, 0).getDate();
  const price = costPerKwh();
  const monthNode = doc.getElementById("ed-dkpi-mese");
  const costNode = doc.getElementById("ed-dkpi-mese-eur");
  const averageNode = doc.getElementById("ed-dkpi-media");
  if (monthNode) monthNode.textContent = `${value.toFixed(1)} kWh`;
  if (costNode && price > 0) costNode.textContent = `${(value * price).toFixed(2)} €`;
  if (averageNode) averageNode.textContent = `${(value / days).toFixed(2)} kWh`;
  return true;
}

export async function refreshReportHooks0153() {
  const state = globalThis[HOOK_FLAG];
  if (!state || state.refreshing) return false;
  state.refreshing = true;
  try {
    const { month, year } = selectedPeriod();
    const values = await reportValues0153(month, year);
    return patchList(values) || patchDetail(values, month, year) || values.size > 0;
  } catch (error) {
    console.warn("[DashboardModern] Report hook refresh", error);
    return false;
  } finally {
    state.refreshing = false;
  }
}

function scheduleRefresh(delay = 25) {
  const state = globalThis[HOOK_FLAG];
  if (!state) return;
  globalThis.clearTimeout?.(state.timer);
  state.timer = globalThis.setTimeout?.(refreshReportHooks0153, delay);
}

function installHooks() {
  const doc = globalThis.document;
  if (!doc) return;
  const state = (globalThis[HOOK_FLAG] ||= { installed: true, refreshing: false });
  installRecorderSanitizer();
  if (!state.observer && typeof globalThis.MutationObserver === "function") {
    state.observer = new globalThis.MutationObserver((mutations) => {
      if (state.refreshing) return;
      const relevant = mutations.some((mutation) => {
        if (mutation.target?.closest?.("#ed-device-list, #ed-pane-analisi")) return true;
        return [...(mutation.addedNodes || [])].some(
          (node) => node?.matches?.("#ed-device-list, #ed-pane-analisi, .ed-device-row") ||
            node?.querySelector?.("#ed-device-list, #ed-pane-analisi, .ed-device-row"),
        );
      });
      if (relevant) scheduleRefresh(30);
    });
    state.observer.observe(doc.documentElement, { childList: true, subtree: true });
  }
  if (!state.eventsInstalled) {
    state.eventsInstalled = true;
    doc.addEventListener(
      "change",
      (event) => {
        if (event.target?.matches?.("#ed-sel-month, #ed-sel-year, #ed-dev-selector")) {
          cache.clear();
          scheduleRefresh(40);
        }
      },
      true,
    );
    globalThis.addEventListener?.("dashboardmodern:energy-statistics", () => {
      cache.clear();
      scheduleRefresh(0);
    });
  }
  scheduleRefresh(80);
}

if (typeof globalThis.document !== "undefined") {
  installHooks();
  globalThis.queueMicrotask?.(installHooks);
  globalThis.setTimeout?.(installHooks, 0);
  globalThis.setTimeout?.(installHooks, 120);
  const timer = globalThis.setInterval?.(() => {
    installHooks();
    if (installRecorderSanitizer() && globalThis[HOOK_FLAG]?.observer) {
      globalThis.clearInterval?.(timer);
    }
  }, 100);
  globalThis.setTimeout?.(() => globalThis.clearInterval?.(timer), 15000);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installHooks, { once: true });
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installHooks, { once: true });
  }
}
