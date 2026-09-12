/* Quello che un apparecchio sa dire, e che non si vuole vedere (#512).
 *
 * «Negli elettrodomestici poter gestire, esempio negli stati o nei comandi,
 * cosa visualizzare o meno: ci sono cose che magari vengono rilevate ma alla
 * fine graficamente uno puo' non interessare.»
 *
 * Le prove che contano sono due, e sono tutte e due casi in cui la risposta
 * sbagliata si vedrebbe subito:
 *
 *   · chi non ha spento niente deve vedere esattamente quello che vedeva
 *     prima. Si scrive cio' che si nasconde, non cio' che si mostra: un elenco
 *     di cose da mostrare avrebbe reso invisibile ogni entita' pubblicata dopo
 *     il giorno in cui l'elenco e' stato scritto;
 *   · una entita' spenta sparisce da TUTTE le file. La stessa entita' esce fra
 *     le pillole e fra i comandi — un interruttore dice «acceso» ed e' anche
 *     il tasto — e toglierla da una sola avrebbe fatto sparire la scritta
 *     lasciando il bottone.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CAMPO_NASCOSTE,
  conVoce,
  elencoNascoste,
  siVede,
  soloQuelleViste,
  vociNascoste,
} from "../src/core/le-voci-nascoste.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (percorso) => readFileSync(join(QUI, "..", percorso), "utf8");

test("chi non ha spento niente vede tutto", () => {
  const apparecchio = { name: "Lavatrice" };
  assert.equal(vociNascoste(apparecchio).size, 0);
  assert.equal(siVede(apparecchio, "sensor.lavatrice_programma"), true);
  const righe = [{ entity: "sensor.a" }, { entity: "sensor.b" }];
  assert.deepEqual(soloQuelleViste(righe, apparecchio), righe);
});

test("l'elenco si legge sia come array sia come stringa con le virgole", () => {
  assert.deepEqual(elencoNascoste(["sensor.a", "sensor.b"]), ["sensor.a", "sensor.b"]);
  assert.deepEqual(elencoNascoste("sensor.a,sensor.b"), ["sensor.a", "sensor.b"]);
});

test("le voci vuote e i doppioni non restano scritti", () => {
  /* Una virgola di troppo diventava una voce vuota che non nasconde niente e
   * resta nella configurazione per sempre. */
  assert.deepEqual(elencoNascoste("sensor.a,,sensor.a, ,senza-punto"), ["sensor.a"]);
});

test("una voce spenta sparisce, e le altre restano", () => {
  const apparecchio = { [CAMPO_NASCOSTE]: ["sensor.seriale"] };
  assert.equal(siVede(apparecchio, "sensor.seriale"), false);
  assert.equal(siVede(apparecchio, "sensor.programma"), true);
  const righe = [{ entity: "sensor.seriale" }, { entity: "sensor.programma" }];
  assert.deepEqual(soloQuelleViste(righe, apparecchio), [{ entity: "sensor.programma" }]);
});

test("si riconosce anche `entity_id`, che e' come le chiama il dispositivo", () => {
  const apparecchio = { [CAMPO_NASCOSTE]: ["sensor.firmware"] };
  const voci = [{ entity_id: "sensor.firmware" }, { entity_id: "sensor.giri" }];
  assert.deepEqual(soloQuelleViste(voci, apparecchio), [{ entity_id: "sensor.giri" }]);
  // E un elenco di stringhe nude.
  assert.deepEqual(soloQuelleViste(["sensor.firmware", "sensor.giri"], apparecchio), [
    "sensor.giri",
  ]);
});

test("accendere e spegnere non tocca l'apparecchio che c'era", () => {
  const prima = { name: "Lavatrice" };
  const spenta = conVoce(prima, "sensor.seriale", false);
  assert.equal(prima[CAMPO_NASCOSTE], undefined, "l'originale non si tocca");
  assert.deepEqual(spenta[CAMPO_NASCOSTE], ["sensor.seriale"]);
  /* Riaccesa l'ultima, il campo se ne va: un elenco vuoto non e' una
   * configurazione, e l'apparecchio torna esattamente com'era. */
  const riaccesa = conVoce(spenta, "sensor.seriale", true);
  assert.equal(CAMPO_NASCOSTE in riaccesa, false);
  assert.equal(riaccesa.name, "Lavatrice");
});

test("la finestra filtra tutte le sue file con la stessa regola", () => {
  const finestra = sorgente("src/sections/appliance-detail-popup-section.js");
  assert.match(finestra, /from "\.\.\/core\/le-voci-nascoste\.js"/);
  /* Le tre file dell'apparecchio senza integrazione, e quelle che arrivano dal
   * dispositivo: se una restasse fuori, un'entita' spenta ricomparirebbe li'. */
  assert.match(finestra, /misure: viste\(misure\)/);
  assert.match(finestra, /pillole: viste\(pillole\)/);
  assert.match(finestra, /comandi: viste\(comandi\)/);
  assert.match(finestra, /const stato = soloQuelleViste\(nuove\(gruppi\.state\), appliance\)/);
  assert.match(finestra, /viste\(nuove\(gruppi\.readings\)\)/);
  assert.match(finestra, /viste\(gruppi\.controls\)/);
  assert.match(finestra, /viste\(gruppi\.diagnostics\)/);
});

test("la scheda offre le voci da spegnere, e le salva col resto", () => {
  const scheda = sorgente("src/sections/appliance-editor-section.js");
  assert.match(scheda, /from "\.\.\/core\/le-voci-nascoste\.js"/);
  assert.match(scheda, /\$\{nascosteMarkup\(device\)\}/);
  assert.match(scheda, /wireNascoste\(modal, form\);/);
  /* Un elenco vuoto non resta scritto: e' la stessa regola degli altri comandi
   * e delle altre letture, e senza di essa ogni apparecchio aperto una volta
   * si portava dietro un campo vuoto. */
  assert.match(scheda, /if \(nascoste\.length\) next\[NASCOSTE_CAMPO\] = nascoste;\s*else delete next\[NASCOSTE_CAMPO\];/);
});

test("la voce che apre i comandi si chiama come quello che fa (#513)", () => {
  /* «Questa dove dice Porte credo sia piu' corretto dire Apri Porte: alla fine
   * dentro ci si aggiunge i comandi che sbloccano qualcosa.» «Apri porte» e'
   * gia' il nome della pagina che la tessera apre: erano due nomi per lo
   * stesso posto. */
  for (const percorso of [
    "src/sections/home-widgets-section.js",
    "src/sections/come-sta-la-casa-section.js",
    "src/sections/todo-editor-section.js",
  ]) {
    const testo = sorgente(percorso);
    assert.match(testo, /t\("Apri porte", "Openers"\)/, `${percorso} non usa il nome nuovo`);
  }
});
