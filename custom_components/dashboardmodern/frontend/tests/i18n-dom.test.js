/*
 * The DOM pass is what makes a third language possible at all: the vendored
 * shell and the 600 kB runtime build exist only in Italian and English, so
 * everything they paint has to be translated after the fact. These tests use a
 * hand-built DOM rather than a real one — the pass only needs text nodes,
 * attributes and a tree walker, and keeping the fixture explicit is what makes
 * the skip rules readable.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { registerCatalog, resetCatalogs, resetLocale, setLocale } from "../src/core/i18n.js";
import { OPT_OUT_ATTRIBUTE, translateSource, translateTree } from "../src/core/i18n-dom.js";

const NODE_FILTER = { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };

/* A text node. `nodeValue` is what the pass reads and rewrites. */
function text(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null };
}

/* An element. Attributes are a plain map; children may be elements or text. */
function element(tagName, { attributes = {}, children = [] } = {}) {
  const store = new Map(Object.entries(attributes));
  const node = {
    nodeType: 1,
    tagName,
    childNodes: children,
    hasAttribute: (name) => store.has(name),
    getAttribute: (name) => (store.has(name) ? store.get(name) : null),
    setAttribute: (name, value) => store.set(name, value),
    attributes: store,
  };
  for (const child of children) child.parentElement = node;
  return node;
}

/* Depth-first walk, honouring the filter the pass installs. */
function documentFor(root) {
  const document = {
    createTreeWalker(from, _what, filter) {
      const queue = [];
      const visit = (node) => {
        const verdict = filter.acceptNode(node);
        if (verdict === NODE_FILTER.FILTER_REJECT) return;
        if (node !== from) queue.push(node);
        for (const child of node.childNodes || []) visit(child);
      };
      visit(from);
      let index = 0;
      return { nextNode: () => (index < queue.length ? queue[index++] : null) };
    },
    defaultView: { NodeFilter: NODE_FILTER },
  };
  const attach = (node) => {
    node.ownerDocument = document;
    for (const child of node.childNodes || []) attach(child);
  };
  attach(root);
  return document;
}

function textNodesOf(root, found = []) {
  for (const child of root.childNodes || []) {
    if (child.nodeType === 3) found.push(child);
    else textNodesOf(child, found);
  }
  return found;
}

test.beforeEach(() => {
  resetLocale();
  resetCatalogs();
});

test.afterEach(() => {
  resetLocale();
  resetCatalogs();
});

test("Italian text the runtime painted is translated through its English key", async () => {
  registerCatalog("de", { Appliances: "Geräte", Security: "Sicherheit" });
  await setLocale("de", { persist: false, apply: false });

  /* "Elettrodomestici" is never a catalog key. It reaches German only because
   * the source index maps it to "Appliances" first. */
  assert.equal(translateSource("Elettrodomestici"), "Geräte");
  assert.equal(translateSource("Appliances"), "Geräte");
  assert.equal(translateSource("Sicurezza"), "Sicherheit");
});

test("a string with no entry keeps its English wording, not its Italian one", async () => {
  registerCatalog("de", { Appliances: "Geräte" });
  await setLocale("de", { persist: false, apply: false });
  /* Nothing for "Sicurezza" in this catalog: the honest answer is the English
   * pivot, which a German reader stands a chance with. */
  assert.equal(translateSource("Sicurezza"), "Security");
  assert.equal(translateSource("Security"), "Security");
});

test("the pass rewrites text nodes and keeps their surrounding whitespace", async () => {
  registerCatalog("de", { Appliances: "Geräte" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", { children: [text("  Elettrodomestici ")] });
  documentFor(root);
  assert.equal(translateTree(root), 1);
  assert.equal(root.childNodes[0].nodeValue, "  Geräte ");
});

test("translatable attributes are rewritten too", async () => {
  registerCatalog("de", { Close: "Schließen", History: "Verlauf" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", {
    children: [
      element("BUTTON", { attributes: { "aria-label": "Chiudi", title: "Storico", id: "x" } }),
    ],
  });
  documentFor(root);
  translateTree(root);
  const button = root.childNodes[0];
  assert.equal(button.getAttribute("aria-label"), "Schließen");
  assert.equal(button.getAttribute("title"), "Verlauf");
  /* Not every attribute is copy: an id that happened to match must not move. */
  assert.equal(button.getAttribute("id"), "x");
});

test("script and style content is left alone", async () => {
  registerCatalog("de", { Appliances: "Geräte" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", {
    children: [
      element("SCRIPT", { children: [text("Elettrodomestici")] }),
      element("STYLE", { children: [text("Elettrodomestici")] }),
    ],
  });
  documentFor(root);
  assert.equal(translateTree(root), 0);
  for (const node of textNodesOf(root)) assert.equal(node.nodeValue, "Elettrodomestici");
});

test("a subtree can opt out, and the opt-out covers its children", async () => {
  registerCatalog("de", { Kitchen: "Küche" });
  await setLocale("de", { persist: false, apply: false });

  /* This is the escape hatch for user data. A room the user named "Cucina" is
   * their word, not ours, and marking its container keeps the pass off it. */
  const root = element("DIV", {
    children: [
      element("SPAN", {
        attributes: { [OPT_OUT_ATTRIBUTE]: "" },
        children: [element("B", { children: [text("Cucina")] })],
      }),
      element("SPAN", { children: [text("Cucina")] }),
    ],
  });
  documentFor(root);
  translateTree(root);
  const [optedOut, translated] = textNodesOf(root);
  assert.equal(optedOut.nodeValue, "Cucina");
  assert.equal(translated.nodeValue, "Küche");
});

test('translate="no" is honoured as the opt-out too', async () => {
  registerCatalog("de", { Kitchen: "Küche" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", {
    children: [element("SPAN", { attributes: { translate: "no" }, children: [text("Cucina")] })],
  });
  documentFor(root);
  assert.equal(translateTree(root), 0);
});

test("a second pass changes nothing, and a locale switch re-reads the source", async () => {
  registerCatalog("de", { Appliances: "Geräte" });
  registerCatalog("fr", { Appliances: "Appareils" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", { children: [text("Elettrodomestici")] });
  documentFor(root);
  assert.equal(translateTree(root), 1);
  /* Idempotent: the pass runs on every render signal, so a no-op second pass is
   * the difference between free and a rewrite of the whole page each frame. */
  assert.equal(translateTree(root), 0);
  assert.equal(root.childNodes[0].nodeValue, "Geräte");

  /* And the switch translates from the remembered source, not from "Geräte" —
   * translating a translation is how languages drift into nonsense. */
  await setLocale("fr", { persist: false, apply: false });
  assert.equal(translateTree(root), 1);
  assert.equal(root.childNodes[0].nodeValue, "Appareils");
});

test("switching back to the source language restores the original text", async () => {
  registerCatalog("de", { Appliances: "Geräte" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", { children: [text("Elettrodomestici")] });
  documentFor(root);
  translateTree(root);
  assert.equal(root.childNodes[0].nodeValue, "Geräte");

  await setLocale("it", { persist: false, apply: false });
  translateTree(root);
  assert.equal(root.childNodes[0].nodeValue, "Elettrodomestici");
});

test("in English the Italian shell is translated to its pivot text", async () => {
  await setLocale("en", { persist: false, apply: false });
  const root = element("DIV", { children: [text("Elettrodomestici")] });
  documentFor(root);
  translateTree(root);
  assert.equal(root.childNodes[0].nodeValue, "Appliances");
});

test("whitespace-only and unknown text are left exactly as they were", async () => {
  registerCatalog("de", { Appliances: "Geräte" });
  await setLocale("de", { persist: false, apply: false });

  const root = element("DIV", {
    children: [text("   "), text("sensor.washer_power"), text("42 kWh")],
  });
  documentFor(root);
  assert.equal(translateTree(root), 0);
  assert.deepEqual(
    textNodesOf(root).map((node) => node.nodeValue),
    ["   ", "sensor.washer_power", "42 kWh"],
  );
});
