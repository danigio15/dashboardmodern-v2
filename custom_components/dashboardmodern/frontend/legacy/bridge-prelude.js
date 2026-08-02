/*
 * DashboardModern legacy bridge prelude.
 *
 * Injected by scripts/vendor_legacy.py as the first script of the vendored
 * legacy dashboard, so it runs before the dashboard's own bootstrap.
 *
 * No credential crosses over, and — just as important — nothing is written to
 * localStorage. An earlier version stored a connection placeholder under
 * cd_connection so the legacy bootstrap could read it unchanged. On a host
 * where the user also runs the standalone dashboard, both pages share one
 * localStorage: the hosted page's placeholder overwrote the standalone page's
 * real token, and the standalone dashboard then tried to authenticate with a
 * placeholder and hung on "connecting". So the placeholder now lives only on a
 * window property this page can see, never in shared storage.
 *
 * This prelude therefore only records that the dashboard is integration-hosted
 * and exposes the placeholder in memory, so the bootstrap does not open its
 * setup wizard asking for a token that is no longer needed anywhere.
 *
 * Standalone use is unaffected: with no host present this is a no-op and the
 * wizard runs exactly as before.
 */
(function () {
  "use strict";

  /*
   * The English legacy renderer returns early when there are no configured
   * lights, so its "Add light" form never reaches the DOM. Keep the legacy
   * renderer intact and append the same stable form only when it is missing.
   * The canonical editor mount then adds data-entity-input/data-light-add-entity
   * and binds the picker exactly as it does for the non-empty state.
   */
  function lightAddFormMarkup() {
    var isEnglish = document.documentElement.lang === "en" || /dashboard-en\.html(?:$|[?#])/.test(window.location.href);
    var title = isEnglish ? "＋ ADD LIGHT" : "＋ AGGIUNGI LUCE";
    var entityPlaceholder = isEnglish ? "light.living_room" : "light.soggiorno";
    var namePlaceholder = isEnglish ? "Light name (optional)" : "Nome luce (facoltativo)";
    var addLabel = isEnglish ? "＋ Add light" : "＋ Aggiungi luce";

    return '<div class="ed-form dm-light-add-form" data-light-add-form>' +
      '<div class="ed-sec-title">' + title + '</div>' +
      '<div class="ed-form-row">' +
        '<input id="luce-add-ent" class="ed-input mono" placeholder="' + entityPlaceholder + '">' +
        '<button type="button" class="dm-entity-picker" data-entity-target="luce-add-ent" aria-label="' +
          (isEnglish ? "Select light entity" : "Seleziona entità luce") + '">🔍</button>' +
      '</div>' +
      '<input id="luce-add-name" class="ed-input" placeholder="' + namePlaceholder + '">' +
      '<button class="ed-btn-add" onclick="cdLuceAdd()">' + addLabel + '</button>' +
    '</div>';
  }

  function installEmptyLightsRendererFix() {
    var original = window.editorRenderLuci;
    if (typeof original !== "function" || original.__dmEmptyLightsFixed) return false;

    function patchedEditorRenderLuci() {
      var html = original.apply(this, arguments);
      if (typeof html !== "string" || /data-light-add-form|id=["']luce-add-ent["']/.test(html)) {
        return html;
      }
      return html + lightAddFormMarkup();
    }

    patchedEditorRenderLuci.__dmEmptyLightsFixed = true;
    window.editorRenderLuci = patchedEditorRenderLuci;
    return true;
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("dashboardmodern:legacy-ready", installEmptyLightsRendererFix, { once: true });
    window.addEventListener("DOMContentLoaded", installEmptyLightsRendererFix, { once: true });
  }

  // Capture a constructor installed before this prelude. The real integration
  // page starts with the browser-native WebSocket; Playwright and legitimate
  // embedders may preload an in-memory adapter before document parsing.
  var PRELUDE_WEBSOCKET = window.WebSocket;
  var HAS_INSTANCE_QUERY = false;
  var HAS_HOST_QUERY = false;
  try {
    var _q = window.location.search || "";
    var _mi = /[?&]dmi=([^&]+)/.exec(_q);
    if (_mi && _mi[1]) {
      HAS_INSTANCE_QUERY = true;
      if (!window.__DASHBOARDMODERN_INSTANCE__) {
        window.__DASHBOARDMODERN_INSTANCE__ = decodeURIComponent(_mi[1]);
      }
    }
    var _mp = /[?&]dmp=(\d)/.exec(_q);
    if (_mp) {
      HAS_HOST_QUERY = true;
      window.__DASHBOARDMODERN_PRIMARY__ = _mp[1] === "1";
    }
  } catch (e) {}

  try {
    if (parent && parent !== window) {
      if (parent.__DASHBOARDMODERN_INSTANCE__ && !window.__DASHBOARDMODERN_INSTANCE__) {
        window.__DASHBOARDMODERN_INSTANCE__ = parent.__DASHBOARDMODERN_INSTANCE__;
      }
      if (typeof parent.__DASHBOARDMODERN_PRIMARY__ !== "undefined") {
        window.__DASHBOARDMODERN_PRIMARY__ = parent.__DASHBOARDMODERN_PRIMARY__ !== false;
      }
    }
  } catch (e) { /* cross-origin parent: standalone use, nothing to copy */ }

  var HOSTED_TOKEN = "__dashboardmodern_hosted__";

  function isInjectedSocket(SocketCtor) {
    if (typeof SocketCtor !== "function") return false;
    try {
      return String(SocketCtor).indexOf("[native code]") === -1;
    } catch (error) {
      return false;
    }
  }

  if (isInjectedSocket(PRELUDE_WEBSOCKET)) {
    window.__DASHBOARDMODERN_PRELUDE_WS__ = PRELUDE_WEBSOCKET;
  }

  function isHosted() {
    // Same-origin by construction: both documents are served by Home Assistant.
    // A cross-origin parent throws here, which is the correct standalone path.
    try {
      // dmi is retained as a backwards-compatible parse-time host signal. dmp
      // is the newer explicit marker. An explicit bridge constructor is also a
      // reliable signal and must not be replaced by a native network socket.
      if (window.__DASHBOARDMODERN_BRIDGED__ === true) return true;
      if (window.__DASHBOARDMODERN_HOSTED__ === true) return true;
      if (typeof window.__DASHBOARDMODERN_BRIDGE_WS__ === "function") return true;
      if (HAS_INSTANCE_QUERY || HAS_HOST_QUERY) return true;
      var parent = window.parent;
      if (!parent || parent === window) return false;
      return parent.__DASHBOARDMODERN_HOST__ === true;
    } catch (error) {
      return false;
    }
  }

  if (!isHosted()) return;

  // In memory only. The bootstrap reads this before it reads cd_connection, so
  // the hosted page never has to touch the storage the standalone page relies
  // on. Not a credential: the shim discards the auth message it appears in.
  window.__DASHBOARDMODERN_HOSTED__ = true;
  // Copy the real access token from the parent synchronously: this runs before
  // the dashboard's scripts parse, so const LONG_LIVED_TOKEN sees it. In memory
  // only — never written to storage.
  var REAL_TOKEN = "";
  try {
    REAL_TOKEN = String(window.parent.__DASHBOARDMODERN_REAL_TOKEN__ || "");
  } catch (error) {
    REAL_TOKEN = "";
  }
  if (REAL_TOKEN) {
    window.__DASHBOARDMODERN_REAL_TOKEN__ = REAL_TOKEN;
    window.DASHBOARDMODERN_AUTH_TOKEN ||= REAL_TOKEN;
  }

  /*
   * The inert socket below deliberately triggers the legacy close path once.
   * That close handler schedules `connect` five seconds later. Recorder and the
   * shared 0.14.16 broker are ready before then, so the retry is redundant, but
   * its callback is a lexical reference and cannot be replaced afterwards.
   * Track only the timeout created while invoking this exact close callback;
   * the final runtime can then cancel that one timer without replacing
   * WebSocket, setTimeout or any application callback globally.
   */
  function invokeTrackedInitialClose(socket, event) {
    var originalSetTimeout = window.setTimeout;
    if (typeof originalSetTimeout !== "function" || typeof socket.onclose !== "function") {
      socket.onclose(event);
      return;
    }
    var record = window.__DASHBOARDMODERN_LEGACY_RECONNECT__ || {
      timer: 0,
      callback: null,
      args: [],
      captured: false,
      cancelled: false,
    };
    window.__DASHBOARDMODERN_LEGACY_RECONNECT__ = record;

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

  // Between document parse and the host's load-time bridge install, the page
  // would otherwise reach the REAL WebSocket and authenticate on its own — the
  // source of the "login attempt failed" notifications. Replace it with an
  // inert stub that opens nothing and closes immediately: the dashboard's own
  // reconnect logic retries after the bridge is installed and succeeds. No
  // authentication of any kind can leave the frame before the bridge exists.
  function StubSocket() {
    var self = this;
    this.readyState = StubSocket.CONNECTING;
    setTimeout(function () {
      self.readyState = StubSocket.CLOSED;
      try {
        if (typeof self.onerror === "function") self.onerror({ type: "error" });
      } catch (error) {
        /* listener errors are the page's business */
      }
      try {
        if (typeof self.onclose === "function") {
          invokeTrackedInitialClose(self, { code: 1006, reason: "bridge not ready" });
        }
      } catch (error) {
        /* listener errors are the page's business */
      }
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
    if (type === "close" || type === "error") {
      setTimeout(function () {
        try {
          handler({ code: 1006, type: type });
        } catch (error) {
          /* listener errors are the page's business */
        }
      }, 50);
    }
  };
  StubSocket.prototype.removeEventListener = function () {};

  var BridgeWS = null;
  try {
    BridgeWS = window.parent.__DASHBOARDMODERN_BRIDGE_WS__ || window.__DASHBOARDMODERN_BRIDGE_WS__ || null;
  } catch (error) {
    BridgeWS = window.__DASHBOARDMODERN_BRIDGE_WS__ || null;
  }

  // The main legacy bootstrap receives only the explicit host bridge (or the
  // inert stub). Never give it a generic preloaded adapter while its own script
  // is parsing: synchronous mock replies inside ws.send() can recursively
  // re-enter the legacy state machine.
  window.WebSocket = typeof BridgeWS === "function" ? BridgeWS : StubSocket;

  function deferredSocketConstructor(SocketCtor) {
    function construct(args) {
      if (typeof Reflect !== "undefined" && typeof Reflect.construct === "function") {
        return Reflect.construct(SocketCtor, args);
      }
      var Bound = Function.prototype.bind.apply(SocketCtor, [null].concat(args));
      return new Bound();
    }

    function DeferredSocket() {
      var inner = construct(Array.prototype.slice.call(arguments));
      Object.defineProperty(this, "__dmInnerSocket", {
        value: inner,
        configurable: false,
        enumerable: false,
        writable: false,
      });
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
      return this.__dmInnerSocket.close.apply(this.__dmInnerSocket, arguments);
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
    ["readyState", "url", "protocol", "extensions", "bufferedAmount", "binaryType"].forEach(function (property) {
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
    });
    DeferredSocket.CONNECTING = SocketCtor.CONNECTING == null ? 0 : SocketCtor.CONNECTING;
    DeferredSocket.OPEN = SocketCtor.OPEN == null ? 1 : SocketCtor.OPEN;
    DeferredSocket.CLOSING = SocketCtor.CLOSING == null ? 2 : SocketCtor.CLOSING;
    DeferredSocket.CLOSED = SocketCtor.CLOSED == null ? 3 : SocketCtor.CLOSED;
    return DeferredSocket;
  }

  // Once the main legacy socket and canonical store are initialized, expose an
  // asynchronous wrapper around the preloaded adapter. Both a later reconnect
  // and Recorder receive the expected mock/bridge replies, but never inside the
  // same call stack as send(), so the legacy state machine cannot recurse.
  if (
    window.__DASHBOARDMODERN_PRELUDE_WS__ === PRELUDE_WEBSOCKET &&
    typeof window.addEventListener === "function"
  ) {
    window.addEventListener(
      "dashboardmodern:legacy-ready",
      function installDeferredPreloadedSocket() {
        window.DASHBOARDMODERN_AUTH_TOKEN ||= REAL_TOKEN || HOSTED_TOKEN;
        window.WebSocket = deferredSocketConstructor(PRELUDE_WEBSOCKET);
      },
      { once: true },
    );
  }

  window.__DASHBOARDMODERN_CONNECTION__ = {
    token: REAL_TOKEN || HOSTED_TOKEN,
    local_ip: window.location.host,
    remote_url: "",
  };
})();