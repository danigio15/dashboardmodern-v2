/* DashboardModern hosted bridge prelude — no credential crosses into the frame. */
(function () {
  "use strict";

  var HOSTED_PLACEHOLDER = "__dashboardmodern_hosted__";
  var PRELUDE_WEBSOCKET = window.WebSocket;
  var hasInstanceQuery = false;
  var hasHostQuery = false;

  function lightAddFormMarkup() {
    var isEnglish =
      document.documentElement.lang === "en" ||
      /dashboard-en\.html(?:$|[?#])/.test(window.location.href);
    var title = isEnglish ? "＋ ADD LIGHT" : "＋ AGGIUNGI LUCE";
    var entityPlaceholder = isEnglish ? "light.living_room" : "light.soggiorno";
    var namePlaceholder = isEnglish ? "Light name (optional)" : "Nome luce (facoltativo)";
    var addLabel = isEnglish ? "＋ Add light" : "＋ Aggiungi luce";
    return (
      '<div class="ed-form dm-light-add-form" data-light-add-form>' +
      '<div class="ed-sec-title">' +
      title +
      "</div>" +
      '<div class="ed-form-row">' +
      '<input id="luce-add-ent" class="ed-input mono" placeholder="' +
      entityPlaceholder +
      '">' +
      '<button type="button" class="dm-entity-picker" data-entity-target="luce-add-ent">🔍</button>' +
      "</div>" +
      '<input id="luce-add-name" class="ed-input" placeholder="' +
      namePlaceholder +
      '">' +
      '<button class="ed-btn-add" onclick="cdLuceAdd()">' +
      addLabel +
      "</button></div>"
    );
  }

  function installEmptyLightsRendererFix() {
    var original = window.editorRenderLuci;
    if (typeof original !== "function" || original.__dmEmptyLightsFixed) return false;
    function patchedEditorRenderLuci() {
      var html = original.apply(this, arguments);
      if (
        typeof html !== "string" ||
        /data-light-add-form|id=["']luce-add-ent["']/.test(html)
      )
        return html;
      return html + lightAddFormMarkup();
    }
    patchedEditorRenderLuci.__dmEmptyLightsFixed = true;
    window.editorRenderLuci = patchedEditorRenderLuci;
    return true;
  }

  function isInjectedSocket(SocketCtor) {
    if (typeof SocketCtor !== "function") return false;
    try {
      return String(SocketCtor).indexOf("[native code]") === -1;
    } catch (_error) {
      return false;
    }
  }

  function parentValue(key) {
    try {
      return parent && parent !== window ? parent[key] : undefined;
    } catch (_error) {
      return undefined;
    }
  }

  try {
    var query = window.location.search || "";
    var instance = /[?&]dmi=([^&]+)/.exec(query);
    if (instance && instance[1]) {
      hasInstanceQuery = true;
      window.__DASHBOARDMODERN_INSTANCE__ ||=
        decodeURIComponent(instance[1]);
    }
    var primary = /[?&]dmp=(\d)/.exec(query);
    if (primary) {
      hasHostQuery = true;
      window.__DASHBOARDMODERN_PRIMARY__ = primary[1] === "1";
    }
    // Shared configuration profile. Without it a secondary plancia keeps the
    // historical per-user transport instead of guessing a storage key.
    var profile = /[?&]dmc=([^&]*)/.exec(query);
    if (profile && profile[1]) {
      window.__DASHBOARDMODERN_PROFILE__ ||= decodeURIComponent(profile[1]);
    }
  } catch (_error) {}

  if (parentValue("__DASHBOARDMODERN_INSTANCE__") && !window.__DASHBOARDMODERN_INSTANCE__)
    window.__DASHBOARDMODERN_INSTANCE__ = parentValue("__DASHBOARDMODERN_INSTANCE__");
  if (typeof parentValue("__DASHBOARDMODERN_PRIMARY__") !== "undefined")
    window.__DASHBOARDMODERN_PRIMARY__ = parentValue("__DASHBOARDMODERN_PRIMARY__") !== false;
  if (parentValue("__DASHBOARDMODERN_PROFILE__") && !window.__DASHBOARDMODERN_PROFILE__)
    window.__DASHBOARDMODERN_PROFILE__ = parentValue("__DASHBOARDMODERN_PROFILE__");

  function isHosted() {
    if (window.__DASHBOARDMODERN_HOSTED__ === true) return true;
    if (window.__DASHBOARDMODERN_BRIDGED__ === true) return true;
    if (typeof window.__DASHBOARDMODERN_BRIDGE_WS__ === "function") return true;
    if (hasInstanceQuery || hasHostQuery) return true;
    return parentValue("__DASHBOARDMODERN_HOST__") === true;
  }

  if (!isHosted()) return;

  window.__DASHBOARDMODERN_HOSTED__ = true;

  // The historical hosted runtime completes cd_sections after page load. Once
  // DashboardStore installs its legacy-write bridge, that compatibility write
  // is indistinguishable from a user edit: it syncs to HA, renders globally and
  // can retrigger expensive sections. Complete missing visibility keys here,
  // before modules-entry.js installs the bridge, so the later legacy pass is
  // genuinely idempotent. This only runs behind storage-namespace.js, therefore
  // no shared standalone localStorage is touched.
  function normalizeHostedVisibility() {
    if (!window.__DASHBOARDMODERN_STORAGE_NS__) return false;
    var raw = window.localStorage && window.localStorage.getItem("dm_dashboard_state");
    if (!raw) return false;
    var state;
    try {
      state = JSON.parse(raw);
    } catch (_error) {
      return false;
    }
    if (!state || Number(state.schema_version || 0) < 4 || !state.sections) return false;

    var sections = state.sections || {};
    var visibility = Object.assign({}, state.visibility || {});
    var overrides = sections.entityOverrides || {};
    var hasEntity = function (value) {
      return typeof value === "string" && value.trim().indexOf(".") > 0;
    };
    var hasSlotPrefix = function (prefix) {
      return Object.keys(overrides).some(function (slot) {
        return slot.indexOf(prefix) === 0 && hasEntity(overrides[slot]);
      });
    };
    var hasNestedEntity = function (value) {
      if (hasEntity(value)) return true;
      if (!value || typeof value !== "object") return false;
      return Object.keys(value).some(function (key) {
        if (key === "metadata") return false;
        return hasNestedEntity(value[key]);
      });
    };
    var listHasItems = function (value) {
      return Array.isArray(value) && value.length > 0;
    };
    var irrigation = sections.irrigation || {};
    var pool = sections.pool || {};
    var defaults = {
      energy: hasNestedEntity(sections.energy) || hasSlotPrefix("dm.energy_"),
      appliances: listHasItems(sections.appliances),
      ev: listHasItems(sections.ev) || hasSlotPrefix("dm.ev_"),
      boiler: hasSlotPrefix("dm.boiler_"),
      clima: listHasItems(sections.climate),
      temp:
        Array.isArray(sections.rooms) &&
        sections.rooms.some(function (room) {
          return hasEntity(room && room.temp) || hasEntity(room && room.hum);
        }),
      security:
        listHasItems(sections.cameras) ||
        hasSlotPrefix("dm.security_") ||
        hasEntity(overrides["dm.home_interruttore_antifurto"]),
      server: hasSlotPrefix("dm.server_"),
      tapparelle: listHasItems(sections.covers),
      irrigazione: Array.isArray(irrigation.zones) && irrigation.zones.length > 0,
      piscina: Object.keys(pool).length > 0,
    };

    var changed = false;
    Object.keys(defaults).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(visibility, key)) {
        visibility[key] = Boolean(defaults[key]);
        changed = true;
      }
    });
    if (!changed) return false;

    state.visibility = visibility;
    window.localStorage.setItem("dm_dashboard_state", JSON.stringify(state));
    window.localStorage.setItem("cd_sections", JSON.stringify(visibility));
    return true;
  }

  normalizeHostedVisibility();

  if (isInjectedSocket(PRELUDE_WEBSOCKET))
    window.__DASHBOARDMODERN_PRELUDE_WS__ = PRELUDE_WEBSOCKET;

  function trackReconnect(socket, event) {
    if (typeof socket.onclose !== "function") return;
    var originalSetTimeout = window.setTimeout;
    var record = (window.__DASHBOARDMODERN_LEGACY_RECONNECT__ ||= {
      timer: 0,
      callback: null,
      args: [],
      captured: false,
      cancelled: false,
    });
    function trackedSetTimeout(handler, delay) {
      var args = Array.prototype.slice.call(arguments, 2);
      var timer = originalSetTimeout.apply(window, arguments);
      if (typeof handler === "function" && Number(delay) === 5000) {
        record.timer = timer;
        record.callback = handler;
        record.args = args;
        record.captured = true;
        record.cancelled = false;
      }
      return timer;
    }
    window.setTimeout = trackedSetTimeout;
    try {
      socket.onclose(event);
    } finally {
      if (window.setTimeout === trackedSetTimeout) window.setTimeout = originalSetTimeout;
    }
  }

  function StubSocket() {
    var socket = this;
    socket.readyState = StubSocket.CONNECTING;
    setTimeout(function () {
      socket.readyState = StubSocket.CLOSED;
      try {
        socket.onerror && socket.onerror({ type: "error" });
      } catch (_error) {}
      try {
        trackReconnect(socket, { code: 1006, reason: "host bridge not ready" });
      } catch (_error) {}
    }, 40);
  }
  StubSocket.CONNECTING = 0;
  StubSocket.OPEN = 1;
  StubSocket.CLOSING = 2;
  StubSocket.CLOSED = 3;
  StubSocket.prototype.send = function () {};
  StubSocket.prototype.close = function () {
    this.readyState = StubSocket.CLOSED;
  };
  StubSocket.prototype.addEventListener = function (type, handler) {
    if (type !== "close" && type !== "error") return;
    setTimeout(function () {
      try {
        handler({ type: type, code: 1006 });
      } catch (_error) {}
    }, 50);
  };
  StubSocket.prototype.removeEventListener = function () {};

  function deferredSocketConstructor(SocketCtor) {
    function DeferredSocket() {
      var args = Array.prototype.slice.call(arguments);
      var inner = Reflect.construct(SocketCtor, args);
      Object.defineProperty(this, "__dmInnerSocket", { value: inner });
      var outer = this;
      ["onopen", "onmessage", "onerror", "onclose"].forEach(function (property) {
        var assigned = null;
        Object.defineProperty(outer, property, {
          configurable: true,
          enumerable: true,
          get: function () {
            return assigned;
          },
          set: function (handler) {
            assigned = typeof handler === "function" ? handler : null;
            inner[property] = assigned
              ? function (event) {
                  setTimeout(function () {
                    assigned.call(outer, event);
                  }, 0);
                }
              : null;
          },
        });
      });
    }
    DeferredSocket.prototype = Object.create(SocketCtor.prototype || Object.prototype);
    DeferredSocket.prototype.constructor = DeferredSocket;
    DeferredSocket.prototype.send = function () {
      return this.__dmInnerSocket.send.apply(this.__dmInnerSocket, arguments);
    };
    DeferredSocket.prototype.close = function () {
      return this.__dmInnerSocket.close && this.__dmInnerSocket.close.apply(this.__dmInnerSocket, arguments);
    };
    DeferredSocket.prototype.addEventListener = function (type, handler, options) {
      var outer = this;
      if (typeof this.__dmInnerSocket.addEventListener !== "function") return;
      return this.__dmInnerSocket.addEventListener(
        type,
        function (event) {
          setTimeout(function () {
            handler.call(outer, event);
          }, 0);
        },
        options,
      );
    };
    DeferredSocket.prototype.removeEventListener = function () {};
    ["readyState", "url", "protocol", "extensions", "bufferedAmount", "binaryType"].forEach(
      function (property) {
        Object.defineProperty(DeferredSocket.prototype, property, {
          configurable: true,
          enumerable: true,
          get: function () {
            return this.__dmInnerSocket[property];
          },
          set: function (value) {
            this.__dmInnerSocket[property] = value;
          },
        });
      },
    );
    DeferredSocket.CONNECTING = SocketCtor.CONNECTING == null ? 0 : SocketCtor.CONNECTING;
    DeferredSocket.OPEN = SocketCtor.OPEN == null ? 1 : SocketCtor.OPEN;
    DeferredSocket.CLOSING = SocketCtor.CLOSING == null ? 2 : SocketCtor.CLOSING;
    DeferredSocket.CLOSED = SocketCtor.CLOSED == null ? 3 : SocketCtor.CLOSED;
    DeferredSocket.__dmInjectedHostedAdapter = true;
    return DeferredSocket;
  }

  function explicitBridge() {
    var bridge = parentValue("__DASHBOARDMODERN_BRIDGE_WS__");
    if (typeof bridge === "function") return bridge;
    return typeof window.__DASHBOARDMODERN_BRIDGE_WS__ === "function"
      ? window.__DASHBOARDMODERN_BRIDGE_WS__
      : null;
  }

  function adoptBridge() {
    var bridge = explicitBridge();
    if (bridge) {
      window.__DASHBOARDMODERN_BRIDGE_WS__ = bridge;
      window.__DASHBOARDMODERN_BRIDGED__ = true;
      window.WebSocket = bridge;
      return true;
    }
    var injected = window.__DASHBOARDMODERN_PRELUDE_WS__;
    if (typeof injected === "function" && isInjectedSocket(injected)) {
      var adapter =
        window.__DASHBOARDMODERN_PRELUDE_DEFERRED_WS__ ||
        deferredSocketConstructor(injected);
      window.__DASHBOARDMODERN_PRELUDE_DEFERRED_WS__ = adapter;
      window.__DASHBOARDMODERN_BRIDGE_WS__ = adapter;
      window.__DASHBOARDMODERN_BRIDGED__ = true;
      window.WebSocket = adapter;
      return true;
    }
    return false;
  }

  if (!adoptBridge()) window.WebSocket = StubSocket;
  window.__DASHBOARDMODERN_CONNECTION__ = {
    token: HOSTED_PLACEHOLDER,
    local_ip: window.location.host,
    remote_url: "",
  };

  function adoptAndFix() {
    adoptBridge();
    installEmptyLightsRendererFix();
  }
  window.addEventListener("dashboardmodern:bridge-ready", adoptAndFix);
  window.addEventListener("dashboardmodern:legacy-ready", adoptAndFix);
  window.addEventListener("DOMContentLoaded", adoptAndFix, { once: true });
})();