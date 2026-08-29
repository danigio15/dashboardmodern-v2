/* Sei frasi che dicevano il falso, e come si riconoscono.
 *
 * Vengono tutte dalla revisione della 1.3.7, e hanno la stessa forma: una
 * finestra che afferma una cosa mentre nella stessa finestra ce n'e' scritta
 * un'altra. Non sono errori di calcolo — i numeri erano giusti — sono errori di
 * ragionamento su un dato che manca.
 *
 * La regola che le lega, ed e' quella che vale la pena ricordare: **assente non
 * e' zero, e assente non e' spento**. Un sensore che non risponde non dice che
 * la batteria e' a terra, che il sole non produce, che l'acqua non e' stata
 * misurata. Dice che non risponde, e la finestra deve dire quello.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { analisiDellaSezione } from "../src/core/analisi-sezione.js";

const IN_INGLESE = (_it, en) => en;

/* ── il sole non e' fermo perche' manca la lettura della casa ────────────── */

test("senza il consumo della casa il sole dice quello che sta facendo", () => {
  const lettura = analisiDellaSezione(
    { key: "energia", rows: [{ group: "solar", watts: 2160 }] },
    IN_INGLESE,
  );
  assert.match(
    lettura.frase,
    /2[.,]?1|2160/,
    "col fotovoltaico a due chilowatt si diceva «no solar production», e chi legge chiude la finestra convinto di avere l'impianto guasto",
  );
  assert.doesNotMatch(lettura.frase, /No solar production/);
});

test("col sole davvero fermo la frase resta quella di prima", () => {
  const lettura = analisiDellaSezione(
    { key: "energia", rows: [{ group: "solar", watts: 0 }] },
    IN_INGLESE,
  );
  assert.match(lettura.frase, /No solar production/);
});

test("senza nessuna delle due letture non si dichiara niente", () => {
  /* Questo caso lo intercetta un ramo piu' in alto, ed e' giusto cosi': la
   * frase sul sole non deve mai essere l'ultima spiaggia di una tessera muta. */
  const lettura = analisiDellaSezione(
    { key: "energia", rows: [{ group: "grid", watts: 120 }] },
    IN_INGLESE,
  );
  assert.match(lettura.frase, /Nothing to read yet/);
  assert.doesNotMatch(lettura.frase, /No solar production/);
});

/* ── la piscina non smentisce quello che ha appena scritto ───────────────── */

test("con il pH letto e il termometro assente si dice cosa manca", () => {
  const lettura = analisiDellaSezione(
    {
      key: "piscina",
      rows: [{ name: "pH", raw: 7.3, value: "7,3", entity: "sensor.piscina_ph" }],
    },
    IN_INGLESE,
  );
  assert.ok(lettura.punti.length, "il pH e' stato letto, e infatti c'e' un punto che lo dice");
  assert.doesNotMatch(
    lettura.frase,
    /No reading yet/,
    "diceva «nessuna lettura» subito sotto il punto che riportava il pH: due frasi che si smentiscono valgono meno di una",
  );
  assert.match(lettura.frase, /water temperature is unavailable/i);
});

test("con la vasca muta del tutto, «nessuna lettura» resta giusto", () => {
  const lettura = analisiDellaSezione({ key: "piscina", rows: [] }, IN_INGLESE);
  assert.match(lettura.frase, /No reading yet/);
});

/* ── un'auto sola non si racconta al plurale ─────────────────────────────── */

test("un'auto con due letture resta un'auto", () => {
  /* Una macchina porta due righe — la carica e l'autonomia — e chi contava le
   * righe ne deduceva due macchine. */
  const tessera = {
    key: "ev",
    quante: 1,
    rows: [
      { name: "Carica", raw: 62, percentuale: 62, entity: "sensor.auto_soc" },
      { name: "Autonomia", raw: 240, entity: "sensor.auto_km" },
    ],
  };
  const lettura = analisiDellaSezione(tessera, IN_INGLESE);
  assert.doesNotMatch(
    lettura.frase,
    /lowest|One is charging/i,
    "il plurale su una macchina sola nasceva dal contare le righe invece delle auto",
  );
});

/* ── assente non e' zero: la barra rossa su una batteria sconosciuta ─────── */

test("una carica che non si legge non disegna una barra a terra", async () => {
  /* `percentualeDellaRiga` non e' esportata — e' un dettaglio di come si
   * disegna — quindi qui si prova la regola che la reggeva, che e' quella che
   * si sbaglia: `Number(null)` fa zero, e zero e' un valore come un altro per
   * chi disegna una barra. */
  const campi = ["battery", "position", "level", "soc", "humidity", "percent"];
  const percentuale = (riga) => {
    for (const campo of campi) {
      const grezzo = riga?.[campo];
      if (grezzo === null || grezzo === undefined || grezzo === "") continue;
      const valore = Number(grezzo);
      if (Number.isFinite(valore)) return valore;
    }
    return null;
  };
  assert.equal(
    percentuale({ battery: null }),
    null,
    "un aspirapolvere muto non e' un aspirapolvere scarico",
  );
  assert.equal(percentuale({ battery: "" }), null);
  assert.equal(percentuale({ battery: undefined }), null);
  /* E uno zero vero resta zero: la correzione non deve nascondere una batteria
   * davvero a terra, che e' proprio la cosa da vedere. */
  assert.equal(percentuale({ battery: 0 }), 0);
  assert.equal(percentuale({ battery: 47 }), 47);
  /* Il campo assente non ferma la ricerca sugli altri. */
  assert.equal(percentuale({ battery: null, level: 30 }), 30);
});

/* ── il Delta non e' una sonda ───────────────────────────────────────────── */

test("il confronto fra sonde non tira dentro il Delta, la pressione o i watt", () => {
  /* «77,9° di salto fra la sonda piu' calda e la piu' fredda», confrontando la
   * temperatura del boiler col Delta a -3°: il Delta e' gia' una differenza, e
   * faceva da «piu' fredda» a ogni lettura. */
  const lettura = analisiDellaSezione(
    {
      key: "solare",
      attiva: false,
      rows: [
        { name: "Temperatura Boiler", raw: 74.9, sonda: true, entity: "a" },
        { name: "Sonda pannello", raw: 68.2, sonda: true, entity: "b" },
        { name: "Delta Solare termico Boiler", raw: -3.0, sonda: false, entity: "c" },
        { name: "Pressione", raw: 1.5, sonda: false, entity: "d" },
        { name: "Resistenza", raw: 1500, sonda: false, entity: "e" },
      ],
    },
    IN_INGLESE,
  );
  assert.match(lettura.frase, /6\.7|6,7/, "il salto giusto e' fra le due sonde vere");
  for (const punto of lettura.punti) {
    assert.doesNotMatch(
      punto,
      /Delta|Pressione|Resistenza/,
      `una non-sonda e' entrata nel confronto: ${punto}`,
    );
  }
});

test("una riga senza marchio resta una sonda: e' la forma delle tessere semplici", () => {
  const lettura = analisiDellaSezione(
    {
      key: "solare",
      attiva: false,
      rows: [
        { name: "Pannello", raw: 61, entity: "a" },
        { name: "Boiler", raw: 48, entity: "b" },
      ],
    },
    IN_INGLESE,
  );
  assert.match(lettura.frase, /13/);
});
