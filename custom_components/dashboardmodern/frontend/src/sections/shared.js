// DM-FIX-20260812B
import { canonicalClimateType } from "../core/device-model.js";

export const root = globalThis;
export const doc = root.document;

export const clean = (value) => String(value ?? "").trim();
export const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const finiteOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
export const english = () => {
  const lang = clean(doc?.documentElement?.lang).toLowerCase();
  const path = clean(root.location?.pathname).toLowerCase();
  return lang === "en" || lang.startsWith("en-") || /dashboard-en\.html$/.test(path);
};
export const locale = () => (english() ? "en-US" : "it-IT");
export const t = (it, en) => (english() ? en : it);
export const esc = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

export function readClimateUnits() {
  let values;
  try {
    const raw = root.localStorage?.getItem?.("cd_clima_units");
    if (raw !== null && raw !== undefined) values = JSON.parse(raw);
  } catch (_error) {
    values = [];
  }
  if (!Array.isArray(values)) values = root.getClimaUnits?.().slice?.() || [];
  return values.map((item) => ({ ...item, type: canonicalClimateType(item?.type) }));
}

const ENERGY_RUNTIME_SOURCES = Object.freeze([
  {
    group: "house",
    totalKey: "total_energy",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
    fallbackKeys: ["annual_energy", "daily_energy"],
  },
  {
    group: "solar",
    totalKey: "total_energy",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
    fallbackKeys: ["annual_energy", "daily_energy"],
  },
  {
    group: "grid",
    totalKey: "total_import_energy",
    periodKeys: ["annual_import_energy", "monthly_import_energy", "daily_import_energy"],
    fallbackKeys: ["annual_import_energy", "daily_import_energy"],
  },
  {
    group: "grid",
    totalKey: "total_export_energy",
    periodKeys: ["annual_export_energy", "monthly_export_energy", "daily_export_energy"],
    fallbackKeys: ["annual_export_energy", "daily_export_energy"],
  },
  {
    group: "battery",
    totalKey: "total_charged_energy",
    periodKeys: ["annual_charged_energy", "monthly_charged_energy", "daily_charged_energy"],
    fallbackKeys: ["annual_charged_energy", "daily_charged_energy"],
  },
  {
    group: "battery",
    totalKey: "total_discharged_energy",
    periodKeys: [
      "annual_discharged_energy",
      "monthly_discharged_energy",
      "daily_discharged_energy",
    ],
    fallbackKeys: ["annual_discharged_energy", "daily_discharged_energy"],
  },
]);

const ENERGY_RUNTIME_FIELDS = Object.freeze(
  Object.fromEntries(
    ["house", "solar", "grid", "battery"].map((group) => [
      group,
      [...new Set(
        ENERGY_RUNTIME_SOURCES.filter((source) => source.group === group).flatMap((source) => [
          source.totalKey,
          ...source.periodKeys,
        ]),
      )],
    ]),
  ),
);

function resolveConfiguredEntity(reference, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return "";
  try {
    return clean(resolver?.(original) || original);
  } catch (_error) {
    return original;
  }
}

function entityExists(reference, states = {}, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return false;
  if (original.startsWith("dm.")) return true;
  const resolved = resolveConfiguredEntity(original, resolver);
  return Boolean(states?.[original] || states?.[resolved]);
}

function cumulativeEntity(reference, states = {}, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return false;
  const resolved = resolveConfiguredEntity(original, resolver);
  const current = states?.[resolved] || states?.[original];
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  return stateClass === "total" || stateClass === "total_increasing";
}

/**
 * Return a non-destructive runtime Energy projection.
 *
 * Old saved configurations may still contain entity ids that no longer exist
 * in Home Assistant. They must not block Recorder fallback, so stale refs are
 * removed only from this in-memory projection. If a dedicated lifetime meter
 * is missing, an existing annual helper is preferred as a virtual cumulative
 * Recorder source; a daily helper is the last fallback. The monthly helper is
 * deliberately never promoted to Total here, so a valid explicit monthly
 * sensor remains authoritative for the current month.
 */
export function sanitizeEnergyModel(value = {}, states = allStates(), resolver = root.resolveEntity) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const snapshot = states && typeof states === "object" ? states : {};
  if (!Object.keys(snapshot).length) return value;

  let result = value;
  let changed = false;
  const ensureGroup = (group) => {
    if (!changed) {
      result = { ...value };
      changed = true;
    }
    if (result[group] === value[group]) result[group] = { ...(value[group] || {}) };
    else if (!result[group]) result[group] = {};
    return result[group];
  };

  for (const [group, keys] of Object.entries(ENERGY_RUNTIME_FIELDS)) {
    for (const key of keys) {
      const reference = clean(value[group]?.[key]);
      if (!reference || entityExists(reference, snapshot, resolver)) continue;
      ensureGroup(group)[key] = "";
    }
  }

  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = result[source.group] || value[source.group] || {};
    const total = clean(group[source.totalKey]);
    if (total && entityExists(total, snapshot, resolver)) continue;
    const fallback = source.fallbackKeys
      .map((key) => clean(group[key]))
      .find(
        (reference) =>
          entityExists(reference, snapshot, resolver) &&
          cumulativeEntity(reference, snapshot, resolver),
      );
    if (fallback) ensureGroup(source.group)[source.totalKey] = fallback;
  }

  return result;
}

export function dashboardStore() {
  return root.DashboardModernModules?.store || null;
}

export function section(name, fallback) {
  try {
    const value = dashboardStore()?.getSection?.(name) ?? fallback;
    return name === "energy" ? sanitizeEnergyModel(value, allStates(), root.resolveEntity) : value;
  } catch (_error) {
    return fallback;
  }
}

export function allStates() {
  // Hosted Home Assistant surfaces do not all expose the live registry through
  // the same object at the same moment. Merge every supported source instead of
  // making the period engine and the compatibility layer observe different
  // universes on Chrome vs the HA mobile WebView.
  const values = {
    ...(root.__HASS__?.states || {}),
    ...(root.hass?.states || {}),
  };
  for (const name of ["_RAW_STATES", "STATES"]) {
    let lexical = null;
    try {
      lexical = root.eval?.(`typeof ${name} !== "undefined" && ${name} ? ${name} : null`);
    } catch (_error) {}
    if (lexical && typeof lexical === "object") {
      Object.assign(values, lexical);
      continue;
    }
    if (root[name] && typeof root[name] === "object") Object.assign(values, root[name]);
  }
  return values;
}

export function readJson(key, fallback) {
  try {
    return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

export function writeJsonIfChanged(key, value, { sync = true } = {}) {
  const serialized = JSON.stringify(value);
  if (root.localStorage?.getItem(key) === serialized) return false;
  root.localStorage?.setItem(key, serialized);
  if (sync) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  return true;
}

export function installStyle(id, css) {
  if (!doc?.head || doc.getElementById(id)) return false;
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = css;
  doc.head.append(style);
  return true;
}

export function afterResult(result, callback) {
  if (result && typeof result.finally === "function") return result.finally(callback);
  callback();
  return result;
}

export function wrapFunction(name, marker, callback) {
  const current = root[name];
  if (typeof current !== "function" || current[marker]) return false;
  function wrapped(...args) {
    return afterResult(current.apply(this, args), () => root.queueMicrotask?.(callback));
  }
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

export function selectedPeriod() {
  const now = new Date();
  const month = Number(doc?.getElementById("ed-sel-month")?.value);
  const year = Number(doc?.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

export function formatNumber(value, digits = 1) {
  return finite(value).toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
