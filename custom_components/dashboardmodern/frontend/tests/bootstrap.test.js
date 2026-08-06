import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { legacyAssetUrl, readLegacyHtml } from "./legacy-source.js";

for (const [name, locale] of [
  ["dashboard.html", "it"],
  ["dashboard-en.html", "en"],
]) {
  const html = readLegacyHtml(name);
  const watchdog = readFileSync(legacyAssetUrl(`dashboard-watchdog-${locale}.js`), "utf8");
  const runtime = readFileSync(legacyAssetUrl(`dashboard-runtime-${locale}.js`), "utf8");

  test(`${name}: external bootstrap removes the spinner and has a bounded failure state`, () => {
    assert.match(
      html,
      new RegExp(`data-dashboardmodern-bootstrap-watchdog[^>]+dashboard-watchdog-${locale}\\.js`),
      "external bootstrap watchdog missing from shipped HTML",
    );

    const overlay = { dataset: {}, innerHTML: '<div class="s"></div>', style: {}, remove() {} };
    const listeners = {};
    let timeout;
    const window = {
      addEventListener: (type, listener) => (listeners[type] = listener),
      setTimeout: (listener, milliseconds) => {
        assert.equal(milliseconds, 10_000, "bootstrap timeout must stay bounded");
        timeout = listener;
        return 7;
      },
    };
    vm.runInNewContext(watchdog, {
      window,
      document: { getElementById: () => overlay },
    });
    assert.equal(typeof listeners.error, "function");
    timeout();
    assert.equal(overlay.dataset.state, "error");
    assert.match(overlay.innerHTML, /Errore durante il caricamento di DashboardModern/);

    assert.match(runtime, /function cdHideBoot\(\) \{\s*window\.__DASHBOARDMODERN_READY__ = true;/);
    assert.match(runtime, /clearTimeout\(window\.__DASHBOARDMODERN_BOOT_TIMEOUT__\)/);
    assert.match(runtime, /o\.style\.opacity = '0'/);
    assert.match(runtime, /o\.remove\(\)/);
  });
}
