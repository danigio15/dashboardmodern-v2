/* Il nome di una lettura non dice due volte la stessa cosa.
 *
 * I casi sono quelli della schermata arrivata dalla casa: «Temperatura Pannello
 * solare Temperature», «Temperatura Boiler Temperature», «Boiler temperatura
 * sopra Temperature». La parola c'e' due volte, una per lingua, perche' Home
 * Assistant costruisce il nome amichevole mettendo insieme il nome del
 * dispositivo — scritto in italiano da chi abita la casa — e quello
 * dell'entita', che l'integrazione scrive in inglese.
 *
 * La parte delicata non e' togliere: e' NON togliere. Un nome accorciato troppo
 * smette di dire quale cosa sia, ed e' un difetto peggiore di una parola in
 * piu'. Meta' delle prove qui sotto pretende che il nome resti intero.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { nomeDellaLettura } from "../src/core/nome-della-lettura.js";

test("la parola della misura non si dice due volte", () => {
  assert.equal(
    nomeDellaLettura("Temperatura Pannello solare Temperature", { unita: "°C" }),
    "Temperatura Pannello solare",
  );
  assert.equal(nomeDellaLettura("Temperatura Boiler Temperature", { unita: "°C" }), "Temperatura Boiler");
  assert.equal(
    nomeDellaLettura("Boiler temperatura sopra Temperature", { unita: "°C" }),
    "Boiler temperatura sopra",
  );
});

test("vale per le altre misure, non solo per i gradi", () => {
  assert.equal(nomeDellaLettura("Lavatrice Power", { unita: "W" }), "Lavatrice");
  assert.equal(nomeDellaLettura("Bagno Humidity", { unita: "%" }), "Bagno");
  assert.equal(nomeDellaLettura("Contatore Energy", { unita: "kWh" }), "Contatore");
});

test("una parola ripetuta di fila si dice una volta", () => {
  assert.equal(nomeDellaLettura("Boiler Boiler", { unita: "" }), "Boiler");
  assert.equal(nomeDellaLettura("Salone  Salone temperatura", { unita: "" }), "Salone temperatura");
});

test("la stessa parola in testa e in coda se ne va anche senza unita'", () => {
  assert.equal(nomeDellaLettura("Temperatura Boiler Temperature"), "Temperatura Boiler");
});

/* ── e adesso quello che NON si tocca ──────────────────────────────────── */

test("un nome che senza quella parola direbbe di meno resta intero", () => {
  assert.equal(
    nomeDellaLettura("Delta Solare termico Boiler", { unita: "°C" }),
    "Delta Solare termico Boiler",
    "nessuna delle sue parole e' la misura",
  );
  assert.equal(
    nomeDellaLettura("Temperatura", { unita: "°C" }),
    "Temperatura",
    "togliendola non resterebbe niente",
  );
  assert.equal(
    nomeDellaLettura("Sonda Temperatura", { unita: "°C" }),
    "Sonda",
    "«Sonda» da sola identifica ancora, e il grado lo dice il numero",
  );
});

test("senza unita' non si toglie la misura in coda", () => {
  /* Senza unita' non si sa se quella parola sia gia' detta altrove: nel dubbio
   * si tiene. Meglio una parola in piu' che un nome che non dice piu' cosa e'. */
  assert.equal(nomeDellaLettura("Pannello Temperature"), "Pannello Temperature");
});

test("i casi vuoti non rompono niente", () => {
  assert.equal(nomeDellaLettura(""), "");
  assert.equal(nomeDellaLettura(null), "");
  assert.equal(nomeDellaLettura("   "), "");
});
