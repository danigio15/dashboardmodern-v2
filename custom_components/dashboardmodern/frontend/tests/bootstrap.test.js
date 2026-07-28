import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { inlineScripts } from "./inline-syntax.js";

for (const name of ["dashboard.html", "dashboard-en.html"]) {
  const file = new URL(`../legacy/${name}`, import.meta.url);
  const html = readFileSync(file, "utf8");

  test(`${name}: real bootstrap removes the spinner and has a bounded failure state`, () => {
    const watchdog = inlineScripts(file).find((block) =>
      block.attributes.includes("data-dashboardmodern-bootstrap-watchdog"),
    );
    assert.ok(watchdog, "bootstrap watchdog missing from shipped HTML");

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
    vm.runInNewContext(watchdog.source, {
      window,
      document: { getElementById: () => overlay },
    });
    assert.equal(typeof listeners.error, "function");
    timeout();
    assert.equal(overlay.dataset.state, "error");
    assert.match(overlay.innerHTML, /Errore durante il caricamento di DashboardModern/);

    assert.match(html, /function cdHideBoot\(\) \{\s*window\.__DASHBOARDMODERN_READY__ = true;/);
    assert.match(html, /clearTimeout\(window\.__DASHBOARDMODERN_BOOT_TIMEOUT__\)/);
    assert.match(html, /o\.style\.opacity = '0'/);
    assert.match(html, /o\.remove\(\)/);
  });
}
