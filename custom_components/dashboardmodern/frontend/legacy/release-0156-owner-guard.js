/* DashboardModern 0.14.16: final owner for current and historical period values. */
const FINAL_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const OWNER_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_OWNER_GUARD__";
const CURRENT_SLOTS_0156 = Object.freeze([
  "dm.energy_consumo_casa_mese",
  "dm.energy_produzione_solare_mese",
  "dm.energy_rete_acquistata_mese",
  "dm.energy_rete_venduta_mese",
  "dm.energy_batteria_caricata_mese",
  "dm.energy_batteria_usata_mese",
]);
const ENERGY_SOURCES_0156 = Object.freeze([
  ["cons", "house", ["total_energy", "annual_energy", "monthly_energy"]],
  ["prelevato", "grid", ["total_import_energy", "annual_import_energy", "monthly_import_energy"]],
  ["immesso", "grid", ["total_export_energy", "annual_export_energy", "monthly_export_energy"]],
  ["prod", "solar", ["total_energy", "annual_energy", "monthly_energy"]],
  ["batCar", "battery", ["total_charged_energy", "annual_charged_energy", "monthly_charged_energy"]],
  ["batScar", "battery", ["total_discharged_energy", "annual_discharged_energy", "monthly_discharged_energy"]],
]);

function ownerState0156() {
  return (globalThis[OWNER_KEY_0156] ||= {
    installed: true,
    timer: 0,
    overviewTimer: 0,
    refreshingCurrent: false,
    overviewGeneration: 0,
    deviceGeneration: 0,
  });
}

function registry0156() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  return (globalThis.CD_PERIOD ||= {});
}

function rawState0156(slot) {
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[slot]) return _RAW_STATES[slot];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[slot] || globalThis.STATES?.[slot] || null;
}

function restoreCurrentSlots0156() {
  const values = registry0156();
  let restored = false;
  CURRENT_SLOTS_0156.forEach((slot) => {
    const state = rawState0156(slot);
    if (!state?.attributes?.dashboardmodern_derived || !state?.attributes?.dashboardmodern_source) return;
    const value = Number(state.state);
    if (!Number.isFinite(value)) return;
    if (Number(values[slot]) !== value) values[slot] = value;
    restored = true;
  });
  return restored;
}

async function refreshCurrent0156() {
  const state = ownerState0156();
  const runtime = globalThis[FINAL_KEY_0156];
  if (state.refreshingCurrent || typeof runtime?.refreshCurrent !== "function") {
    return restoreCurrentSlots0156();
  }
  state.refreshingCurrent = true;
  try {
    await runtime.refreshCurrent();
    return restoreCurrentSlots0156();
  } catch (error) {
    console.warn("[DashboardModern] final current-period owner", error);
    return false;
  } finally {
    state.refreshingCurrent = false;
  }
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

function rowTime0156(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

function cumulative0156(row) {
  for (const key of ["sum", "state", "max"]) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function periodValue0156(rows = [], baseline = null) {
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTime0156(left) - rowTime0156(right));
  const changes = ordered
    .map((row) => Number(row?.change))
    .filter((value) => Number.isFinite(value));
  if (changes.length) return Math.max(0, changes.reduce((total, value) => total + value, 0));
  const values = ordered.map(cumulative0156).filter((value) => value != null);
  const base = cumulative0156(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];
    total += difference >= 0 ? difference : Math.max(0, values[index]);
  }
  return Math.max(0, total);
}

function monthRange0156(month, year) {
  const now = new Date();
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  // Recorder's end is exclusive. For a closed historical month use the last
  // millisecond before the next month, leaving an exact first-of-month end only
  // for the baseline request. This prevents the two requests being conflated.
  const end = next > now ? now : new Date(next.getTime() - 1);
  const baselineStart = new Date(start);
  baselineStart.setDate(baselineStart.getDate() - 2);
  return { start, end, baselineStart };
}

async function statistics0156(ids, start, end) {
  const runtime = globalThis[FINAL_KEY_0156];
  if (typeof runtime?.statistics !== "function") return {};
  return runtime.statistics(ids, start, end, "day");
}

async function monthValues0156(ids, month, year) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  const range = monthRange0156(month, year);
  if (!unique.length || range.end <= range.start) return new Map();
  const rows = await statistics0156(unique, range.start, range.end);
  const unresolved = unique.filter((id) => periodValue0156(rows[id] || []) == null);
  const baselines = unresolved.length
    ? await statistics0156(unresolved, range.baselineStart, range.start)
    : {};
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

function energySources0156() {
  let energy = {};
  try {
    energy = globalThis.DashboardModernModules?.store?.getSection?.("energy") || {};
  } catch (_error) {}
  return ENERGY_SOURCES_0156.map(([key, groupName, fields]) => {
    const group = energy[groupName] || {};
    const entity = fields
      .map((field) => String(group[field] || "").trim())
      .find(Boolean) || "";
    return { key, entity };
  }).filter((source) => source.entity);
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

function patchOverview0156(data) {
  const prod = Number(data?.prod) || 0;
  const cons = Number(data?.cons) || 0;
  const grid = Number(data?.prelevato) || 0;
  const auto = cons > 0
    ? Math.max(0, Math.min(100, Math.round(((cons - grid) / cons) * 100)))
    : 0;
  const set = (id, html) => {
    const node = globalThis.document?.getElementById?.(id);
    if (node) node.innerHTML = html;
  };
  set("ed-kpi-prod", `${prod.toFixed(1)} <small>kWh</small>`);
  set("ed-kpi-cons", `${cons.toFixed(1)} <small>kWh</small>`);
  set("ed-kpi-auto", `${auto} <small>%</small>`);
}

async function refreshOverview0156() {
  const state = ownerState0156();
  const generation = ++state.overviewGeneration;
  const selected = selectedReportPeriod0156();
  const sources = energySources0156();
  try {
    const values = await monthValues0156(
      sources.map((source) => source.entity),
      selected.month,
      selected.year,
    );
    if (generation !== state.overviewGeneration) return false;
    const data = Object.fromEntries(
      sources.map((source) => [
        source.key,
        values.get(source.entity) ?? values.get(resolveEntity0156(source.entity)) ?? 0,
      ]),
    );
    patchOverview0156(data);
    globalThis.__DASHBOARDMODERN_REPORT_PERIOD__ = { ...selected, values: data };
    return true;
  } catch (error) {
    console.warn("[DashboardModern] final Report-period owner", error);
    return false;
  }
}

function scheduleOverview0156(delay = 0) {
  const state = ownerState0156();
  globalThis.clearTimeout?.(state.overviewTimer);
  state.overviewTimer = globalThis.setTimeout?.(() => refreshOverview0156(), delay);
}

function canonicalDevices0156() {
  try {
    const modules = globalThis.DashboardModernModules;
    return modules?.data?.canonicalReportDevices?.(
      modules.store.getSection("appliances") || [],
      modules.store.getSection("loads") || [],
      globalThis.STATES || {},
    ) || [];
  } catch (_error) {
    return [];
  }
}

function rowEntity0156(row, devices) {
  const direct = String(row?.dataset?.entity || row?.dataset?.sensor || "").trim();
  if (direct) return direct;
  const match = /apriStorico\s*\(\s*event\s*,\s*['\"]([^'\"]+)/.exec(
    row?.getAttribute?.("onclick") || "",
  );
  if (match?.[1]) return match[1];
  const name = String(row?.querySelector?.(".ed-dev-name")?.childNodes?.[0]?.textContent || "").trim();
  return String(devices.find((device) => String(device.name || "").trim() === name)?.entity || "");
}

function patchDeviceRows0156(values) {
  const listNode = globalThis.document?.getElementById?.("ed-device-list");
  if (!listNode) return;
  const devices = canonicalDevices0156();
  let total = 0;
  listNode.querySelectorAll(".ed-device-row").forEach((row) => {
    const entity = rowEntity0156(row, devices);
    const value = values.get(entity) ?? values.get(resolveEntity0156(entity));
    if (!Number.isFinite(value)) return;
    total += value;
    row.dataset.entity = entity;
    row.dataset.dmPeriodValue = String(value);
    const node = row.querySelector(".ed-dev-kwh");
    if (node) node.innerHTML = `${value.toFixed(1)} <small style="font-size:10px">kWh</small>`;
  });
  const totalNode = globalThis.document?.getElementById?.("ed-dev-total");
  if (totalNode) totalNode.textContent = `${total.toFixed(1)} kWh`;
}

function wrapDeviceRenderer0156() {
  const current = globalThis.renderEdDeviceList;
  if (typeof current !== "function" || current.__dm0156OwnerGuardDevices) return false;

  async function ownerDeviceRenderer0156(month, year, ...rest) {
    const state = ownerState0156();
    const generation = ++state.deviceGeneration;
    const result = await current.call(this, month, year, ...rest);
    const devices = canonicalDevices0156();
    const ids = [...new Set(devices.map((device) => String(device.entity || "").trim()).filter(Boolean))];
    try {
      const values = await monthValues0156(ids, month, year);
      if (generation === state.deviceGeneration) patchDeviceRows0156(values);
    } catch (error) {
      console.warn("[DashboardModern] final historical device owner", error);
    }
    return result;
  }

  ownerDeviceRenderer0156.__dm0156OwnerGuardDevices = true;
  ownerDeviceRenderer0156.__dmPrevious = current;
  globalThis.renderEdDeviceList = ownerDeviceRenderer0156;
  return true;
}

function wrapLateWriter0156(name) {
  const current = globalThis[name];
  if (typeof current !== "function" || current.__dm0156OwnerGuard) return false;

  function guardedLateWriter0156(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      if (!restoreCurrentSlots0156()) refreshCurrent0156();
    };
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }

  guardedLateWriter0156.__dm0156OwnerGuard = true;
  guardedLateWriter0156.__dmPrevious = current;
  globalThis[name] = guardedLateWriter0156;
  return true;
}

function wrapReportRenderer0156() {
  const current = globalThis.renderEnergyDashboard;
  if (typeof current !== "function" || current.__dm0156OwnerGuard) return false;

  function guardedReportRenderer0156(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      restoreCurrentSlots0156();
      scheduleOverview0156(0);
    };
    if (result && typeof result.finally === "function") return result.finally(finish);
    globalThis.queueMicrotask?.(finish);
    return result;
  }

  guardedReportRenderer0156.__dm0156OwnerGuard = true;
  guardedReportRenderer0156.__dmPrevious = current;
  globalThis.renderEnergyDashboard = guardedReportRenderer0156;
  return true;
}

function installWrappers0156() {
  wrapLateWriter0156("cdDeriveFromTotals");
  wrapLateWriter0156("cdRefreshPeriodDeltas");
  wrapReportRenderer0156();
  wrapDeviceRenderer0156();
}

function reinforce0156() {
  installWrappers0156();
  refreshCurrent0156();
  scheduleOverview0156(0);
}

function install0156() {
  const state = ownerState0156();
  reinforce0156();
  if (!state.eventsInstalled) {
    state.eventsInstalled = true;
    globalThis.document?.addEventListener?.(
      "change",
      (event) => {
        if (!event.target?.matches?.("#ed-sel-month, #ed-sel-year")) return;
        state.overviewGeneration += 1;
        state.deviceGeneration += 1;
        scheduleOverview0156(10);
        globalThis.setTimeout?.(() => scheduleOverview0156(0), 160);
        globalThis.setTimeout?.(() => scheduleOverview0156(0), 500);
      },
      true,
    );
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", reinforce0156);
    globalThis.addEventListener?.("pageshow", reinforce0156);
  }

  globalThis.clearInterval?.(state.timer);
  let attempts = 0;
  state.timer = globalThis.setInterval?.(() => {
    attempts += 1;
    installWrappers0156();
    restoreCurrentSlots0156();
    if (
      attempts >= 80 ||
      (globalThis.cdDeriveFromTotals?.__dm0156OwnerGuard &&
        globalThis.cdRefreshPeriodDeltas?.__dm0156OwnerGuard &&
        globalThis.renderEnergyDashboard?.__dm0156OwnerGuard &&
        globalThis.renderEdDeviceList?.__dm0156OwnerGuardDevices)
    ) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") install0156();