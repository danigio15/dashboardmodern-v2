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
  try {
    var _q = window.location.search || "";
    var _mi = /[?&]dmi=([^&]+)/.exec(_q);
    if (_mi && _mi[1] && !window.__DASHBOARDMODERN_INSTANCE__) {
      window.__DASHBOARDMODERN_INSTANCE__ = decodeURIComponent(_mi[1]);
    }
    var _mp = /[?&]dmp=(\d)/.exec(_q);
    if (_mp) window.__DASHBOARDMODERN_PRIMARY__ = _mp[1] === "1";
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

  function isHosted() {
    // Same-origin by construction: both documents are served by Home Assistant.
    // A cross-origin parent throws here, which is the correct standalone path.
    try {
      // The host sets these directly on this window before/at frame load; either
      // is a reliable signal we are the integration-hosted copy, independent of
      // parent-access timing.
      if (window.__DASHBOARDMODERN_BRIDGED__ === true) return true;
      if (window.__DASHBOARDMODERN_INSTANCE__) return true;
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
  if (REAL_TOKEN) window.__DASHBOARDMODERN_REAL_TOKEN__ = REAL_TOKEN;

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
          self.onclose({ code: 1006, reason: "bridge not ready" });
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
    BridgeWS = window.parent.__DASHBOARDMODERN_BRIDGE_WS__ || null;
  } catch (error) {
    BridgeWS = null;
  }
  window.WebSocket = typeof BridgeWS === "function" ? BridgeWS : StubSocket;

  window.__DASHBOARDMODERN_CONNECTION__ = {
    token: REAL_TOKEN || HOSTED_TOKEN,
    local_ip: window.location.host,
    remote_url: "",
  };
})();
