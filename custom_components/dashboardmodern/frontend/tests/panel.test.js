import assert from "node:assert/strict";
import test from "node:test";

// panel.js defines a custom element, so the DOM globals must exist at import.
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define: () => {} };

const { resolveLegacyVariant } = await import("../panel.js");

test("the Italian locale selects the Italian dashboard", () => {
  const panel = { config: { legacy_variants: ["dashboard.html", "dashboard-en.html"] } };
  assert.equal(resolveLegacyVariant(panel, { locale: { language: "it" } }), "dashboard.html");
});

test("a non-Italian locale selects the English dashboard", () => {
  const panel = { config: { legacy_variants: ["dashboard.html", "dashboard-en.html"] } };
  assert.equal(resolveLegacyVariant(panel, { locale: { language: "en-GB" } }), "dashboard-en.html");
});

test("with no vendored variants there is nothing to serve", () => {
  // A checkout without the HTML vendored is a legitimate state: the panel
  // simply mounts nothing rather than pointing at a 404.
  assert.equal(resolveLegacyVariant({ config: {} }, { locale: { language: "it" } }), null);
  assert.equal(resolveLegacyVariant({ config: { legacy_variants: [] } }, { locale: {} }), null);
});

test("when the preferred variant is absent, the first available is used", () => {
  const panel = { config: { legacy_variants: ["dashboard-en.html"] } };
  assert.equal(resolveLegacyVariant(panel, { locale: { language: "it" } }), "dashboard-en.html");
});
