import assert from "node:assert/strict";
import test from "node:test";

import { mountLegacyHost } from "../src/legacy/host.js";

function element(tag) {
  return {
    tagName: tag,
    style: {},
    attributes: {},
    listeners: {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    },
    replaceChildren(...children) {
      this.children = children;
    },
    remove() {},
  };
}

test("the hosted frame installs only the authenticated transport bridge", () => {
  const scripts = [];
  const childDocument = {
    head: {
      append(node) {
        scripts.push(node);
      },
    },
    getElementById(id) {
      return scripts.find((node) => node.id === id) || null;
    },
    createElement(tag) {
      return element(tag);
    },
  };
  const frame = element("iframe");
  frame.contentWindow = { document: childDocument };
  frame.clientHeight = 100;
  const container = element("div");
  const connection = { sendMessagePromise: async () => ({}) };

  const host = mountLegacyHost(container, {
    hass: { locale: { language: "it" } },
    connection,
    staticBase: "/dashboardmodern_static/hash",
    documentRef: { createElement: () => frame },
    hostWindow: {},
  });

  assert.equal(scripts.length, 0, "the host must not inject a second runtime");
  assert.equal(host.frame.contentWindow.__DASHBOARDMODERN_BRIDGED__, true);
  assert.equal(typeof host.frame.contentWindow.WebSocket, "function");
  assert.match(host.frame.getAttribute("src"), /\/legacy\/dashboard\.html\?/);

  host.frame.listeners.load();
  assert.equal(scripts.length, 0, "reloads must not inject patches either");
});
