/* DashboardModern 0.14.15: live Home Assistant truth for temperature and appliances. */
const PUBLIC_RUNTIME_KEY = "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__";
const ON_STATES = new Set(["on", "playing", "heat", "cool", "open", "opening", "running", "active"]);

function runtime0155() {
  return (globalThis[PUBLIC_RUNTIME_KEY] ||= {
    installed: true,
    version: "0.14.15",
    states: new Map(),
    socket: null,
    socketRetry: 0,
    messageId: 155000,
    observer: null,
    wrapperTimer: 0,
    syncTimer: 0,
  });
}

function isEnglish0155() {
  return globalThis.document?.documentElement?.lang === "en";
}

function copy0155(it, en) {
  return isEnglish0155() ? en : it;
}

function stateId0155(state) {
  return String(state?.entity_id || "").trim();
}

function writeLegacyState0155(state) {
  const id = stateId0155(state);
  if (!id) return;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) _RAW_STATES[id] = state;
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES) STATES[id] = state;
  } catch (_error) {}
  try {
    if (globalThis._RAW_STATES) globalThis._RAW_STATES[id] = state;
  } catch (_error) {}
  try {
    if (globalThis.STATES) globalThis.STATES[id] = state;
  } catch (_error) {}
}

function rememberState0155(state, schedule = true) {
  const id = stateId0155(state);
  if (!id) return false;
  const runtime = runtime0155();
  runtime.states.set(id, state);
  writeLegacyState0155(state);
  if (schedule) scheduleRuntimeSync0155();
  return true;
}

function rememberStates0155(states) {
  let changed = false;
  (Array.isArray(states) ? states : []).forEach((state) => {
    changed = rememberState0155(state, false) || changed;
  });
  if (changed) scheduleRuntimeSync0155();
  return changed;
}

function exactState0155(entity) {
  const id = String(entity || "").trim();
  if (!id) return null;
  const mirrored = runtime0155().states.get(id);
  if (mirrored) return mirrored;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[id]) return _RAW_STATES[id];
  } catch (_error) {}
  try {
    if (globalThis._RAW_STATES?.[id]) return globalThis._RAW_STATES[id];
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES?.[id]) return STATES[id];
  } catch (_error) {}
  return globalThis.STATES?.[id] || null;
}

function numberState0155(entity) {
  const value = Number.parseFloat(exactState0155(entity)?.state);
  return Number.isFinite(value) ? value : null;
}

function configuredRooms0155() {
  try {
    const rooms = globalThis.DashboardModernModules?.store?.getSection?.("rooms");
    if (Array.isArray(rooms)) return rooms;
  } catch (_error) {}
  try {
    if (typeof getStanze === "function") {
      const rooms = getStanze();
      if (Array.isArray(rooms)) return rooms;
    }
  } catch (_error) {}
  return [];
}

function configuredAppliances0155() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    if (Array.isArray(items)) return items;
  } catch (_error) {}
  try {
    if (typeof getAppliances === "function") {
      const items = getAppliances();
      if (Array.isArray(items)) return items;
    }
  } catch (_error) {}
  return [];
}

function entityDomId0155(entity) {
  return String(entity || "").replaceAll(".", "_").replaceAll("-", "_");
}

function setText0155(node, value) {
  if (!node || node.textContent === value) return false;
  node.textContent = value;
  return true;
}

function setHtml0155(node, value) {
  if (!node || node.innerHTML === value) return false;
  node.innerHTML = value;
  return true;
}

function setWidth0155(node, value) {
  if (!node || node.style.width === value) return false;
  node.style.width = value;
  return true;
}

function syncTemperature0155() {
  const doc = globalThis.document;
  if (!doc) return false;
  const rooms = configuredRooms0155().filter((room) => room?.temp || room?.hum);
  const grid = doc.getElementById("temp-grid");
  if (rooms.length && grid && !grid.querySelector(".temp-card")) {
    try {
      globalThis.buildTempCards?.();
    } catch (_error) {}
  }

  let changed = false;
  rooms.forEach((room, index) => {
    const tempEntity = String(room?.temp || "").trim();
    const humidityEntity = String(
      room?.hum || (tempEntity ? tempEntity.replace("_temperature", "_humidity") : ""),
    ).trim();
    const temperature = numberState0155(tempEntity);
    const humidity = numberState0155(humidityEntity);
    const tempId = entityDomId0155(tempEntity);
    const humidityId = entityDomId0155(humidityEntity);

    const tempText = temperature == null ? "—" : temperature.toFixed(1);
    const humidityText = humidity == null ? "—" : humidity.toFixed(0);
    changed = setText0155(doc.getElementById(`tv_${tempId}`), tempText) || changed;
    changed = setText0155(doc.getElementById(`tbl_${tempId}`), `${tempText}°`) || changed;
    changed =
      setWidth0155(
        doc.getElementById(`tb_${tempId}`),
        temperature == null
          ? "0%"
          : `${Math.min(100, Math.max(0, ((temperature - 10) / 25) * 100))}%`,
      ) || changed;
    changed =
      setHtml0155(
        doc.getElementById(`hv_${humidityId}`),
        `${humidityText}<span style="font-size:14px;opacity:0.75;">%</span>`,
      ) || changed;
    changed = setText0155(doc.getElementById(`hbl_${humidityId}`), `${humidityText}%`) || changed;
    changed =
      setWidth0155(
        doc.getElementById(`hb_${humidityId}`),
        humidity == null ? "0%" : `${Math.min(100, Math.max(0, humidity))}%`,
      ) || changed;

    const cards = [...doc.querySelectorAll("#temp-grid .temp-card")];
    const card =
      cards.find((candidate) => String(candidate.dataset.roomId || "") === String(room.id || "")) ||
      cards.find(
        (candidate) =>
          (candidate.querySelector(".cp-name")?.textContent || "").trim() ===
          String(room.name || "").trim(),
      ) ||
      cards[index];
    if (card) {
      const fallbackTemperature = card.querySelector(".temp-value");
      if (fallbackTemperature && !fallbackTemperature.id) {
        changed = setText0155(fallbackTemperature, tempText) || changed;
      }
      const fallbackHumidity = card.querySelector(
        ".humidity-value,.hum-value,[data-humidity-value]",
      );
      if (fallbackHumidity && !fallbackHumidity.id) {
        changed = setText0155(fallbackHumidity, humidityText) || changed;
      }
      card.dataset.dmLiveTemperature = temperature == null ? "unavailable" : tempText;
      card.dataset.dmLiveHumidity = humidity == null ? "unavailable" : humidityText;
    }
  });

  const updated = doc.getElementById("temp-last-update");
  if (updated && rooms.some((room) => exactState0155(room.temp) || exactState0155(room.hum))) {
    const now = new Date().toLocaleTimeString(isEnglish0155() ? "en-GB" : "it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    changed = setText0155(updated, `${copy0155("Aggiornato alle", "Updated at")} ${now}`) || changed;
  }
  return changed;
}

function entityEntries0155(item) {
  return [
    ...new Set(
      (Array.isArray(item?.entities) ? item.entities : [])
        .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
        .filter(Boolean),
    ),
  ];
}

function firstEntity0155(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    const entity = typeof value === "string" ? value : value?.entity;
    if (entity) return entity;
  }
  return "";
}

function controlEntity0155(item) {
  const explicit = firstEntity0155(item, [
    "control_entity",
    "switch_entity",
    "switch",
    "light",
    "fan",
  ]);
  if (/^(switch|light|input_boolean|fan)\./i.test(explicit)) return explicit;
  return (
    entityEntries0155(item).find((entity) => /^(switch|light|input_boolean|fan)\./i.test(entity)) ||
    ""
  );
}

function stateEntity0155(item) {
  return firstEntity0155(item, ["state_entity", "status_entity", "binary_sensor", "control_entity"]);
}

function powerEntity0155(item) {
  const explicit = firstEntity0155(item, ["power_entity", "power", "power_sensor"]);
  const candidates = [explicit, ...entityEntries0155(item)].filter(Boolean);
  return (
    candidates.find((entity) => {
      const state = exactState0155(entity);
      const unit = String(state?.attributes?.unit_of_measurement || "")
        .toLowerCase()
        .replaceAll(" ", "");
      return state?.attributes?.device_class === "power" || /^(w|kw|mw)$/.test(unit);
    }) ||
    explicit ||
    ""
  );
}

function applianceLiveState0155(item) {
  const control = controlEntity0155(item);
  const status = stateEntity0155(item);
  const power = powerEntity0155(item);
  const powerState = exactState0155(power);
  let watts = Number.parseFloat(powerState?.state);
  const unit = String(powerState?.attributes?.unit_of_measurement || "")
    .toLowerCase()
    .replaceAll(" ", "");
  if (Number.isFinite(watts) && unit === "kw") watts *= 1000;
  else if (Number.isFinite(watts) && unit === "mw") watts *= 1_000_000;
  if (!Number.isFinite(watts)) watts = null;

  const binaryState = String(
    exactState0155(control)?.state ?? exactState0155(status)?.state ?? "",
  ).toLowerCase();
  const powered = ON_STATES.has(binaryState);
  const runThreshold = Number.isFinite(Number(item?.threshold_run)) ? Number(item.threshold_run) : 5;
  const standbyThreshold = Number.isFinite(Number(item?.threshold_standby))
    ? Number(item.threshold_standby)
    : 1;
  if (watts != null && watts >= runThreshold) return { state: "run", watts, control, powered };
  if (powered || (watts != null && watts >= standbyThreshold)) {
    return { state: "on", watts, control, powered };
  }
  return { state: "off", watts, control, powered };
}

function syncAppliances0155() {
  const doc = globalThis.document;
  if (!doc) return false;
  const items = configuredAppliances0155();
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  let changed = false;
  doc
    .querySelectorAll(
      "#appl-grid-overview .appl-wide-card[data-appliance-id],#page-appliances-main .appl-wide-card[data-appliance-id]",
    )
    .forEach((card, index) => {
      const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
      if (!item) return;
      const live = applianceLiveState0155(item);
      const active = live.state === "run" || live.state === "on";
      if (card.classList.contains("on") !== active) {
        card.classList.toggle("on", active);
        changed = true;
      }
      card.dataset.dmLiveState = live.state;
      const badge = card.querySelector(".appl-st");
      if (badge) {
        badge.classList.remove("run", "on", "off");
        badge.classList.add(live.state);
        const label =
          live.state === "run"
            ? copy0155("In funzione", "Running")
            : live.state === "on"
              ? copy0155("Acceso", "On")
              : copy0155("Spento", "Off");
        changed = setText0155(badge, `● ${label}`) || changed;
      }

      const button = [...card.querySelectorAll("button")].find((candidate) => {
        const onclick = candidate.getAttribute("onclick") || "";
        return (
          candidate.dataset.dmPowerToggle === "true" ||
          candidate.classList.contains("dm-appliance-power-toggle") ||
          /cdApplEntTog/.test(onclick) ||
          /^(⏻|Accendi|Spegni|Turn on|Turn off)$/i.test(candidate.textContent.trim())
        );
      });
      if (button && live.control) {
        const controlOn = ON_STATES.has(
          String(exactState0155(live.control)?.state || "").toLowerCase(),
        );
        if (button.classList.contains("on") !== controlOn) {
          button.classList.toggle("on", controlOn);
          changed = true;
        }
        const label = controlOn ? copy0155("Spegni", "Turn off") : copy0155("Accendi", "Turn on");
        changed = setText0155(button, label) || changed;
        if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
        button.dataset.dmPowerToggle = "true";
      }
    });
  return changed;
}

function functionChainHas0155(fn, marker) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current[marker]) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function wrapRender0155(name, callback) {
  const current = globalThis[name];
  if (typeof current !== "function" || functionChainHas0155(current, "__dm0155PublicRuntime")) {
    return false;
  }
  function publicRuntimeRender0155(...args) {
    const result = current.apply(this, args);
    const after = () => {
      callback();
      scheduleRuntimeSync0155();
    };
    if (result && typeof result.finally === "function") return result.finally(after);
    after();
    return result;
  }
  publicRuntimeRender0155.__dm0155PublicRuntime = true;
  publicRuntimeRender0155.__dmPrevious = current;
  globalThis[name] = publicRuntimeRender0155;
  return true;
}

function installRenderWrappers0155() {
  wrapRender0155("renderTemperature", syncTemperature0155);
  wrapRender0155("renderApplianceSection", syncAppliances0155);
  wrapRender0155("renderAppliances", syncAppliances0155);
}

function installObserver0155() {
  const runtime = runtime0155();
  if (
    runtime.observer ||
    !globalThis.document?.documentElement ||
    typeof MutationObserver !== "function"
  ) {
    return;
  }
  runtime.observer = new MutationObserver((records) => {
    const runtimeChanged = records.some((record) => {
      const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
      return Boolean(target?.closest?.("#temp-grid,#appl-grid-overview,#page-appliances-main"));
    });
    if (runtimeChanged) scheduleRuntimeSync0155();
  });
  runtime.observer.observe(globalThis.document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function socketToken0155() {
  const candidates = [
    globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
    globalThis.parent?.__DASHBOARDMODERN_REAL_TOKEN__,
    globalThis.DASHBOARDMODERN_AUTH_TOKEN,
    globalThis.LONG_LIVED_TOKEN,
    globalThis.HA_TOKEN,
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function sendSocket0155(socket, payload) {
  const id = ++runtime0155().messageId;
  socket.send(JSON.stringify({ id, ...payload }));
  return id;
}

function connectStateBridge0155() {
  const runtime = runtime0155();
  if (runtime.socket && [0, 1].includes(runtime.socket.readyState)) return runtime.socket;
  if (typeof globalThis.WebSocket !== "function" || !globalThis.location) return null;
  const protocol = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
  let socket;
  try {
    socket = new globalThis.WebSocket(`${protocol}//${globalThis.location.host}/api/websocket`);
  } catch (_error) {
    return null;
  }
  runtime.socket = socket;
  let stateRequestId = 0;
  let subscriptionId = 0;
  const subscribe = () => {
    stateRequestId = sendSocket0155(socket, { type: "get_states" });
    subscriptionId = sendSocket0155(socket, {
      type: "subscribe_events",
      event_type: "state_changed",
    });
  };
  socket.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (_error) {
      return;
    }
    if (message.type === "auth_required") {
      const token = socketToken0155();
      if (token) socket.send(JSON.stringify({ type: "auth", access_token: token }));
      return;
    }
    if (message.type === "auth_ok") {
      subscribe();
      return;
    }
    if (message.type === "result" && message.id === stateRequestId && Array.isArray(message.result)) {
      rememberStates0155(message.result);
      return;
    }
    if (message.type === "event" && message.id === subscriptionId) {
      const next = message.event?.data?.new_state;
      const old = message.event?.data?.old_state;
      if (next) rememberState0155(next);
      else if (old?.entity_id) runtime.states.delete(old.entity_id);
    }
  };
  socket.onclose = () => {
    if (runtime.socket === socket) runtime.socket = null;
    globalThis.clearTimeout?.(runtime.socketRetry);
    runtime.socketRetry = globalThis.setTimeout?.(connectStateBridge0155, 3000);
  };
  socket.onerror = () => {};
  return socket;
}

function syncRuntime0155() {
  installRenderWrappers0155();
  syncTemperature0155();
  syncAppliances0155();
}

let syncQueued0155 = false;
function scheduleRuntimeSync0155() {
  if (syncQueued0155) return;
  syncQueued0155 = true;
  const run = () => {
    syncQueued0155 = false;
    syncRuntime0155();
  };
  globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
}

function install0155() {
  const runtime = runtime0155();
  runtime.installed = true;
  installRenderWrappers0155();
  installObserver0155();
  connectStateBridge0155();
  syncRuntime0155();

  if (!runtime.wrapperTimer) {
    let attempts = 0;
    runtime.wrapperTimer = globalThis.setInterval?.(() => {
      attempts += 1;
      installRenderWrappers0155();
      syncRuntime0155();
      if (attempts >= 150) {
        globalThis.clearInterval?.(runtime.wrapperTimer);
        runtime.wrapperTimer = 0;
      }
    }, 100);
  }
  if (!runtime.syncTimer) runtime.syncTimer = globalThis.setInterval?.(syncRuntime0155, 1000);

  runtime.syncTemperature = syncTemperature0155;
  runtime.syncAppliances = syncAppliances0155;
  runtime.ingestState = rememberState0155;
  runtime.ingestStates = rememberStates0155;
}

if (typeof globalThis.document !== "undefined") {
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0155);
  globalThis.addEventListener?.("pageshow", install0155);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0155, { once: true });
  } else install0155();
}
