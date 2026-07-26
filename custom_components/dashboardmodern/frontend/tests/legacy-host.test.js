import assert from "node:assert/strict";
import test from "node:test";

import { HOST_KEY, legacyVariantForLocale, mountLegacyHost } from "../src/legacy/host.js";
import { ALLOWED_MESSAGE_TYPES, createBridgeSocket } from "../src/legacy/bridge-socket.js";

function fakeElement(tag) {
  return {
    tagName: tag,
    className: "",
    style: {},
    attributes: {},
    children: [],
    listeners: {},
    contentWindow: {},
    setAttribute(key, value) {
      this.attributes[key] = String(value);
    },
    getAttribute(key) {
      return this.attributes[key];
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    remove() {
      this.removed = true;
    },
  };
}

const documentRef = { createElement: fakeElement };

function connectionWith(handler = async () => ({}), subscribe = async () => () => {}) {
  return { sendMessagePromise: handler, subscribeEvents: subscribe };
}

function mount(overrides = {}) {
  const container = fakeElement("div");
  const hostWindow = { location: { host: "ha.local:8123" } };
  const host = mountLegacyHost(container, {
    hass: { locale: { language: "it" } },
    connection: connectionWith(),
    staticBase: "/dashboardmodern_static/abc",
    documentRef,
    hostWindow,
    ...overrides,
  });
  return { host, container, hostWindow };
}

/** Drive a shim socket and collect what it delivers back. */
async function exchange(socket, message) {
  const received = [];
  socket.onmessage = (event) => received.push(JSON.parse(event.data));
  await socket.send(JSON.stringify(message));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return received;
}

test("the language variant follows the Home Assistant locale", () => {
  assert.equal(legacyVariantForLocale("it"), "dashboard.html");
  assert.equal(legacyVariantForLocale("it-IT"), "dashboard.html");
  assert.equal(legacyVariantForLocale("en-GB"), "dashboard-en.html");
  assert.equal(legacyVariantForLocale(undefined), "dashboard-en.html");
});

test("no credential is published to the hosted page", () => {
  const { hostWindow } = mount();

  // The hosted page loads scripts from a public CDN, and any script in a page
  // can read that page's storage. There must be nothing worth reading.
  assert.equal(hostWindow[HOST_KEY], true);
  assert.equal(JSON.stringify(hostWindow).includes("token"), false);
});

test("the hosted page gets a shim instead of the real WebSocket", () => {
  const { host } = mount();

  assert.equal(typeof host.frame.contentWindow.WebSocket, "function");
  assert.equal(host.frame.contentWindow.__DASHBOARDMODERN_BRIDGED__, true);
});

test("the shim is reinstalled when the hosted document reloads", () => {
  const { host } = mount();
  host.frame.contentWindow = {};

  host.frame.listeners.load();

  assert.equal(host.frame.contentWindow.__DASHBOARDMODERN_BRIDGED__, true);
});

test("mounting without an authenticated connection is refused", () => {
  assert.throws(
    () => mount({ connection: {} }),
    /authenticated Home Assistant connection/,
  );
});

test("the frame points at the versioned path and keeps playback permissions", () => {
  const { host } = mount();

  assert.equal(host.frame.getAttribute("src"), "/dashboardmodern_static/abc/legacy/dashboard.html");
  for (const permission of ["autoplay", "fullscreen", "picture-in-picture"]) {
    assert.equal(host.frame.getAttribute("allow").includes(permission), true);
  }
  assert.equal(host.frame.getAttribute("sandbox"), undefined);
  // Fill the container: subtracting a header the container already excluded
  // is what left a blank strip under the dashboard.
  assert.equal(host.frame.style.height, "100%");
});

test("a container with no height falls back to viewport units", () => {
  const container = fakeElement("div");
  const frame = fakeElement("iframe");
  frame.clientHeight = 0;
  const host = mountLegacyHost(container, {
    hass: { locale: { language: "it" } },
    connection: connectionWith(),
    staticBase: "/dashboardmodern_static/abc",
    documentRef: { createElement: () => frame },
    hostWindow: { location: { host: "ha.local:8123" } },
  });

  assert.equal(host.frame.style.height, "100dvh");
});

test("destroying the host removes the frame and the marker", () => {
  const { host, hostWindow } = mount();

  host.destroy();

  assert.equal(host.frame.removed, true);
  assert.equal(HOST_KEY in hostWindow, false);
});

test("the shim completes the handshake without authenticating", async () => {
  const Socket = createBridgeSocket({ connection: connectionWith() });
  const socket = new Socket();
  const received = [];
  socket.onmessage = (event) => received.push(JSON.parse(event.data));

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(received, [{ type: "auth_ok" }]);
});

test("an auth message carrying a placeholder is discarded, not forwarded", async () => {
  const sent = [];
  const Socket = createBridgeSocket({
    connection: connectionWith(async (message) => {
      sent.push(message);
      return {};
    }),
  });

  await exchange(new Socket(), { type: "auth", access_token: "__dashboardmodern_hosted__" });

  assert.deepEqual(sent, []);
});

test("permitted messages are forwarded and their replies returned", async () => {
  const Socket = createBridgeSocket({
    connection: connectionWith(async (message) =>
      message.type === "get_states" ? [{ entity_id: "light.x" }] : {},
    ),
  });

  const received = await exchange(new Socket(), { id: 7, type: "get_states" });
  const result = received.find((item) => item.id === 7);

  assert.equal(result.success, true);
  assert.deepEqual(result.result, [{ entity_id: "light.x" }]);
});

test("a message type outside the allowed set is refused and reported", async () => {
  const denied = [];
  const sent = [];
  const Socket = createBridgeSocket({
    connection: connectionWith(async (message) => {
      sent.push(message);
      return {};
    }),
    onDenied: (type) => denied.push(type),
  });

  const received = await exchange(new Socket(), { id: 3, type: "config/auth/create" });
  const result = received.find((item) => item.id === 3);

  // The shim is the enforcement point: this is a stronger guarantee than the
  // token ever gave, because a token permits everything its owner can do.
  assert.equal(result.success, false);
  assert.equal(result.error.code, "not_allowed");
  assert.deepEqual(denied, ["config/auth/create"]);
  assert.deepEqual(sent, []);
});

test("the allowed set covers what the hosted dashboard actually sends", () => {
  for (const type of [
    "get_states",
    "call_service",
    "subscribe_events",
    "config/area_registry/list",
    "config/device_registry/list",
    "config/entity_registry/list",
    "recorder/statistics_during_period",
    "frontend/get_user_data",
    "frontend/set_user_data",
    "camera/stream",
  ]) {
    assert.equal(ALLOWED_MESSAGE_TYPES.includes(type), true, `missing ${type}`);
  }
  // Nothing that would let the hosted page grant itself anything.
  assert.equal(ALLOWED_MESSAGE_TYPES.includes("auth/long_lived_access_token"), false);
  assert.equal(ALLOWED_MESSAGE_TYPES.includes("config/auth/create"), false);
});

test("a backend failure is reported rather than swallowed", async () => {
  const Socket = createBridgeSocket({
    connection: connectionWith(async () => {
      throw Object.assign(new Error("nope"), { code: "unknown_command" });
    }),
  });

  const received = await exchange(new Socket(), { id: 4, type: "get_states" });
  const result = received.find((item) => item.id === 4);

  assert.equal(result.success, false);
  assert.equal(result.error.code, "unknown_command");
});

test("events reach the hosted page and unsubscribe when the socket closes", async () => {
  let emit = null;
  let released = 0;
  const Socket = createBridgeSocket({
    connection: connectionWith(undefined, async (callback) => {
      emit = callback;
      return () => {
        released += 1;
      };
    }),
  });

  const socket = new Socket();
  const received = [];
  socket.onmessage = (event) => received.push(JSON.parse(event.data));
  await socket.send(JSON.stringify({ id: 9, type: "subscribe_events", event_type: "state_changed" }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  emit({ event_type: "state_changed" });
  assert.equal(received.some((item) => item.type === "event" && item.id === 9), true);

  // A hosted document that reloads would otherwise leak a subscription each time.
  socket.close();
  assert.equal(released, 1);
});
