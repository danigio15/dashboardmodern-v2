// DM-FIX-20260812B
/* Pure period/statistics service. */
import { runtimeMetrics } from "./runtime-metrics.js";

export const PERIOD_SOURCES = Object.freeze([
  {
    key: "house",
    group: "house",
    totalKey: "total_energy",
    periodKeys: { day: "daily_energy", month: "monthly_energy", year: "annual_energy" },
    slots: {
      day: "dm.energy_consumo_casa_oggi",
      month: "dm.energy_consumo_casa_mese",
      year: "dm.energy_consumo_casa_anno",
    },
  },
  {
    key: "gridImport",
    group: "grid",
    totalKey: "total_import_energy",
    periodKeys: {
      day: "daily_import_energy",
      month: "monthly_import_energy",
      year: "annual_import_energy",
    },
    slots: {
      day: "dm.energy_energia_prelevata_oggi",
      month: "dm.energy_rete_acquistata_mese",
      year: "dm.energy_rete_acquistata_anno",
    },
  },
  {
    key: "gridExport",
    group: "grid",
    totalKey: "total_export_energy",
    periodKeys: {
      day: "daily_export_energy",
      month: "monthly_export_energy",
      year: "annual_export_energy",
    },
    slots: {
      day: "dm.energy_energia_immessa_oggi",
      month: "dm.energy_rete_venduta_mese",
      year: "dm.energy_rete_venduta_anno",
    },
  },
  {
    key: "solar",
    group: "solar",
    totalKey: "total_energy",
    periodKeys: { day: "daily_energy", month: "monthly_energy", year: "annual_energy" },
    slots: {
      day: "dm.energy_produzione_solare_oggi",
      month: "dm.energy_produzione_solare_mese",
      year: "dm.energy_produzione_solare_anno",
    },
  },
  {
    key: "batteryCharged",
    group: "battery",
    totalKey: "total_charged_energy",
    periodKeys: {
      day: "daily_charged_energy",
      month: "monthly_charged_energy",
      year: "annual_charged_energy",
    },
    slots: {
      day: "dm.energy_batteria_caricata_oggi",
      month: "dm.energy_batteria_caricata_mese",
      year: "dm.energy_batteria_caricata_anno",
    },
  },
  {
    key: "batteryDischarged",
    group: "battery",
    totalKey: "total_discharged_energy",
    periodKeys: {
      day: "daily_discharged_energy",
      month: "monthly_discharged_energy",
      year: "annual_discharged_energy",
    },
    slots: {
      day: "dm.energy_batteria_scaricata_oggi",
      month: "dm.energy_batteria_usata_mese",
      year: "dm.energy_batteria_usata_anno",
    },
  },
]);

const finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function rowTimestamp(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

export function cumulativeValue(row) {
  return finite(row?.sum);
}

/**
 * Return the energy consumed in a period.
 * A single lifetime sample is deliberately not treated as a period value.
 */
export function periodConsumption(rows = [], baseline = null) {
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTimestamp(left) - rowTimestamp(right));

  const values = ordered.map(cumulativeValue).filter((value) => value != null);
  const first = cumulativeValue(baseline);
  if (first != null && values.length) values.unshift(first);
  if (values.length < 2) return null;

  // Recorder's sum is already unit-normalized and reset-aware. Re-applying
  // counter reset logic here would count the same reset twice.
  return Math.max(0, values.at(-1) - values[0]);
}

export function recorderBucketConsumptions(rows = [], baseline = null) {
  const ordered = [baseline, ...(Array.isArray(rows) ? rows : [])]
    .filter((row) => row && cumulativeValue(row) != null)
    .sort((left, right) => rowTimestamp(left) - rowTimestamp(right));
  return ordered.slice(1).map((row, index) =>
    Object.freeze({
      ...row,
      change: Math.max(0, cumulativeValue(row) - cumulativeValue(ordered[index])),
    }),
  );
}

function endOfClosedRange(nextBoundary, now) {
  if (nextBoundary > now) return new Date(now);
  return new Date(nextBoundary);
}

export function periodRange(kind, selected = new Date(), now = new Date()) {
  const date = new Date(selected);
  const current = new Date(now);
  let start;
  let next;
  let period;

  if (kind === "day") {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next = new Date(start);
    next.setDate(next.getDate() + 1);
    period = "hour";
  } else if (kind === "year") {
    start = new Date(date.getFullYear(), 0, 1);
    next = new Date(date.getFullYear() + 1, 0, 1);
    period = "month";
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    period = "day";
  }

  return {
    start,
    end: endOfClosedRange(next, current),
    next,
    period,
    kind,
  };
}

export function baselineRange(kind, start) {
  const baselineStart = new Date(start);
  if (kind === "day") baselineStart.setHours(baselineStart.getHours() - 2);
  else if (kind === "year") baselineStart.setMonth(baselineStart.getMonth() - 1);
  else baselineStart.setDate(baselineStart.getDate() - 2);
  return { start: baselineStart, end: new Date(start) };
}

export function resolveEntity(reference, resolver = globalThis.resolveEntity) {
  const original = String(reference || "").trim();
  if (!original) return "";
  try {
    return String(resolver?.(original) || original).trim();
  } catch (_error) {
    return original;
  }
}

export function isCumulativeEnergyEntity(entityId, states = {}, resolver = (value) => value) {
  const original = String(entityId || "").trim();
  if (!original) return false;
  const resolved = resolveEntity(original, resolver);
  const state = states?.[resolved] || states?.[original] || null;
  const attributes = state?.attributes || {};
  const stateClass = String(attributes.state_class || "").toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  const text = `${original} ${resolved} ${attributes.friendly_name || ""}`.toLowerCase();
  return /(^|[\s._-])(total|totale|lifetime|counter|contatore|meter)([\s._-]|$)/.test(text);
}

export function sourcePlans(
  energy = {},
  kind = "month",
  states = {},
  overrides = {},
  resolver = (value) => value,
) {
  return PERIOD_SOURCES.flatMap((definition) => {
    const group = energy?.[definition.group] || {};
    const explicitKey = definition.periodKeys[kind];
    const explicit = String(group?.[explicitKey] || "").trim();
    const total = String(group?.[definition.totalKey] || "").trim();
    const legacy = String(overrides?.[definition.slots[kind]] || "").trim();
    const resolvedExplicit = resolveEntity(explicit, resolver);
    const resolvedTotal = resolveEntity(total, resolver);
    const explicitAliasesTotal = Boolean(
      explicit && total && resolvedExplicit && resolvedExplicit === resolvedTotal,
    );

    // A real period helper is authoritative for the current period even when
    // Home Assistant marks it total/total_increasing (utility_meter does this).
    // Migrations historically mirrored the lifetime Total sensor into the
    // annual field for compatibility. When both fields resolve to the same
    // entity it is still a lifetime counter and must be derived with Recorder,
    // never read directly as the current year's consumption.
    if (explicit && !explicitAliasesTotal) {
      const plans = [
        {
          ...definition,
          kind,
          slot: definition.slots[kind],
          entity: resolvedExplicit,
          source: explicit,
          direct: true,
          reason: "explicit-period",
        },
      ];
      // Direct helpers are not authoritative for a previous period. Prefer the
      // configured lifetime counter there. If no dedicated lifetime counter is
      // available, a cumulative explicit helper may still provide reset-aware
      // Recorder growth for historical periods.
      const historicalSource =
        total || (isCumulativeEnergyEntity(explicit, states, resolver) ? explicit : "");
      if (historicalSource) {
        plans.push({
          ...definition,
          kind,
          slot: definition.slots[kind],
          entity: resolveEntity(historicalSource, resolver),
          source: historicalSource,
          direct: false,
          fallback: true,
          reason: total ? "canonical-total-fallback" : "explicit-cumulative-fallback",
        });
      }
      return plans;
    }

    const source = total || explicit || legacy;
    if (!source) return [];
    if (!total && !explicit && !isCumulativeEnergyEntity(legacy, states, resolver)) return [];
    return [
      {
        ...definition,
        kind,
        slot: definition.slots[kind],
        entity: resolveEntity(source, resolver),
        source,
        direct: false,
        reason: explicitAliasesTotal
          ? "period-aliases-total"
          : total
            ? "canonical-total"
            : "legacy-cumulative",
      },
    ];
  });
}

function readDirectState(entity, states = {}) {
  const state = states?.[entity];
  const value = finite(state?.state);
  return value == null ? null : Math.max(0, value);
}

export class HomeAssistantBroker {
  constructor({ timeout = 12000, cacheCurrentMs = 15000, cacheHistoricalMs = 600000 } = {}) {
    this.timeout = timeout;
    this.cacheCurrentMs = cacheCurrentMs;
    this.cacheHistoricalMs = cacheHistoricalMs;
    this.socket = null;
    this.connection = null;
    this.authenticated = false;
    this.nextId = 150000;
    this.pending = new Map();
    this.inflight = new Map();
    this.cache = new Map();
    this.subscription = 0;
    this.statesStarted = false;
  }

  token() {
    const values = [
      globalThis.DASHBOARDMODERN_AUTH_TOKEN,
      globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
      globalThis.LONG_LIVED_TOKEN,
      globalThis.HA_TOKEN,
    ];
    try {
      const config = JSON.parse(globalThis.localStorage?.getItem("cd_connection") || "{}");
      values.push(config.token, config.access_token);
    } catch (_error) {}
    return values.map((value) => String(value || "").trim()).find(Boolean) || "";
  }

  url() {
    const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location?.host || "dashboardmodern-bridge"}/api/websocket`;
  }

  reset(error = null) {
    const socket = this.socket;
    this.socket = null;
    this.connection = null;
    this.authenticated = false;
    this.subscription = 0;
    this.statesStarted = false;
    if (error) {
      this.pending.forEach(({ reject, timer }) => {
        globalThis.clearTimeout?.(timer);
        reject(error);
      });
      this.pending.clear();
      this.inflight.clear();
    }
    try {
      if (socket?.readyState === 1) socket.close();
    } catch (_error) {}
  }

  ingestState(state, { emitEvent = true } = {}) {
    const id = String(state?.entity_id || "").trim();
    if (!id) return false;
    const copy = { ...state, attributes: { ...(state.attributes || {}) } };
    const registries = [];
    try {
      if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) registries.push(_RAW_STATES);
    } catch (_error) {}
    try {
      if (typeof STATES !== "undefined" && STATES) registries.push(STATES);
    } catch (_error) {}
    globalThis._RAW_STATES ||= {};
    globalThis.STATES ||= {};
    registries.push(globalThis._RAW_STATES, globalThis.STATES);
    [...new Set(registries)].forEach((registry) => {
      registry[id] = copy;
    });
    if (
      emitEvent &&
      !copy.attributes?.dashboardmodern_derived &&
      typeof globalThis.CustomEvent === "function"
    ) {
      globalThis.dispatchEvent?.(
        new globalThis.CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: id, state: copy },
        }),
      );
    }
    return true;
  }

  handleMessage(event, resolveConnection, rejectConnection) {
    let message;
    try {
      message = JSON.parse(event?.data || event);
    } catch (_error) {
      return;
    }

    if (message.type === "auth_required") {
      const token = this.token();
      if (!token) {
        rejectConnection(new Error("Home Assistant token missing"));
        return;
      }
      this.socket?.send(JSON.stringify({ type: "auth", access_token: token }));
      return;
    }
    if (message.type === "auth_ok") {
      this.authenticated = true;
      resolveConnection(this.socket);
      return;
    }
    if (message.type === "auth_invalid") {
      rejectConnection(new Error(message.message || "Invalid Home Assistant authentication"));
      return;
    }
    if (message.type === "event" && message.id === this.subscription) {
      this.ingestState(message.event?.data?.new_state);
      return;
    }
    if (message.type !== "result" || message.id == null) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    globalThis.clearTimeout?.(pending.timer);
    if (message.success === false)
      pending.reject(new Error(message.error?.message || "HA request failed"));
    else pending.resolve(message.result ?? null);
  }

  connect() {
    if (this.authenticated && this.socket?.readyState === 1) return Promise.resolve(this.socket);
    if (this.connection) return this.connection;
    if (typeof globalThis.WebSocket !== "function") {
      return Promise.reject(new Error("WebSocket unavailable"));
    }

    this.connection = new Promise((resolve, reject) => {
      let settled = false;
      let timer = 0;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout?.(timer);
        callback(value);
      };
      timer = globalThis.setTimeout?.(
        () => finish(reject, new Error("Home Assistant connection timeout")),
        this.timeout,
      );
      try {
        const socket = new globalThis.WebSocket(this.url());
        this.socket = socket;
        socket.onmessage = (event) =>
          this.handleMessage(
            event,
            (value) => finish(resolve, value),
            (error) => finish(reject, error),
          );
        socket.onerror = () => finish(reject, new Error("Home Assistant connection unavailable"));
        socket.onclose = () => {
          if (this.socket === socket) this.reset();
        };
      } catch (error) {
        finish(reject, error);
      }
    })
      .catch((error) => {
        this.reset(error);
        throw error;
      })
      .finally(() => {
        this.connection = null;
      });
    return this.connection;
  }

  async request(payload) {
    const socket = await this.connect();
    const id = ++this.nextId;
    if (payload?.type === "recorder/statistics_during_period")
      runtimeMetrics.increment("recorderRequests");
    return new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout?.(() => {
        this.pending.delete(id);
        reject(new Error("Home Assistant response timeout"));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, ...payload }));
      } catch (error) {
        globalThis.clearTimeout?.(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async cachedRequest(payload, cacheKey, maxAge = 0) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < maxAge) return cached.value;
    if (this.inflight.has(cacheKey)) return this.inflight.get(cacheKey);
    const promise = this.request(payload)
      .then((value) => {
        if (maxAge > 0) this.cache.set(cacheKey, { at: Date.now(), value });
        return value;
      })
      .finally(() => this.inflight.delete(cacheKey));
    this.inflight.set(cacheKey, promise);
    return promise;
  }

  async statistics(ids, start, end, period = "day") {
    const originals = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!originals.length) return {};
    const mapped = new Map(originals.map((id) => [id, resolveEntity(id)]));
    const statisticIds = [...new Set([...mapped.values()].filter(Boolean))];
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    const historical = Date.parse(endIso) < Date.now() - 86400000;
    const key = `statistics|${period}|${startIso}|${endIso}|${statisticIds.join(",")}`;
    const payload = {
      type: "recorder/statistics_during_period",
      start_time: startIso,
      end_time: endIso,
      statistic_ids: statisticIds,
      period,
      types: ["sum"],
      units: { energy: "kWh" },
    };
    let result;
    try {
      result = await this.cachedRequest(
        payload,
        key,
        historical ? this.cacheHistoricalMs : this.cacheCurrentMs,
      );
    } catch (error) {
      const compatiblePayload = { ...payload };
      delete compatiblePayload.units;
      const compatibleKey = `${key}|compat`;
      result = await this.cachedRequest(
        compatiblePayload,
        compatibleKey,
        historical ? this.cacheHistoricalMs : this.cacheCurrentMs,
      );
    }
    return Object.fromEntries(
      originals.map((id) => [id, result?.[mapped.get(id)] || result?.[id] || []]),
    );
  }

  async valuesForPlans(plans, selected, states = globalThis.STATES || {}) {
    const output = new Map();
    const direct = plans.filter((plan) => plan.direct);
    const selectedDate = new Date(selected);
    const today = new Date();
    const directIsCurrent = (kind) =>
      kind === "day"
        ? selectedDate.toDateString() === today.toDateString()
        : kind === "year"
          ? selectedDate.getFullYear() === today.getFullYear()
          : selectedDate.getFullYear() === today.getFullYear() &&
            selectedDate.getMonth() === today.getMonth();
    direct
      .filter((plan) => directIsCurrent(plan.kind))
      .forEach((plan) => {
        const value = readDirectState(plan.entity, states);
        if (value != null) output.set(plan.key, value);
      });

    const derived = plans.filter(
      (plan) => !plan.direct && !(plan.fallback && output.has(plan.key)),
    );
    if (!derived.length) return output;
    const kind = derived[0].kind;
    const range = periodRange(kind, selected);
    if (range.end <= range.start) return output;
    const ids = [...new Set(derived.map((plan) => plan.entity))];
    const baseline = baselineRange(kind, range.start);
    // One Recorder request contains both the sample immediately before the
    // boundary and all samples in the requested period. This is the same data
    // contract used for Energy: growth = final sum - initial sum.
    const rows = await this.statistics(ids, baseline.start, range.end, range.period);

    derived.forEach((plan) => {
      const entityRows = (rows[plan.entity] || [])
        .slice()
        .sort((left, right) => rowTimestamp(left) - rowTimestamp(right));
      const before = entityRows.filter((row) => rowTimestamp(row) < range.start.getTime());
      const within = entityRows.filter(
        (row) =>
          rowTimestamp(row) >= range.start.getTime() && rowTimestamp(row) < range.end.getTime(),
      );
      const value = periodConsumption(within, before.at(-1) || null);
      if (value != null) output.set(plan.key, Math.round(value * 1000) / 1000);
    });
    return output;
  }

  async valuesForEntities(ids, kind, selected) {
    const plans = [...new Set((ids || []).map(String).filter(Boolean))].map((entity) => ({
      key: entity,
      entity: resolveEntity(entity),
      source: entity,
      kind,
      direct: false,
    }));
    return this.valuesForPlans(plans, selected);
  }

  async startStateFeed() {
    if (this.statesStarted) return true;
    this.statesStarted = true;
    try {
      const states = await this.cachedRequest({ type: "get_states" }, "get_states", 5000);
      (Array.isArray(states) ? states : []).forEach((state) =>
        this.ingestState(state, { emitEvent: false }),
      );
      const socket = await this.connect();
      const id = ++this.nextId;
      this.subscription = id;
      await new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout?.(() => {
          this.pending.delete(id);
          reject(new Error("State subscription timeout"));
        }, this.timeout);
        this.pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, type: "subscribe_events", event_type: "state_changed" }));
      });
      return true;
    } catch (error) {
      this.statesStarted = false;
      throw error;
    }
  }
}
