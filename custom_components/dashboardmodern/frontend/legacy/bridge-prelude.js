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
  window.__DASHBOARDMODERN_CONNECTION__ = {
    token: HOSTED_TOKEN,
    local_ip: window.location.host,
    remote_url: "",
  };
})();
