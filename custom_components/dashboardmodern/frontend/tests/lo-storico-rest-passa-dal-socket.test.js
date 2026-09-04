/* Le chiamate REST allo storico passano dal socket, e i periodi lunghi dalle
 * statistiche.
 *
 * Dentro il pannello la plancia non ha un gettone: ogni `fetch` a
 * `/api/history/period` rispondeva 401 e Home Assistant suonava «Login
 * attempt or request with invalid authentication from 127.0.0.1» — una
 * campanella ogni dieci minuti dalla derivazione dei totali, e niente storico
 * nel Report. E con «1 mese» il grafico diceva «nessuno storico» perche' la
 * domanda dei cambi di stato di trenta giorni scadeva.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  domandaDallIndirizzo,
  eUnoStoricoRest,
  rispostaComeRest,
} from "../src/core/storico-rest.js";
import {
  SOGLIA_STATISTICHE_ORE,
  attesaPer,
  domandaStatistiche,
  domandaStoriaLeggera,
  periodoDelleStatistiche,
  righeDalleStatistiche,
  vuoleLeStatistiche,
} from "../src/core/storico-lungo.js";
import { intervalloDa } from "../src/core/periodo-storico.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("un indirizzo REST dello storico si riconosce e diventa la domanda per il socket", () => {
  const url =
    "http://homeassistant.local:8123/api/history/period/2026-09-01T00:00:00.000Z?filter_entity_id=sensor.a,sensor.b&minimal_response&no_attributes&end_time=2026-09-02T00:00:00.000Z";
  assert.equal(eUnoStoricoRest(url), true);
  assert.equal(eUnoStoricoRest("/api/states/sensor.a"), false);
  const domanda = domandaDallIndirizzo(url);
  assert.deepEqual(domanda, {
    type: "history/history_during_period",
    start_time: "2026-09-01T00:00:00.000Z",
    end_time: "2026-09-02T00:00:00.000Z",
    entity_ids: ["sensor.a", "sensor.b"],
    include_start_time_state: true,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: true,
  });
  /* `significant_changes_only=false` e' l'unico posto dove il guscio lo dice. */
  const tutti = domandaDallIndirizzo(
    "/api/history/period/2026-09-01T00:00:00Z?filter_entity_id=binary_sensor.x&end_time=2026-09-02T00:00:00Z&significant_changes_only=false",
  );
  assert.equal(tutti.significant_changes_only, false);
  assert.equal(tutti.minimal_response, false);
  /* Senza entita' non c'e' niente da tradurre. */
  assert.equal(domandaDallIndirizzo("/api/history/period/2026-09-01T00:00:00Z"), null);
  assert.equal(domandaDallIndirizzo("/api/states"), null);
});

test("la risposta del socket torna nella forma del REST, nell'ordine chiesto", () => {
  const T0 = Date.UTC(2026, 8, 1) / 1000;
  const risultato = {
    "sensor.b": [{ s: "2", lu: T0 }],
    "sensor.a": [
      { s: "1", lu: T0, a: { unit_of_measurement: "kWh" } },
      { s: "1.5", lu: T0 + 3600, lc: T0 + 3200 },
    ],
  };
  const rest = rispostaComeRest(risultato, ["sensor.a", "sensor.b", "sensor.vuoto"]);
  assert.equal(rest.length, 2, "chi non ha righe non compare, come nel REST");
  assert.equal(rest[0][0].entity_id, "sensor.a");
  assert.equal(rest[0][0].state, "1");
  assert.equal(rest[0][0].last_changed, "2026-09-01T00:00:00.000Z");
  assert.deepEqual(rest[0][0].attributes, { unit_of_measurement: "kWh" });
  assert.equal(rest[0][1].last_changed, "2026-09-01T00:53:20.000Z", "lc quando c'e'");
  assert.equal(rest[0][1].last_updated, "2026-09-01T01:00:00.000Z");
  assert.deepEqual(rest[0][1].attributes, {});
  assert.equal(rest[1][0].entity_id, "sensor.b");
  assert.deepEqual(rispostaComeRest(null, ["sensor.a"]), []);
});

test("il guscio chiede lo storico via fetch, e la riparazione lo serve dal socket", () => {
  const sezione = leggi("sections/indirizzo-di-casa-section.js");
  assert.match(sezione, /export function storicoViaSocket\(indirizzo, ripiego\)/);
  assert.match(sezione, /chiediAHomeAssistant\(domanda, ATTESA_STORICO_MS\)/);
  assert.match(sezione, /rispostaComeRest\(risultato, domanda\.entity_ids\)/);
  /* Senza gettone e senza socket: un 502 pulito, non un 401 che suona. */
  assert.match(
    sezione,
    /gettoneDiAccesso\(\) \? ripiego\(\) : Promise\.resolve\(rispostaJson\(\[\], 502\)\)/,
  );
  assert.match(sezione, /const viaSocket = storicoViaSocket\(finale/);
});

test("oltre tre giorni lo storico si chiede alle statistiche, con la pazienza giusta", () => {
  assert.equal(SOGLIA_STATISTICHE_ORE, 72);
  const giorno = intervalloDa(24);
  const settimana = intervalloDa(168);
  const mese = intervalloDa(720);
  const anno = intervalloDa(24 * 366);
  assert.equal(vuoleLeStatistiche(giorno), false);
  assert.equal(vuoleLeStatistiche(settimana), true);
  assert.equal(periodoDelleStatistiche(settimana), "hour");
  assert.equal(periodoDelleStatistiche(mese), "hour");
  assert.equal(periodoDelleStatistiche(anno), "day");
  assert.equal(attesaPer(giorno), 12_000);
  assert.equal(attesaPer(settimana), 20_000);
  assert.equal(attesaPer(mese), 30_000);
  const domanda = domandaStatistiche("sensor.temp", mese);
  assert.equal(domanda.type, "recorder/statistics_during_period");
  assert.deepEqual(domanda.statistic_ids, ["sensor.temp"]);
  assert.equal(domanda.period, "hour");
  assert.deepEqual(domanda.types, ["mean", "state", "min", "max"]);
  const leggera = domandaStoriaLeggera("sensor.temp", mese);
  assert.equal(leggera.significant_changes_only, true);
  assert.deepEqual(leggera.entity_ids, ["sensor.temp"]);
});

test("le statistiche diventano righe di storia che i grafici leggono gia'", () => {
  const T0 = Date.UTC(2026, 8, 1);
  const righe = righeDalleStatistiche(
    {
      "sensor.temp": [
        { start: T0 + 3_600_000, mean: 21.4 },
        { start: T0, mean: null, state: 20.9 },
        { start: "2026-09-01T02:00:00+00:00", mean: 22.1 },
        { start: T0 + 10_800_000, mean: null, state: null },
      ],
    },
    "sensor.temp",
  );
  assert.deepEqual(righe, [
    { s: "20.9", lu: T0 / 1000 },
    { s: "21.4", lu: T0 / 1000 + 3600 },
    { s: "22.1", lu: T0 / 1000 + 7200 },
  ]);
  assert.deepEqual(righeDalleStatistiche({}, "sensor.temp"), []);
  assert.deepEqual(righeDalleStatistiche(null, "sensor.temp"), []);
});

test("il popup e la cache condivisa leggono dallo stesso posto, e il broker accetta una pazienza", () => {
  const storia = leggi("sections/history-section.js");
  assert.match(storia, /export async function leggiStorico\(broker, entity, intervallo\)/);
  assert.match(storia, /if \(vuoleLeStatistiche\(scelto\)\)/);
  assert.match(storia, /broker\.request\(domandaStatistiche\(entity, scelto\), attesa\)/);
  assert.match(storia, /return broker\.request\(domandaStoriaLeggera\(entity, scelto\), attesa\);/);
  const condivisa = leggi("sections/storico-condiviso-section.js");
  assert.match(condivisa, /await leggiStorico\(broker, entity, intervallo\)/);
  const broker = leggi("core/period-service.js");
  assert.match(broker, /async request\(payload, timeout = this\.timeout\)/);
});

test("il velo dell'Energia copre i primi tentativi, poi si legge la ragione", () => {
  const energia = leggi("sections/energy-section.js");
  assert.match(energia, /export const TENTATIVI_COL_VELO = 2;/);
  assert.match(energia, /state\.retryCount < TENTATIVI_COL_VELO;/);
  assert.match(energia, /node\.dataset\.dmEnergyRagione = spiegazione;/);
  assert.match(
    energia,
    /\[data-dm-energy-ragione\]:not\(\.dm-energy-awaiting\)::before\{content:attr\(data-dm-energy-ragione\)/,
  );
  assert.match(energia, /state\.retryCount <= TENTATIVI_COL_VELO \? 250 : 20_000/);
});

/* ── i periodi lunghi passano dalle statistiche (dal campo: la CPU) ─────── */

import {
  domandaStatisticheDallaDomanda,
  intervalloDellaDomanda,
  rispostaDalleStatistiche,
} from "../src/core/storico-rest.js";

const ADESSO = Date.UTC(2026, 8, 4, 9, 30);

test("la derivazione dei totali dall'inizio dell'anno chiede le statistiche del giorno, da un giorno prima", () => {
  /* Il guscio chiede la storia grezza di un contatore dall'inizio dell'anno,
   * ogni dieci minuti: decine di migliaia di righe per due numeri. */
  const domanda = domandaDallIndirizzo(
    "http://ha.local:8123/api/history/period/2026-01-01T00:00:00.000Z?filter_entity_id=sensor.energia_casa&minimal_response&no_attributes",
  );
  const statistiche = domandaStatisticheDallaDomanda(domanda, ADESSO);
  assert.equal(statistiche.type, "recorder/statistics_during_period");
  assert.deepEqual(statistiche.statistic_ids, ["sensor.energia_casa"]);
  assert.equal(statistiche.period, "day");
  /* Un periodo prima dell'inizio: la prima riga cade sull'inizio esatto. */
  assert.equal(statistiche.start_time, "2025-12-31T00:00:00.000Z");
  assert.equal(statistiche.end_time, new Date(ADESSO).toISOString());
  assert.deepEqual(statistiche.types, ["state", "mean"]);
  /* Un mese: l'ora. Un giorno: niente statistiche, la storia va bene com'e'. */
  const mese = domandaDallIndirizzo(
    "/api/history/period/2026-09-01T00:00:00.000Z?filter_entity_id=sensor.energia_casa",
  );
  assert.equal(domandaStatisticheDallaDomanda(mese, ADESSO).period, "hour");
  assert.equal(domandaStatisticheDallaDomanda(mese, ADESSO).start_time, "2026-08-31T23:00:00.000Z");
  const giorno = domandaDallIndirizzo(
    "/api/history/period/2026-09-04T00:00:00.000Z?filter_entity_id=sensor.temperatura",
  );
  assert.equal(domandaStatisticheDallaDomanda(giorno, ADESSO), null);
  assert.deepEqual(intervalloDellaDomanda(giorno, ADESSO), {
    start: Date.UTC(2026, 8, 4),
    end: ADESSO,
  });
  assert.equal(intervalloDellaDomanda({ start_time: "boh" }, ADESSO), null);
  assert.equal(domandaStatisticheDallaDomanda(null, ADESSO), null);
});

test("le statistiche rispondono come righe di storia: lo stato di fine periodo, datato alla fine", () => {
  const G = 86_400_000;
  const inizioAnno = Date.UTC(2026, 0, 1);
  const risultato = {
    "sensor.energia_casa": [
      { start: inizioAnno - G, state: 1000, mean: null },
      { start: inizioAnno, state: 1012.5 },
      { start: inizioAnno + G, state: 1030 },
      /* Il periodo corrente non ha ancora una fine: si data ad adesso. */
      { start: inizioAnno + 2 * G, state: 1041.2 },
    ],
    /* Un contatto non ha statistiche: niente righe, e chi chiede torna alla storia. */
    "binary_sensor.porta": [],
  };
  const adesso = inizioAnno + 2 * G + 3_600_000;
  const righe = rispostaDalleStatistiche(
    risultato,
    ["sensor.energia_casa", "binary_sensor.porta"],
    "day",
    adesso,
  );
  assert.equal(righe.length, 1, "solo chi ha righe, come il REST");
  const [contatore] = righe;
  assert.deepEqual(
    contatore.map((riga) => [riga.state, riga.last_changed]),
    [
      ["1000", new Date(inizioAnno).toISOString()],
      ["1012.5", new Date(inizioAnno + G).toISOString()],
      ["1030", new Date(inizioAnno + 2 * G).toISOString()],
      ["1041.2", new Date(adesso).toISOString()],
    ],
  );
  assert.equal(contatore[0].entity_id, "sensor.energia_casa");
  assert.deepEqual(contatore[0].attributes, {});
  /* La lettura del guscio: «la prima riga del periodo» e' il valore
   * all'inizio del periodo, esattamente. */
  const primaDopo = (t) => {
    for (const p of contatore) if (new Date(p.last_changed) >= t) return parseFloat(p.state);
    return NaN;
  };
  assert.equal(primaDopo(new Date(inizioAnno)), 1000);
  assert.equal(primaDopo(new Date(inizioAnno + G)), 1012.5);
  /* Senza `state` vale la media; senza niente la riga non c'e'. */
  const medie = rispostaDalleStatistiche(
    {
      "sensor.t": [
        { start: inizioAnno, mean: 21.4 },
        { start: inizioAnno + 3_600_000, mean: null, state: null },
      ],
    },
    ["sensor.t"],
    "hour",
    adesso,
  );
  assert.deepEqual(
    medie[0].map((r) => r.state),
    ["21.4"],
  );
  assert.deepEqual(rispostaDalleStatistiche(null, ["sensor.x"], "hour", adesso), []);
});

test("la strada del socket prova le statistiche per un periodo lungo e torna alla storia per chi non ne ha", () => {
  const sezione = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/sections/indirizzo-di-casa-section.js"),
    "utf8",
  );
  assert.match(sezione, /const statistiche = domandaStatisticheDallaDomanda\(domanda\);/);
  assert.match(
    sezione,
    /rispostaDalleStatistiche\(risultato, domanda\.entity_ids, statistiche\.period\)/,
  );
  assert.match(
    sezione,
    /tradotte\.length === domanda\.entity_ids\.length \? tradotte : dallaStoria\(\)/,
  );
});
