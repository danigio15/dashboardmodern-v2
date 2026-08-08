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

const ENERGY_RUNTIME_FIELDS = Object.freeze({
  house: ["total_energy", "annual_energy", "monthly_energy", "daily_energy"],
  solar: ["total_energy", "annual_energy", "monthly_energy", "daily_energy"],
  grid: [
    "total_import_energy",
    "annual_import_energy",
    "monthly_import_energy",
    "daily_import_energy",
    "total_export_energy",
    "annual_export_energy",
    "monthly_export_energy",
    "daily_export_energy",
  ],
  battery: [
    "total_charged_energy",
    "annual_charged_energy",
    "monthly_charged_energy",
    "daily_charged_energy",
    "total_discharged_energy",
    "annual_discharged_energy",
    "monthly_discharged_energy",
    "daily_discharged_energy",
  ],
});

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

/**
 * Return a non-destructive runtime Energy projection.
 *
 * Old saved configurations may still contain entity ids that no longer exist
 * in Home Assistant. They must not block the period planner from selecting a
 * working Recorder source. This function only removes those stale references
 * from the in-memory projection; it never invents a lifetime source and never
 * rewrites the user's persisted configuration. Period-specific fallback is
 * deliberately owned by sourcePlans(), where day/month/year context is known.
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
