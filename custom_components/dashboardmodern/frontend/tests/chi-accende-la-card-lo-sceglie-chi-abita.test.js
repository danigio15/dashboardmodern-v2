/* «Fra le varie note di rilascio avevo letto che aggiunti esempio i sensori
 *  porta ad un frigo o un sensore ad un'asciugatrice o lavatrice la card
 *  diventava ambra per avvisare, ma sicuro non sarà un bug ma mi perdo io
 *  qualcosa.» (#519)
 *
 * «Dove si aggiungono i sensori nelle card elettrodomestici ci sarebbe modo di
 *  aggiungere un'opzione per scegliere se quell'entità fa colorare la card nei
 *  widget?» (#520)
 *
 * Non si perdeva niente: a colorare la card c'era una casella sola, «Entità
 * allarme/anomalia», e la porta del frigo di proposito non ci passava — un
 * frigo aperto per prendere il latte non è un guasto, ed è per questo che la
 * porta è una pastiglia. Ma «non è un guasto» non vuol dire «non me ne
 * importa»: a chi ha il congelatore in garage quella porta importa eccome.
 *
 * Quindi non lo decide più il codice. Tre cose da difendere:
 *
 * La prima, e viene prima di tutte: **chi non sceglie niente non cambia
 * niente.** Un apparecchio senza questo campo si comporta esattamente come
 * prima, e nessuno si ritrova la casa piena di card accese per un
 * aggiornamento.
 *
 * La seconda: una scelta che non risponde non accende. «Non lo so» non è
 * «sì», e una card accesa per un sensore muto sarebbe un avviso che non si può
 * chiudere perché non è mai cominciato.
 *
 * La terza: la parola «accesa» è una sola. La dicono in due — l'allarme di
 * sempre e le entità scelte — e due elenchi di dialetti si scollano: allora la
 * stessa entità colora la card e non conta fra gli allarmi.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CAMPO_COLORANO,
  coloraLaCard,
  conVoceCheColora,
  eAccesa,
  elencoColorano,
  qualcosaColora,
  vociCheColorano,
} from "../src/core/le-voci-che-colorano.js";
import { applianceAlarm } from "../src/core/appliance-card-view-model.js";

const PORTA = "binary_sensor.porta_congelatore";
const FINE = "binary_sensor.fine_ciclo";

test("chi non sceglie niente si comporta come prima", () => {
  /* La riga che rende questa modifica sicura per tutti quelli che non l'hanno
   * chiesta: senza il campo non si accende niente, qualunque cosa dica la
   * casa. */
  assert.equal(qualcosaColora({}, { [PORTA]: { state: "on" } }), false);
  assert.equal(applianceAlarm({}, { [PORTA]: { state: "on" } }, "off"), false);
  assert.equal(vociCheColorano({}).size, 0);
});

test("l'entità scelta accende la card, e solo quando è accesa", () => {
  const frigo = { [CAMPO_COLORANO]: [PORTA] };
  assert.equal(applianceAlarm(frigo, { [PORTA]: { state: "on" } }, "off"), true);
  assert.equal(applianceAlarm(frigo, { [PORTA]: { state: "off" } }, "off"), false);
  /* I dialetti che girano davvero: un contatto dice `on`, una cover e certe
   * integrazioni dicono `open`. */
  assert.equal(applianceAlarm(frigo, { [PORTA]: { state: "open" } }, "off"), true);
});

test("una scelta che non risponde non accende niente", () => {
  const frigo = { [CAMPO_COLORANO]: [PORTA] };
  for (const muto of ["unavailable", "unknown", "", "none"])
    assert.equal(
      applianceAlarm(frigo, { [PORTA]: { state: muto } }, "off"),
      false,
      `"${muto}" non è un sì`,
    );
  /* E nemmeno un'entità che non esiste proprio. */
  assert.equal(applianceAlarm(frigo, {}, "off"), false);
});

test("l'allarme di sempre continua a funzionare, e i due si sommano", () => {
  /* La casella «Entità allarme/anomalia» non se ne va: chi l'ha configurata
   * non deve accorgersi di niente. */
  const lavatrice = { alert_entity: "binary_sensor.guasto", [CAMPO_COLORANO]: [FINE] };
  assert.equal(
    applianceAlarm(lavatrice, { "binary_sensor.guasto": { state: "problem" } }, "off"),
    true,
  );
  assert.equal(applianceAlarm(lavatrice, { [FINE]: { state: "on" } }, "off"), true);
  assert.equal(
    applianceAlarm(
      lavatrice,
      { "binary_sensor.guasto": { state: "off" }, [FINE]: { state: "off" } },
      "off",
    ),
    false,
  );
});

test("la parola «accesa» è scritta in un posto solo", () => {
  /* Se l'elenco dei dialetti fosse due, un giorno si scollerebbero: la stessa
   * entità colorerebbe la card e non conterebbe fra gli allarmi. */
  for (const parola of [
    "on",
    "open",
    "problem",
    "triggered",
    "alert",
    "alarm",
    "fault",
    "error",
    "leak",
  ])
    assert.equal(eAccesa(parola), true, `"${parola}" dovrebbe dire di sì`);
  for (const parola of ["off", "closed", "idle", "unavailable", "", "34"])
    assert.equal(eAccesa(parola), false, `"${parola}" non dovrebbe dire di sì`);
  const sorgente = readFileSync(
    new URL("../src/core/appliance-card-view-model.js", import.meta.url),
    "utf8",
  );
  assert.match(
    sorgente,
    /import \{ eAccesa, qualcosaColora \} from "\.\/le-voci-che-colorano\.js";/,
  );
  assert.doesNotMatch(sorgente, /\/\^\(on\|problem\|triggered/);
});

test("l'elenco si scrive come gli altri della stessa scheda", () => {
  /* Arriva dal campo nascosto della scheda come stringa con le virgole, ed è
   * la stessa forma dei comandi, delle letture e delle voci nascoste. */
  assert.deepEqual(elencoColorano(`${PORTA},${FINE}`), [PORTA, FINE]);
  /* Una virgola di troppo non diventa una voce vuota che resta scritta per
   * sempre nella configurazione, e un doppione non si duplica. */
  assert.deepEqual(elencoColorano(`${PORTA},,${PORTA},senza-punto`), [PORTA]);
  assert.deepEqual(elencoColorano(null), []);
});

test("il tocco ribalta senza toccare l'originale", () => {
  /* La scheda lavora su una copia finché non si salva: è così che «annulla»
   * resta possibile. */
  const frigo = Object.freeze({ name: "Frigo" });
  const acceso = conVoceCheColora(frigo, PORTA, true);
  assert.deepEqual(acceso[CAMPO_COLORANO], [PORTA]);
  assert.equal(coloraLaCard(acceso, PORTA), true);
  assert.equal(frigo[CAMPO_COLORANO], undefined, "l'originale è stato modificato");
  const spento = conVoceCheColora(acceso, PORTA, false);
  assert.deepEqual(spento[CAMPO_COLORANO], []);
  /* E un identificativo che non è un'entità non entra. */
  assert.equal(conVoceCheColora(frigo, "senza-punto", true)[CAMPO_COLORANO], undefined);
});

test("la scheda ha il suo blocco, e un elenco vuoto non si salva", () => {
  const sorgente = readFileSync(
    new URL("../src/sections/appliance-editor-section.js", import.meta.url),
    "utf8",
  );
  /* Sta accanto a «cosa mostrare»: è la stessa domanda fatta due volte sullo
   * stesso elenco di entità. */
  assert.match(sorgente, /\$\{nascosteMarkup\(device\)\}\s*\n\s*\$\{coloranoMarkup\(device\)\}/);
  assert.match(sorgente, /wireNascoste\(modal, form\);\s*\n\s*wireColorano\(modal, form\);/);
  /* Il catalogo delle entità arriva dopo, e questo elenco si rifà con l'altro. */
  assert.match(sorgente, /disegnaNascoste\(modal, form\);\s*\n\s*disegnaColorano\(modal, form\);/);
  /* Un elenco vuoto non è una configurazione: il campo se ne va. */
  assert.match(
    sorgente,
    /const colorano = elencoColorano\(values\.colorano\);\s*\n\s*if \(colorano\.length\) next\[COLORANO_CAMPO\] = colorano;\s*\n\s*else delete next\[COLORANO_CAMPO\];/,
  );
});
