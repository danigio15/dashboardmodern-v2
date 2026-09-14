/* «La sezione si resetta all'infinito.»
 *
 * Segnalato da chi usa la sorgente unica con segno: scegliendo che per la
 * batteria i valori positivi sono la carica, la scheda si richiudeva e il
 * verso tornava a «scarica». Ogni volta.
 *
 * La catena era questa. La scheda mette il verso *prima* delle caselle del
 * sensore, quindi lo si sceglie quando di entita' non ce n'e' ancora nessuna.
 * Il salvataggio filtrava via `positive`, si ritrovava zero entita' e
 * cancellava l'intera dichiarazione; il ridisegno che parte subito dopo
 * rileggeva il modello, non trovava piu' niente e richiudeva la scheda col
 * verso di partenza.
 *
 * Con «scarica» — che e' il verso di partenza della batteria — la stessa cosa
 * succedeva senza vedersi: la scheda si riazzerava su un valore identico a
 * quello scelto. Per questo la segnalazione parla solo della carica.
 *
 * Dalla #435 il verso e' uscito dalla scheda: e' una riga del riquadro, sempre
 * in vista, perche' e' una proprieta' del SENSORE e non della casella in cui lo
 * si e' scritto. La scheda resta quello che dice di essere — «ho UNA entita' al
 * posto di due» — e la sua spunta la accendono le entita'. Quello che queste
 * prove tengono fermo non cambia: la scelta del verso resta scritta, e non se
 * la porta via nessuno.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applySignedSources, signedSource } from "../src/core/signed-energy.js";

/* Il salvataggio, ridotto a quello che decide: cosa resta scritto nel modello.
 * Riproduce riga per riga il filtro di `persistSignedSource`. */
function salva(signed) {
  const entities = Object.entries(signed || {}).filter(
    ([key, value]) => key !== "positive" && String(value ?? "").trim(),
  );
  const verso = String(signed?.positive ?? "").trim();
  if (!entities.length && !verso) return undefined;
  return {
    ...Object.fromEntries(entities.map(([key, value]) => [key, String(value).trim()])),
    positive: verso,
  };
}

test("il verso scelto prima del sensore resta scritto", () => {
  const scritto = salva({ positive: "charge" });
  assert.deepEqual(scritto, { positive: "charge" }, "la scelta non va buttata");
});

test("e riletto tiene la scheda aperta sul verso scelto", () => {
  const modello = { battery: { signed: salva({ positive: "charge" }) } };
  const sorgente = signedSource(modello, "battery");
  assert.ok(sorgente, "la scheda deve restare dichiarata");
  assert.equal(sorgente.positive, "charge", "e sul verso che si e' scelto");
  assert.equal(sorgente.inverted, true, "carica e' il verso opposto a quello del runtime");
});

test("lo stesso vale per la rete, dove il difetto non si vedeva", () => {
  const modello = { grid: { signed: salva({ positive: "export" }) } };
  const sorgente = signedSource(modello, "grid");
  assert.ok(sorgente);
  assert.equal(sorgente.positive, "export");
});

test("una dichiarazione senza entita' non ricava niente", () => {
  const modello = { battery: { signed: { positive: "charge" } } };
  // Nessuna casella compilata: niente da ricavare, e il modello resta com'era.
  assert.deepEqual(applySignedSources(modello), modello);
});

test("togliere la spunta cancella tutto, verso compreso", () => {
  assert.equal(salva({}), undefined);
  assert.equal(salva({ positive: "" }), undefined);
});

test("la spunta accesa si salva da sola, senza aspettare un sensore", () => {
  const renderers = new URL("../src/core/renderers.js", import.meta.url);
  const sorgente = readFileSync(renderers, "utf8");
  assert.match(
    sorgente,
    /if \(toggle\.checked\) \{[\s\S]{0,400}onSignedChange\?\.\(group, \{ \.\.\.declared, positive \}\)/,
    "accendere la spunta deve salvare",
  );
  /* Spegnerla cancella le entita', non il verso: quello vale anche per chi la
   * sorgente unica non ce l'ha, ed e' scritto fuori di qui. */
  assert.match(
    sorgente,
    /for \(const measure of SIGNED_MEASURES\) delete declared\[measure\];[\s\S]{0,400}onSignedChange\?\.\(group, \{ positive \}\)/,
    "spegnerla deve cancellare le entita' e lasciare il verso",
  );
});

test("il verso si sceglie senza aprire la scheda della sorgente unica", () => {
  const renderers = new URL("../src/core/renderers.js", import.meta.url);
  const sorgente = readFileSync(renderers, "utf8");
  /* La riga del verso e' del riquadro, e si stampa accanto alla scheda — non
   * dentro il suo corpo, che sta chiuso finche' non si accende la spunta.
   * Chi il sensore lo aveva scritto nella casella «Potenza» di sempre non
   * aveva modo di arrivarci: e' la #435. */
  assert.match(sorgente, /function createDirectionField\(/);
  assert.match(
    sorgente,
    /body\.append\(createDirectionField\(document, group, model, locale, handlers\)\);/,
  );
  /* E la spunta della scheda la accendono le entita', non il verso: trovarla
   * aperta per aver scelto un verso direbbe una cosa che non e' vera. */
  assert.match(
    sorgente,
    /const dichiarate = Boolean\(source && Object\.keys\(source\.entities\)\.length\);/,
  );
  assert.match(sorgente, /toggle\.checked = dichiarate;/);
});
