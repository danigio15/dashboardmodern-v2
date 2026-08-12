// DM-FIX-20260812B
const STATE_EVENT = "dashboardmodern:state-changed";
const SERVICE_KEY = "DashboardModernEnergyService";
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;
const LEGACY_CONFIG_KEYS = Object.freeze([
  "dm_dashboard_state",
  "cd_stanze",
  "cd_cameras",
  "cd_appliances",
  "cd_loads",
  "cd_luci",
  "cd_clima_units",
  "cd_ev_cars",
  "cd_tapparelle",
  "cd_piscina",
  "cd_irrigazione",
  "cd_energy_model",
  "cd_entity_overrides",
]);

function makeEvent(root, detail) {
  if (typeof root.CustomEvent === "function") return new root.CustomEvent(STATE_EVENT, { detail });
  return { type: STATE_EVENT, detail };
}

function collectEntityIds(value, output, depth = 0) {
  if (depth > 12 || value == null) return;
  if (typeof value === "string") {
    const id = value.trim();
    if (ENTITY_ID.test(id)) output.add(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEntityIds(entry, output, depth + 1));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((entry) => collectEntityIds(entry, output, depth + 1));
  }
}

function collectStoredConfig(root, ids) {
  const storage = root.localStorage;
  if (!storage?.getItem) return;
  for (const key of LEGACY_CONFIG_KEYS) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      let value = raw;
      try {
        value = JSON.parse(raw);
      } catch (_error) {}
      collectEntityIds(value, ids);
    } catch (_error) {}
  }
}

function configuredEntities(root) {
  const ids = new Set();
  try {
    collectEntityIds(root.DashboardModernModules?.store?.getState?.()?.sections, ids);
  } catch (_error) {}
  try {
    collectEntityIds(root.CD_BAKED_CONFIG, ids);
  } catch (_error) {}
  try {
    collectEntityIds(root.ENTITY_OVERRIDES, ids);
  } catch (_error) {}
  collectStoredConfig(root, ids);
  return ids;
}

/**
 * Prevent the initial Home Assistant get_states snapshot from producing one UI
 * event per entity, discard live updates that are not used anywhere by the
 * dashboard, then coalesce the remaining notifications into a bounded batch.
 * State registries are still updated synchronously by the original broker.
 */
export function installStateEventGate(broker, root = globalThis, { delay = 500 } = {}) {
  if (!broker || typeof broker.ingestState !== "function" || broker.__dmStateEventGate)
    return false;

  const original = broker.ingestState;
  const pendingIds = new Set();
  let lastState = null;
  let timer = 0;
  let interests = new Set();
  let interestsAt = 0;

  const currentInterests = () => {
    const now = Date.now();
    if (!interestsAt || now - interestsAt >= 5000) {
      interests = configuredEntities(root);
      interestsAt = now;
    }
    return interests;
  };

  const flush = () => {
    timer = 0;
    if (!pendingIds.size) return;
    const entityIds = [...pendingIds];
    pendingIds.clear();
    const state = lastState;
    lastState = null;
    root.dispatchEvent?.(
      makeEvent(root, {
        entity_id: entityIds.at(-1) || "",
        entity_ids: entityIds,
        state,
        coalesced: true,
      }),
    );
  };

  const queue = (state) => {
    const id = String(state?.entity_id || "").trim();
    if (!id) return;
    const configured = currentInterests();
    // If neither the canonical nor legacy configuration is ready yet, remain
    // backward compatible and allow the event. Once configuration is known,
    // unrelated Home Assistant chatter is ignored.
    if (configured.size && !configured.has(id)) return;
    pendingIds.add(id);
    lastState = state || lastState;
    if (timer) return;
    timer = root.setTimeout?.(flush, Math.max(0, Number(delay) || 0)) || 0;
    if (!timer) root.queueMicrotask?.(flush);
  };

  broker.ingestState = function gatedIngestState(state) {
    // startStateFeed() sets statesStarted before get_states and subscription only
    // after the initial snapshot has been ingested. Suppress that bootstrap
    // notification storm entirely.
    const bootstrapSnapshot = Boolean(this.statesStarted && !this.subscription);
    const dispatch = root.dispatchEvent;

    if (typeof dispatch !== "function") return original.call(this, state);

    root.dispatchEvent = function gatedDispatch(event) {
      if (event?.type === STATE_EVENT) {
        if (!bootstrapSnapshot) queue(state);
        return true;
      }
      return dispatch.call(root, event);
    };

    try {
      return original.call(this, state);
    } finally {
      root.dispatchEvent = dispatch;
    }
  };

  Object.defineProperty(broker, "__dmStateEventGate", {
    value: Object.freeze({ flush, pendingIds, currentInterests }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return true;
}

/**
 * Arm a setter before energy-section.js is evaluated. That makes the broker
 * gate installation synchronous with DashboardModernEnergyService assignment,
 * so there is no race with a very fast bridge/WebSocket during startup.
 */
export function armStateEventGate(root = globalThis) {
  const current = root[SERVICE_KEY];
  if (current?.broker) {
    installStateEventGate(current.broker, root);
    return true;
  }

  const descriptor = Object.getOwnPropertyDescriptor(root, SERVICE_KEY);
  if (descriptor && !descriptor.configurable) return false;
  if (descriptor?.set?.__dmStateEventGateSetter) return true;

  let value = descriptor?.value;
  const setter = function setEnergyService(next) {
    value = next;
    installStateEventGate(next?.broker, root);
  };
  Object.defineProperty(setter, "__dmStateEventGateSetter", { value: true });

  Object.defineProperty(root, SERVICE_KEY, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get() {
      return value;
    },
    set: setter,
  });
  return true;
}

armStateEventGate();
