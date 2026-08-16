// Beta 26 real-device stability: keep primary temperature/humidity labels
// deterministic even when legacy and multi-association renderers repaint the
// same cards in different animation frames.
import { applianceArtwork } from "../core/appliance-artwork.js";
import { canonicalApplianceVisualKey } from "../core/device-model.js";
import {
  clean,
  dashboardStore,
  doc,
  english,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA26_REAL_DEVICE_STABILITY__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  scheduled: false,
});

function rooms() {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
}

function defaultTemperatureLabel() {
  return english() ? "Temperature" : "Temperatura";
}

function defaultHumidityLabel() {
  return english() ? "Humidity" : "Umidità";
}

function cardLabels(card, room) {
  const associationId = clean(card?.dataset?.temperatureId);
  const primary = !associationId || associationId === "primary";
  if (!primary) {
    return {
      temperature: defaultTemperatureLabel(),
      humidity: defaultHumidityLabel(),
    };
  }
  return {
    temperature:
      clean(room?.temp_name || room?.temperature_name) || defaultTemperatureLabel(),
    humidity: clean(room?.hum_name || room?.humidity_name) || defaultHumidityLabel(),
  };
}

/**
 * Beta26 must not expose two different appliance artwork renderers: the legacy
 * add/edit flow historically calls cdApplianceIcon(), while dashboard cards use
 * the canonical appliance artwork helper. Bridge the public legacy function to
 * the canonical helper so add, edit and cards render the same visual without
 * changing the existing catalog keys or callers.
 */
export function installCanonicalApplianceArtworkBridge() {
  const current = root.cdApplianceIcon;
  if (typeof current !== "function") return false;
  if (current.__dmBeta26CanonicalArtwork === true) return true;

  function canonicalApplianceIcon(type, size = 96) {
    const visualKey = canonicalApplianceVisualKey(type) || clean(type) || "generico";
    return applianceArtwork(visualKey, size) || current(type, size);
  }
  canonicalApplianceIcon.__dmBeta26CanonicalArtwork = true;
  canonicalApplianceIcon.__dmPrevious = current;
  root.cdApplianceIcon = canonicalApplianceIcon;
  return true;
}

/**
 * The Beta25 renderer owns multiple cards per room while Beta17 keeps the
 * legacy primary labels. Apply the saved labels directly to the primary card
 * so a later repaint cannot leave only the humidity label at its generic text.
 */
export function syncBeta26TemperatureLabels() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const byId = new Map(rooms().map((room) => [clean(room?.id), room]));
  let synced = false;

  grid.querySelectorAll(".temp-card[data-room-id]").forEach((card) => {
    const room = byId.get(clean(card.dataset.roomId));
    if (!room) return;
    const labels = cardLabels(card, room);
    const temperature = card.querySelector(".cp-temp-current-lbl");
    const humidity = card.querySelector(".cp-temp-target .lbl");
    const humidityText = `💧 ${labels.humidity}`;

    if (temperature && temperature.textContent !== labels.temperature)
      temperature.textContent = labels.temperature;
    if (temperature && temperature.title !== labels.temperature)
      temperature.title = labels.temperature;
    if (humidity && humidity.textContent !== humidityText) humidity.textContent = humidityText;
    if (humidity && humidity.title !== labels.humidity) humidity.title = labels.humidity;

    card.dataset.dmBeta26TemperatureLabels = "stable";
    synced = true;
  });
  return synced;
}

function installTemperatureRenderHooks() {
  for (const name of ["buildTempCards", "renderTemperature", "render"])
    wrapFunction(name, `__dmBeta26TemperatureLabels_${name}`, scheduleTemperatureLabels);
}

function runTemperatureLabels() {
  state.scheduled = false;
  installTemperatureRenderHooks();
  syncBeta26TemperatureLabels();
}

function scheduleTemperatureLabels() {
  if (state.scheduled) return;
  state.scheduled = true;
  root.queueMicrotask?.(runTemperatureLabels);
  root.requestAnimationFrame?.(runTemperatureLabels);
  root.setTimeout?.(runTemperatureLabels, 0);
  root.setTimeout?.(runTemperatureLabels, 80);
  root.setTimeout?.(runTemperatureLabels, 180);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return true;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return false;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section === "rooms" || change?.section === "snapshot")
      scheduleTemperatureLabels();
  });
  return true;
}

export function installBeta26RealDeviceStability() {
  if (!doc) return false;
  installCanonicalApplianceArtworkBridge();
  installTemperatureRenderHooks();
  subscribeStore();
  scheduleTemperatureLabels();

  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:temperature-editor-rendered",
    ])
      root.addEventListener?.(eventName, () => {
        installCanonicalApplianceArtworkBridge();
        installTemperatureRenderHooks();
        subscribeStore();
        scheduleTemperatureLabels();
      });

    root.addEventListener?.("dashboardmodern:state-changed", scheduleTemperatureLabels);
    doc.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            "#page-temp,[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7']",
          )
        )
          scheduleTemperatureLabels();
      },
      true,
    );
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta26RealDeviceStability, { once: true });
else installBeta26RealDeviceStability();

export const beta26RealDeviceStability = Object.freeze({
  installCanonicalApplianceArtworkBridge,
  syncBeta26TemperatureLabels,
  installBeta26RealDeviceStability,
});
