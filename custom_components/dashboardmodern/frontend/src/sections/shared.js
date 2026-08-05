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

export function dashboardStore() {
  return root.DashboardModernModules?.store || null;
}

export function section(name, fallback) {
  try {
    return dashboardStore()?.getSection?.(name) ?? fallback;
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
