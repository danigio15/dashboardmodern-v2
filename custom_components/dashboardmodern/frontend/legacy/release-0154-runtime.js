/* DashboardModern 0.14.14: real cumulative periods and unified appliance artwork. */
import {
  PERIOD_SOURCES_0152,
  periodConsumption0152,
  periodRange0152,
} from "./release-0152-runtime.js";

const RELEASE_FLAG = "__DASHBOARDMODERN_RELEASE_0154__";
const STYLE_ID = "dm-release-0154-runtime-styles";
const REQUEST_TIMEOUT = 18000;
const REFRESH_EVENT = "dashboardmodern:energy-periods-0154";
const OLD_REFRESH_EVENT = "dashboardmodern:energy-statistics";

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEnglish() {
  return globalThis.document?.documentElement?.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

function resolveRuntimeEntity(reference, resolver = globalThis.resolveEntity) {
  const original = String(reference || "").trim();
  if (!original) return "";
  try {
    const resolved = resolver?.(original);
    return String(resolved || original).trim();
  } catch (_error) {
    return original;
  }
}

function legacyOverrides() {
  try {
    if (typeof ENTITY_OVERRIDES !== "undefined" && ENTITY_OVERRIDES) return ENTITY_OVERRIDES;
  } catch (_error) {}
  return globalThis.ENTITY_OVERRIDES || {};
}

function runtimeStateRegistries() {
  const registries = [];
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) registries.push(_RAW_STATES);
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES) registries.push(STATES);
  } catch (_error) {}
  if (globalThis._RAW_STATES) registries.push(globalThis._RAW_STATES);
  if (globalThis.STATES) registries.push(globalThis.STATES);
  return [...new Set(registries)];
}

function runtimeStatesObject() {
  const merged = {};
  runtimeStateRegistries().forEach((registry) => Object.assign(merged, registry || {}));
  return merged;
}

function stateForEntity(entity, states = runtimeStatesObject(), resolver = globalThis.resolveEntity) {
  const original = String(entity || "").trim();
  const resolved = resolveRuntimeEntity(original, resolver);
  return states?.[resolved] || states?.[original] || null;
}

export function isCumulativeEnergyEntity0154(
  entity,
  states = {},
  resolver = (value) => value,
) {
  const original = String(entity || "").trim();
  if (!original) return false;
  const resolved = resolveRuntimeEntity(original, resolver);
  const state = stateForEntity(original, states, resolver);
  const attributes = state?.attributes || {};
  const stateClass = String(attributes.state_class || "").toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  const text = `${original} ${resolved} ${attributes.friendly_name || ""}`.toLowerCase();
  return /(^|[\s._-])(total|totale|lifetime|counter|contatore)([\s._-]|$)/.test(text);
}

function legacySourceForSlot(slot, overrides = legacyOverrides(), resolver = globalThis.resolveEntity) {
  const mapped = String(overrides?.[slot] || "").trim();
  if (mapped) return mapped;
  const resolved = resolveRuntimeEntity(slot, resolver);
  return resolved && resolved !== slot ? resolved : "";
}

export function periodPlans0154(
  energy = {},
  kind = "month",
  states = {},
  overrides = {},
  resolver = (value) => value,
) {
  return PERIOD_SOURCES_0152.flatMap((definition) => {
    const target = definition.periods[kind];
    if (!target) return [];
    const group = energy?.[definition.group] || {};
    const explicit = String(group[target.explicitKey] || "").trim();
    const total = String(group[definition.totalKey] || "").trim();
    const legacy = legacySourceForSlot(target.slot, overrides, resolver);

    let source = "";
    let reason = "";
    if (explicit) {
      const cumulative =
        explicit === total || isCumulativeEnergyEntity0154(explicit, states, resolver);
      if (!cumulative) return [];
      source = explicit;
      reason = "explicit-cumulative";
    } else if (total) {
      source = total;
      reason = "canonical-total";
    } else if (legacy && isCumulativeEnergyEntity0154(legacy, states, resolver)) {
      source = legacy;
      reason = "legacy-cumulative";
    }

    if (!source) return [];
    return [
      {
        kind,
        group: definition.group,
        slot: target.slot,
        source,
        entity: resolveRuntimeEntity(source, resolver),
        reason,
      },
    ];
  });
}

function periodRegistry() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  globalThis.CD_PERIOD ||= {};
  return globalThis.CD_PERIOD;
}

function setDerivedPeriod(plan, value, selected) {
  if (!plan?.slot || !Number.isFinite(value)) return;
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  periodRegistry()[plan.slot] = rounded;
  const timestamp = new Date().toISOString();
  const state = {
    entity_id: plan.slot,
    state: String(rounded),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      friendly_name: plan.slot,
      dashboardmodern_derived: true,
      dashboardmodern_source: plan.entity,
      dashboardmodern_source_reason: plan.reason,
      dashboardmodern_period: plan.kind,
      dashboardmodern_selected: selected.toISOString(),
      dashboardmodern_version: "0.14.14",
    },
    last_updated: timestamp,
    last_changed: timestamp,
  };
  runtimeStateRegistries().forEach((registry) => {
    registry[plan.slot] = state;
  });
}

function clearDerivedPeriod(slot) {
  if (!slot) return;
  try {
    delete periodRegistry()[slot];
  } catch (_error) {}
}

function selectedPeriodDate() {
  const now = new Date();
  const monthElement =
    globalThis.document?.getElementById?.("ed-sel-month") ||
    globalThis.document?.querySelector?.('select[id*="month"],select[id*="mese"]');
  const yearElement =
    globalThis.document?.getElementById?.("ed-sel-year") ||
    globalThis.document?.querySelector?.('select[id*="year"],select[id*="anno"]');
  const rawMonth = Number(monthElement?.value);
  const rawYear = Number(yearElement?.value || yearElement?.selectedOptions?.[0]?.textContent);
  const month =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth - 1
      : Number.isInteger(rawMonth) && rawMonth >= 0 && rawMonth <= 11
        ? rawMonth
        : now.getMonth();
  const year = Number.isInteger(rawYear) && rawYear >= 2000 ? rawYear : now.getFullYear();
  return new Date(year, month, 1);
}

function baselineRange(kind, start) {
  const baselineStart = new Date(start);
  if (kind === "day") baselineStart.setHours(baselineStart.getHours() - 2);
  else if (kind === "year") baselineStart.setMonth(baselineStart.getMonth() - 1);
  else baselineStart.setDate(baselineStart.getDate() - 2);
  return { start: baselineStart, end: new Date(start) };
}

class StatisticsSocket0154 {
  constructor() {
    this.socket = null;
    this.connection = null;
    this.pending = new Map();
    this.nextId = 154000;
  }

  token() {
    const candidates = [
      globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
      globalThis.DASHBOARDMODERN_AUTH_TOKEN,
      globalThis.LONG_LIVED_TOKEN,
      globalThis.HA_TOKEN,
    ];
    try {
      const configured = JSON.parse(globalThis.localStorage?.getItem("cd_connection") || "{}");
      candidates.push(configured.token, configured.access_token);
    } catch (_error) {}
    return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
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
      const timer = globalThis.setTimeout?.(() => {
        if (!settled) reject(new Error(copy("Timeout canale statistiche", "Statistics channel timeout")));
      }, REQUEST_TIMEOUT);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout?.(timer);
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
          const token = this.token();
          if (!token) {
            finish(
              reject,
              new Error(copy("Connessione Home Assistant non autenticata", "Home Assistant connection is not authenticated")),
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
          finish(reject, new Error(copy("Autenticazione non valida", "Invalid authentication")));
          return;
        }
        if (message.type !== "result" || message.id == null) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        globalThis.clearTimeout?.(pending.timer);
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
      const timer = globalThis.setTimeout?.(() => {
        this.pending.delete(id);
        reject(new Error(copy("Timeout risposta Recorder", "Recorder response timeout")));
      }, REQUEST_TIMEOUT);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, ...payload }));
    });
  }
}

const statisticsSocket = new StatisticsSocket0154();

async function statisticsForPlans(plans, range) {
  const ids = [...new Set(plans.map((plan) => plan.entity).filter(Boolean))];
  if (!ids.length) return {};
  return statisticsSocket.request({
    type: "recorder/statistics_during_period",
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: ids,
    period: range.period,
    units: { energy: "kWh" },
  });
}

function historyRowsValue(rows = []) {
  const values = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      value: numberOrNull(row?.state),
      time: Date.parse(row?.last_updated || row?.last_changed || row?.timestamp || 0),
    }))
    .filter((row) => row.value != null)
    .sort((left, right) => left.time - right.time)
    .map((row) => row.value);
  if (values.length < 2) return null;
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];
    total += difference >= 0 ? difference : Math.max(0, values[index]);
  }
  return Math.max(0, total);
}

async function historyFallback(plans, range) {
  const token = statisticsSocket.token();
  if (!token || typeof globalThis.fetch !== "function" || !globalThis.location?.origin) return {};
  const ids = [...new Set(plans.map((plan) => plan.entity).filter(Boolean))];
  if (!ids.length) return {};
  const url = new URL(`/api/history/period/${range.start.toISOString()}`, globalThis.location.origin);
  url.searchParams.set("filter_entity_id", ids.join(","));
  url.searchParams.set("minimal_response", "");
  url.searchParams.set("no_attributes", "");
  url.searchParams.set("end_time", range.end.toISOString());
  const response = await globalThis.fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return {};
  const payload = await response.json();
  const byId = {};
  (Array.isArray(payload) ? payload : []).forEach((rows) => {
    const entity = rows?.[0]?.entity_id;
    if (entity) byId[entity] = rows;
  });
  return Object.fromEntries(ids.map((id) => [id, historyRowsValue(byId[id] || [])]));
}

async function requestKind(kind, selected, plans, generation) {
  if (!plans.length) return;
  const range = periodRange0152(kind, selected);
  if (range.end <= range.start) return;
  let result = await statisticsForPlans(plans, range);
  if (generation !== releaseState().generation) return;

  const needsBaseline = plans.filter((plan) =>
    periodConsumption0152(result?.[plan.entity] || []) == null,
  );
  let baselineResult = {};
  if (needsBaseline.length) {
    const baseline = baselineRange(kind, range.start);
    baselineResult = await statisticsForPlans(needsBaseline, {
      ...baseline,
      period: range.period,
    });
  }
  if (generation !== releaseState().generation) return;

  const unresolved = [];
  const values = new Map();
  plans.forEach((plan) => {
    const baselineRows = (baselineResult?.[plan.entity] || [])
      .slice()
      .sort((left, right) => {
        const leftTime = Date.parse(left?.start || left?.end || 0);
        const rightTime = Date.parse(right?.start || right?.end || 0);
        return leftTime - rightTime;
      });
    const value = periodConsumption0152(
      result?.[plan.entity] || [],
      baselineRows.at(-1) || null,
    );
    if (value == null) unresolved.push(plan);
    else values.set(plan.slot, value);
  });

  if (unresolved.length) {
    try {
      const fallback = await historyFallback(unresolved, range);
      unresolved.forEach((plan) => {
        const value = fallback[plan.entity];
        if (Number.isFinite(value)) values.set(plan.slot, value);
      });
    } catch (error) {
      console.warn("[DashboardModern 0.14.14] History fallback", error);
    }
  }
  if (generation !== releaseState().generation) return;

  plans.forEach((plan) => {
    const value = values.get(plan.slot);
    if (Number.isFinite(value)) setDerivedPeriod(plan, value, selected);
    else clearDerivedPeriod(plan.slot);
  });
}

function dashboardEnergy() {
  try {
    return globalThis.DashboardModernModules?.store?.getSection?.("energy") || {};
  } catch (_error) {
    return {};
  }
}

function allPlans(selected = selectedPeriodDate()) {
  const energy = dashboardEnergy();
  const states = runtimeStatesObject();
  const overrides = legacyOverrides();
  const resolver = globalThis.resolveEntity || ((value) => value);
  return {
    selected,
    day: periodPlans0154(energy, "day", states, overrides, resolver),
    month: periodPlans0154(energy, "month", states, overrides, resolver),
    year: periodPlans0154(energy, "year", states, overrides, resolver),
  };
}

function releaseState() {
  return (globalThis[RELEASE_FLAG] ||= {
    installed: true,
    version: "0.14.14-dev",
    generation: 0,
    refreshing: false,
    timer: 0,
    pendingSlots: new Set(),
    sources: {},
  });
}

export async function refreshEnergyPeriods0154(selected = selectedPeriodDate()) {
  const state = releaseState();
  const plans = allPlans(selected);
  const combined = [...plans.day, ...plans.month, ...plans.year];
  if (!combined.length) return false;
  const generation = ++state.generation;
  state.refreshing = true;
  state.pendingSlots = new Set(combined.map((plan) => plan.slot));
  state.sources = Object.fromEntries(
    combined.map((plan) => [plan.slot, { entity: plan.entity, reason: plan.reason, kind: plan.kind }]),
  );

  try {
    await Promise.all([
      requestKind("day", new Date(), plans.day, generation),
      requestKind("month", selected, plans.month, generation),
      requestKind("year", selected, plans.year, generation),
    ]);
    if (generation !== state.generation) return false;
    state.pendingSlots.clear();
    state.refreshing = false;
    globalThis.render?.();
    globalThis.renderEnergy?.();
    globalThis.renderEnergyDashboard?.();
    globalThis.dispatchEvent?.(
      new CustomEvent(REFRESH_EVENT, {
        detail: { selected: selected.toISOString(), sources: state.sources, version: "0.14.14" },
      }),
    );
    return true;
  } catch (error) {
    if (generation === state.generation) {
      state.pendingSlots.clear();
      state.refreshing = false;
    }
    console.warn("[DashboardModern 0.14.14] Energy period refresh", error);
    return false;
  }
}

function derivedSlotSet() {
  const plans = allPlans();
  return new Set([...plans.day, ...plans.month, ...plans.year].map((plan) => plan.slot));
}

function installPeriodReadGuards() {
  const wrap = (name, pendingValue) => {
    const previous = globalThis[name];
    if (typeof previous !== "function" || previous.__dm0154PeriodGuard) return false;
    function guardedPeriodRead0154(reference, ...args) {
      const key = String(reference || "");
      const registry = periodRegistry();
      if (registry[key] !== undefined) {
        const value = Number(registry[key]);
        if (name === "cdPNum") return Number.isFinite(value) ? value : 0;
        if (name === "cdPRaw") return value >= 100 ? value.toFixed(0) : value.toFixed(1);
        if (name === "cdPVal") {
          return `${value >= 100 ? value.toFixed(1) : value.toFixed(2)} kWh`;
        }
      }
      if (derivedSlotSet().has(key)) return pendingValue;
      return previous.call(this, reference, ...args);
    }
    guardedPeriodRead0154.__dm0154PeriodGuard = true;
    guardedPeriodRead0154.__dmPrevious = previous;
    globalThis[name] = guardedPeriodRead0154;
    return true;
  };
  const num = wrap("cdPNum", 0);
  const raw = wrap("cdPRaw", "—");
  const val = wrap("cdPVal", "—");
  return num || raw || val || Boolean(
    globalThis.cdPNum?.__dm0154PeriodGuard &&
      globalThis.cdPRaw?.__dm0154PeriodGuard &&
      globalThis.cdPVal?.__dm0154PeriodGuard,
  );
}

function scheduleEnergyRefresh(delay = 40) {
  const state = releaseState();
  globalThis.clearTimeout?.(state.timer);
  state.timer = globalThis.setTimeout?.(() => refreshEnergyPeriods0154(), delay);
}

export function canonicalArtworkType0154(value) {
  const token = String(value || "").toLowerCase();
  if (/microonde|microwave/.test(token)) return "microwave";
  if (/forno|oven|stove/.test(token)) return "oven";
  if (/frigo|fridge|refriger|frigorifero|freezer|congelatore/.test(token)) return "fridge";
  if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) return "boiler";
  if (/lavatrice|washing[_ -]?machine|washer/.test(token)) return "washer";
  if (/asciugatrice|tumble[_ -]?dryer|dryer/.test(token)) return "dryer";
  if (/lavastoviglie|dishwasher/.test(token)) return "dishwasher";
  if (/piano[_ -]?cottura|cooktop|hob/.test(token)) return "cooktop";
  if (/televis|\btv\b|monitor/.test(token)) return "television";
  return "";
}

function artworkBody0154(type) {
  const panel = '<rect class="dm-art-panel" x="3" y="3" width="90" height="90" rx="20"/><path class="dm-art-highlight" d="M15 13h66a10 10 0 0 1 10 10v8C70 18 42 17 5 39V23A10 10 0 0 1 15 13Z"/>';
  const bodies = {
    oven: `${panel}<rect class="dm-art-shell" x="15" y="10" width="66" height="76" rx="9"/><rect class="dm-art-face" x="21" y="17" width="54" height="14" rx="5"/><circle class="dm-art-accent" cx="29" cy="24" r="3.2"/><circle class="dm-art-muted" cx="39" cy="24" r="3.2"/><circle class="dm-art-muted" cx="49" cy="24" r="3.2"/><rect class="dm-art-face" x="21" y="37" width="54" height="40" rx="6"/><rect class="dm-art-window" x="28" y="44" width="40" height="25" rx="4"/><path class="dm-art-line" d="M34 61c8-7 20-7 28 0M31 72h34"/>`,
    microwave: `${panel}<rect class="dm-art-shell" x="10" y="22" width="76" height="54" rx="10"/><rect class="dm-art-face" x="16" y="29" width="50" height="40" rx="6"/><rect class="dm-art-window" x="22" y="35" width="38" height="28" rx="4"/><circle class="dm-art-accent" cx="76" cy="36" r="5"/><rect class="dm-art-accent" x="70" y="47" width="12" height="5" rx="2.5"/><rect class="dm-art-muted" x="70" y="57" width="12" height="5" rx="2.5"/><path class="dm-art-line" d="M31 56h20M34 51c4-5 10-5 14 0"/>`,
    fridge: `${panel}<rect class="dm-art-shell" x="20" y="8" width="56" height="80" rx="12"/><rect class="dm-art-face" x="26" y="14" width="44" height="31" rx="7"/><rect class="dm-art-face" x="26" y="51" width="44" height="30" rx="7"/><rect class="dm-art-accent" x="31" y="21" width="6" height="17" rx="3"/><rect class="dm-art-accent" x="31" y="58" width="6" height="17" rx="3"/><circle class="dm-art-accent" cx="63" cy="22" r="3"/>`,
    boiler: `${panel}<rect class="dm-art-shell" x="20" y="8" width="56" height="76" rx="28"/><rect class="dm-art-face" x="27" y="15" width="42" height="62" rx="21"/><path class="dm-art-water" d="M28 51c9-8 16 5 25-3 6-5 10-4 16 0v18a13 13 0 0 1-13 13H40a13 13 0 0 1-13-13Z"/><circle class="dm-art-shell" cx="48" cy="58" r="8"/><path class="dm-art-line dm-art-line-light" d="M48 53v6M44 57l4 4 4-4"/><path class="dm-art-line" d="M36 86v5M60 86v5"/>`,
    washer: `${panel}<rect class="dm-art-shell" x="13" y="10" width="70" height="76" rx="9"/><rect class="dm-art-face" x="19" y="16" width="58" height="14" rx="5"/><circle class="dm-art-accent" cx="27" cy="23" r="3"/><rect class="dm-art-muted" x="58" y="20" width="12" height="5" rx="2.5"/><circle class="dm-art-face" cx="48" cy="57" r="24"/><circle class="dm-art-window" cx="48" cy="57" r="17"/><path class="dm-art-line dm-art-line-light" d="M35 58c8-8 18 8 27-1M38 64c7-5 13 4 20 0"/>`,
    dryer: `${panel}<rect class="dm-art-shell" x="13" y="10" width="70" height="76" rx="9"/><rect class="dm-art-face" x="19" y="16" width="58" height="14" rx="5"/><circle class="dm-art-accent" cx="27" cy="23" r="3"/><circle class="dm-art-face" cx="48" cy="57" r="24"/><circle class="dm-art-window" cx="48" cy="57" r="17"/><path class="dm-art-line dm-art-line-light" d="M39 64c-5-5 5-8 0-13M48 64c-5-5 5-8 0-13M57 64c-5-5 5-8 0-13"/>`,
    dishwasher: `${panel}<rect class="dm-art-shell" x="14" y="10" width="68" height="76" rx="9"/><rect class="dm-art-face" x="20" y="16" width="56" height="14" rx="5"/><circle class="dm-art-accent" cx="28" cy="23" r="3"/><rect class="dm-art-face" x="20" y="36" width="56" height="41" rx="6"/><path class="dm-art-line" d="M27 49h42M30 64h36M33 49v15M44 49v15M55 49v15M66 49v15"/><path class="dm-art-water" d="M23 67c9-6 16 5 25-2 8-6 14 4 25-1v10H23Z"/>`,
    cooktop: `${panel}<rect class="dm-art-shell" x="12" y="18" width="72" height="60" rx="10"/><rect class="dm-art-face" x="18" y="24" width="60" height="48" rx="7"/><circle class="dm-art-window" cx="35" cy="40" r="10"/><circle class="dm-art-window" cx="61" cy="40" r="10"/><circle class="dm-art-window" cx="35" cy="61" r="8"/><circle class="dm-art-window" cx="61" cy="61" r="8"/><circle class="dm-art-accent" cx="35" cy="40" r="3"/><circle class="dm-art-accent" cx="61" cy="61" r="3"/>`,
    television: `${panel}<rect class="dm-art-shell" x="10" y="18" width="76" height="54" rx="9"/><rect class="dm-art-window" x="17" y="25" width="62" height="40" rx="5"/><path class="dm-art-line" d="M39 78h18M48 70v8"/><path class="dm-art-line dm-art-line-light" d="M27 53c10-17 29-21 43-9"/>`,
  };
  return bodies[type] || "";
}

export function applianceArtwork0154(type, size = 96) {
  const canonical = canonicalArtworkType0154(type);
  const body = artworkBody0154(canonical);
  if (!canonical || !body) return "";
  return `<span class="dm-appliance-art dm-appliance-art-0154" data-dm-art="${canonical}" data-dm-art-style="panel"><svg width="${size}" height="${size}" viewBox="0 0 96 96" role="img" aria-hidden="true">${body}</svg></span>`;
}

function applianceItems() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(items) ? items : [];
  } catch (_error) {
    return [];
  }
}

function applianceVisual(item) {
  try {
    return globalThis.DashboardModernModules?.data?.getDeviceVisual?.(item) || null;
  } catch (_error) {
    return null;
  }
}

function applianceToken(item, visual) {
  return String(
    visual?.value ||
      item?.visual_key ||
      item?.device_type ||
      item?.type ||
      item?.icon ||
      item?.name ||
      "",
  );
}

function installArtworkOverride() {
  const previous = globalThis.cdApplianceIcon;
  if (typeof previous !== "function" || previous.__dm0154Artwork) return false;
  function cdApplianceIcon0154(type, size) {
    return applianceArtwork0154(type, size || 96) || previous.call(this, type, size);
  }
  cdApplianceIcon0154.__dm0154Artwork = true;
  cdApplianceIcon0154.__dmPrevious = previous;
  globalThis.cdApplianceIcon = cdApplianceIcon0154;
  globalThis.renderApplianceSection?.(true);
  return true;
}

function normalizeApplianceCards0154() {
  const doc = globalThis.document;
  if (!doc) return false;
  const items = applianceItems();
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  const cards = doc.querySelectorAll(
    "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]",
  );
  cards.forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
    if (!item) return;
    const visual = applianceVisual(item);
    const type = canonicalArtworkType0154(applianceToken(item, visual));
    const viewport = card.querySelector(".appl-visual");
    const media = viewport?.querySelector(".appl-ic");
    if (!viewport || !media) return;
    viewport.classList.add("dm-appliance-viewport-0154");
    media.classList.add("dm-appliance-media-0154");
    card.dataset.dmArtStyle = "panel";

    if (visual?.kind === "image" && visual.value) {
      card.dataset.dmArtwork = "custom";
      let image = media.querySelector("img");
      if (!image) {
        image = doc.createElement("img");
        media.replaceChildren(image);
      }
      image.classList.add("dm-appliance-custom-image-0154");
      if (image.getAttribute("src") !== visual.value) image.src = visual.value;
      image.alt = String(item.name || "");
      return;
    }

    if (!type) return;
    card.dataset.dmArtwork = type;
    const existing = media.querySelector(`[data-dm-art="${type}"][data-dm-art-style="panel"]`);
    if (!existing) media.innerHTML = applianceArtwork0154(type, 96);
  });
  return true;
}

function installStyles0154() {
  const doc = globalThis.document;
  if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --dm-art-tile: linear-gradient(145deg,#edf7ff 0%,#dceefa 100%);
      --dm-art-panel:#dff3ff;
      --dm-art-panel-stroke:#8dd8f8;
      --dm-art-shell:#102b46;
      --dm-art-face:#f7fbff;
      --dm-art-window:#24658d;
      --dm-art-accent:#22b8f0;
      --dm-art-muted:#91a9be;
      --dm-art-water:#33c2f4;
      --dm-art-line:#102b46;
      --dm-art-line-light:#e7f8ff;
      --dm-art-highlight:rgba(255,255,255,.58);
    }
    html[data-theme="dark"] {
      --dm-art-tile: linear-gradient(145deg,#0d2339 0%,#102e49 100%);
      --dm-art-panel:#123a59;
      --dm-art-panel-stroke:#1b6e99;
      --dm-art-shell:#e6f7ff;
      --dm-art-face:#bfeaff;
      --dm-art-window:#0a3858;
      --dm-art-accent:#39c7ff;
      --dm-art-muted:#79a9c5;
      --dm-art-water:#22b8f0;
      --dm-art-line:#dff6ff;
      --dm-art-line-light:#dff6ff;
      --dm-art-highlight:rgba(125,211,252,.12);
    }

    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual {
      background:var(--dm-art-tile)!important;
      border-color:var(--dm-art-panel-stroke)!important;
      display:grid!important;
      place-items:center!important;
      overflow:hidden!important;
    }

    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual .appl-ic,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual .appl-ic,
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual .appl-ic {
      display:grid!important;
      place-items:center!important;
      width:100%!important;
      height:100%!important;
      padding:clamp(5px,1vw,9px)!important;
      margin:0!important;
      overflow:hidden!important;
      color:inherit!important;
    }

    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card.dm-control-device[data-dm-artwork][data-dm-art-style="panel"]
      .appl-visual.dm-appliance-viewport-0154
      .appl-ic.dm-appliance-media-0154
      .dm-appliance-art-0154[data-dm-art][data-dm-art-style="panel"] > svg,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-artwork][data-dm-art-style="panel"]
      .appl-visual.dm-appliance-viewport-0154
      .appl-ic.dm-appliance-media-0154
      .dm-appliance-art-0154[data-dm-art][data-dm-art-style="panel"] > svg,
    html body #page-appliances-main
      .appl-wide-card[data-dm-artwork][data-dm-art-style="panel"]
      .dm-appliance-art-0154[data-dm-art][data-dm-art-style="panel"] > svg {
      display:block!important;
      width:88%!important;
      height:88%!important;
      min-width:0!important;
      min-height:0!important;
      max-width:88%!important;
      max-height:88%!important;
      object-fit:contain!important;
      overflow:visible!important;
      transform:none!important;
      filter:drop-shadow(0 8px 12px rgba(15,41,66,.18));
    }

    .dm-appliance-art-0154 { display:grid!important;place-items:center!important;width:100%!important;height:100%!important; }
    .dm-appliance-art-0154 .dm-art-panel { fill:var(--dm-art-panel);stroke:var(--dm-art-panel-stroke);stroke-width:2; }
    .dm-appliance-art-0154 .dm-art-highlight { fill:var(--dm-art-highlight); }
    .dm-appliance-art-0154 .dm-art-shell { fill:var(--dm-art-shell);stroke:var(--dm-art-shell);stroke-width:2; }
    .dm-appliance-art-0154 .dm-art-face { fill:var(--dm-art-face); }
    .dm-appliance-art-0154 .dm-art-window { fill:var(--dm-art-window); }
    .dm-appliance-art-0154 .dm-art-accent { fill:var(--dm-art-accent); }
    .dm-appliance-art-0154 .dm-art-muted { fill:var(--dm-art-muted); }
    .dm-appliance-art-0154 .dm-art-water { fill:var(--dm-art-water); }
    .dm-appliance-art-0154 .dm-art-line { fill:none;stroke:var(--dm-art-line);stroke-width:3;stroke-linecap:round;stroke-linejoin:round; }
    .dm-appliance-art-0154 .dm-art-line-light { stroke:var(--dm-art-line-light); }

    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] img.dm-appliance-custom-image-0154,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] img.dm-appliance-custom-image-0154 {
      display:block!important;
      width:82%!important;
      height:82%!important;
      max-width:82%!important;
      max-height:82%!important;
      object-fit:contain!important;
      object-position:center!important;
      padding:5px!important;
      border-radius:16px!important;
      background:var(--dm-art-panel)!important;
      border:2px solid var(--dm-art-panel-stroke)!important;
      box-shadow:0 8px 16px rgba(15,41,66,.14)!important;
    }
  `;
  doc.head.append(style);
  return true;
}

function installDomObserver0154() {
  const state = releaseState();
  if (!globalThis.document?.documentElement || state.domObserver) return false;
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      normalizeApplianceCards0154();
    };
    globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length || record.removedNodes.length)) schedule();
  });
  observer.observe(globalThis.document.documentElement, { childList: true, subtree: true });
  state.domObserver = observer;
  schedule();
  return true;
}

function installInteractions0154() {
  const state = releaseState();
  if (state.interactionsInstalled || !globalThis.document) return;
  state.interactionsInstalled = true;
  globalThis.addEventListener?.(OLD_REFRESH_EVENT, () => scheduleEnergyRefresh(0));
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installPeriodReadGuards();
    installArtworkOverride();
    normalizeApplianceCards0154();
    scheduleEnergyRefresh(80);
  });
  globalThis.document.addEventListener(
    "click",
    (event) => {
      const target = event.target?.closest?.("button,.sub-tab-btn,.ed-inner-tab,.hist-time-btn");
      if (!target) return;
      if (/giornal|daily|mensil|monthly|report|analisi|analysis|ann|year/i.test(target.textContent || "")) {
        scheduleEnergyRefresh(20);
      }
    },
    true,
  );
  globalThis.document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || target.closest("#editor-modal")) return;
      if (/month|mese|year|anno/i.test(`${target.id} ${target.name} ${target.getAttribute("aria-label") || ""}`)) {
        scheduleEnergyRefresh(20);
      }
    },
    true,
  );
  try {
    globalThis.DashboardModernModules?.store?.subscribe?.((change) => {
      if (change.section === "energy" && change.status === "success") scheduleEnergyRefresh(0);
      if (change.section === "appliances") normalizeApplianceCards0154();
    });
  } catch (_error) {}
}

function install0154() {
  releaseState();
  installStyles0154();
  installInteractions0154();
  installDomObserver0154();
  installPeriodReadGuards();
  installArtworkOverride();
  normalizeApplianceCards0154();
  globalThis.cdRefreshPeriodDeltas = (..._args) => refreshEnergyPeriods0154();
  globalThis.cdDeriveFromTotals = (..._args) => refreshEnergyPeriods0154();
  scheduleEnergyRefresh(300);
}

if (typeof globalThis.document !== "undefined") {
  install0154();
  globalThis.queueMicrotask?.(install0154);
  globalThis.setTimeout?.(install0154, 0);
  globalThis.setTimeout?.(install0154, 160);
  const retry = globalThis.setInterval?.(() => {
    install0154();
    if (
      globalThis.cdPNum?.__dm0154PeriodGuard &&
      globalThis.cdApplianceIcon?.__dm0154Artwork
    ) {
      globalThis.clearInterval?.(retry);
    }
  }, 100);
  globalThis.setTimeout?.(() => globalThis.clearInterval?.(retry), 15000);
  globalThis.setInterval?.(() => scheduleEnergyRefresh(0), 5 * 60 * 1000);
}
