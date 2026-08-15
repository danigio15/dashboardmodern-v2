// DM-FIX-20260815F
import { normalizeSection } from "../core/migrations.js";
import { root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONFIG_PERSISTENCE__";
const USER_DATA_VERSION = 1;
const PERSIST_META_KEY = "dm_persistence_meta";
const REMOTE_REFRESH_MIN_MS = 1200;
const state = (root[KEY] ||= {
  installed: false,
  dirtyAt: 0,
  dirtyMarkTimer: 0,
  pushTimer: 0,
  pushPromise: null,
  needsPush: false,
  hydrating: false,
  hydrated: false,
  localWasConfigured: false,
  lastPullAt: 0,
  refreshTimer: 0,
  resetOwnerInstalled: false,
  resetting: false,
  mutationBridgeInstalled: false,
});

// Complete dashboard configuration snapshot. Runtime counters/timers such as
// cd_pool_run and cd_irr_lastrun are intentionally excluded, while every
// user-editable legacy/canonical key is included so phone and desktop cannot
// silently diverge just because one editor still writes a legacy key.
export const CONFIG_KEYS = Object.freeze([
  "dm_dashboard_state",
  "dm_schema_version",
  "cd_branding",
  "cd_sections",
  "cd_section_names",
  "cd_stanze",
  "cd_floors",
  "cd_cameras",
  "cd_appliances",
  "cd_loads",
  "cd_devices",
  "cd_luci",
  "cd_luci_rooms",
  "cd_luci_order",
  "cd_luci_room_order",
  "cd_clima_units",
  "cd_ev_cars",
  "cd_ev_car_active",
  "cd_ev_visual",
  "cd_ev_image",
  "cd_tapparelle",
  "cd_piscina",
  "cd_irrigazione",
  "cd_energy_model",
  "cd_entity_overrides",
  "cd_quick_actions",
  "cd_navbar_order",
  "cd_energy_views",
  "cd_slot_labels",
  "cd_flow_nodes",
  "cd_gruppi_extra",
  "cd_gruppi_removed",
  "cd_avvisi_names_extra",
  "cd_avvisi_custom",
  "cd_subloads_extra",
  "cd_report_devices",
  "cd_lavatrice_visual",
  "cd_text_overrides",
  "cd_hidden_elements",
  "cd_costo_kwh",
  "cd_prezzo_immissione",
  // Kept for compatibility with the modern editor. Legacy deliberately treated
  // appearance as device-local; these keys do not affect entity configuration.
  "cd_theme",
  "cd_nav_mode",
]);

const LEGACY_SYNC_CONTROL_KEYS = Object.freeze(["cd_sync_ts", "cd_sync_dirty"]);

function instanceId() {
  return String(
    root.__DASHBOARDMODERN_INSTANCE__ || root.__DASHBOARDMODERN_STORAGE_NS__ || "integration",
  );
}

export function integrationUserDataKey({ primary = true, instance = "" } = {}) {
  const suffix =
    primary === false && instance
      ? `__${String(instance)
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 16)}`
      : "";
  return `dashboardmodern_integration_config${suffix}`;
}

function userDataKey() {
  return integrationUserDataKey({
    primary: root.__DASHBOARDMODERN_PRIMARY__ !== false,
    instance: root.__DASHBOARDMODERN_INSTANCE__,
  });
}

function legacyUserDataKey() {
  return `dashboardmodern_v2_config:${instanceId()}`;
}

export async function migrateLegacyUserData(fetchValue, pushValue) {
  const current = await fetchValue(userDataKey());
  if (current) return current;
  const legacy = await fetchValue(legacyUserDataKey());
  if (!legacy) return null;
  await pushValue(userDataKey(), legacy);
  return legacy;
}

function valuesFromStorage(storage = root.localStorage) {
  const values = {};
  for (const key of CONFIG_KEYS) {
    const value = storage?.getItem?.(key);
    if (value !== null && value !== undefined) values[key] = value;
  }
  return values;
}

function localValues() {
  return valuesFromStorage(root.localStorage);
}

function meaningfulScalar(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return value;
  return false;
}

function meaningfulNested(value, { ignoreMetadata = false } = {}) {
  if (Array.isArray(value)) return value.some((item) => meaningfulNested(item));
  if (value && typeof value === "object")
    return Object.entries(value).some(
      ([key, child]) => !(ignoreMetadata && key === "metadata") && meaningfulNested(child),
    );
  return meaningfulScalar(value);
}

function meaningfulLocal(values = localValues()) {
  const stateValue = values.dm_dashboard_state;
  if (stateValue) {
    try {
      const parsed = JSON.parse(stateValue);
      const sections = parsed?.sections || {};
      if (
        Object.entries(sections).some(([name, value]) =>
          name === "energy"
            ? meaningfulNested(value, { ignoreMetadata: true })
            : meaningfulNested(value),
        )
      )
        return true;
    } catch (_error) {}
  }
  return Object.entries(values).some(([key, value]) => {
    if (["dm_dashboard_state", "dm_schema_version", "cd_sections"].includes(key)) return false;
    try {
      return meaningfulNested(JSON.parse(value));
    } catch (_error) {
      return String(value || "").trim().length > 0;
    }
  });
}

export function normalizeRemoteSnapshot(remote) {
  if (!remote || typeof remote !== "object" || Array.isArray(remote)) return null;
  if (
    Number(remote.version) === USER_DATA_VERSION &&
    remote.values &&
    typeof remote.values === "object" &&
    !Array.isArray(remote.values)
  ) {
    return {
      version: USER_DATA_VERSION,
      updated_at: Number(remote.updated_at) || 0,
      values: Object.fromEntries(
        CONFIG_KEYS.flatMap((key) =>
          typeof remote.values[key] === "string" ? [[key, remote.values[key]]] : [],
        ),
      ),
      migrated_from: remote.migrated_from || "",
    };
  }

  // beta20/beta21 and the vendored legacy runtime wrote a flat payload to the
  // very same frontend user_data key. Accept it once, then upgrade it to the
  // single modern envelope after reconciliation. Without this compatibility
  // path whichever device wrote last could make the other format unreadable.
  const legacyValues = Object.fromEntries(
    CONFIG_KEYS.flatMap((key) => (typeof remote[key] === "string" ? [[key, remote[key]]] : [])),
  );
  if (
    Object.keys(legacyValues).length ||
    Object.prototype.hasOwnProperty.call(remote, "__ts") ||
    Object.prototype.hasOwnProperty.call(remote, "_savedAt")
  ) {
    return {
      version: USER_DATA_VERSION,
      updated_at: Number(remote.__ts || remote._savedAt) || 0,
      values: legacyValues,
      migrated_from: "legacy-flat",
    };
  }
  return null;
}

export function sameConfigValues(left = {}, right = {}) {
  return CONFIG_KEYS.every((key) => {
    const a = Object.prototype.hasOwnProperty.call(left || {}, key) ? String(left[key]) : null;
    const b = Object.prototype.hasOwnProperty.call(right || {}, key) ? String(right[key]) : null;
    return a === b;
  });
}

export function persistenceReconcileAction({
  remote = null,
  localConfigured = false,
  pendingAt = 0,
  local = {},
} = {}) {
  if (!remote) return localConfigured ? "push-local" : "none";
  const normalized = normalizeRemoteSnapshot(remote);
  if (!normalized) return "unsupported";
  if (sameConfigValues(local, normalized.values)) return "in-sync";
  return Number(pendingAt) > Number(normalized.updated_at || 0)
    ? "push-local"
    : "restore-remote";
}

function readMeta(storage = root.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(PERSIST_META_KEY) || "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeMeta(patch = {}, storage = root.localStorage) {
  const current = readMeta(storage);
  const next = { ...current, ...patch };
  try {
    storage?.setItem?.(PERSIST_META_KEY, JSON.stringify(next));
  } catch (_error) {}
  return next;
}

function snapshot() {
  return {
    version: USER_DATA_VERSION,
    updated_at: Date.now(),
    values: localValues(),
  };
}

function hostedBridge() {
  return Boolean(
    root.__DASHBOARDMODERN_HOSTED__ && (root.__DASHBOARDMODERN_BRIDGE_WS__ || root.WebSocket),
  );
}

function bridgeRequest(type, payload = {}) {
  if (!hostedBridge()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const Socket = root.__DASHBOARDMODERN_BRIDGE_WS__ || root.WebSocket;
    const id = 700000 + Math.floor(Math.random() * 200000);
    let sent = false;
    let socket;
    let finished = false;
    const timer = root.setTimeout?.(() => {
      if (finished) return;
      try {
        socket?.close?.();
      } catch (_error) {}
      finished = true;
      reject(new Error(`${type} timed out`));
    }, 8000);
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      if (timer) root.clearTimeout?.(timer);
      try {
        socket?.close?.();
      } catch (_error) {}
      callback(value);
    };
    const send = () => {
      if (sent || finished) return;
      sent = true;
      try {
        socket.send(JSON.stringify({ id, type, ...payload }));
      } catch (error) {
        finish(reject, error);
      }
    };
    try {
      socket = new Socket("ws://dashboardmodern.invalid/api/websocket");
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event?.data || "{}");
        } catch (_error) {
          return;
        }
        if (message.type === "auth_ok") {
          send();
          return;
        }
        if (message.type !== "result" || message.id !== id) return;
        if (message.success === false)
          finish(reject, new Error(message.error?.message || `${type} failed`));
        else finish(resolve, message.result);
      };
      socket.onerror = () => finish(reject, new Error(`${type} bridge error`));
      root.setTimeout?.(() => {
        if (!sent && !finished && socket?.readyState === 1 && root.__DASHBOARDMODERN_BRIDGE_WS__)
          send();
      }, 25);
    } catch (error) {
      finish(reject, error);
    }
  });
}

function markPending({ schedule = true } = {}) {
  if (
    state.resetting ||
    state.hydrating ||
    !state.hydrated ||
    root.__DASHBOARDMODERN_PERSIST_RESTORE__ ||
    root.__DASHBOARDMODERN_CONFIG_RESETTING__
  )
    return state.dirtyAt;
  const now = Date.now();
  state.dirtyAt = now;
  writeMeta({ pending_at: now });
  if (schedule && hostedBridge()) schedulePush();
  return now;
}

function queuePendingFromStorage() {
  if (state.dirtyMarkTimer) return;
  state.dirtyMarkTimer =
    root.setTimeout?.(() => {
      state.dirtyMarkTimer = 0;
      markPending();
    }, 0) || 0;
  if (!state.dirtyMarkTimer) markPending();
}

async function pushNow() {
  if (!hostedBridge()) return true;
  const value = snapshot();
  try {
    await bridgeRequest("frontend/set_user_data", { key: userDataKey(), value });
    state.dirtyAt = 0;
    state.localWasConfigured = meaningfulLocal(value.values);
    writeMeta({ synced_at: value.updated_at, pending_at: 0 });
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:persistence-saved", { detail: value }));
    return true;
  } catch (error) {
    console.warn("[DashboardModern] config sync failed; local copy kept", error);
    return false;
  }
}

function schedulePush() {
  state.needsPush = true;
  if (state.pushPromise) return state.pushPromise;
  state.pushPromise = new Promise((resolve) => {
    const run = async () => {
      state.pushTimer = 0;
      let result = true;
      do {
        state.needsPush = false;
        result = (await pushNow()) && result;
      } while (state.needsPush);
      state.pushPromise = null;
      resolve(result);
    };
    state.pushTimer = root.setTimeout?.(run, 140) || 0;
    if (!state.pushTimer) run();
  });
  return state.pushPromise;
}

export function normalizeRestoredValues(values) {
  const restored = { ...values };
  if (typeof restored.cd_stanze === "string") {
    try {
      restored.cd_stanze = JSON.stringify(
        normalizeSection("rooms", JSON.parse(restored.cd_stanze)),
      );
    } catch (_error) {}
  }
  if (typeof restored.dm_dashboard_state === "string") {
    try {
      const restoredSnapshot = JSON.parse(restored.dm_dashboard_state);
      restoredSnapshot.sections ||= {};
      restoredSnapshot.sections.rooms = normalizeSection(
        "rooms",
        restoredSnapshot.sections.rooms || [],
      );
      restored.dm_dashboard_state = JSON.stringify(restoredSnapshot);
    } catch (_error) {}
  }
  return restored;
}

export function applyRestoredValues(storage, values) {
  if (!storage || !values || typeof values !== "object" || Array.isArray(values)) return false;
  const restored = normalizeRestoredValues(values);
  for (const key of CONFIG_KEYS) {
    const value = restored[key];
    if (typeof value === "string") storage.setItem(key, value);
    else storage.removeItem?.(key);
  }
  return true;
}

function restoreValues(values) {
  root.__DASHBOARDMODERN_PERSIST_RESTORE__ = true;
  try {
    return applyRestoredValues(root.localStorage, values);
  } finally {
    delete root.__DASHBOARDMODERN_PERSIST_RESTORE__;
  }
}

function refreshRuntimeAfterRestore(remote) {
  try {
    root.DashboardModernModules?.store?.migrate?.();
  } catch (error) {
    console.warn("[DashboardModern] canonical state reload after persistence restore failed", error);
  }
  root.cdEvCarsRefresh?.();
  root.buildQuickActions?.();
  root.cdApplyNavOrder?.();
  root.cdApplyNavVis?.();
  root.buildTempCards?.();
  root.buildClimaCards?.();
  root.render?.();
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:persistence-restored", { detail: remote }));
}

async function hydrateRemote(options = {}) {
  const force = options?.force === true;
  if (state.hydrating || state.resetting || (!force && state.hydrated) || !hostedBridge())
    return false;
  state.hydrating = true;
  try {
    const rawRemote = await migrateLegacyUserData(
      async (key) => (await bridgeRequest("frontend/get_user_data", { key }))?.value,
      (key, value) => bridgeRequest("frontend/set_user_data", { key, value }),
    );
    state.lastPullAt = Date.now();
    const remote = normalizeRemoteSnapshot(rawRemote);
    const local = localValues();
    const meta = readMeta();
    const pendingAt = Math.max(Number(state.dirtyAt) || 0, Number(meta.pending_at) || 0);
    // On the very first pull use the pre-module value captured before
    // DashboardStore.migrate() writes empty canonical defaults. Otherwise a
    // pristine desktop could incorrectly seed an empty cloud snapshot.
    const localConfigured = state.hydrated ? meaningfulLocal(local) : state.localWasConfigured;
    const action = persistenceReconcileAction({
      remote: rawRemote,
      localConfigured,
      pendingAt,
      local,
    });

    if (action === "push-local") return await pushNow();
    if (action === "restore-remote" && remote) {
      if (!restoreValues(remote.values)) return false;
      state.dirtyAt = 0;
      state.localWasConfigured = meaningfulLocal(localValues());
      writeMeta({ synced_at: Number(remote.updated_at) || Date.now(), pending_at: 0 });
      refreshRuntimeAfterRestore(remote);
      // Migration/normalization can legitimately add canonical empty keys or
      // convert legacy room shapes. Upgrade the remote envelope once so later
      // focus pulls compare against the exact canonical local snapshot.
      if (remote.migrated_from === "legacy-flat" || !sameConfigValues(localValues(), remote.values))
        await pushNow();
      return true;
    }
    if (action === "in-sync" && remote) {
      state.dirtyAt = 0;
      state.localWasConfigured = localConfigured;
      writeMeta({ synced_at: Number(remote.updated_at) || Date.now(), pending_at: 0 });
      if (remote.migrated_from === "legacy-flat") await pushNow();
      return false;
    }
    if (action === "unsupported")
      console.warn("[DashboardModern] unsupported remote config snapshot retained without overwrite");
    return false;
  } catch (error) {
    console.warn("[DashboardModern] config restore skipped", error);
    return false;
  } finally {
    state.hydrating = false;
    state.hydrated = true;
  }
}

function scheduleRemoteRefresh(delay = 0) {
  if (state.resetting || !hostedBridge()) return;
  if (root.document?.visibilityState === "hidden") return;
  if (state.refreshTimer) return;
  const elapsed = Date.now() - (Number(state.lastPullAt) || 0);
  const wait = Math.max(Number(delay) || 0, REMOTE_REFRESH_MIN_MS - elapsed, 0);
  state.refreshTimer =
    root.setTimeout?.(() => {
      state.refreshTimer = 0;
      hydrateRemote({ force: true }).catch((error) =>
        root.console?.warn?.("[DashboardModern] cross-device refresh failed", error),
      );
    }, wait) || 0;
  if (!state.refreshTimer) hydrateRemote({ force: true });
}

function installStorageMutationBridge() {
  const storage = root.localStorage;
  if (!storage || storage.__dmPersistenceMutationBridge) return false;
  const originalSetItem = storage.setItem?.bind(storage);
  const originalRemoveItem = storage.removeItem?.bind(storage);
  if (!originalSetItem || !originalRemoveItem) return false;

  storage.setItem = function dashboardModernPersistentSetItem(key, value) {
    const managed = CONFIG_KEYS.includes(String(key));
    const before = managed ? storage.getItem(key) : null;
    const result = originalSetItem(key, value);
    if (
      managed &&
      before !== String(value) &&
      state.hydrated &&
      !state.hydrating &&
      !state.resetting &&
      !root.__DASHBOARDMODERN_PERSIST_RESTORE__ &&
      !root.__DASHBOARDMODERN_CONFIG_RESETTING__
    )
      queuePendingFromStorage();
    return result;
  };
  storage.removeItem = function dashboardModernPersistentRemoveItem(key) {
    const managed = CONFIG_KEYS.includes(String(key));
    const before = managed ? storage.getItem(key) : null;
    const result = originalRemoveItem(key);
    if (
      managed &&
      before !== null &&
      state.hydrated &&
      !state.hydrating &&
      !state.resetting &&
      !root.__DASHBOARDMODERN_PERSIST_RESTORE__ &&
      !root.__DASHBOARDMODERN_CONFIG_RESETTING__
    )
      queuePendingFromStorage();
    return result;
  };
  storage.__dmPersistenceMutationBridge = true;
  state.mutationBridgeInstalled = true;
  return true;
}

function resetConfirmation() {
  const english = root.document?.documentElement?.lang === "en";
  return english
    ? "Delete all DashboardModern configuration for this dashboard?"
    : "Eliminare tutta la configurazione DashboardModern di questa plancia?";
}

export async function resetAllConfig({ skipConfirm = false, reload = true } = {}) {
  if (state.resetting) return false;
  if (!skipConfirm && root.confirm && !root.confirm(resetConfirmation())) return false;
  state.resetting = true;
  state.hydrated = true;
  state.localWasConfigured = false;
  root.__DASHBOARDMODERN_CONFIG_RESETTING__ = true;

  try {
    if (state.pushPromise) await state.pushPromise;
    await Promise.resolve();
  } catch (_error) {}

  try {
    root.localStorage?.clear?.();
  } catch (error) {
    state.resetting = false;
    delete root.__DASHBOARDMODERN_CONFIG_RESETTING__;
    root.console?.error?.("[DashboardModern] local reset failed", error);
    return false;
  }

  const empty = snapshot();
  try {
    if (hostedBridge())
      await bridgeRequest("frontend/set_user_data", { key: userDataKey(), value: empty });
  } catch (error) {
    root.console?.warn?.("[DashboardModern] remote reset deferred", error);
    state.dirtyAt = Date.now();
    writeMeta({ pending_at: state.dirtyAt });
    state.needsPush = true;
    schedulePush();
  }

  try {
    root.localStorage?.clear?.();
  } catch (_error) {}

  root.dispatchEvent?.(new CustomEvent("dashboardmodern:config-reset", { detail: empty }));
  if (reload) root.setTimeout?.(() => root.location?.reload?.(), 40);
  else {
    state.resetting = false;
    delete root.__DASHBOARDMODERN_CONFIG_RESETTING__;
  }
  return true;
}

function installResetOwner() {
  if (typeof root.wzResetAll !== "function" || root.wzResetAll.__dmCanonicalReset) return false;
  const canonical = function dashboardModernResetAll() {
    return resetAllConfig();
  };
  canonical.__dmCanonicalReset = true;
  canonical.__dmPrevious = root.wzResetAll;
  root.wzResetAll = canonical;
  state.resetOwnerInstalled = true;
  return true;
}

function disableLegacySyncState() {
  // The vendored runtime and this module used to write incompatible payloads to
  // the same frontend user_data key. The modern module is now the only owner.
  root.__DASHBOARDMODERN_PERSISTENCE_OWNER__ = "modern-v1";
  for (const key of LEGACY_SYNC_CONTROL_KEYS) {
    try {
      root.localStorage?.removeItem?.(key);
    } catch (_error) {}
  }
  try {
    root._cdSyncReqId = -1;
  } catch (_error) {}
}

export function installConfigPersistenceSection() {
  if (state.installed) {
    disableLegacySyncState();
    installResetOwner();
    installStorageMutationBridge();
    return;
  }
  state.installed = true;
  state.localWasConfigured = meaningfulLocal();
  const initialMeta = readMeta();
  state.dirtyAt = Number(initialMeta.pending_at) || 0;
  disableLegacySyncState();

  // Intentionally do NOT invoke the legacy cdMarkDirty/cdSyncPush functions.
  // They used a flat payload while this owner uses {version, updated_at, values}
  // and the two writers racing on the same HA key is the root cause of devices
  // showing different configurations.
  root.cdMarkDirty = function dashboardModernMarkDirty() {
    return markPending();
  };

  root.cdSyncPush = function dashboardModernSyncPush() {
    if (!state.hydrated || state.hydrating) {
      // Remote must be read before a local snapshot is allowed to overwrite it.
      return hydrateRemote().then(() => true);
    }
    markPending({ schedule: false });
    return schedulePush();
  };

  root.cdSyncPull = () => hydrateRemote({ force: true });
  root.dmResetAllConfig = resetAllConfig;
  installResetOwner();
  installStorageMutationBridge();

  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    disableLegacySyncState();
    installResetOwner();
    installStorageMutationBridge();
    root.setTimeout?.(() => hydrateRemote(), 0);
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    disableLegacySyncState();
    installResetOwner();
    installStorageMutationBridge();
    root.setTimeout?.(() => hydrateRemote(), 0);
  });

  root.addEventListener?.("focus", () => scheduleRemoteRefresh(40));
  root.addEventListener?.("pageshow", () => scheduleRemoteRefresh(40));
  root.addEventListener?.("storage", () => scheduleRemoteRefresh(40));
  root.document?.addEventListener?.("visibilitychange", () => {
    if (root.document?.visibilityState === "visible") scheduleRemoteRefresh(40);
  });
}

installConfigPersistenceSection();
