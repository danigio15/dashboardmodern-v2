/* DashboardModern hosted bridge prelude — no credential crosses into the frame. */
(function () {
  "use strict";

  var HOSTED_PLACEHOLDER = "__dashboardmodern_hosted__";
  var hasInstanceQuery = false;
  var hasHostQuery = false;

  function parentValue(key) {
    try {
      return parent && parent !== window ? parent[key] : undefined;
    } catch (_error) {
      return undefined;
    }
  }

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
      '<div class="ed-sec-title">' + title + "</div>" +
      '<div class="ed-form-row">' +
      '<input id="luce-add-ent" class="ed-input mono" placeholder="' + entityPlaceholder + '">' +
      '<button type="button" class="dm-entity-picker" data-entity-target="luce-add-ent">🔍</button>' +
      "</div>" +
      '<input id="luce-add-name" class="ed-input" placeholder="' + namePlaceholder + '">' +
      '<button class="ed-btn-add" onclick="cdLuceAdd()">' + addLabel + "</button></div>"
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

  try {
    var query = window.location.search || "";
    var instance = /[?&]dmi=([^&]+)/.exec(query);
    if (instance && instance[1]) {
      hasInstanceQuery = true;
      window.__DASHBOARDMODERN_INSTANCE__ ||= decodeURIComponent(instance[1]);
    }
    var primary = /[?&]dmp=(\d)/.exec(query);
    if (primary) {
      hasHostQuery = true;
      window.__DASHBOARDMODERN_PRIMARY__ = primary[1] === "1";
    }
  } catch (_error) {}

  if (parentValue("__DASHBOARDMODERN_INSTANCE__") && !window.__DASHBOARDMODERN_INSTANCE__)
    window.__DASHBOARDMODERN_INSTANCE__ = parentValue("__DASHBOARDMODERN_INSTANCE__");
  if (typeof parentValue("__DASHBOARDMODERN_PRIMARY__") !== "undefined")
    window.__DASHBOARDMODERN_PRIMARY__ = parentValue("__DASHBOARDMODERN_PRIMARY__") !== false;

  function isHosted() {
    if (window.__DASHBOARDMODERN_HOSTED__ === true) return true;
    if (window.__DASHBOARDMODERN_BRIDGED__ === true) return true;
    if (typeof window.__DASHBOARDMODERN_BRIDGE_WS__ === "function") return true;
    if (hasInstanceQuery || hasHostQuery) return true;
    return parentValue("__DASHBOARDMODERN_HOST__") === true;
  }

  if (!isHosted()) return;

  window.__DASHBOARDMODERN_HOSTED__ = true;

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
  StubSocket.__dmHostedStub = true;
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

  function explicitBridge() {
    var parentBridge = parentValue("__DASHBOARDMODERN_BRIDGE_WS__");
    if (typeof parentBridge === "function") return parentBridge;
    var localBridge = window.__DASHBOARDMODERN_BRIDGE_WS__;
    if (typeof localBridge === "function" && localBridge.__dmHostedStub !== true)
      return localBridge;
    return null;
  }

  function adoptBridge() {
    var bridge = explicitBridge();
    if (!bridge) return false;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = bridge;
    window.__DASHBOARDMODERN_BRIDGED__ = true;
    window.WebSocket = bridge;
    return true;
  }

  /*
   * Never infer that the browser's current WebSocket is a trusted adapter.
   * Android WebView and some embedded browsers stringify native constructors
   * differently, so source-code heuristics can accidentally reuse the real
   * network WebSocket and send the hosted placeholder to Home Assistant.
   * Only the explicit parent bridge is trusted. Until it exists, StubSocket
   * cannot open a network connection.
   */
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
