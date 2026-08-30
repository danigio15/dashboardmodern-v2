import assert from "node:assert/strict";
import test from "node:test";

import { HOST_KEY, legacyVariantForLocale, mountLegacyHost } from "../src/legacy/host.js";
import {
  ALLOWED_MESSAGE_TYPES,
  createBridgeSocket,
  isLegacyDashboardPersistenceMessage,
} from "../src/legacy/bridge-socket.js";

function fakeElement(tag) {
  return {
    tagName: tag,
    className: "",
    style: {},
    attributes: {},
    dataset: {},
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
  const hostWindow = {
    location: { href: "http://ha.local:8123/dashboardmodern", host: "ha.local:8123" },
  };
  const host = mountLegacyHost(container, {
    hass: { locale: { language: "it" } },
    connection: connectionWith(),
    staticBase: "/dashboardmodern_static/abc",
    documentRef,
    hostWindow,
    fetchRef: async () => ({
      ok: true,
      text: async () => "<!doctype html><html><head></head><body></body></html>",
    }),
    ...overrides,
  });
  return { host, container, hostWindow };
}

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
  /* Segnalazione #178: un profilo in francese si ritrovava — a suo dire — la
   * plancia in italiano. Le lingue che non parliamo prendono l'inglese: non lo
   * capiscono piu' dell'italiano, ma e' quello che ci si aspetta quando la
   * propria lingua non c'e'. */
  for (const lingua of ["fr", "fr-FR", "de", "de-AT", "es", "es-419", "pt-BR", "nl", "sv"]) {
    assert.equal(legacyVariantForLocale(lingua), "dashboard-en.html", lingua);
  }
  // E l'italiano resta italiano, senza farsi rubare il posto da una lingua che
  // comincia per "it" senza esserlo.
  assert.equal(legacyVariantForLocale("it-CH"), "dashboard.html");
  assert.equal(legacyVariantForLocale("ita"), "dashboard-en.html");
  /* A language we now translate still starts from the English shell: it is a
   * starting point, translated from the inside, not the language itself. */
  assert.equal(legacyVariantForLocale("ja"), "dashboard-en.html");
  assert.equal(legacyVariantForLocale("ar-EG"), "dashboard-en.html");
  assert.equal(legacyVariantForLocale("zh-TW"), "dashboard-en.html");
});

async function hostedDocument(language) {
  const { host } = mount({ hass: { locale: { language } } });
  /* The document is fetched and rewritten asynchronously; the srcdoc lands on
   * the frame once that settles. */
  for (let attempt = 0; attempt < 10 && !host.frame.srcdoc; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return host.frame.srcdoc || "";
}

test("the hosted shell is stamped with the user's language and direction", async () => {
  /* The vendored file hard-codes lang="it" or lang="en". Left alone, the first
   * paint would be in the wrong language — and for Arabic, laid out the wrong
   * way round until a script got to it. */
  const japanese = await hostedDocument("ja");
  assert.match(japanese, /<html[^>]*lang="ja"/);
  assert.match(japanese, /<html[^>]*dir="ltr"/);

  const arabic = await hostedDocument("ar");
  assert.match(arabic, /<html[^>]*lang="ar"/);
  assert.match(arabic, /<html[^>]*dir="rtl"/);
});

test("the resolved locale reaches the hosted document before its first script", async () => {
  const html = await hostedDocument("pt-BR");
  /* Resolved, not passed through: pt-BR has no catalog of its own and must
   * arrive as the pt the engine can actually load. */
  assert.match(html, /window\.__DASHBOARDMODERN_LOCALE__="pt"/);
  const preludeAt = html.indexOf("__DASHBOARDMODERN_LOCALE__");
  const bodyAt = html.indexOf("<body");
  assert.ok(preludeAt >= 0 && (bodyAt < 0 || preludeAt < bodyAt), "locale must be set in <head>");
});

test("an unknown Home Assistant language falls back to English, not to Italian", async () => {
  const html = await hostedDocument("xx-YY");
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /window\.__DASHBOARDMODERN_LOCALE__="en"/);
});

test("no credential is published to the hosted page", () => {
  const { hostWindow } = mount();
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
  assert.throws(() => mount({ connection: {} }), /authenticated Home Assistant connection/);
});

test("the frame records the versioned source and keeps playback permissions", async () => {
  const { host } = mount();
  await host.ready;
  assert.equal(
    host.frame.dataset.source,
    "/dashboardmodern_static/abc/legacy/dashboard.html?dmi=integration&dmp=1",
  );
  assert.equal(host.frame.getAttribute("src"), undefined);
  assert.match(
    host.frame.srcdoc,
    /<base href="http:\/\/ha\.local:8123\/dashboardmodern_static\/abc\/legacy\/">/,
  );
  assert.match(host.frame.srcdoc, /__DASHBOARDMODERN_BRIDGE_WS__/);
  for (const permission of ["autoplay", "fullscreen", "picture-in-picture"]) {
    assert.equal(host.frame.getAttribute("allow").includes(permission), true);
  }
  assert.equal(host.frame.getAttribute("sandbox"), undefined);
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
    hostWindow: {
      location: { href: "http://ha.local:8123/dashboardmodern", host: "ha.local:8123" },
    },
    fetchRef: async () => ({
      ok: true,
      text: async () => "<!doctype html><html><head></head><body></body></html>",
    }),
  });
  assert.equal(host.frame.style.height, "100dvh");
});

test("destroying the host removes the frame and the marker", () => {
  const { host, hostWindow } = mount();
  host.destroy();
  assert.equal(host.frame.removed, true);
  assert.equal(HOST_KEY in hostWindow, false);
});

/* La plancia scrive anche nel documento di Home Assistant: lo scorrimento
 * bloccato e, col modo chiosco, un velo fisso a tutto schermo sopra il
 * pannello. Home Assistant e' una pagina sola e non si scarica mai quando si
 * passa a un'altra plancia, quindi quel velo restava addosso alle altre
 * dashboard e sembrava che il tema fosse sbiancato per sempre. Chi ospita la
 * cornice sa sempre quando la toglie: deve chiedere di rimettere a posto
 * prima. */
test("chi smonta la plancia le fa rimettere a posto il documento di Home Assistant", () => {
  const { host } = mount();
  const chiamate = [];
  host.frame.contentWindow.dmReleaseOwnerDocument = () => {
    chiamate.push(host.frame.removed === true);
  };
  host.destroy();
  assert.deepEqual(chiamate, [false], "va chiamata, e prima che la cornice sparisca");
});

test("e se la cornice non risponde piu', si smonta lo stesso", () => {
  const { host } = mount();
  Object.defineProperty(host.frame, "contentWindow", {
    get() {
      throw new Error("cross origin");
    },
  });
  host.destroy();
  assert.equal(host.frame.removed, true);
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

test("legacy hosted config reads and writes are recognized by request id", () => {
  assert.equal(
    isLegacyDashboardPersistenceMessage({
      id: 17,
      type: "frontend/get_user_data",
      key: "dashboardmodern_integration_config",
    }),
    true,
  );
  assert.equal(
    isLegacyDashboardPersistenceMessage({
      id: 22,
      type: "frontend/set_user_data",
      key: "dashboardmodern_integration_config__secondary",
    }),
    true,
  );
  assert.equal(
    isLegacyDashboardPersistenceMessage({
      id: 700001,
      type: "frontend/get_user_data",
      key: "dashboardmodern_integration_config",
    }),
    false,
  );
});

test("legacy hosted config writer is acknowledged but never reaches Home Assistant", async () => {
  const sent = [];
  const Socket = createBridgeSocket({
    connection: connectionWith(async (message) => {
      sent.push(message);
      return { value: "remote" };
    }),
  });
  const read = await exchange(new Socket(), {
    id: 18,
    type: "frontend/get_user_data",
    key: "dashboardmodern_integration_config",
  });
  assert.deepEqual(read.find((item) => item.id === 18)?.result, { value: null });
  const write = await exchange(new Socket(), {
    id: 19,
    type: "frontend/set_user_data",
    key: "dashboardmodern_integration_config",
    value: { __ts: Date.now(), cd_sections: "{}" },
  });
  assert.equal(write.find((item) => item.id === 19)?.success, true);
  assert.deepEqual(sent, []);
});

test("modern persistence requests still reach Home Assistant", async () => {
  const sent = [];
  const Socket = createBridgeSocket({
    connection: connectionWith(async (message) => {
      sent.push(message);
      return message.type === "frontend/get_user_data" ? { value: { version: 1 } } : null;
    }),
  });
  const received = await exchange(new Socket(), {
    id: 700123,
    type: "frontend/get_user_data",
    key: "dashboardmodern_integration_config",
  });
  assert.equal(received.find((item) => item.id === 700123)?.success, true);
  assert.deepEqual(sent, [
    { type: "frontend/get_user_data", key: "dashboardmodern_integration_config" },
  ]);
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
  socket.close();
  assert.equal(released, 1);
});

/* Lo smontaggio del pannello e' differito: nella sua finestra un host
 * sostituto puo' essere gia' montato, e i globali sul window sono i suoi.
 * Il destroy in ritardo non deve portargli via il ponte: cancella solo se
 * la firma — il BridgeSocket — e' ancora la propria. */
test("il destroy in ritardo non porta via i globali di un host sostituto", () => {
  const { host, hostWindow } = mount();
  const vecchio = host;
  // Un sostituto monta sullo stesso window e riscrive i globali.
  const container2 = fakeElement("div");
  const nuovo = mountLegacyHost(container2, {
    hass: { locale: { language: "it" } },
    connection: connectionWith(),
    staticBase: "/dashboardmodern_static/def",
    documentRef,
    hostWindow,
    fetchRef: async () => ({
      ok: true,
      text: async () => "<!doctype html><html><head></head><body></body></html>",
    }),
  });
  const ponteDelNuovo = hostWindow.__DASHBOARDMODERN_BRIDGE_WS__;
  vecchio.destroy();
  assert.equal(hostWindow[HOST_KEY], true, "il marchio del sostituto e' sparito");
  assert.equal(
    hostWindow.__DASHBOARDMODERN_BRIDGE_WS__,
    ponteDelNuovo,
    "il ponte del sostituto e' stato cancellato dal destroy in ritardo",
  );
  // E quando a smontare e' il legittimo proprietario, i globali se ne vanno.
  nuovo.destroy();
  assert.equal(HOST_KEY in hostWindow, false);
  assert.equal("__DASHBOARDMODERN_BRIDGE_WS__" in hostWindow, false);
});
