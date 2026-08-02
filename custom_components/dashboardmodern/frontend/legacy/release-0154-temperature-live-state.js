/* DashboardModern 0.14.14: keep saved room sensors live even when canonical overrides exist. */
const TEMPERATURE_LIVE_KEY = "__DASHBOARDMODERN_RELEASE_0154_TEMPERATURE_LIVE__";

function functionChainHasTemperature0154(fn) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current.__dm0154TemperatureLive) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function exactState0154(entity) {
  const id = String(entity || "").trim();
  if (!id) return null;
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[id]) return _RAW_STATES[id];
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES?.[id]) return STATES[id];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[id] || globalThis.STATES?.[id] || null;
}

function numericState0154(entity) {
  const state = exactState0154(entity);
  const value = Number.parseFloat(state?.state);
  return Number.isFinite(value) ? value : null;
}

function rooms0154() {
  try {
    if (typeof getStanze === "function") {
      const rooms = getStanze();
      if (Array.isArray(rooms)) return rooms;
    }
  } catch (_error) {}
  try {
    const rooms = globalThis.DashboardModernModules?.store?.getSection?.("rooms");
    return Array.isArray(rooms) ? rooms : [];
  } catch (_error) {
    return [];
  }
}

function roomFloor0154(room) {
  return room?.floor || room?.name || "Altro";
}

function syncFloorAverages0154(rooms) {
  globalThis.document?.querySelectorAll?.(".tfl-avg").forEach((element) => {
    const values = rooms
      .filter((room) => roomFloor0154(room) === element.dataset.floor)
      .map((room) => numericState0154(room.temp))
      .filter((value) => value != null);
    const next = values.length
      ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)}°`
      : "—°";
    if (element.textContent !== next) element.textContent = next;
  });
}

function syncTemperatureCards0154() {
  const doc = globalThis.document;
  if (!doc) return false;
  const rooms = rooms0154();
  syncFloorAverages0154(rooms);

  const minimum = 10;
  const maximum = 35;
  rooms.forEach((room) => {
    const temperatureEntity = String(room?.temp || "").trim();
    if (!temperatureEntity) return;
    const humidityEntity = String(
      room?.hum || temperatureEntity.replace("_temperature", "_humidity"),
    ).trim();
    const temperatureId = temperatureEntity.replaceAll(".", "_").replaceAll("-", "_");
    const humidityId = humidityEntity.replaceAll(".", "_").replaceAll("-", "_");
    const temperature = numericState0154(temperatureEntity);
    const humidity = numericState0154(humidityEntity);

    const value = doc.getElementById(`tv_${temperatureId}`);
    const bar = doc.getElementById(`tb_${temperatureId}`);
    const barLabel = doc.getElementById(`tbl_${temperatureId}`);
    const comfort = doc.getElementById(`tc_${temperatureId}`);
    if (value) {
      if (temperature == null) {
        if (value.textContent !== "—") value.textContent = "—";
        if (bar && bar.style.width !== "0%") bar.style.width = "0%";
        if (barLabel && barLabel.textContent !== "—°") barLabel.textContent = "—°";
        if (comfort && comfort.textContent !== "—") comfort.textContent = "—";
      } else {
        const text = temperature.toFixed(1);
        if (value.textContent !== text) value.textContent = text;
        const width = `${Math.min(100, Math.max(0, ((temperature - minimum) / (maximum - minimum)) * 100))}%`;
        if (bar && bar.style.width !== width) bar.style.width = width;
        if (barLabel && barLabel.textContent !== `${text}°`) barLabel.textContent = `${text}°`;
        let badge = "🟢";
        let label = doc.documentElement.lang === "en" ? "Comfort" : "Comfort";
        if (temperature < 16) {
          badge = "❄️";
          label = doc.documentElement.lang === "en" ? "Cold" : "Freddo";
        } else if (temperature < 19) {
          badge = "🔵";
          label = doc.documentElement.lang === "en" ? "Cool" : "Fresco";
        } else if (temperature > 27) {
          badge = "🔥";
          label = doc.documentElement.lang === "en" ? "Hot" : "Caldo";
        } else if (temperature > 24) {
          badge = "🟡";
          label = doc.documentElement.lang === "en" ? "Warm" : "Tiepido";
        }
        if (comfort) {
          if (comfort.textContent !== badge) comfort.textContent = badge;
          if (comfort.getAttribute("title") !== label) comfort.setAttribute("title", label);
        }
      }
    }

    const humidityValue = doc.getElementById(`hv_${humidityId}`);
    const humidityBar = doc.getElementById(`hb_${humidityId}`);
    const humidityLabel = doc.getElementById(`hbl_${humidityId}`);
    if (humidityValue) {
      if (humidity == null) {
        const html = '—<span style="font-size:14px;opacity:0.75;">%</span>';
        if (humidityValue.innerHTML !== html) humidityValue.innerHTML = html;
        if (humidityBar && humidityBar.style.width !== "0%") humidityBar.style.width = "0%";
        if (humidityLabel && humidityLabel.textContent !== "—%") humidityLabel.textContent = "—%";
      } else {
        const rounded = humidity.toFixed(0);
        const html = `${rounded}<span style="font-size:14px;opacity:0.75;">%</span>`;
        if (humidityValue.innerHTML !== html) humidityValue.innerHTML = html;
        const width = `${Math.min(100, humidity)}%`;
        if (humidityBar && humidityBar.style.width !== width) humidityBar.style.width = width;
        if (humidityLabel && humidityLabel.textContent !== `${rounded}%`) {
          humidityLabel.textContent = `${rounded}%`;
        }
      }
    }
  });
  return true;
}

function installTemperatureLive0154() {
  const current = globalThis.renderTemperature;
  if (typeof current !== "function" || functionChainHasTemperature0154(current)) return false;

  function liveTemperatureRender0154(...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(syncTemperatureCards0154);
    }
    syncTemperatureCards0154();
    return result;
  }

  liveTemperatureRender0154.__dm0154TemperatureLive = true;
  liveTemperatureRender0154.__dmPrevious = current;
  globalThis.renderTemperature = liveTemperatureRender0154;
  globalThis[TEMPERATURE_LIVE_KEY] = { installed: true };
  return true;
}

if (typeof globalThis.document !== "undefined") {
  installTemperatureLive0154();
  globalThis.queueMicrotask?.(installTemperatureLive0154);
  globalThis.setTimeout?.(installTemperatureLive0154, 0);
  globalThis.setTimeout?.(installTemperatureLive0154, 120);
  globalThis.setTimeout?.(installTemperatureLive0154, 500);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installTemperatureLive0154);
  globalThis.addEventListener?.("pageshow", installTemperatureLive0154);
}
