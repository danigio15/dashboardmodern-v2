import assert from "node:assert/strict";
import test from "node:test";

// panel.js defines a custom element, so the DOM globals must exist at import.
globalThis.HTMLElement = class {};
globalThis.customElements = { get: () => undefined, define: () => {} };

const { OBLIO_MS, profiloDellaPlancia, resolveLegacyVariant, restaSullaPlancia } =
  await import("../panel.js");

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

/* All'avvio Home Assistant puo' staccare e riattaccare il pannello nel giro
 * di un fotogramma: smontare subito buttava via l'iframe con tutta la
 * plancia, e il prossimo `set hass` la ricostruiva da zero — il velo d'avvio
 * si vedeva due volte. Lo smontaggio aspetta un attimo e si annulla se il
 * pannello torna attaccato; se se n'e' andato davvero, parte. */
/* Lo smontaggio resta differito. Cambia solo cosa succede allo scadere: se la
 * plancia e' gia' al riparo — messa da parte al cambio di pagina — non c'e'
 * piu' niente da smontare, e `abbandona` lascia andare solo il riferimento. */
test("lo smontaggio del pannello e' differito, e il riattacco lo annulla", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../panel.js", import.meta.url), "utf8");
  assert.match(source, /connectedCallback\(\)\s*\{\s*if \(this\._smontaggio\)/);
  assert.match(source, /disconnectedCallback\(\)\s*\{\s*if \(this\._smontaggio\) return;/);
  assert.match(source, /if \(!this\.isConnected\) this\.abbandona\(\)/);
  assert.match(source, /abbandona\(\)\s*\{\s*if \(!this\.host\)/);
  assert.doesNotMatch(source, /disconnectedCallback\(\)\s*\{\s*this\.resetHost\(\);/);
});

/* Il profilo della plancia: due chiavi uguali sono la stessa plancia. Tutto
 * quello che cambierebbe il documento da servire deve cambiare la chiave, se
 * no al ritorno ci si riprende la plancia sbagliata. */
test("il profilo distingue entry, variante, base, configurazione e ruolo", () => {
  const panel = {
    config: {
      entry_ids: ["e1"],
      config_profile: "casa",
      primary: true,
      static_base: "/dashboardmodern_static/abc",
    },
  };
  const base = profiloDellaPlancia(panel, "dashboard.html", "/dashboardmodern_static/abc");
  assert.equal(base, profiloDellaPlancia(panel, "dashboard.html", "/dashboardmodern_static/abc"));
  for (const diverso of [
    profiloDellaPlancia(panel, "dashboard-en.html", "/dashboardmodern_static/abc"),
    profiloDellaPlancia(panel, "dashboard.html", "/dashboardmodern_static/def"),
    profiloDellaPlancia({ config: { ...panel.config, entry_ids: ["e2"] } }, "dashboard.html", "/x"),
    profiloDellaPlancia({ config: { ...panel.config, config_profile: "altra" } }, "dashboard.html", "/x"),
    profiloDellaPlancia({ config: { ...panel.config, primary: false } }, "dashboard.html", "/x"),
  ]) {
    assert.notEqual(diverso, base);
  }
});

/* Il cambio d'indirizzo che resta sulla plancia — una finestra che si apre, un
 * parametro — non e' un addio: li' non si parcheggia niente. */
test("si riconosce se l'indirizzo nuovo e' ancora la nostra pagina", () => {
  assert.equal(restaSullaPlancia("/dashboardmodern", "dashboardmodern"), true);
  assert.equal(restaSullaPlancia("/dashboardmodern/home?x=1", "dashboardmodern"), true);
  assert.equal(restaSullaPlancia("/lovelace/0", "dashboardmodern"), false);
  assert.equal(restaSullaPlancia("/config/dashboard", "dashboardmodern"), false);
  /* Senza il nome della pagina non si indovina: si parcheggia, e se Home
   * Assistant la plancia se l'e' tenuta la cornice torna al giro dopo. */
  assert.equal(restaSullaPlancia("/dashboardmodern", ""), false);
  assert.equal(restaSullaPlancia("/dashboardmodern", undefined), false);
});

test("la plancia da parte non resta viva per sempre: mezz'ora", () => {
  /* Una plancia parcheggiata continua a ricevere gli stati della casa. Tenerla
   * per una pagina che nessuno riapre e' memoria e lavoro regalati. */
  assert.equal(OBLIO_MS, 30 * 60 * 1000);
});
