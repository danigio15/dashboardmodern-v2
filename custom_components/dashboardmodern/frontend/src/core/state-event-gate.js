const STATE_EVENT = "dashboardmodern:state-changed";
const SERVICE_KEY = "DashboardModernEnergyService";

function makeEvent(root, detail) {
  if (typeof root.CustomEvent === "function") return new root.CustomEvent(STATE_EVENT, { detail });
  return { type: STATE_EVENT, detail };
}

/**
 * Prevent the initial Home Assistant get_states snapshot from producing one UI
 * event per entity, then coalesce live state_changed notifications into a
 * single short batch. State registries are still updated synchronously by the
 * original broker; only the expensive UI notification is gated.
 */
export function installStateEventGate(broker, root = globalThis, { delay = 40 } = {}) {
  if (!broker || typeof broker.ingestState !== "function" || broker.__dmStateEventGate) return false;

  const original = broker.ingestState;
  const pendingIds = new Set();
  let lastState = null;
  let timer = 0;

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
    if (id) pendingIds.add(id);
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
    value: Object.freeze({ flush, pendingIds }),
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
