/* DashboardModern 0.14.17: completed months end inside the month, not at the next baseline boundary. */
const MONTH_FIX_KEY_0157 = "__DASHBOARDMODERN_RELEASE_0157_MONTH_RANGE_FIX__";
const FINAL_MONTH_RUNTIME_0157 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";

function time0157(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

function cumulative0157(row) {
  for (const key of ["sum", "state", "max"]) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function periodValue0157(rows, baseline) {
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => time0157(left) - time0157(right));
  const changes = ordered
    .map((row) => row?.change)
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);
  if (changes.length) return Math.max(0, changes.reduce((total, value) => total + value, 0));
  const values = ordered.map(cumulative0157).filter((value) => value != null);
  const base = cumulative0157(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    total += delta >= 0 ? delta : Math.max(0, values[index]);
  }
  return Math.max(0, total);
}

function resolved0157(entity) {
  const original = String(entity || "").trim();
  try { return String(globalThis.resolveEntity?.(original) || original).trim(); }
  catch (_error) { return original; }
}

function monthRange0157(month, year) {
  const now = new Date();
  const safeMonth = Number.isInteger(+month) && +month >= 1 && +month <= 12
    ? +month
    : now.getMonth() + 1;
  const safeYear = Number.isInteger(+year) && +year >= 2000 ? +year : now.getFullYear();
  const start = new Date(safeYear, safeMonth - 1, 1);
  const next = new Date(safeYear, safeMonth, 1);
  // A completed month must not end exactly at 00:00 of the next month: that
  // timestamp is reserved for the cumulative baseline request.
  const end = next > now ? now : new Date(next.getTime() - 1);
  const baselineStart = new Date(start);
  baselineStart.setDate(baselineStart.getDate() - 2);
  return { start, end, baselineStart };
}

function installMonthRangeFix0157() {
  const runtime = globalThis[FINAL_MONTH_RUNTIME_0157];
  if (!runtime || typeof runtime.statistics !== "function") return false;
  if (runtime.monthValues?.__dm0157MonthBoundary) return true;

  async function monthValuesBoundary0157(ids, month, year) {
    const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
    const dates = monthRange0157(month, year);
    if (!unique.length || dates.end <= dates.start) return new Map();
    const rows = await runtime.statistics(unique, dates.start, dates.end, "day");
    const unresolved = unique.filter((id) => periodValue0157(rows[id] || []) == null);
    const baselines = unresolved.length
      ? await runtime.statistics(unresolved, dates.baselineStart, dates.start, "day")
      : {};
    const values = new Map();
    unique.forEach((id) => {
      const baselineRows = (baselines[id] || [])
        .slice()
        .sort((left, right) => time0157(left) - time0157(right));
      const value = periodValue0157(rows[id] || [], baselineRows.at(-1) || null);
      if (value == null) return;
      const rounded = Math.round(value * 1000) / 1000;
      values.set(id, rounded);
      values.set(resolved0157(id), rounded);
    });
    return values;
  }

  monthValuesBoundary0157.__dm0157MonthBoundary = true;
  monthValuesBoundary0157.__dmPrevious = runtime.monthValues;
  runtime.monthValues = monthValuesBoundary0157;
  globalThis[MONTH_FIX_KEY_0157] = { installed: true, monthValues: monthValuesBoundary0157 };
  return true;
}

if (!installMonthRangeFix0157()) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (installMonthRangeFix0157() || attempts >= 20) clearInterval(timer);
  }, 50);
}
