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

test("the hosted frame receives the runtime stability guard on every load", () => {
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

  const host = mountLegacyHost(container, {
    hass: { locale: { language: "it" } },
    connection: { sendMessagePromise: async () => ({}) },
    staticBase: "/dashboardmodern_static/hash",
    documentRef: { createElement: () => frame },
    hostWindow: {},
  });

  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].id, "dm-runtime-hotfix");
  assert.equal(
    scripts[0].src,
    "/dashboardmodern_static/hash/legacy/runtime-hotfix.js",
  );

  host.frame.listeners.load();
  assert.equal(scripts.length, 1, "reload installation stays idempotent");
});
