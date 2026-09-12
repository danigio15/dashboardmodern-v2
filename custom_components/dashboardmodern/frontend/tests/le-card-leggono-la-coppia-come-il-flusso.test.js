/* «Il flusso dice 236 W dalla batteria, la card accanto dice 0 W.»
 *
 * Segnalato con le due schermate dello stesso istante: la bolla verde «▲ 236
 * W», e sotto la card BATTERIA «0 W · 13%». I numeri della casa dicono da che
 * parte sta la verità — casa 725 W, sole 485 W, rete 0 W: quei 236 W escono
 * dalla batteria, e il conto torna solo col numero del flusso.
 *
 * Il motivo è strutturale. La potenza non è sempre nella casella `power`: chi
 * ha dichiarato un sensore unico col segno, o DUE sensori uno per verso — la
 * coppia carica/scarica — quella casella ce l'ha vuota o con dentro un verso
 * solo. La mappa del flusso lo sapeva e passava da `applySignedSources`; le
 * card leggevano il campo grezzo, cioè il sensore della CARICA mentre la
 * batteria si scaricava: zero.
 *
 * Qui si tiene fermo che le due strade partano dalla stessa risoluzione.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applySignedSources, derivedEnergyStates } from "../src/core/signed-energy.js";

const sorgente = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

/* La casa che ha segnalato: due sensori per la batteria, uno per verso. */
const IMPIANTO = Object.freeze({
  house: { power: "sensor.casa_w" },
  solar: { power: "sensor.sole_w" },
  grid: { power: "sensor.rete_w" },
  battery: {
    power: "sensor.batteria_carica_w",
    power_discharge: "sensor.batteria_scarica_w",
    soc: "sensor.batteria_soc",
  },
});

const watt = (id, valore) => ({
  entity_id: id,
  state: String(valore),
  attributes: { unit_of_measurement: "W" },
});

const STATI = Object.freeze({
  "sensor.casa_w": watt("sensor.casa_w", 725),
  "sensor.sole_w": watt("sensor.sole_w", 485),
  "sensor.rete_w": watt("sensor.rete_w", 0),
  /* Si sta scaricando: il sensore della carica segna zero, quello della
     scarica segna i 236 W che vanno in casa. */
  "sensor.batteria_carica_w": watt("sensor.batteria_carica_w", 0),
  "sensor.batteria_scarica_w": watt("sensor.batteria_scarica_w", 236),
});

test("con la coppia, la casella grezza è quella del verso fermo", () => {
  /* È il difetto, messo in chiaro: leggere `battery.power` dà lo zero della
     carica mentre la batteria sta dando 236 W. */
  assert.equal(IMPIANTO.battery.power, "sensor.batteria_carica_w");
  assert.equal(STATI[IMPIANTO.battery.power].state, "0");
});

test("la risoluzione porta alla lettura ricavata, e quella dice 236 W", () => {
  const risolto = applySignedSources(IMPIANTO);
  assert.notEqual(risolto.battery.power, IMPIANTO.battery.power);
  assert.match(risolto.battery.power, /^dm_derived\./);
  const ricavate = derivedEnergyStates(IMPIANTO, STATI);
  const lettura = ricavate[risolto.battery.power];
  /* Positivo = scarica, la convenzione di casa: 236 W che escono. */
  assert.equal(Number(lettura.state), 236);
  /* E il bilancio torna: il sole piu' la batteria fanno la casa, a meno degli
     arrotondamenti dei sensori. Col numero della casella grezza — zero — non
     tornerebbe di duecento watt. */
  const sole = Number(STATI["sensor.sole_w"].state);
  const casa = Number(STATI["sensor.casa_w"].state);
  assert.ok(Math.abs(sole + Number(lettura.state) - casa) <= 5, "il bilancio non torna");
  assert.ok(Math.abs(sole + 0 - casa) > 200, "col verso fermo il bilancio salta");
});

test("le card partono dalla stessa risoluzione del flusso", () => {
  const letture = sorgente.slice(
    sorgente.indexOf("function lettureDellImpianto("),
    sorgente.indexOf('    solare: di("solar")?.watts'),
  );
  assert.match(letture, /const risolto = primo \? applySignedSources\(impianto \|\| \{\}\) : impianto;/);
  /* Le quattro potenze e il SOC si leggono dal risolto, non dal grezzo. */
  assert.match(letture, /clean\(risolto\?\.\[group\]\?\.\[field\]\)/);
  assert.match(letture, /clean\(risolto\?\.battery\?\.soc\)/);
  /* E i numeri del giorno pure: con un contatore unico col segno anche «In
     batteria» e «Da batteria» escono dalla risoluzione. */
  assert.match(letture, /oggiDellImpianto\(states, risolto, primo\)/);
  assert.doesNotMatch(letture, /clean\(impianto\?\.\[group\]/);
});

test("il secondo impianto resta sulle sue caselle", () => {
  /* Le letture ricavate le pubblica chi le pubblica per il PRIMO impianto — il
     primo livello del documento Energia È il primo impianto. Prendere quegli
     id per il secondo vorrebbe dire mostrare la batteria di casa dentro la
     casa dell'altro: un difetto peggiore di quello che si corregge. */
  const letture = sorgente.slice(
    sorgente.indexOf("function lettureDellImpianto("),
    sorgente.indexOf('    solare: di("solar")?.watts'),
  );
  assert.match(letture, /primo \? applySignedSources/);
  assert.match(letture, /: impianto;/);
});
