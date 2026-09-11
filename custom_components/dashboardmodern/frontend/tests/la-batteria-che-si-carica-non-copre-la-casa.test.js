/* «Segna che la batteria copre la casa a 3.12 kW» (dal campo).
 *
 * Le due foto della segnalazione, nello stesso istante:
 *
 *   · la tessera Energia scrive «La batteria copre 3,12 kW»;
 *   · la mappa dei flussi, accanto, disegna la batteria che SI CARICA a
 *     3212 W, con la freccia dal sole verso di lei.
 *
 * Una delle due mente, e si sa quale senza guardare il codice: il sole fa
 * 3939 W, la casa ne usa 727, la rete e' a zero. Se la batteria stesse
 * scaricando 3,12 kW, in casa entrerebbero 7 kW per alimentare 727 W senza
 * mandarne fuori nessuno. La batteria si sta caricando, e sono esattamente
 * i 3212 W che avanzano: 3939 - 727.
 *
 * La causa: meta' dei sensori scrive positivo quando la batteria si CARICA,
 * e il verso lo dichiara chi abita la casa una volta sola (#434). Quel verso
 * lo girava SOLO la mappa. Le righe della tessera portavano il numero grezzo,
 * e ci leggevano sopra tre cose diverse — la frase, il soggetto del racconto,
 * la casella del popup.
 *
 * Adesso si gira dove la riga nasce, e da li' in poi c'e' una convenzione
 * sola. Le prove tengono ferme quattro cose.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analisiDellaSezione } from "../src/core/analisi-sezione.js";
import { potenzaDellaBatteria, batteriaGirata } from "../src/core/energy-flow-truth.js";

const sorgente = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

const tr = (it) => it;

/* La casa della segnalazione, con la batteria gia' nella convenzione di qui:
 * positivo = scarica, quindi caricarsi a 3212 W vale -3212. */
const CASA = (batteria) => ({
  key: "energia",
  lingua: "it",
  today: 10.6,
  rows: [
    { group: "house", watts: 727 },
    { group: "solar", watts: 3939 },
    { group: "grid", watts: 0 },
    { group: "battery", watts: batteria, soc: 44 },
  ],
});

test("la batteria che si carica non copre la casa", () => {
  const lettura = analisiDellaSezione(CASA(-3212), tr, Date.now(), null, "it");
  const punti = lettura.punti.join(" | ");
  /* Quello che diceva prima, e che non deve piu' dire. */
  assert.doesNotMatch(punti, /La batteria copre/);
  assert.match(punti, /La batteria si carica a/);
  /* E il numero e' quello vero, non il suo opposto. */
  assert.match(punti, /3,21 kW|3212 W/);
});

test("la batteria che scarica davvero continua a dirlo", () => {
  /* Di notte: niente sole, la casa tira 727 W e la batteria li da'. La
   * correzione non deve spegnere la frase giusta. */
  const notte = {
    key: "energia",
    lingua: "it",
    rows: [
      { group: "house", watts: 727 },
      { group: "solar", watts: 0 },
      { group: "grid", watts: 0 },
      { group: "battery", watts: 727, soc: 44 },
    ],
  };
  const punti = analisiDellaSezione(notte, tr, Date.now(), null, "it").punti.join(" | ");
  assert.match(punti, /La batteria copre/);
  assert.doesNotMatch(punti, /si carica/);
});

test("il verso si gira dove la riga nasce, una volta sola", () => {
  const letture = sorgente.slice(
    sorgente.indexOf("function lettureDellImpianto("),
    sorgente.indexOf('    solare: di("solar")?.watts'),
  );
  /* Qui si gira... */
  assert.match(letture, /battuta\.watts = potenzaDellaBatteria\(/);
  assert.match(letture, /batteriaGirata\(readJson\(CHIAVE_VERSO_BATTERIA, \{\}\)\)/);
  /* ...e nel modello del flusso NON si rigira: due giri riportano il numero
   * com'era, che e' il difetto di prima scritto al contrario. */
  const flusso = sorgente.slice(
    sorgente.indexOf("    solare: di(\"solar\")?.watts"),
    sorgente.indexOf("/* Cosa dice la didascalia del giorno"),
  );
  assert.match(flusso, /batteria: di\("battery"\)\?\.watts \?\? null,/);
  assert.doesNotMatch(flusso, /potenzaDellaBatteria/);
  /* In tutto il file il giro si fa in un posto solo. */
  assert.equal([...sorgente.matchAll(/potenzaDellaBatteria\(/g)].length, 1);
});

test("girare due volte riporta il numero com'era: e' la ragione del posto unico", () => {
  /* Il sensore di chi ha segnalato: positivo quando si carica. */
  const grezzo = 3212;
  const girata = batteriaGirata({ girata: true });
  const unaVolta = potenzaDellaBatteria(grezzo, girata);
  assert.equal(unaVolta, -3212, "una volta: carica, come dice la mappa");
  assert.equal(potenzaDellaBatteria(unaVolta, girata), grezzo, "due volte: si torna al difetto");
  /* Chi non ha girato niente non cambia di una virgola. */
  assert.equal(potenzaDellaBatteria(grezzo, batteriaGirata({})), grezzo);
  /* E «non configurata» resta diversa da «ferma»: `null` non e' zero. */
  assert.equal(potenzaDellaBatteria(null, true), null);
  assert.equal(potenzaDellaBatteria(0, true), 0);
});
