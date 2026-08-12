import { root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONFIG_PERSISTENCE__";
const USER_DATA_VERSION = 1;
const state = (root[KEY] ||= {
  installed: false,
  dirtyAt: 0,
  pushTimer: 0,
  pushPromise: null,
  needsPush: false,
  hydrating: false,
  hydrated: false,
  localWasConfigured: false,
  resetOwnerInstalled: false,
  resetting: false,
});

const CONFIG_KEYS = Object.freeze([
  "dm_dashboard_state",
  "dm_schema_version",
  "cd_sections",
  "cd_stanze",
  "cd_floors",
  "cd_cameras",
  "cd_appliances",
  "cd_loads",
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
  "cd_section_names",
  "cd_navbar_order",
  "cd_energy_views",
  "cd_slot_labels",
  "cd_gruppi_extra",
  "cd_gruppi_removed",
  "cd_avvisi_names_extra",
  "cd_subloads_extra",
  "cd_report_devices",
  "cd_lavatrice_visual",
  "cd_costo_kwh",
  "cd_prezzo_immissione",
  "cd_theme",
  "cd_nav_mode",
]);

function instanceId() {
  return String(
    root.__DASHBOARDMODERN_INSTANCE__ ||
      root.__DASHBOARDMODERN_STORAGE_NS__ ||
      "integration",
  );
}

function userDataKey() {
  return `dashboardmodern_v2_config:${instanceId()}`;
}

function localValues() {
  const values = {};
  for (const key of CONFIG_KEYS) {
    const value = root.localStorage?.getItem(key);
    if (value !== null && value !== undefined) values[key] = value;
  }
  return values;
}

function meaningfulLocal(values = localValues()) {
  const stateValue = values.dm_dashboard_state;
  if (stateValue) {
    try {
      const parsed = JSON.parse(stateValue);
      const sections = parsed?.sections || {};
      if (Object.values(sections).some((value) =>
        Array.isArray(value) ? value.length > 0 : value && typeof value === "object" ? Object.keys(value).length > 0 : Boolean(value),
      )) return true;
    } catch (_error) {}
  }
  return Object.entries(values).some(([key, value]) =>
    !["dm_schema_version", "cd_sections"].includes(key) && String(value || "").length > 2,
  );
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
    root.__DASHBOARDMODERN_HOSTED__ &&
      (root.__DASHBOARDMODERN_BRIDGE_WS__ || root.WebSocket),
  );
}

function bridgeRequest(type, payload = {}) {
  if (!hostedBridge()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const Socket = root.__DASHBOARDMODERN_BRIDGE_WS__ || root.WebSocket;
    const id = 700000 + Math.floor(Math.random() * 200000);
    let sent = false;
    let socket;
    const timer = root.setTimeout?.(() => {
      try { socket?.close?.(); } catch (_error) {}
      reject(new Error(`${type} timed out`));
    }, 8000);
    const finish = (callback, value) => {
      if (timer) root.clearTimeout?.(timer);
      try { socket?.close?.(); } catch (_error) {}
      callback(value);
    };
    const send = () => {
      if (sent) return;
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
        try { message = JSON.parse(event?.data || "{}"); } catch (_error) { return; }
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
        if (!sent && socket?.readyState === 1 && root.__DASHBOARDMODERN_BRIDGE_WS__) send();
      }, 25);
    } catch (error) {
      finish(reject, error);
    }
  });
}

async function pushNow() {
  if (!hostedBridge()) return true;
  const value = snapshot();
  try {
    await bridgeRequest("frontend/set_user_data", { key: userDataKey(), value });
    state.dirtyAt = 0;
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
    state.pushTimer = root.setTimeout?.(run, 80) || 0;
    if (!state.pushTimer) run();
  });
  return state.pushPromise;
}

function restoreValues(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return false;
  root.__DASHBOARDMODERN_PERSIST_RESTORE__ = true;
  try {
    for (const [key, value] of Object.entries(values)) {
      if (!CONFIG_KEYS.includes(key) || typeof value !== "string") continue;
      root.localStorage?.setItem(key, value);
    }
  } finally {
    delete root.__DASHBOARDMODERN_PERSIST_RESTORE__;
  }
  return true;
}

async function hydrateRemote() {
  if (state.hydrating || state.hydrated || state.resetting || !hostedBridge()) return false;
  state.hydrating = true;
  try {
    const result = await bridgeRequest("frontend/get_user_data", { key: userDataKey() });
    const remote = result?.value;
    if (
      !state.localWasConfigured &&
      remote &&
      typeof remote === "object" &&
      remote.version === USER_DATA_VERSION &&
      restoreValues(remote.values)
    ) {
      try { root.DashboardModernModules?.store?.migrate?.(); } catch (error) {
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
      return true;
    }
    if (!remote && state.localWasConfigured) await pushNow();
    return false;
  } catch (error) {
    console.warn("[DashboardModern] config restore skipped", error);
    return false;
  } finally {
    state.hydrating = false;
    state.hydrated = true;
  }
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

  // Let a push or legacy-store reconciliation already queued before the click
  // finish first. The reset is then the final writer both locally and remotely.
  try {
    if (state.pushPromise) await state.pushPromise;
    await Promise.resolve();
  } catch (_error) {}

  // storage-namespace.js makes clear() instance-scoped: this removes every
  // cd_/dm_ key for this dashboard, including alert keys unknown to older
  // snapshots, without touching another DashboardModern instance or HA data.
  try { root.localStorage?.clear?.(); } catch (error) {
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
    // Local reset remains valid; a later sync still carries the empty snapshot.
    root.console?.warn?.("[DashboardModern] remote reset deferred", error);
    state.needsPush = true;
    schedulePush();
  }

  // Rendering/store bridges may have completed work while the remote reset was
  // in flight. Clear once more so Reset totale always wins that race too.
  try { root.localStorage?.clear?.(); } catch (_error) {}

  root.dispatchEvent?.(new CustomEvent("dashboardmodern:config-reset", { detail: empty }));
  if (reload) {
    // Reload the exact versioned iframe URL. Rebuilding pathname/search with
    // location.replace() caused 404s inside the Home Assistant panel mount.
    root.setTimeout?.(() => root.location?.reload?.(), 40);
  } else {
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

export function installConfigPersistenceSection() {
  if (state.installed) {
    installResetOwner();
    return;
  }
  state.installed = true;
  state.localWasConfigured = meaningfulLocal();

  const previousMarkDirty = typeof root.cdMarkDirty === "function" ? root.cdMarkDirty : null;
  root.cdMarkDirty = function dashboardModernMarkDirty(...args) {
    try { previousMarkDirty?.apply(this, args); } catch (_error) {}
    state.dirtyAt = Date.now();
    return state.dirtyAt;
  };

  const previousSyncPush = typeof root.cdSyncPush === "function" ? root.cdSyncPush : null;
  root.cdSyncPush = function dashboardModernSyncPush(...args) {
    try { previousSyncPush?.apply(this, args); } catch (_error) {}
    return schedulePush();
  };

  root.cdSyncPull = hydrateRemote;
  root.dmResetAllConfig = resetAllConfig;
  installResetOwner();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installResetOwner();
    root.setTimeout?.(hydrateRemote, 0);
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    installResetOwner();
    root.setTimeout?.(hydrateRemote, 0);
  });
}

installConfigPersistenceSection();
