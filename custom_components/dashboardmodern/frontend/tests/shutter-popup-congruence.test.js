/* La card «Tapparelle aperte» della Home, e la sua fine.
 *
 * Viveva nel Quadro Avvisi, con un popup che elencava le tapparelle aperte e
 * i loro comandi. Il Quadro Avvisi dalla Home e' uscito e la tessera
 * «Tapparelle» del ponte dice le stesse cose: la card non aveva piu' un posto
 * dove stare ne' una porta da cui aprirsi. Questo file veglia che non torni
 * per sbaglio — ne' il suo markup, ne' il suo vestito.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/shutter-section.js", import.meta.url);
const runtimeUrl = new URL("../src/sections/section-runtime.js", import.meta.url);
const deckUrl = new URL("../src/sections/home-widgets-section.js", import.meta.url);

test("della card e del popup non resta niente, nemmeno il vestito", async () => {
  const [source, runtime] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(runtimeUrl, "utf8"),
  ]);

  for (const traccia of [
    /dm-shutter-popup/,
    /dm-shutter-alert/,
    /dm-shutter-actions/,
    /openPopup/,
    /ensureAlert/,
    /tapp-avvisi/,
  ])
    assert.doesNotMatch(source, traccia, String(traccia));
  assert.doesNotMatch(runtime, /shutter-alert-layout-section/);
});

test("il modulo e' rimasto la pelle della pagina: nessun ascolto, nessun timer", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /function installStyles/);
  assert.match(source, /#page-tapparelle/);
  // Niente da sincronizzare vuol dire niente a cui restare in ascolto.
  assert.doesNotMatch(source, /addEventListener\?\.\("dashboardmodern:state-changed"/);
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /120\s*:\s*350/);
});

test("quello che la card diceva lo dice la tessera del ponte", async () => {
  const deck = await readFile(deckUrl, "utf8");
  assert.match(deck, /function coversModel/);
  assert.match(deck, /data-dm-w-cover=/);
  assert.match(deck, /data-dm-w-position/);
});
