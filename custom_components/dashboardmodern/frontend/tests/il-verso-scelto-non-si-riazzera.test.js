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
  assert.match(
    sorgente,
    /onSignedChange\?\.\(group, \{\}\)/,
    "spegnerla deve mandare il vuoto, o non si cancella piu'",
  );
});
