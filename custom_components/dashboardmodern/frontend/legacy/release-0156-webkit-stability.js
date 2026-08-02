/* DashboardModern 0.14.16: WebKit-safe live-state priority and one-shot legacy reconnect. */
const PUBLIC_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__";
const FINAL_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const STABILITY_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_WEBKIT_STABILITY__";

function stabilityState0156() {
  return (globalThis[STABILITY_KEY_0156] ||= {
    installed: true,
    armed: false,
    originalWebSocket: null,
    restoreTimer: 0,
    wrapperTimer: 0,
  });
}

function runtimeState0156(entity) {
  const id = String(entity || "").trim();
  if (!id) return null;
  const live = globalThis[PUBLIC_KEY_0156];
  const remembered = live?.states instanceof Map ? live.states.get(id) : null;
  if (remembered) return remembered;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[id]) return _RAW_STATES[id];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[id] || globalThis.STATES?.[id] || null;
}

function configuredRooms0156() {
  try {
    const rooms = globalThis.DashboardModernModules?.store?.getSection?.("rooms");
    if (Array.isArray(rooms)) return rooms;
  } catch (_error) {}
  try {
    if (typeof globalThis.getStanze === "function") {
      const rooms = globalThis.getStanze();
      if (Array.isArray(rooms)) return rooms;
    }
  } catch (_error) {}
  return [];
}

function entityDomId0156(entity) {
  return String(entity || "").replaceAll(".", "_").replaceAll("-", "_");
}

function syncRememberedTemperature0156() {
  const doc = globalThis.document;
  if (!doc) return false;
  let changed = false;
  configuredRooms0156().forEach((room) => {
    const tempEntity = String(room?.temp || "").trim();
    if (!tempEntity) return;
    const humidityEntity = String(room?.hum || tempEntity.replace("_temperature", "_humidity")).trim();
    const temperature = Number.parseFloat(runtimeState0156(tempEntity)?.state);
    const humidity = Number.parseFloat(runtimeState0156(humidityEntity)?.state);
    const tempText = Number.isFinite(temperature) ? temperature.toFixed(1) : "—";
    const humidityText = Number.isFinite(humidity) ? humidity.toFixed(0) : "—";
    const tempId = entityDomId0156(tempEntity);
    const humidityId = entityDomId0156(humidityEntity);

    const setText = (id, value) => {
      const node = doc.getElementById(id);
      if (!node || node.textContent === value) return;
      node.textContent = value;
      changed = true;
    };
    setText(`tv_${tempId}`, tempText);
    setText(`tbl_${tempId}`, `${tempText}°`);
    setText(`hbl_${humidityId}`, `${humidityText}%`);
    const humidityNode = doc.getElementById(`hv_${humidityId}`);
    if (humidityNode) {
      const html = `${humidityText}<span style="font-size:14px;opacity:0.75;">%</span>`;
      if (humidityNode.innerHTML !== html) {
        humidityNode.innerHTML = html;
        changed = true;
      }
    }
  });
  return changed;
}

function installLivePriority0156() {
  const runtime = globalThis[PUBLIC_KEY_0156];
  if (!runtime || runtime.__dm0156LivePriority) return Boolean(runtime?.__dm0156LivePriority);
  const previousSync = typeof runtime.syncTemperature === "function"
    ? runtime.syncTemperature.bind(runtime)
    : null;
  runtime.syncTemperature = function syncTemperature0156(force = true) {
    let result = false;
    try { result = previousSync ? previousSync(force) : false; } catch (_error) {}
    return syncRememberedTemperature0156() || result;
  };

  const previousIngestState = typeof runtime.ingestState === "function"
    ? runtime.ingestState.bind(runtime)
    : null;
  if (previousIngestState) {
    runtime.ingestState = function ingestState0156(state) {
      const result = previousIngestState(state);
      globalThis.queueMicrotask?.(syncRememberedTemperature0156);
      return result;
    };
  }
  const previousIngestStates = typeof runtime.ingestStates === "function"
    ? runtime.ingestStates.bind(runtime)
    : null;
  if (previousIngestStates) {
    runtime.ingestStates = function ingestStates0156(states) {
      const result = previousIngestStates(states);
      globalThis.queueMicrotask?.(syncRememberedTemperature0156);
      return result;
    };
  }
  runtime.__dm0156LivePriority = true;
  return true;
}

function rememberedStates0156() {
  const live = globalThis[PUBLIC_KEY_0156];
  if (live?.states instanceof Map && live.states.size) return [...live.states.values()];
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) return Object.values(_RAW_STATES);
  } catch (_error) {}
  return Object.values(globalThis._RAW_STATES || globalThis.STATES || {});
}

function createLegacyCompatSocket0156() {
  const listeners = new Map();
  const socket = {
    readyState: 1,
    url: "dashboardmodern://shared-runtime",
    protocol: "",
    extensions: "",
    bufferedAmount: 0,
    binaryType: "blob",
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    addEventListener(type, handler) {
      if (typeof handler !== "function") return;
      const list = listeners.get(type) || new Set();
      list.add(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    close() {
      // The shared broker owns the real transport. Closing this compatibility
      // facade must not schedule another legacy reconnect.
    },
  };

  const emit = (message) => {
    const event = new MessageEvent("message", { data: JSON.stringify(message) });
    globalThis.setTimeout?.(() => {
      try { socket.onmessage?.(event); } catch (_error) {}
      listeners.get("message")?.forEach((handler) => {
        try { handler.call(socket, event); } catch (_error) {}
      });
    }, 0);
  };

  socket.send = (raw) => {
    let message;
    try { message = JSON.parse(raw); } catch (_error) { return; }
    if (message.type === "auth") {
      emit({ type: "auth_ok" });
      return;
    }
    if (message.type === "get_states") {
      emit({ id: message.id, type: "result", success: true, result: rememberedStates0156() });
      return;
    }
    if (message.type === "subscribe_events") {
      emit({ id: message.id, type: "result", success: true, result: null });
      return;
    }
    if (message.type === "frontend/get_user_data") {
      emit({ id: message.id, type: "result", success: true, result: { value: null } });
      return;
    }
    const shared = globalThis[FINAL_KEY_0156]?.socket;
    if (shared?.readyState === 1 && typeof shared.send === "function") {
      try { shared.send(raw); return; } catch (_error) {}
    }
    if (message.id != null) emit({ id: message.id, type: "result", success: true, result: null });
  };

  globalThis.setTimeout?.(() => emit({ type: "auth_required" }), 0);
  return socket;
}

function armLegacyReconnect0156() {
  const state = stabilityState0156();
  if (state.armed || typeof globalThis.WebSocket !== "function") return false;
  const original = globalThis.WebSocket;
  state.originalWebSocket = original;
  state.armed = true;

  function OneShotWebSocket0156(...args) {
    const status = String(globalThis.document?.getElementById?.("conn-text")?.textContent || "").toLowerCase();
    const live = globalThis[PUBLIC_KEY_0156];
    const finalRuntime = globalThis[FINAL_KEY_0156];
    const canReuse = Boolean(live?.states?.size || finalRuntime?.installed || finalRuntime?.ready);
    const isLegacyReconnect = status.includes("riconnessione") || status.includes("reconnect");
    if (canReuse && isLegacyReconnect) {
      globalThis.WebSocket = original;
      state.armed = false;
      globalThis.clearTimeout?.(state.restoreTimer);
      return createLegacyCompatSocket0156();
    }
    return Reflect.construct(original, args);
  }
  OneShotWebSocket0156.prototype = original.prototype;
  ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach((key, index) => {
    OneShotWebSocket0156[key] = original[key] ?? index;
  });
  globalThis.WebSocket = OneShotWebSocket0156;
  state.restoreTimer = globalThis.setTimeout?.(() => {
    if (globalThis.WebSocket === OneShotWebSocket0156) globalThis.WebSocket = original;
    state.armed = false;
  }, 8000);
  return true;
}

function reinforce0156() {
  installLivePriority0156();
  syncRememberedTemperature0156();
  armLegacyReconnect0156();
}

function install0156() {
  reinforce0156();
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    globalThis.setTimeout?.(reinforce0156, 0);
  });
  globalThis.addEventListener?.("pageshow", () => globalThis.setTimeout?.(reinforce0156, 0));
  const state = stabilityState0156();
  let attempts = 0;
  state.wrapperTimer = globalThis.setInterval?.(() => {
    attempts += 1;
    installLivePriority0156();
    if (!state.armed) armLegacyReconnect0156();
    if (attempts >= 60 || (globalThis[PUBLIC_KEY_0156]?.__dm0156LivePriority && state.armed)) {
      globalThis.clearInterval?.(state.wrapperTimer);
      state.wrapperTimer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") install0156();
