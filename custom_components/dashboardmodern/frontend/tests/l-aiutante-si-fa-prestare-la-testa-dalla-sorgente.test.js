/* «Ma non è assolutamente vero, nel database i dati ci sono.»
 *
 * E infatti ci sono. Non sotto l'entità che la plancia stava leggendo.
 *
 * Dalla segnalazione, i due sensori della stessa colonnina:
 *
 *     sensor.1p7k_101573_lifetime_energy   1440.762  total_increasing
 *     sensor.wallbox_lifetime_filtered     1440.762  total_increasing
 *                                          entity_id: sensor.1p7k_101573_lifetime_energy
 *
 * Il secondo è un aiutante costruito sopra il primo: adesso segnano lo stesso
 * numero, ma le statistiche a lungo termine dell'aiutante cominciano il giorno
 * in cui è stato creato l'aiutante, non il giorno in cui è stata installata la
 * colonnina. Tre mesi in meno nel Recorder — che nel database ci sono eccome,
 * scritti sotto il nome dell'entità di partenza.
 *
 * Il legame non si indovina: lo pubblica l'aiutante stesso, nell'attributo
 * `entity_id`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  crescitaNellArco,
  energiaPrimaDelleStatistiche,
  sorgenteDichiarata,
  sourcePlans,
} from "../src/core/period-service.js";

const SORGENTE = readFileSync(new URL("../src/core/period-service.js", import.meta.url), "utf8");

const STATI = {
  "sensor.wallbox_lifetime_filtered": {
    state: "1440.762",
    attributes: {
      state_class: "total_increasing",
      device_class: "energy",
      unit_of_measurement: "kWh",
      entity_id: "sensor.1p7k_101573_lifetime_energy",
    },
  },
  "sensor.1p7k_101573_lifetime_energy": {
    state: "1440.762",
    attributes: {
      state_class: "total_increasing",
      device_class: "energy",
      unit_of_measurement: "kWh",
    },
  },
};

test("un aiutante dice da chi è fatto, e lo si legge", () => {
  assert.equal(
    sorgenteDichiarata("sensor.wallbox_lifetime_filtered", STATI),
    "sensor.1p7k_101573_lifetime_energy",
  );
});

test("chi non è fatto di nessuno non ha sorgente", () => {
  assert.equal(sorgenteDichiarata("sensor.1p7k_101573_lifetime_energy", STATI), "");
  assert.equal(sorgenteDichiarata("sensor.mai_visto", STATI), "");
  assert.equal(sorgenteDichiarata("", STATI), "");
  assert.equal(sorgenteDichiarata(null), "");
});

test("un gruppo di più entità non ha UNA sorgente: non se ne inventa una", () => {
  /* `entity_id` con più nomi è un gruppo o una somma. Prenderne uno vorrebbe
   * dire leggere l'apparecchio sbagliato, che è l'errore peggiore dei due. */
  const stati = {
    "sensor.somma": { attributes: { entity_id: ["sensor.a", "sensor.b"] } },
    "sensor.uno_solo": { attributes: { entity_id: ["sensor.a"] } },
    "sensor.se_stesso": { attributes: { entity_id: "sensor.se_stesso" } },
    "sensor.senza_punto": { attributes: { entity_id: "non-un-entita" } },
  };
  assert.equal(sorgenteDichiarata("sensor.somma", stati), "");
  assert.equal(sorgenteDichiarata("sensor.uno_solo", stati), "sensor.a");
  assert.equal(sorgenteDichiarata("sensor.se_stesso", stati), "");
  assert.equal(sorgenteDichiarata("sensor.senza_punto", stati), "");
});

test("i piani delle fonti si portano dietro la sorgente", () => {
  const piani = sourcePlans(
    { house: { total_energy: "sensor.wallbox_lifetime_filtered" } },
    "year",
    STATI,
  );
  const casa = piani.find((plan) => plan.key === "house");
  assert.equal(casa.entity, "sensor.wallbox_lifetime_filtered");
  assert.equal(casa.sorgente, "sensor.1p7k_101573_lifetime_energy");
});

const ANNO = {
  kind: "year",
  period: "day",
  start: new Date("2026-01-01T00:00:00Z"),
  end: new Date("2026-09-01T00:00:00Z"),
};

/* L'aiutante: statistiche da giugno, e al primo secchiello il contatore segna
 * già 894,9 più di quello che la `sum` ha contato. */
const AIUTANTE = [
  { start: "2026-06-01T00:00:00Z", sum: 0, state: 894.9 },
  { start: "2026-08-31T00:00:00Z", sum: 477.8, state: 1372.7 },
];

/* La sorgente: le stesse letture, ma da marzo, quando la colonnina è nata. */
const SORGENTE_VERA = [
  { start: "2026-03-01T00:00:00Z", sum: 0, state: 0 },
  { start: "2026-06-01T00:00:00Z", sum: 894.9, state: 894.9 },
  { start: "2026-08-31T00:00:00Z", sum: 1372.7, state: 1372.7 },
];

test("la testa che manca all'aiutante ce l'ha la sorgente", () => {
  assert.equal(Math.round(energiaPrimaDelleStatistiche(AIUTANTE, ANNO) * 10) / 10, 894.9);
  assert.equal(energiaPrimaDelleStatistiche(SORGENTE_VERA, ANNO), 0);

  assert.equal(
    Math.round(crescitaNellArco(AIUTANTE, ANNO) * 10) / 10,
    477.8,
    "letto dall'aiutante, l'anno è corto",
  );
  assert.equal(
    Math.round(crescitaNellArco(SORGENTE_VERA, ANNO) * 10) / 10,
    1372.7,
    "letto dalla sorgente, l'anno è intero",
  );
});

test("si chiede alla sorgente solo a chi ha la testa corta, e solo sul primo arco", () => {
  assert.match(SORGENTE, /const conLaTestaCorta = plans\.filter\(\(plan\) => \{/);
  assert.match(SORGENTE, /if \(continuazione\) return false;/);
  assert.match(SORGENTE, /energiaPrimaDelleStatistiche\(righe\[plan\.entity\], range\) > 0/);
});

test("e si passa alla sorgente solo se arriva davvero più indietro", () => {
  /* Un'entità che non ha quelle righe non è un rimedio: scambiarla per tale
   * vorrebbe dire leggere un altro apparecchio per niente. */
  assert.match(SORGENTE, /if \(!della\.length \|\| primaDella >= primaSua\) return \[\];/);
});

test("l'ammanco che resta è quello della serie che si è usata davvero", () => {
  /* Se la sorgente copre tutto, non c'è più niente da dire; se anche lei è
   * corta, si dice quanto manca a LEI, non all'aiutante. */
  assert.match(SORGENTE, /const mancante = prestata\s*\?\s*prestata\.mancante/);
});
