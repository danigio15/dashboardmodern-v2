/* La finestra di una tessera dice cosa sta succedendo, non elenca.
 *
 * «Il popup smette di essere un elenco e dice cosa sta facendo l'impianto, da
 * quanto, e dove va a finire.» E una forma sola per tutte: «Diciassette
 * sezioni. Stesso ordine, sempre: il verdetto, la frase, la misura con la sua
 * corsa, le caselle, i comandi.»
 *
 * Qui si prova la parte che si ragiona — il verdetto e la frase — perche' e'
 * quella che si sbaglia in silenzio: una frase che dice «2 zone su 5» quando
 * ne sono accese tre e' sbagliata senza rompersi, e a occhio non si vede.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  bricioleDellaSezione,
  daQuanto,
  fraseDellaTessera,
  verdettoDellaTessera,
} from "../src/core/racconto-tessera.js";

test("il verdetto dice quale delle tre cose e', e in che ordine", () => {
  assert.equal(verdettoDellaTessera({}).tono, "bene");
  assert.equal(verdettoDellaTessera({ attiva: true }).tono, "corso");
  assert.equal(verdettoDellaTessera({ alert: true }).tono, "guarda");
  // Una finestra aperta batte una lavatrice in funzione: se c'e' qualcosa da
  // guardare lo si dice, anche se nel frattempo qualcos'altro sta lavorando.
  assert.equal(verdettoDellaTessera({ alert: true, attiva: true }).tono, "guarda");
});

test("il verdetto parla la lingua di chi guarda", () => {
  assert.equal(verdettoDellaTessera({}).testo, "Tutto regolare");
  assert.equal(verdettoDellaTessera({}, true).testo, "All clear");
});

test("il tempo si dice come lo direbbe una persona", () => {
  assert.equal(daQuanto(40), "da 40 minuti");
  assert.equal(daQuanto(1), "da 1 minuto");
  assert.equal(daQuanto(60), "da un'ora");
  assert.equal(daQuanto(80), "da un'ora e 20");
  assert.equal(daQuanto(180), "da 3 ore");
  assert.equal(daQuanto(60 * 24 * 2), "da 2 giorni");
  assert.equal(daQuanto(0), "da poco");
});

test("la frase conta quello che c'e' davvero", () => {
  const luci = {
    key: "luci",
    rows: [
      { on: true, name: "Lampadario Salone" },
      { on: true, name: "Faretti Cucina" },
      { on: false, name: "Piantana" },
      { on: false, name: "Bagno" },
      { on: false, name: "Ingresso" },
    ],
  };
  assert.equal(
    fraseDellaTessera(luci),
    "2 luci accese su 5: Lampadario Salone e Faretti Cucina e altre.".replace(" e altre", ""),
  );
  assert.equal(fraseDellaTessera({ key: "luci", rows: [{ on: false }, { on: false }] }), "Sono tutte spente.");
});

test("il clima dice quanto manca all'obiettivo, e quando non manca niente lo dice", () => {
  const vicino = {
    key: "clima",
    rows: [
      { on: true, name: "Salotto", ambient: 21.9, target: 22 },
      { on: false, name: "Camera", ambient: 19, target: 21 },
    ],
  };
  assert.match(fraseDellaTessera(vicino), /gia' all'obiettivo/);
  const lontano = {
    key: "clima",
    rows: [
      { on: true, name: "Salotto", ambient: 20, target: 22 },
      { on: true, name: "Camera", ambient: 20, target: 22 },
      { on: false, name: "Studio", ambient: 19, target: 21 },
    ],
  };
  assert.match(fraseDellaTessera(lontano), /^2 zone accese su 3\./);
  assert.match(fraseDellaTessera(lontano), /2,0° all'obiettivo/);
});

test("le sonde che non trovano acqua lo dicono in positivo", () => {
  const asciutto = { key: "allagamenti", rows: Array.from({ length: 6 }, () => ({ on: false })) };
  assert.equal(fraseDellaTessera(asciutto), "Nessuna perdita. Tutte e 6 le sonde hanno risposto.");
  const bagnato = {
    key: "allagamenti",
    rows: [{ on: true, name: "Lavanderia" }, { on: false, name: "Bagno" }],
  };
  assert.match(fraseDellaTessera(bagnato), /C'e' acqua: Lavanderia\./);
});

test("le batterie dicono qual e' la piu' bassa, col suo nome", () => {
  const batterie = {
    key: "batterie",
    rows: [
      { name: "Garage", level: 12 },
      { name: "Ingresso", level: 88 },
      { name: "Cantina", level: 41 },
    ],
  };
  assert.equal(fraseDellaTessera(batterie), "La piu' bassa e' Garage al 12%, su 3.");
});

/* Una sezione senza una frase sua non resta muta, e una sezione vuota lo dice
 * invece di far vedere un buco. */
test("chi non ha una frase sua ne ha comunque una", () => {
  assert.match(fraseDellaTessera({ key: "piscina", rows: [{ on: true }, { on: false }] }), /1 su 2/);
  assert.equal(fraseDellaTessera({ key: "piscina", rows: [] }), "Qui non c'e' ancora niente.");
});

/* Le briciole sotto il titolo sono quelle del progetto approvato. */
test("le briciole del solare termico sono quelle disegnate", () => {
  assert.deepEqual(bricioleDellaSezione("solare"), [
    "Circuito primario",
    "Boiler",
    "Ricircolo sanitario",
  ]);
  assert.deepEqual(bricioleDellaSezione("energia"), ["Produzione", "Consumi", "Report"]);
  assert.deepEqual(bricioleDellaSezione("aperture", true), ["Doors and windows", "Watch"]);
});
