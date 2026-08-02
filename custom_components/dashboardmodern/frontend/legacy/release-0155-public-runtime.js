/* DashboardModern 0.14.15: reconcile the live Home Assistant state already exposed by the panel bridge. */
const PUBLIC_RUNTIME_KEY = "__DASHBOARDMODERN_RELEASE_0155_PUBLIC_RUNTIME__";
const ON_STATES = new Set(["on", "playing", "heat", "cool", "open", "opening", "running", "active"]);

function runtime0155() {
  return (globalThis[PUBLIC_RUNTIME_KEY] ||= {
    installed: true,
    version: "0.14.15",
    states: new Map(),
    wrappersTimer: 0,
    sampleTimer: 0,
    lastSignature: "",
    lastTemperatureSignature: "",
  });
}

function isEnglish0155() {
  return globalThis.document?.documentElement?.lang === "en";
}

function copy0155(it, en) {
  return isEnglish0155() ? en : it;
}

function rawState0155(entity) {
  const id = String(entity || "").trim();
  if (!id) return null;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[id]) return _RAW_STATES[id];
  } catch (_error) {}
  try {
    if (globalThis._RAW_STATES?.[id]) return globalThis._RAW_STATES[id];
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES?.[id]) return STATES[id];
  } catch (_error) {}
  try {
    if (globalThis.STATES?.[id]) return globalThis.STATES[id];
  } catch (_error) {}
  return runtime0155().states.get(id) || null;
}

function rememberState0155(state, sync = true) {
  const id = String(state?.entity_id || "").trim();
  if (!id) return false;
  runtime0155().states.set(id, state);
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) _RAW_STATES[id] = state;
  } catch (_error) {}
  try {
    if (globalThis._RAW_STATES) globalThis._RAW_STATES[id] = state;
  } catch (_error) {}
  if (sync) syncRuntime0155(true);
  return true;
}

function rememberStates0155(states) {
  let changed = false;
  (Array.isArray(states) ? states : []).forEach((state) => {
    changed = rememberState0155(state, false) || changed;
  });
  if (changed) syncRuntime0155(true);
  return changed;
}

function numberState0155(entity) {
  const value = Number.parseFloat(rawState0155(entity)?.state);
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

function statusEntity0155(item) {
  return firstEntity0155(item, ["state_entity", "status_entity", "binary_sensor"]);
}

function powerEntity0155(item) {
  const explicit = firstEntity0155(item, ["power_entity", "power", "power_sensor"]);
  const candidates = [explicit, ...entityEntries0155(item)].filter(Boolean);
  return (
    candidates.find((entity) => {
      const state = rawState0155(entity);
      const unit = String(state?.attributes?.unit_of_measurement || "")
        .trim()
        .toLowerCase()
        .replaceAll(" ", "");
      return state?.attributes?.device_class === "power" || /^(w|kw|mw)$/.test(unit);
    }) ||
    explicit ||
    ""
  );
}

function relevantEntities0155() {
  const ids = new Set();
  configuredRooms0155().forEach((room) => {
    if (typeof room?.temp === "string" && room.temp) ids.add(room.temp);
    if (typeof room?.hum === "string" && room.hum) ids.add(room.hum);
  });
  configuredAppliances0155().forEach((item) => {
    [controlEntity0155(item), statusEntity0155(item), powerEntity0155(item)].forEach((id) => {
      if (id) ids.add(id);
    });
  });
  return [...ids];
}

function stateSignature0155() {
  return relevantEntities0155()
    .sort()
    .map((id) => {
      const state = rawState0155(id);
      if (state) runtime0155().states.set(id, state);
      return `${id}:${state?.state ?? ""}:${state?.last_updated ?? state?.last_changed ?? ""}`;
    })
    .join("|");
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

function temperatureSignature0155(rooms) {
  return rooms
    .map((room) => {
      const temp = rawState0155(room.temp);
      const humidity = rawState0155(room.hum);
      return `${room.id || room.name}:${temp?.state ?? ""}:${temp?.last_updated ?? ""}:${humidity?.state ?? ""}:${humidity?.last_updated ?? ""}`;
    })
    .join("|");
}

function syncTemperature0155(force = false) {
  const doc = globalThis.document;
  if (!doc) return false;
  const rooms = configuredRooms0155().filter(
    (room) => typeof room?.temp === "string" && room.temp.trim(),
  );
  if (!rooms.length) return false;

  const signature = temperatureSignature0155(rooms);
  if (!force && signature === runtime0155().lastTemperatureSignature) return false;
  runtime0155().lastTemperatureSignature = signature;

  const grid = doc.getElementById("temp-grid");
  if (grid && !grid.querySelector(".temp-card")) {
    try {
      globalThis.buildTempCards?.();
    } catch (_error) {}
  }

  let changed = false;
  rooms.forEach((room, index) => {
    const tempEntity = room.temp.trim();
    const humidityEntity =
      typeof room.hum === "string" && room.hum.trim()
        ? room.hum.trim()
        : tempEntity.replace("_temperature", "_humidity");
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
      card.dataset.dmLiveTemperature = temperature == null ? "unavailable" : tempText;
      card.dataset.dmLiveHumidity = humidity == null ? "unavailable" : humidityText;
    }
  });

  const updated = doc.getElementById("temp-last-update");
  if (updated && signature) {
    const now = new Date().toLocaleTimeString(isEnglish0155() ? "en-GB" : "it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    changed = setText0155(updated, `${copy0155("Aggiornato alle", "Updated at")} ${now}`) || changed;
  }
  return changed;
}

function applianceLiveState0155(item) {
  const control = controlEntity0155(item);
  const status = statusEntity0155(item);
  const power = powerEntity0155(item);
  const powerState = rawState0155(power);
  let watts = Number.parseFloat(powerState?.state);
  const unit = String(powerState?.attributes?.unit_of_measurement || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "");
  if (Number.isFinite(watts) && unit === "kw") watts *= 1000;
  else if (Number.isFinite(watts) && unit === "mw") watts *= 1_000_000;
  if (!Number.isFinite(watts)) watts = null;

  const binaryState = String(rawState0155(control)?.state ?? rawState0155(status)?.state ?? "").toLowerCase();
  const powered = ON_STATES.has(binaryState);
  const runThreshold = Number.isFinite(Number(item?.threshold_run)) ? Number(item.threshold_run) : 5;
  const standbyThreshold = Number.isFinite(Number(item?.threshold_standby))
    ? Number(item.threshold_standby)
    : 1;
  if (watts != null && watts >= runThreshold) return { state: "run", control };
  if (powered || (watts != null && watts >= standbyThreshold)) return { state: "on", control };
  return { state: "off", control };
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
      const active = live.state !== "off";
      if (card.classList.contains("on") !== active) {
        card.classList.toggle("on", active);
        changed = true;
      }
      if (card.dataset.dmLiveState !== live.state) {
        card.dataset.dmLiveState = live.state;
        changed = true;
      }

      const badge = card.querySelector(".appl-st");
      if (badge) {
        const label =
          live.state === "run"
            ? copy0155("In funzione", "Running")
            : live.state === "on"
              ? copy0155("Acceso", "On")
              : copy0155("Spento", "Off");
        if (
          !badge.classList.contains(live.state) ||
          ["run", "on", "off"].some(
            (state) => state !== live.state && badge.classList.contains(state),
          )
        ) {
          badge.classList.remove("run", "on", "off");
          badge.classList.add(live.state);
          changed = true;
        }
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
        const controlOn = ON_STATES.has(String(rawState0155(live.control)?.state || "").toLowerCase());
        if (button.classList.contains("on") !== controlOn) {
          button.classList.toggle("on", controlOn);
          changed = true;
        }
        const label = controlOn ? copy0155("Spegni", "Turn off") : copy0155("Accendi", "Turn on");
        changed = setText0155(button, label) || changed;
        if (button.getAttribute("aria-label") !== label) {
          button.setAttribute("aria-label", label);
          changed = true;
        }
        if (button.dataset.dmPowerToggle !== "true") {
          button.dataset.dmPowerToggle = "true";
          changed = true;
        }
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

function wrapRender0155(name, callback, swallowErrors = false) {
  const current = globalThis[name];
  if (typeof current !== "function" || functionChainHas0155(current, "__dm0155PublicRuntime")) {
    return false;
  }

  function publicRuntimeRender0155(...args) {
    let result;
    try {
      result = current.apply(this, args);
    } catch (error) {
      callback(true);
      if (!swallowErrors) throw error;
      return false;
    }
    const after = () => callback(true);
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
  wrapRender0155("renderTemperature", syncTemperature0155, true);
  wrapRender0155("renderApplianceSection", syncAppliances0155);
  wrapRender0155("renderAppliances", syncAppliances0155);
}

function syncRuntime0155(force = false) {
  installRenderWrappers0155();
  syncTemperature0155(force);
  syncAppliances0155();
}

function sampleStates0155() {
  const signature = stateSignature0155();
  const runtime = runtime0155();
  if (signature === runtime.lastSignature) return false;
  runtime.lastSignature = signature;
  syncRuntime0155(true);
  return true;
}

function install0155() {
  const runtime = runtime0155();
  runtime.installed = true;
  installRenderWrappers0155();
  sampleStates0155();

  if (!runtime.wrappersTimer) {
    let attempts = 0;
    runtime.wrappersTimer = globalThis.setInterval?.(() => {
      attempts += 1;
      installRenderWrappers0155();
      if (attempts >= 30) {
        globalThis.clearInterval?.(runtime.wrappersTimer);
        runtime.wrappersTimer = 0;
      }
    }, 100);
  }
  if (!runtime.sampleTimer) runtime.sampleTimer = globalThis.setInterval?.(sampleStates0155, 500);

  runtime.syncTemperature = (force = true) => syncTemperature0155(force);
  runtime.syncAppliances = syncAppliances0155;
  runtime.ingestState = rememberState0155;
  runtime.ingestStates = rememberStates0155;
  runtime.sampleStates = sampleStates0155;
}

if (typeof globalThis.document !== "undefined") {
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0155);
  globalThis.addEventListener?.("pageshow", install0155);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0155, { once: true });
  } else install0155();
}
