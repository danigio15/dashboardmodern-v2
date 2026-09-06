/* «Un menu a tendina che seleziona quale sezione della dashboard è incriminata
 * e quale funzione, così è più diretta la segnalazione.»
 *
 * Le sezioni non si scrivono a mano: sono quelle che la persona ha davvero
 * nella barra. Le parti sì, e sono un vocabolario: quelle di casa loro per le
 * sezioni che ne hanno, e per tutte le altre i cinque modi in cui una cosa può
 * andare storta. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ALTRO,
  parteValida,
  partiDellaSezione,
  sezioniOfferte,
} from "../src/core/dove-succede.js";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

test("le parti: prima quelle della sezione, poi quelle di tutti, e Altro in fondo", () => {
  /* Le chiavi sono quelle vere della barra: `energy`, non `energia`. */
  const energia = partiDellaSezione("energy");
  assert.deepEqual(energia.slice(0, 4), ["flussi", "report", "carichi", "costi"]);
  assert.deepEqual(energia.slice(4, 9), [
    "dati",
    "disegno",
    "comando",
    "configurazione",
    "lentezza",
  ]);
  assert.equal(energia.at(-1), ALTRO);
  /* Una sezione che non conosciamo — quella che uno si è fatto da sé, o una
   * nuova — non resta senza tendina: prende quelle che valgono ovunque. */
  const sua = partiDellaSezione("la-mia-sezione");
  assert.deepEqual(sua, ["dati", "disegno", "comando", "configurazione", "lentezza", ALTRO]);
  /* E «non lo so» è una risposta: senza sezione si offrono lo stesso. */
  assert.deepEqual(partiDellaSezione(""), sua);
});

test("una parte scelta smette di valere se la sezione cambia", () => {
  assert.equal(parteValida("energy", "report"), true);
  assert.equal(parteValida("luci", "report"), false);
  /* Le comuni valgono ovunque, e «non ho scelto» vale sempre. */
  assert.equal(parteValida("luci", "dati"), true);
  assert.equal(parteValida("luci", ""), true);
  /* E le chiavi sono quelle che la barra scrive davvero. */
  assert.deepEqual(partiDellaSezione("energia"), partiDellaSezione("una-che-non-esiste"));
});

test("le sezioni arrivano dalla barra, ripulite e senza doppioni", () => {
  const offerte = sezioniOfferte([
    { id: "Energy", nome: " ENERGIA " },
    { id: "energy", nome: "Energia" },
    { id: "  ", nome: "senza chiave" },
    { id: "luci", nome: "" },
    null,
  ]);
  assert.deepEqual(offerte, [
    { id: "energy", nome: "ENERGIA" },
    /* Senza nome resta la chiave: brutto, ma vero — meglio che una riga vuota
     * nella tendina. */
    { id: "luci", nome: "luci" },
  ]);
});

test("la sezione: due tendine nel modulo, e la scelta viaggia con la diagnostica", async () => {
  const sezione = await leggi("../src/sections/segnalazioni-section.js");
  assert.match(sezione, /function tendineMarkup\(\)/);
  assert.match(sezione, /id="dm-tkt-sezione"/);
  assert.match(sezione, /id="dm-tkt-funzione"/);
  /* Le sezioni si leggono dalla barra, non da un elenco scritto qui. */
  assert.match(sezione, /querySelectorAll\?\.\("\.tab\[data-tab\]"\)/);
  /* La pagina da cui si apre si propone da sola. */
  assert.match(sezione, /if \(!state\.bozza\.sezione && sezioni\.some/);
  /* E la scelta parte con le parole, non con gli identificativi. */
  assert.match(sezione, /sezione: nomeDellaSezione\(sezione\)/);
  assert.match(sezione, /funzione: state\.bozza\.funzione \? nomeDellaParte/);
  for (const chiave of ['"sezione",', '"funzione",']) assert.ok(sezione.includes(chiave), chiave);
});

test("il backend accetta le due chiavi e le scrive in cima", async () => {
  const store = await leggi("../../ticket_store.py");
  assert.match(store, /"sezione",/);
  assert.match(store, /"funzione",/);
  assert.match(store, /DOVE_SUCCEDE = \("sezione", "funzione"\)/);
  const client = await leggi("../../github_client.py");
  assert.match(client, /\*\*Dove:\*\* \{dove\}/);
  /* In cima e non anche sotto: una volta sola. */
  assert.match(client, /if valore and chiave not in DOVE_SUCCEDE/);
});
