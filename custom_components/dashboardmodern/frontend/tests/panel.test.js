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

/* Segnalazione #178: quando la plancia nella lingua giusta non e' stata
 * spedita, si ripiega sull'inglese e non sulla prima della lista. Finche' le
 * plance sono due la differenza non si vede, perche' "dashboard-en.html" viene
 * prima in ordine alfabetico; ma il ripiego non deve dipendere da un ordine
 * alfabetico che nessuno ha scelto. */
test("il ripiego e' l'inglese, non la prima della lista", () => {
  const panel = { config: { legacy_variants: ["dashboard-de.html", "dashboard-en.html"] } };
  assert.equal(resolveLegacyVariant(panel, { locale: { language: "fr" } }), "dashboard-en.html");
  // Anche a un profilo italiano, se l'italiano non c'e'.
  assert.equal(resolveLegacyVariant(panel, { locale: { language: "it" } }), "dashboard-en.html");
});

test("e se non c'e' nemmeno l'inglese si prende quello che c'e'", () => {
  const panel = { config: { legacy_variants: ["dashboard-de.html"] } };
  assert.equal(resolveLegacyVariant(panel, { locale: { language: "fr" } }), "dashboard-de.html");
});
