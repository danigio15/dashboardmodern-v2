/* DashboardModern 0.14.14: isolate energy refreshes and keep appliance metrics correct. */
const HOTFIX_KEY = "__DASHBOARDMODERN_RELEASE_0154_ENERGY_RENDER_HOTFIX__";
const RELEASE_KEY = "__DASHBOARDMODERN_RELEASE_0154__";
const PERIOD_EVENT = "dashboardmodern:energy-periods-0154";

function clock0154Hotfix() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function hotfixState0154() {
  return (globalThis[HOTFIX_KEY] ||= {
    suppressUntil: 0,
    energyRenderDepth: 0,
    releaseState: null,
    installed: false,
    monitor: null,
    monitorTicks: 0,
  });
}

function functionChainHas0154(fn, marker) {
  const seen = new Set();
  let current = fn;
  while (typeof current === "function" && !seen.has(current)) {
    if (current[marker]) return true;
    seen.add(current);
    current = current.__dmPrevious;
  }
  return false;
}

function armGlobalRenderSuppression0154(duration = 5000) {
  const state = hotfixState0154();
  state.suppressUntil = Math.max(state.suppressUntil, clock0154Hotfix() + duration);
}

function instrumentEnergyRefreshState0154() {
  const release = globalThis[RELEASE_KEY];
  const hotfix = hotfixState0154();
  if (!release || hotfix.releaseState === release) return Boolean(release);

  let refreshing = Boolean(release.refreshing);
  try {
    Object.defineProperty(release, "refreshing", {
      configurable: true,
      enumerable: true,
      get() {
        return refreshing;
      },
      set(value) {
        const next = Boolean(value);
        if (next || refreshing !== next) armGlobalRenderSuppression0154(5000);
        refreshing = next;
      },
    });
    hotfix.releaseState = release;
    return true;
  } catch (_error) {
    return false;
  }
}

function calledFromEnergyRefresh0154() {
  try {
    return /refreshEnergyPeriods0154|cdRefreshPeriodDeltas|cdDeriveFromTotals|renderEnergyDashboard|renderEnergy/.test(
      String(new Error().stack || ""),
    );
  } catch (_error) {
    return false;
  }
}

function installGlobalRenderGate0154() {
  const current = globalThis.render;
  if (typeof current !== "function" || functionChainHas0154(current, "__dm0154EnergyRenderGate")) {
    return false;
  }

  function energySafeGlobalRender0154(...args) {
    const hotfix = hotfixState0154();
    if (
      hotfix.energyRenderDepth > 0 ||
      clock0154Hotfix() <= hotfix.suppressUntil ||
      calledFromEnergyRefresh0154()
    ) {
      return false;
    }
    return current.apply(this, args);
  }

  energySafeGlobalRender0154.__dm0154EnergyRenderGate = true;
  energySafeGlobalRender0154.__dm0154RenderGuard = true;
  energySafeGlobalRender0154.__dmPrevious = current;
  globalThis.render = energySafeGlobalRender0154;
  return true;
}

function installEnergyRenderPhase0154(name) {
  const current = globalThis[name];
  if (typeof current !== "function" || functionChainHas0154(current, "__dm0154EnergyPhase")) {
    return false;
  }

  function energyPhase0154(...args) {
    const state = hotfixState0154();
    state.energyRenderDepth += 1;
    armGlobalRenderSuppression0154(1500);
    let result;
    try {
      result = current.apply(this, args);
    } catch (error) {
      state.energyRenderDepth = Math.max(0, state.energyRenderDepth - 1);
      throw error;
    }
    if (result && typeof result.finally === "function") {
      return result.finally(() => {
        state.energyRenderDepth = Math.max(0, state.energyRenderDepth - 1);
      });
    }
    state.energyRenderDepth = Math.max(0, state.energyRenderDepth - 1);
    return result;
  }

  energyPhase0154.__dm0154EnergyPhase = true;
  energyPhase0154.__dmPrevious = current;
  globalThis[name] = energyPhase0154;
  return true;
}

function runtimeState0154(entity) {
  const id = String(entity || "").trim();
  return globalThis._RAW_STATES?.[id] || globalThis.STATES?.[id] || null;
}

function configuredEntities0154(item) {
  return [...new Set(
    (Array.isArray(item?.entities) ? item.entities : [])
      .map((value) => (typeof value === "string" ? value : value?.entity))
      .filter(Boolean),
  )];
}

function explicitEntity0154(item, keys) {
  for (const key of keys || []) {
    const value = item?.[key];
    const entity = typeof value === "string" ? value : value?.entity;
    if (typeof entity === "string" && entity.includes(".")) return entity;
  }
  return "";
}

function entityFacts0154(entity) {
  const state = runtimeState0154(entity);
  const attributes = state?.attributes || {};
  return {
    entity: String(entity || ""),
    unit: String(attributes.unit_of_measurement || "").trim().toLowerCase().replaceAll(" ", ""),
    deviceClass: String(attributes.device_class || "").trim().toLowerCase(),
    stateClass: String(attributes.state_class || "").trim().toLowerCase(),
    text: `${entity || ""} ${attributes.friendly_name || ""}`.toLowerCase(),
  };
}

function isEnergyEntity0154(entity) {
  const facts = entityFacts0154(entity);
  return (
    facts.deviceClass === "energy" ||
    /^(wh|kwh|mwh)$/.test(facts.unit) ||
    (/total|totale|energy|energia|kwh/.test(facts.text) && !/^(w|kw|mw)$/.test(facts.unit)) ||
    (["total", "total_increasing"].includes(facts.stateClass) && !/^(w|kw|mw)$/.test(facts.unit))
  );
}

function isPowerEntity0154(entity) {
  const facts = entityFacts0154(entity);
  return (
    facts.deviceClass === "power" ||
    /^(w|kw|mw)$/.test(facts.unit) ||
    (/power|potenza|watt/.test(facts.text) && !isEnergyEntity0154(entity))
  );
}

function isDurationEntity0154(entity) {
  const facts = entityFacts0154(entity);
  return (
    facts.deviceClass === "duration" ||
    /^(s|sec|second|seconds|min|minute|minutes|h|hr|hour|hours)$/.test(facts.unit) ||
    /duration|durata|runtime|tempo/.test(facts.text)
  );
}

function roleForKeys0154(keys) {
  const token = String(keys?.[0] || "").toLowerCase();
  if (token.startsWith("energy") || token.includes("daily_energy")) return "energy";
  if (token.startsWith("power")) return "power";
  if (token.startsWith("duration")) return "duration";
  if (token.startsWith("switch") || token.startsWith("control") || token.startsWith("light")) {
    return "control";
  }
  if (token.startsWith("history")) return "history";
  return "";
}

function candidateForRole0154(item, role) {
  const candidates = configuredEntities0154(item);
  if (role === "energy") return candidates.find(isEnergyEntity0154) || "";
  if (role === "power") return candidates.find(isPowerEntity0154) || "";
  if (role === "duration") return candidates.find(isDurationEntity0154) || "";
  if (role === "control") {
    return candidates.find((entity) => /^(switch|light|input_boolean|fan)\./.test(entity)) || "";
  }
  if (role === "history") {
    return candidates.find(isEnergyEntity0154) || candidates.find(isPowerEntity0154) || "";
  }
  return "";
}

function validForRole0154(entity, role) {
  if (!entity) return false;
  if (role === "energy") return isEnergyEntity0154(entity);
  if (role === "power") return isPowerEntity0154(entity);
  if (role === "duration") return isDurationEntity0154(entity);
  if (role === "control") return /^(switch|light|input_boolean|fan)\./.test(entity);
  if (role === "history") return isEnergyEntity0154(entity) || isPowerEntity0154(entity);
  return true;
}

function installApplianceEntityClassifier0154() {
  const current = globalThis.cdApplEntity;
  if (typeof current !== "function" || functionChainHas0154(current, "__dm0154EntityClassifier")) {
    return false;
  }

  function classifiedApplianceEntity0154(item, keys) {
    const role = roleForKeys0154(keys);
    const explicit = explicitEntity0154(item, keys);
    if (explicit && (!role || validForRole0154(explicit, role))) return explicit;
    const candidate = candidateForRole0154(item, role);
    if (candidate) return candidate;
    const fallback = current.call(this, item, keys);
    if (role && !validForRole0154(fallback, role)) return null;
    return fallback;
  }

  classifiedApplianceEntity0154.__dm0154EntityClassifier = true;
  classifiedApplianceEntity0154.__dmPrevious = current;
  globalThis.cdApplEntity = classifiedApplianceEntity0154;
  return true;
}

function entityDisplayValue0154(entity) {
  const state = runtimeState0154(entity);
  if (!state) return "";
  const unit = String(state.attributes?.unit_of_measurement || "").trim();
  return `${state.state}${unit ? ` ${unit}` : ""}`;
}

function normalizeApplianceMetrics0154() {
  const doc = globalThis.document;
  if (!doc) return false;
  let items = [];
  try {
    const value = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    items = Array.isArray(value) ? value : [];
  } catch (_error) {}
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
    if (!item) return;
    const power = candidateForRole0154(item, "power");
    const energy = candidateForRole0154(item, "energy");
    const live = card.querySelector(".appl-live");
    const primary = live?.querySelector(".appl-primary");
    const primaryValue = primary?.querySelector("strong")?.textContent || "";
    if (primary && (!power || /(?:^|\s)(?:wh|kwh|mwh)(?:\s|$)/i.test(primaryValue))) primary.remove();
    if (!energy || !live) return;
    const label = globalThis.document?.documentElement?.lang === "en" ? "Total" : "Totale";
    const value = entityDisplayValue0154(energy);
    if (!value) return;
    let total = live.querySelector(".appl-mini[data-dm-energy-total='true']");
    if (!total) {
      total = [...live.querySelectorAll(".appl-mini")].find((node) =>
        /(?:wh|kwh|mwh)(?:\s|$)/i.test(node.textContent || ""),
      );
    }
    if (!total) {
      total = doc.createElement("span");
      total.className = "appl-mini";
      live.append(total);
    }
    if (total.dataset.dmEnergyTotal !== "true") total.dataset.dmEnergyTotal = "true";
    const text = `∑ ${label} ${value}`;
    if (total.textContent !== text) total.textContent = text;
  });
  return true;
}

function periodRegistry0154() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  return globalThis.CD_PERIOD || {};
}

function periodNumber0154(slot) {
  const value = Number(periodRegistry0154()?.[slot]);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function periodText0154(slot) {
  const value = periodNumber0154(slot);
  if (value == null) return "—";
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded} kWh`;
}

function setPeriodText0154(id, value) {
  const node = globalThis.document?.getElementById?.(id);
  if (!node || node.textContent === value) return false;
  node.textContent = value;
  return true;
}

function setPeriodDual0154(id, downSlot, upSlot) {
  const node = globalThis.document?.getElementById?.(id);
  if (!node) return false;
  const down = periodNumber0154(downSlot);
  const up = periodNumber0154(upSlot);
  const html = `<span style="color:#e11d48">↓ ${down == null ? 0 : Math.round(down * 1000) / 1000} kWh</span><br><span style="color:#10b981">↑ ${up == null ? 0 : Math.round(up * 1000) / 1000} kWh</span>`;
  if (node.innerHTML === html) return false;
  node.innerHTML = html;
  return true;
}

function syncEnergyPeriodDom0154() {
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
  Object.entries(periods).forEach(([kind, slots]) => {
    setPeriodText0154(`v-solar-${kind}`, periodText0154(slots.solar));
    setPeriodText0154(`v-home-${kind}`, periodText0154(slots.home));
    setPeriodDual0154(`v-grid-${kind}`, slots.gridDown, slots.gridUp);
    setPeriodDual0154(`v-battery-${kind}`, slots.batteryDown, slots.batteryUp);
  });
  return true;
}

function installApplianceRenderHook0154() {
  const current = globalThis.renderApplianceSection;
  if (typeof current !== "function" || functionChainHas0154(current, "__dm0154MetricHook")) {
    return false;
  }

  function applianceMetricRender0154(...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(normalizeApplianceMetrics0154);
    }
    normalizeApplianceMetrics0154();
    return result;
  }

  applianceMetricRender0154.__dm0154MetricHook = true;
  applianceMetricRender0154.__dmPrevious = current;
  globalThis.renderApplianceSection = applianceMetricRender0154;
  return true;
}

function installEnergyRenderHotfix0154() {
  instrumentEnergyRefreshState0154();
  installGlobalRenderGate0154();
  installEnergyRenderPhase0154("renderEnergy");
  installEnergyRenderPhase0154("renderEnergyDashboard");
  installApplianceEntityClassifier0154();
  installApplianceRenderHook0154();
  normalizeApplianceMetrics0154();
  syncEnergyPeriodDom0154();
  hotfixState0154().installed = true;
}

function monitorStartup0154() {
  const hotfix = hotfixState0154();
  if (hotfix.monitor || typeof globalThis.setInterval !== "function") return;
  hotfix.monitorTicks = 0;
  hotfix.monitor = globalThis.setInterval(() => {
    hotfix.monitorTicks += 1;
    installEnergyRenderHotfix0154();
    if (hotfix.monitorTicks >= 150) {
      globalThis.clearInterval?.(hotfix.monitor);
      hotfix.monitor = null;
    }
  }, 100);
}

function syncAfterPeriodRefresh0154() {
  armGlobalRenderSuppression0154(1200);
  syncEnergyPeriodDom0154();
  normalizeApplianceMetrics0154();
  globalThis.requestAnimationFrame?.(syncEnergyPeriodDom0154);
  globalThis.setTimeout?.(syncEnergyPeriodDom0154, 40);
}

if (typeof globalThis.document !== "undefined") {
  installEnergyRenderHotfix0154();
  monitorStartup0154();
  globalThis.queueMicrotask?.(installEnergyRenderHotfix0154);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 0);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 120);
  globalThis.setTimeout?.(installEnergyRenderHotfix0154, 500);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installEnergyRenderHotfix0154);
  globalThis.addEventListener?.("pageshow", installEnergyRenderHotfix0154);
  globalThis.addEventListener?.(PERIOD_EVENT, syncAfterPeriodRefresh0154);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installEnergyRenderHotfix0154, {
      once: true,
    });
  }
}
