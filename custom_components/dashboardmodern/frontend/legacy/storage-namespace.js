/*
 * Per-dashboard storage isolation.
 *
 * Every dashboardmodern dashboard uses the same ~37 localStorage keys, all
 * prefixed cd_ or dm_. Two dashboards on one Home Assistant — the integration
 * and the user's own plancia, or several users' dashboards — therefore share
 * one namespace and overwrite each other's token, cameras, rooms and config.
 *
 * This wraps localStorage so those keys are transparently rewritten to
 * cd_<instance>_… for this dashboard only. The dashboard code is untouched: it
 * still reads and writes cd_cameras, but the value lands under its own instance
 * prefix and no other dashboard can see or clobber it.
 *
 * The instance id comes from, in order: an explicit id the integration injects,
 * or a stable id derived from the document's own URL path, so a standalone
 * plancia and an integration-hosted copy always differ. Keys without the cd_/dm_
 * prefix (other apps on the same origin) are left completely alone.
 */
(function () {
  "use strict";

  // The English shell historically declared lang="it". Resolve the variant
  // synchronously before modules-entry.js reads documentElement.lang, so every
  // native renderer receives the correct locale without runtime DOM patches.
  try {
    var dashboardPath = window.location && window.location.pathname ? window.location.pathname : "";
    if (/(^|\/)dashboard-en\.html$/i.test(dashboardPath)) document.documentElement.lang = "en";
  } catch (e) {}

  var NS_PREFIX = "cdns_"; // where the resolved instance id is remembered
  var MANAGED = /^(cd_|dm_)/;

  function resolveInstanceId() {
    // 0. From the frame URL: the host appends ?dmi=<instance>, readable
    // synchronously at parse time. This is the authoritative source.
    try {
      var m = /[?&]dmi=([^&]+)/.exec(window.location.search || "");
      if (m && m[1]) return decodeURIComponent(m[1]);
    } catch (e) {}
    // 1. Explicit id from the integration, if hosted.
    try {
      if (window.__DASHBOARDMODERN_INSTANCE__) return String(window.__DASHBOARDMODERN_INSTANCE__);
    } catch (e) {}
    // 1b. From the parent window: the host sets the markers there because the
    // frame's own pre-navigation window is replaced before scripts run. This
    // is what keeps multiple plance (config entries) truly isolated.
    try {
      if (window.parent && window.parent !== window && window.parent.__DASHBOARDMODERN_INSTANCE__) {
        return String(window.parent.__DASHBOARDMODERN_INSTANCE__);
      }
    } catch (e) {}
    // 2. A stable id from this document's path, so two files on one origin
    //    (e.g. /local/plancia.html vs the integration mount) never collide.
    var path = "";
    try {
      path = window.location && window.location.pathname ? window.location.pathname : "";
    } catch (e) {}
    var hash = 5381;
    for (var i = 0; i < path.length; i += 1) hash = ((hash << 5) + hash + path.charCodeAt(i)) >>> 0;
    return "p" + hash.toString(36);
  }

  var INSTANCE = resolveInstanceId();
  var PREFIX = "cd_" + INSTANCE + "_";

  // Only wrap once, even if the prelude runs twice.
  if (window.__DASHBOARDMODERN_STORAGE_NS__) return;
  window.__DASHBOARDMODERN_STORAGE_NS__ = INSTANCE;

  var real = window.localStorage;

  function mapKey(key) {
    var k = String(key);
    // Managed keys are namespaced; the connection key stays namespaced too, so
    // one dashboard's token can never reach another.
    return MANAGED.test(k) ? PREFIX + k : k;
  }

  // A minimal Storage-compatible shim delegating to the real localStorage with
  // key remapping. Only the methods the dashboard uses are wrapped.
  var shim = {
    getItem: function (key) {
      return real.getItem(mapKey(key));
    },
    setItem: function (key, value) {
      return real.setItem(mapKey(key), value);
    },
    removeItem: function (key) {
      return real.removeItem(mapKey(key));
    },
    clear: function () {
      // Clear only this instance's keys, never another dashboard's.
      var doomed = [];
      for (var i = 0; i < real.length; i += 1) {
        var key = real.key(i);
        if (key && key.indexOf(PREFIX) === 0) doomed.push(key);
      }
      for (var j = 0; j < doomed.length; j += 1) real.removeItem(doomed[j]);
    },
    key: function (index) {
      return real.key(index);
    },
    get length() {
      return real.length;
    },
  };

  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: function () {
        return shim;
      },
    });
  } catch (e) {
    // If the property cannot be redefined, fall back to replacing the methods
    // in place so namespacing still applies.
    try {
      real.getItem = shim.getItem;
      real.setItem = shim.setItem;
      real.removeItem = shim.removeItem;
    } catch (e2) {}
  }
})();
