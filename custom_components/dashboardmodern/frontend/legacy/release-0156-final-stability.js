/* DashboardModern 0.14.16: final live-state and reconnect stability owner. */
const PUBLIC_KEY_0156_FINAL = "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__";
const BROKER_KEY_0156_FINAL = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const FINAL_STABILITY_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_STABILITY__";

function finalStabilityState0156() {
  return (globalThis[FINAL_STABILITY_KEY_0156] ||= {
    installed: true,
    timer: 0,
  });
}

function legacyState0156(entity) {
  const id = String(entity || "").trim();
  if (!id) return null;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[id]) return _RAW_STATES[id];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[id] || globalThis.STATES?.[id] || null;
}

function usableLegacyState0156(state) {
  const value = String(state?.state ?? "").trim().toLowerCase();
  return Boolean(value && !["unknown", "unavailable", "none", "null", "—", "-"].includes(value));
}

function preferredState0156(entity) {
  const id = String(entity || "").trim();
  const legacy = legacyState0156(id);
  if (usableLegacyState0156(legacy)) return legacy;
  const runtime = globalThis[PUBLIC_KEY_0156_FINAL];
  return runtime?.states instanceof Map ? runtime.states.get(id) || legacy : legacy;
}

function mirrorLegacyState0156(state) {
  const id = String(state?.entity_id || "").trim();
  if (!id) return false;
  const mirrored = {
    ...state,
    entity_id: id,
    attributes: { ...(state.attributes || {}) },
  };
  let written = false;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) {
      _RAW_STATES[id] = mirrored;
      written = true;
    }
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES) {
      STATES[id] = mirrored;
      written = true;
    }
  } catch (_error) {}
  if (globalThis._RAW_STATES && typeof globalThis._RAW_STATES === "object") {
    globalThis._RAW_STATES[id] = mirrored;
    written = true;
  }
  if (globalThis.STATES && typeof globalThis.STATES === "object") {
    globalThis.STATES[id] = mirrored;
    written = true;
  }
  return written;
}

function configuredRooms0156Final() {
  try {
    const rooms = globalThis.DashboardModernModules?.store?.getSection?.("rooms");
    if (Array.isArray(rooms)) return rooms;
  } catch (_error) {}
  try {
    const rooms = globalThis.getStanze?.();
    if (Array.isArray(rooms)) return rooms;
  } catch (_error) {}
  return [];
}

function entityDomId0156Final(entity) {
  return String(entity || "").replaceAll(".", "_").replaceAll("-", "_");
}

function syncTemperature0156Final() {
  const doc = globalThis.document;
  if (!doc) return false;
  let changed = false;
  const setText = (id, value) => {
    const node = doc.getElementById(id);
    if (!node || node.textContent === value) return;
    node.textContent = value;
    changed = true;
  };

  configuredRooms0156Final().forEach((room) => {
    const tempEntity = String(room?.temp || "").trim();
    if (!tempEntity) return;
    const humidityEntity = String(
      room?.hum || tempEntity.replace("_temperature", "_humidity"),
    ).trim();
    const temperature = Number.parseFloat(preferredState0156(tempEntity)?.state);
    const humidity = Number.parseFloat(preferredState0156(humidityEntity)?.state);
    const tempText = Number.isFinite(temperature) ? temperature.toFixed(1) : "—";
    const humidityText = Number.isFinite(humidity) ? humidity.toFixed(0) : "—";
    const tempId = entityDomId0156Final(tempEntity);
    const humidityId = entityDomId0156Final(humidityEntity);

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

function scheduleTemperatureSync0156Final() {
  syncTemperature0156Final();
  globalThis.queueMicrotask?.(syncTemperature0156Final);
  globalThis.setTimeout?.(syncTemperature0156Final, 0);
  globalThis.setTimeout?.(syncTemperature0156Final, 60);
}

function installLiveStateOwner0156() {
  const runtime = globalThis[PUBLIC_KEY_0156_FINAL];
  if (!runtime) return false;
  if (!runtime.__dm0156FinalStateOwner) {
    if (runtime.states instanceof Map) {
      runtime.states.forEach(mirrorLegacyState0156);
    }

    const previousSync = typeof runtime.syncTemperature === "function"
      ? runtime.syncTemperature.bind(runtime)
      : null;
    runtime.syncTemperature = function syncTemperatureOwner0156(force = true) {
      let result = false;
      try { result = previousSync ? previousSync(force) : false; } catch (_error) {}
      scheduleTemperatureSync0156Final();
      return result;
    };

    const previousIngestState = typeof runtime.ingestState === "function"
      ? runtime.ingestState.bind(runtime)
      : null;
    if (previousIngestState) {
      runtime.ingestState = function ingestStateOwner0156(state) {
        const result = previousIngestState(state);
        mirrorLegacyState0156(state);
        scheduleTemperatureSync0156Final();
        return result;
      };
    }

    const previousIngestStates = typeof runtime.ingestStates === "function"
      ? runtime.ingestStates.bind(runtime)
      : null;
    if (previousIngestStates) {
      runtime.ingestStates = function ingestStatesOwner0156(states) {
        const result = previousIngestStates(states);
        (Array.isArray(states) ? states : []).forEach(mirrorLegacyState0156);
        scheduleTemperatureSync0156Final();
        return result;
      };
    }
    runtime.__dm0156FinalStateOwner = true;
  }

  const currentRender = globalThis.renderTemperature;
  if (typeof currentRender === "function" && !currentRender.__dm0156FinalStateOwner) {
    function renderTemperatureOwner0156(...args) {
      const result = currentRender.apply(this, args);
      scheduleTemperatureSync0156Final();
      return result;
    }
    renderTemperatureOwner0156.__dm0156FinalStateOwner = true;
    renderTemperatureOwner0156.__dmPrevious = currentRender;
    globalThis.renderTemperature = renderTemperatureOwner0156;
  }
  return true;
}

function rememberedStates0156Final() {
  const runtime = globalThis[PUBLIC_KEY_0156_FINAL];
  if (runtime?.states instanceof Map && runtime.states.size) return [...runtime.states.values()];
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) return Object.values(_RAW_STATES);
  } catch (_error) {}
  return Object.values(globalThis._RAW_STATES || globalThis.STATES || {});
}

function messageEvent0156Final(message) {
  const data = JSON.stringify(message);
  try { return new MessageEvent("message", { data }); }
  catch (_error) { return { type: "message", data }; }
}

function createSharedFacade0156() {
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
      const bucket = listeners.get(type) || new Set();
      bucket.add(handler);
      listeners.set(type, bucket);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    close() {},
  };

  const emit = (message) => {
    const event = messageEvent0156Final(message);
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
    const broker = globalThis[BROKER_KEY_0156_FINAL];
    if (message.type === "call_service" && broker?.socket?.readyState === 1) {
      try { broker.socket.send(raw); } catch (_error) {}
      return;
    }
    if (message.type === "auth") {
      emit({ type: "auth_ok" });
      return;
    }
    if (message.type === "get_states") {
      emit({ id: message.id, type: "result", success: true, result: rememberedStates0156Final() });
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
    emit({ id: message.id, type: "result", success: true, result: [] });
  };

  return socket;
}

function assignLegacySocket0156(socket) {
  let assigned = false;
  try {
    if (typeof ws !== "undefined") {
      ws = socket;
      assigned = true;
    }
  } catch (_error) {}
  if (Object.prototype.hasOwnProperty.call(globalThis, "ws")) {
    try {
      globalThis.ws = socket;
      assigned = true;
    } catch (_error) {}
  }
  return assigned;
}

function markConnected0156() {
  const text = globalThis.document?.getElementById?.("conn-text");
  if (text) text.textContent = "Connesso";
  globalThis.document?.getElementById?.("live-dot")?.classList?.add?.("connected");
}

function installReconnectOwner0156() {
  const current = globalThis.connect;
  if (typeof current !== "function" || current.__dm0156SharedReconnectOwner) {
    return Boolean(current?.__dm0156SharedReconnectOwner);
  }

  async function sharedReconnectOwner0156(...args) {
    const broker = globalThis[BROKER_KEY_0156_FINAL];
    const live = globalThis[PUBLIC_KEY_0156_FINAL];
    const canReuse = Boolean(
      broker?.socket?.readyState === 1 ||
      live?.states?.size,
    );
    if (!canReuse) return current.apply(this, args);
    const facade = createSharedFacade0156();
    assignLegacySocket0156(facade);
    markConnected0156();
    return true;
  }

  sharedReconnectOwner0156.__dm0156SharedReconnectOwner = true;
  sharedReconnectOwner0156.__dmPrevious = current;
  globalThis.connect = sharedReconnectOwner0156;
  return true;
}

function reinforceFinalStability0156() {
  installLiveStateOwner0156();
  installReconnectOwner0156();
  scheduleTemperatureSync0156Final();
}

function installFinalStability0156() {
  reinforceFinalStability0156();
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    globalThis.setTimeout?.(reinforceFinalStability0156, 0);
    globalThis.setTimeout?.(reinforceFinalStability0156, 80);
  });
  globalThis.addEventListener?.("pageshow", () => {
    globalThis.setTimeout?.(reinforceFinalStability0156, 0);
    globalThis.setTimeout?.(reinforceFinalStability0156, 80);
  });

  const state = finalStabilityState0156();
  globalThis.clearInterval?.(state.timer);
  let attempts = 0;
  state.timer = globalThis.setInterval?.(() => {
    attempts += 1;
    reinforceFinalStability0156();
    if (attempts >= 80 || (
      globalThis[PUBLIC_KEY_0156_FINAL]?.__dm0156FinalStateOwner &&
      globalThis.connect?.__dm0156SharedReconnectOwner
    )) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") installFinalStability0156();
