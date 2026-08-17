/*
 * A WebSocket that never carries a credential.
 *
 * The first version of this bridge handed the hosted dashboard a Home Assistant
 * access token, which it stored in localStorage so its existing bootstrap could
 * use it unchanged. That was wrong. The hosted page loads three scripts from a
 * public CDN — Chart.js, hls.js, panzoom — and any script running in a page can
 * read that page's localStorage. Nothing suggests those libraries do anything
 * of the sort, but putting a working Home Assistant credential within reach of
 * third-party code is an exposure with no upside, and the whole point of the
 * integration was to stop tokens existing.
 *
 * So no token crosses over. Instead the panel installs this shim in place of
 * the hosted document's WebSocket constructor. The hosted code still calls
 * `new WebSocket(...)`, still sends the same messages and still receives the
 * same replies — but the messages are forwarded through the panel's own
 * authenticated connection, which lives in the parent document where the CDN
 * scripts are not running.
 *
 * The shim is the enforcement point: it forwards a fixed set of message types
 * and refuses the rest. Anything running inside the hosted page can therefore
 * do exactly what the dashboard needs and nothing else, which is a stronger
 * guarantee than the token ever gave.
 */

export const ALLOWED_MESSAGE_TYPES = Object.freeze([
  "get_states",
  "call_service",
  "subscribe_events",
  "unsubscribe_events",
  "get_config",
  "get_services",
  "config/area_registry/list",
  "config/floor_registry/list",
  "history/history_during_period",
  "history/stream",
  "recorder/statistics_during_period",
  "config/device_registry/list",
  "config/entity_registry/list",
  "recorder/list_statistic_ids",
  "camera/stream",
  "camera_thumbnail",
  "frontend/get_user_data",
  "frontend/set_user_data",
  // Shared plancia configuration. frontend/*_user_data stays allowed only so
  // the per-user copy it used to write can be migrated into the shared store.
  "dashboardmodern/config/get",
  "dashboardmodern/config/set",
  "dashboardmodern/config/restore",
  "auth/sign_path",
]);

const OPEN = 1;
const CLOSED = 3;
const MODERN_PERSISTENCE_ID_MIN = 700000;
const DASHBOARD_CONFIG_KEY_PREFIX = "dashboardmodern_integration_config";

/**
 * The vendored runtime still contains its historical flat user_data sync.
 * Modern persistence uses request ids >= 700000 and an envelope
 * `{version, updated_at, values}`. Both used to write the same HA key, so a
 * phone and a desktop could alternately overwrite it with incompatible shapes.
 * The hosted bridge is early enough to stop the old writer before modules load.
 */
export function isLegacyDashboardPersistenceMessage(message = {}) {
  const type = String(message?.type || "");
  if (type !== "frontend/get_user_data" && type !== "frontend/set_user_data") return false;
  if (!String(message?.key || "").startsWith(DASHBOARD_CONFIG_KEY_PREFIX)) return false;
  const id = Number(message?.id);
  return !Number.isFinite(id) || id < MODERN_PERSISTENCE_ID_MIN;
}

/**
 * Create the shim class.
 *
 * `connection` is the panel's authenticated Home Assistant connection.
 * `onDenied` is called with any message type the shim refuses, so a denial is
 * visible during development instead of looking like a silent failure.
 */
export function createBridgeSocket({
  connection,
  onDenied = () => {},
  allowed = ALLOWED_MESSAGE_TYPES,
} = {}) {
  if (!connection?.sendMessagePromise) {
    throw new Error("An authenticated Home Assistant connection is required.");
  }
  const permitted = new Set(allowed);

  return class BridgeSocket {
    constructor() {
      this.readyState = OPEN;
      this.onmessage = null;
      this.onopen = null;
      this.onclose = null;
      this.onerror = null;
      this._subscriptions = new Map();

      // The hosted bootstrap waits for auth_ok before it does anything. There
      // is nothing to authenticate — the parent connection already is — so the
      // handshake is completed immediately and the auth message it would send
      // is discarded.
      queueMicrotask(() => {
        this.onopen?.({});
        this._deliver({ type: "auth_ok" });
      });
    }

    _deliver(payload) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }

    _reply(id, result) {
      this._deliver({ id, type: "result", success: true, result });
    }

    _fail(id, code, message) {
      this._deliver({
        id,
        type: "result",
        success: false,
        error: { code, message },
      });
    }

    async send(raw) {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      const { id, type } = message;
      if (type === "auth") return;

      if (!permitted.has(type)) {
        onDenied(type);
        this._fail(
          id,
          "not_allowed",
          `Message type not permitted through the bridge: ${type}`,
        );
        return;
      }

      // The classic runtime executes before deferred ES modules, therefore
      // merely replacing cdSyncPush later is not enough: its auth_ok handler can
      // already have issued a flat get/set_user_data request. A harmless success
      // reply keeps that old code from hanging while guaranteeing only the
      // canonical modern owner reaches Home Assistant for this config key.
      if (isLegacyDashboardPersistenceMessage(message)) {
        this._reply(id, type === "frontend/get_user_data" ? { value: null } : null);
        return;
      }

      if (type === "subscribe_events") {
        await this._subscribe(message);
        return;
      }
      if (type === "unsubscribe_events") {
        this._unsubscribe(message);
        return;
      }

      try {
        const { id: _ignored, ...payload } = message;
        this._reply(id, await connection.sendMessagePromise(payload));
      } catch (error) {
        this._fail(
          id,
          error?.code || "bridge_error",
          error?.message || String(error),
        );
      }
    }

    async _subscribe(message) {
      const { id, event_type: eventType } = message;
      try {
        const unsubscribe = await connection.subscribeEvents(
          (event) => this._deliver({ id, type: "event", event }),
          eventType,
        );
        this._subscriptions.set(id, unsubscribe);
        this._reply(id, null);
      } catch (error) {
        this._fail(id, "subscribe_failed", error?.message || String(error));
      }
    }

    _unsubscribe(message) {
      const target = message.subscription;
      const unsubscribe = this._subscriptions.get(target);
      if (unsubscribe) {
        unsubscribe();
        this._subscriptions.delete(target);
      }
      this._reply(message.id, null);
    }

    close() {
      // Subscriptions outlive the socket unless they are released here, and a
      // hosted document that reloads would otherwise leak one per reload.
      for (const unsubscribe of this._subscriptions.values()) unsubscribe();
      this._subscriptions.clear();
      this.readyState = CLOSED;
      this.onclose?.({});
    }
  };
}

/** Install the shim into a hosted document's window. */
export function installBridgeSocket(targetWindow, options) {
  const BridgeSocket = createBridgeSocket(options);
  targetWindow.WebSocket = BridgeSocket;
  targetWindow.__DASHBOARDMODERN_BRIDGED__ = true;
  return BridgeSocket;
}
