import assert from "node:assert/strict";
import test from "node:test";

import { mountLegacyHost, stableStaticBase } from "../src/legacy/host.js";

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
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return this.attributes[key]; },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    replaceChildren(...nodes) { this.children = nodes; },
    remove() { this.removed = true; },
  };
}

const documentRef = { createElement: fakeElement };
const connection = { sendMessagePromise: async () => ({}) };

test("stableStaticBase strips an obsolete asset digest", () => {
  const hostWindow = { location: { href: "http://ha.local:8123/dashboardmodern" } };
  assert.equal(
    stableStaticBase("/dashboardmodern_static/deadbeef1234", hostWindow),
    "http://ha.local:8123/dashboardmodern_static",
  );
});

test("a 404 on an old digest retries the stable runtime mount", async () => {
  const requested = [];
  const container = fakeElement("div");
  const hostWindow = { location: { href: "http://ha.local:8123/dashboardmodern", host: "ha.local:8123" } };
  const host = mountLegacyHost(container, {
    hass: { locale: { language: "it" } },
    connection,
    staticBase: "/dashboardmodern_static/old-digest",
    documentRef,
    hostWindow,
    fetchRef: async (url) => {
      requested.push(url);
      if (url.includes("/old-digest/")) {
        return { ok: false, status: 404, text: async () => "" };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "<!doctype html><html><head></head><body>ok</body></html>",
      };
    },
  });

  assert.equal(await host.ready, true);
  assert.deepEqual(requested, [
    "http://ha.local:8123/dashboardmodern_static/old-digest/legacy/dashboard.html",
    "http://ha.local:8123/dashboardmodern_static/legacy/dashboard.html",
  ]);
  assert.equal(host.frame.dataset.usedStableFallback, "true");
  assert.equal(host.frame.dataset.runtimeBase, "http://ha.local:8123/dashboardmodern_static");
  assert.match(
    host.frame.srcdoc,
    /<base href="http:\/\/ha\.local:8123\/dashboardmodern_static\/legacy\/">/,
  );
});
