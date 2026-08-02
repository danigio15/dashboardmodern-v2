/* DashboardModern 0.14.15: fill unavailable period placeholders without overwriting canonical HA values. */
const PERIOD_EVENT_0155 = "dashboardmodern:energy-periods-0154";
const PERIOD_FALLBACK_KEY_0155 = "__DASHBOARDMODERN_RELEASE_0155_ENERGY_FALLBACK__";

function fallbackState0155() {
  return (globalThis[PERIOD_FALLBACK_KEY_0155] ||= { installed: true, attempts: 0, timer: 0 });
}

function periodRegistry0155() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  return globalThis.CD_PERIOD || {};
}

function periodNumber0155(slot) {
  const value = Number(periodRegistry0155()?.[slot]);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function formattedPeriod0155(slot) {
  const value = periodNumber0155(slot);
  if (value == null) return null;
  return Math.round(value * 1000) / 1000;
}

function hasCanonicalEnergyValue0155(node) {
  if (!node) return false;
  return /(?:wh|kwh|mwh)\b/i.test(String(node.textContent || ""));
}

function fillSinglePeriod0155(id, slot) {
  const node = globalThis.document?.getElementById?.(id);
  if (!node || hasCanonicalEnergyValue0155(node)) return false;
  const value = formattedPeriod0155(slot);
  if (value == null) return false;
  node.textContent = `${value} kWh`;
  return true;
}

function fillDualPeriod0155(id, downSlot, upSlot) {
  const node = globalThis.document?.getElementById?.(id);
  if (!node || hasCanonicalEnergyValue0155(node)) return false;
  const down = formattedPeriod0155(downSlot);
  const up = formattedPeriod0155(upSlot);
  if (down == null && up == null) return false;
  node.innerHTML = `<span style="color:#e11d48">↓ ${down ?? 0} kWh</span><br><span style="color:#10b981">↑ ${up ?? 0} kWh</span>`;
  return true;
}

function fillEnergyPlaceholders0155() {
  const periods = {
    day: {
      solar: "dm.energy_produzione_solare_oggi",
      home: "dm.energy_consumo_casa_oggi",
      gridDown: "dm.energy_energia_prelevata_oggi",
      gridUp: "dm.energy_energia_immessa_oggi",
      batteryDown: "dm.energy_batteria_caricata_oggi",
      batteryUp: "dm.energy_batteria_scaricata_oggi",
    },
    month: {
      solar: "dm.energy_produzione_solare_mese",
      home: "dm.energy_consumo_casa_mese",
      gridDown: "dm.energy_rete_acquistata_mese",
      gridUp: "dm.energy_rete_venduta_mese",
      batteryDown: "dm.energy_batteria_caricata_mese",
      batteryUp: "dm.energy_batteria_usata_mese",
    },
    year: {
      solar: "dm.energy_produzione_solare_anno",
      home: "dm.energy_consumo_casa_anno",
      gridDown: "dm.energy_rete_acquistata_anno",
      gridUp: "dm.energy_rete_venduta_anno",
      batteryDown: "dm.energy_batteria_caricata_anno",
      batteryUp: "dm.energy_batteria_usata_anno",
    },
  };
  let changed = false;
  Object.entries(periods).forEach(([kind, slots]) => {
    changed = fillSinglePeriod0155(`v-solar-${kind}`, slots.solar) || changed;
    changed = fillSinglePeriod0155(`v-home-${kind}`, slots.home) || changed;
    changed = fillDualPeriod0155(`v-grid-${kind}`, slots.gridDown, slots.gridUp) || changed;
    changed = fillDualPeriod0155(`v-battery-${kind}`, slots.batteryDown, slots.batteryUp) || changed;
  });
  return changed;
}

function schedulePlaceholderFill0155() {
  globalThis.queueMicrotask?.(fillEnergyPlaceholders0155);
  globalThis.requestAnimationFrame?.(fillEnergyPlaceholders0155);
  globalThis.setTimeout?.(fillEnergyPlaceholders0155, 40);
  globalThis.setTimeout?.(fillEnergyPlaceholders0155, 160);
}

function installPlaceholderFallback0155() {
  const state = fallbackState0155();
  state.installed = true;
  schedulePlaceholderFill0155();
  if (state.timer || typeof globalThis.setInterval !== "function") return;
  state.timer = globalThis.setInterval(() => {
    state.attempts += 1;
    fillEnergyPlaceholders0155();
    if (state.attempts >= 30) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") {
  globalThis.addEventListener?.(PERIOD_EVENT_0155, schedulePlaceholderFill0155);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installPlaceholderFallback0155);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installPlaceholderFallback0155, {
      once: true,
    });
  } else installPlaceholderFallback0155();
}
