/* DashboardModern 0.14.16: keep current monthly slots immutable while browsing history. */
const LOCK_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_CURRENT_PERIOD_LOCK__";
const CURRENT_SLOTS_0156 = Object.freeze([
  "dm.energy_consumo_casa_mese",
  "dm.energy_produzione_solare_mese",
  "dm.energy_rete_acquistata_mese",
  "dm.energy_rete_venduta_mese",
  "dm.energy_batteria_caricata_mese",
  "dm.energy_batteria_usata_mese",
]);

function lockState0156() {
  const state = (globalThis[LOCK_KEY_0156] ||= {
    installed: true,
    historical: false,
    snapshots: new Map(),
    locked: new Set(),
    timer: 0,
    restoreTimer: 0,
  });
  if (!(state.snapshots instanceof Map)) state.snapshots = new Map();
  if (!(state.locked instanceof Set)) state.locked = new Set();
  return state;
}

function registry0156() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  return (globalThis.CD_PERIOD ||= {});
}

function rawState0156(slot) {
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES?.[slot]) return _RAW_STATES[slot];
  } catch (_error) {}
  return globalThis._RAW_STATES?.[slot] || globalThis.STATES?.[slot] || null;
}

function cloneState0156(state) {
  return state
    ? { ...state, attributes: { ...(state.attributes || {}) } }
    : null;
}

function writeState0156(state) {
  const id = String(state?.entity_id || "").trim();
  if (!id) return;
  const copy = cloneState0156(state);
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) _RAW_STATES[id] = copy;
  } catch (_error) {}
  try {
    globalThis._RAW_STATES ||= {};
    globalThis._RAW_STATES[id] = copy;
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES) STATES[id] = copy;
  } catch (_error) {}
  try {
    if (globalThis.STATES) globalThis.STATES[id] = copy;
  } catch (_error) {}
}

function currentToken0156() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function stateToken0156(state) {
  const selected = String(state?.attributes?.dashboardmodern_selected || "").trim();
  if (!selected) return "";
  if (/^\d{4}-\d{2}/.test(selected)) return selected.slice(0, 7);
  const timestamp = Date.parse(selected);
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isCurrentDerived0156(state) {
  return Boolean(
    state?.attributes?.dashboardmodern_derived &&
      state?.attributes?.dashboardmodern_source &&
      stateToken0156(state) === currentToken0156(),
  );
}

function captureCurrent0156() {
  const state = lockState0156();
  let captured = false;
  CURRENT_SLOTS_0156.forEach((slot) => {
    const raw = rawState0156(slot);
    const value = Number(raw?.state);
    if (!isCurrentDerived0156(raw) || !Number.isFinite(value)) return;
    state.snapshots.set(slot, cloneState0156(raw));
    captured = true;
  });
  return captured;
}

function selectedHistorical0156() {
  const now = new Date();
  const month = Number(globalThis.document?.getElementById?.("ed-sel-month")?.value);
  const year = Number(globalThis.document?.getElementById?.("ed-sel-year")?.value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(year) || year < 2000) return false;
  return month !== now.getMonth() + 1 || year !== now.getFullYear();
}

function installSlotLock0156(slot) {
  const state = lockState0156();
  if (state.locked.has(slot) || !state.snapshots.has(slot)) return false;
  const registry = registry0156();
  let currentValue = Number(state.snapshots.get(slot)?.state);
  if (!Number.isFinite(currentValue)) return false;

  Object.defineProperty(registry, slot, {
    configurable: true,
    enumerable: true,
    get() {
      return currentValue;
    },
    set(value) {
      const parsed = Number(value);
      if (lockState0156().historical) return;
      if (Number.isFinite(parsed)) currentValue = parsed;
    },
  });
  state.locked.add(slot);
  return true;
}

function installLocks0156() {
  captureCurrent0156();
  CURRENT_SLOTS_0156.forEach(installSlotLock0156);
  return lockState0156().locked.size > 0;
}

function restoreSnapshots0156() {
  const state = lockState0156();
  if (!state.historical) {
    captureCurrent0156();
    return false;
  }
  const registry = registry0156();
  let restored = false;
  state.snapshots.forEach((snapshot, slot) => {
    const value = Number(snapshot?.state);
    if (!Number.isFinite(value)) return;
    if (!state.locked.has(slot)) installSlotLock0156(slot);
    try {
      registry[slot] = value;
    } catch (_error) {}
    writeState0156(snapshot);
    restored = true;
  });
  return restored;
}

function scheduleRestore0156(delay = 0) {
  const state = lockState0156();
  globalThis.clearTimeout?.(state.restoreTimer);
  state.restoreTimer = globalThis.setTimeout?.(restoreSnapshots0156, delay);
}

function wrapHistoricalWriter0156(name) {
  const current = globalThis[name];
  if (typeof current !== "function" || current.__dm0156CurrentPeriodLock) return false;

  function currentPeriodLock0156(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      installLocks0156();
      restoreSnapshots0156();
    };
    if (result && typeof result.finally === "function") return result.finally(finish);
    globalThis.queueMicrotask?.(finish);
    return result;
  }

  currentPeriodLock0156.__dm0156CurrentPeriodLock = true;
  currentPeriodLock0156.__dmPrevious = current;
  globalThis[name] = currentPeriodLock0156;
  return true;
}

function installWrappers0156() {
  wrapHistoricalWriter0156("renderEdDeviceList");
  wrapHistoricalWriter0156("renderEnergyDashboard");
  wrapHistoricalWriter0156("cdDeriveFromTotals");
  wrapHistoricalWriter0156("cdRefreshPeriodDeltas");
}

function reinforce0156() {
  installLocks0156();
  installWrappers0156();
  if (lockState0156().historical) restoreSnapshots0156();
}

function install0156() {
  const state = lockState0156();
  reinforce0156();
  if (!state.eventsInstalled) {
    state.eventsInstalled = true;
    globalThis.document?.addEventListener?.(
      "change",
      (event) => {
        if (!event.target?.matches?.("#ed-sel-month, #ed-sel-year")) return;
        // Legacy listeners only schedule their async work. Capture synchronously
        // before that work can replace the current-month states.
        captureCurrent0156();
        installLocks0156();
        state.historical = selectedHistorical0156();
        if (state.historical) {
          restoreSnapshots0156();
          scheduleRestore0156(0);
          globalThis.setTimeout?.(restoreSnapshots0156, 120);
          globalThis.setTimeout?.(restoreSnapshots0156, 500);
        }
      },
      true,
    );
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", reinforce0156);
    globalThis.addEventListener?.("pageshow", reinforce0156);
  }

  globalThis.clearInterval?.(state.timer);
  let attempts = 0;
  state.timer = globalThis.setInterval?.(() => {
    attempts += 1;
    reinforce0156();
    const coreReady =
      state.snapshots.has("dm.energy_consumo_casa_mese") &&
      state.snapshots.has("dm.energy_produzione_solare_mese");
    const wrappersReady =
      globalThis.renderEdDeviceList?.__dm0156CurrentPeriodLock &&
      globalThis.renderEnergyDashboard?.__dm0156CurrentPeriodLock &&
      globalThis.cdDeriveFromTotals?.__dm0156CurrentPeriodLock &&
      globalThis.cdRefreshPeriodDeltas?.__dm0156CurrentPeriodLock;
    if (attempts >= 80 || (coreReady && wrappersReady)) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 100);
}

if (typeof globalThis.document !== "undefined") install0156();