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
 * Adesso si gira dove l'ENTITA' SI RISOLVE (#435): la tessera chiede le sue
 * letture al modello gia' risolto, e il numero che le arriva ha gia' il segno
 * di qui. Non c'e' piu' un posto dove «ricordarsi» di girarlo, e quindi non
 * c'e' piu' un posto dove dimenticarselo. Le prove tengono ferme quattro cose.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analisiDellaSezione } from "../src/core/analisi-sezione.js";
import { applySignedSources, derivedEnergyStates } from "../src/core/signed-energy.js";

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

test("il verso si gira dove l'entita' si risolve, e la tessera legge da li'", () => {
  const letture = sorgente.slice(
    sorgente.indexOf("function lettureDellImpianto("),
    sorgente.indexOf('    solare: di("solar")?.watts'),
  );
  /* Le letture nascono dal modello gia' risolto: `applySignedSources` ha gia'
   * fatto scendere la casella della potenza sulla lettura ricavata. */
  assert.match(letture, /const risolto = primo \? applySignedSources\(impianto \|\| \{\}\) : impianto;/);
  /* E qui dentro non si gira piu' niente a mano: girarlo di nuovo riporterebbe
   * il numero com'era, che e' il difetto di prima scritto al contrario. */
  assert.doesNotMatch(sorgente, /potenzaDellaBatteria|batteriaGirata|cd_batteria_verso/);
});

test("una mano sola sul segno: il numero girato arriva gia' fatto", () => {
  /* Il sensore di chi ha segnalato: positivo quando si carica, scritto nella
   * casella «Potenza» di sempre. */
  const casa = { battery: { power: "sensor.batteria_potenza", signed: { positive: "charge" } } };
  const stati = {
    "sensor.batteria_potenza": {
      entity_id: "sensor.batteria_potenza",
      state: "3212",
      attributes: { unit_of_measurement: "W" },
    },
  };
  /* La casella scende sulla lettura ricavata... */
  assert.equal(applySignedSources(casa).battery.power, "dm_derived.battery_power");
  /* ...e la lettura ricavata porta il numero nella convenzione di qui. */
  assert.equal(derivedEnergyStates(casa, stati)["dm_derived.battery_power"].state, "-3212");
  /* Chi non ha dichiarato niente non cambia di una virgola. */
  const fermo = { battery: { power: "sensor.batteria_potenza" } };
  assert.equal(applySignedSources(fermo).battery.power, "sensor.batteria_potenza");
  assert.deepEqual(derivedEnergyStates(fermo, stati), {});
});
