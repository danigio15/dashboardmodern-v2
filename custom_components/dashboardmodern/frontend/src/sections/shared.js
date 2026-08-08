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

const ENERGY_RUNTIME_SOURCES = Object.freeze([
  {
    group: "house",
    totalKey: "total_energy",
    totalSlot: "dm.core_043",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
  },
  {
    group: "solar",
    totalKey: "total_energy",
    totalSlot: "dm.core_046",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
  },
  {
    group: "grid",
    totalKey: "total_import_energy",
    totalSlot: "dm.core_045",
    periodKeys: ["annual_import_energy", "monthly_import_energy", "daily_import_energy"],
  },
  {
    group: "grid",
    totalKey: "total_export_energy",
    totalSlot: "dm.core_044",
    periodKeys: ["annual_export_energy", "monthly_export_energy", "daily_export_energy"],
  },
  {
    group: "battery",
    totalKey: "total_charged_energy",
    totalSlot: "dm.core_041",
    periodKeys: ["annual_charged_energy", "monthly_charged_energy", "daily_charged_energy"],
  },
  {
    group: "battery",
    totalKey: "total_discharged_energy",
    totalSlot: "dm.core_042",
    periodKeys: [
      "annual_discharged_energy",
      "monthly_discharged_energy",
      "daily_discharged_energy",
    ],
  },
]);

const ENERGY_PERIOD_KEYS = Object.freeze(
  Object.fromEntries(
    ["house", "solar", "grid", "battery"].map((group) => [
      group,
      [...new Set(
        ENERGY_RUNTIME_SOURCES.filter((source) => source.group === group).flatMap(
          (source) => source.periodKeys,
        ),
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
  const resolved = resolveConfiguredEntity(original, resolver);
  return Boolean(states?.[original] || states?.[resolved]);
}

function cumulativeEntity(reference, states = {}, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return false;
  const resolved = resolveConfiguredEntity(original, resolver);
  const state = states?.[resolved] || states?.[original];
  const stateClass = clean(state?.attributes?.state_class).toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  if (state) return false;
  return /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(original);
}

/**
 * Return the Energy model that the live runtime should use.
 *
 * Old configurations can retain period entity ids that no longer exist. Those
 * references must not block Recorder fallback. Also, Home Assistant utility
 * meters with state_class total/total_increasing are valid reset-aware Recorder
 * sources: when a dedicated lifetime field is empty, an existing cumulative
 * day/month/year helper can provide the same sum-growth calculation for the
 * selected month and year.
 *
 * This is a runtime projection only. The persisted user configuration is never
 * rewritten here.
 */
export function sanitizeEnergyModel(
  value = {},
  states = allStates(),
  resolver = root.resolveEntity,
  overrides = {},
) {
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

  for (const [group, keys] of Object.entries(ENERGY_PERIOD_KEYS)) {
    for (const key of keys) {
      const reference = clean(value[group]?.[key]);
      if (!reference || reference.startsWith("dm.")) continue;
      if (!entityExists(reference, snapshot, resolver)) ensureGroup(group)[key] = "";
    }
  }

  for (const source of ENERGY_RUNTIME_SOURCES) {
    const originalGroup = result[source.group] || value[source.group] || {};
    const configuredTotal = clean(originalGroup[source.totalKey]);
    if (configuredTotal && entityExists(configuredTotal, snapshot, resolver)) continue;

    const overrideTotal = clean(overrides?.[source.totalSlot]);
    const candidates = [
      overrideTotal,
      ...source.periodKeys.map((key) => clean(originalGroup[key])),
    ].filter(Boolean);
    const fallback = candidates.find(
      (reference) =>
        entityExists(reference, snapshot, resolver) &&
        cumulativeEntity(reference, snapshot, resolver),
    );
    if (fallback && fallback !== configuredTotal) ensureGroup(source.group)[source.totalKey] = fallback;
  }

  return result;
}

export function dashboardStore() {
  return root.DashboardModernModules?.store || null;
}

export function section(name, fallback) {
  try {
    const store = dashboardStore();
    const value = store?.getSection?.(name) ?? fallback;
    if (name !== "energy") return value;
    const overrides = store?.getSection?.("entityOverrides") || {};
    return sanitizeEnergyModel(value, allStates(), root.resolveEntity, overrides);
  } catch (_error) {
    return fallback;
  }
}

export function allStates() {
  const values = {};
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
