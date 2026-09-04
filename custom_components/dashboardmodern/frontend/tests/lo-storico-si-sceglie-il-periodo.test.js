/* Lo storico si sceglie il periodo (#302).
 *
 * «Nella scheda temperatura il grafico permette solo di scegliere 24h/7g.
 * Inserire la possibilita' di inserire data inizio e data fine oltre a piu'
 * periodi predefiniti.» E su tutti i popup dove si vede lo storico. Queste
 * prove tengono fermo il modello del periodo — le ore, l'intervallo scritto a
 * mano, il futuro che non ha storia — e le tre finestre che lo usano: il
 * popup delle misure, il grafico della stanza, la cronologia della
 * connettivita'.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  MINIMO_MS,
  ORE_DI_SERIE,
  ORE_MASSIME,
  PERIODI,
  chiaveDellIntervallo,
  daInputLocale,
  etichettaDelTempo,
  granularita,
  intervalloDa,
  intervalloDaOre,
  intervalloPersonalizzato,
  nomeDelPeriodo,
  passoDelleTacche,
  perInputLocale,
  periodoDaOre,
} from "../src/core/periodo-storico.js";
import { cambiDiStato, durata } from "../src/sections/storico-connettivita-section.js";
import { hourLabels } from "../src/sections/temperature-trend-section.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");
const ADESSO = Date.UTC(2026, 8, 4, 10, 0, 0);
const ORA = 3_600_000;

test("i periodi di serie: da un'ora a due mesi, ognuno con le sue parole", () => {
  assert.deepEqual(
    PERIODI.map((p) => p.ore),
    [1, 5, 10, 24, 168, 720, 1440],
  );
  for (const p of PERIODI) assert.ok(p.it && p.en && p.chiave, p.chiave);
  assert.equal(periodoDaOre(168).chiave, "7g");
  assert.equal(periodoDaOre(3), null);
  assert.equal(ORE_DI_SERIE, 24);
});

test("le ultime N ore finiscono adesso, e un anno e' il massimo", () => {
  const giorno = intervalloDaOre(24, ADESSO);
  assert.deepEqual(giorno, { start: ADESSO - 24 * ORA, end: ADESSO, ore: 24, personalizzato: false });
  assert.equal(intervalloDaOre(ORE_MASSIME * 3, ADESSO).ore, ORE_MASSIME);
  assert.equal(intervalloDaOre(0, ADESSO), null);
  assert.equal(intervalloDaOre("boh", ADESSO), null);
});

test("da quando a quando: il futuro non ha storia, e l'inizio sta prima della fine", () => {
  const inizio = ADESSO - 3 * ORA;
  const scelto = intervalloPersonalizzato(inizio, ADESSO - ORA, ADESSO);
  assert.deepEqual(scelto, { start: inizio, end: ADESSO - ORA, ore: 2, personalizzato: true });
  /* Una fine nel futuro si riporta ad adesso; una fine mancante e' adesso. */
  assert.equal(intervalloPersonalizzato(inizio, ADESSO + 5 * ORA, ADESSO).end, ADESSO);
  assert.equal(intervalloPersonalizzato(inizio, undefined, ADESSO).end, ADESSO);
  /* Un inizio dopo la fine, o troppo vicino, non e' un intervallo. */
  assert.equal(intervalloPersonalizzato(ADESSO, ADESSO - ORA, ADESSO), null);
  assert.equal(intervalloPersonalizzato(ADESSO - MINIMO_MS / 2, ADESSO, ADESSO), null);
  assert.equal(intervalloPersonalizzato("boh", ADESSO, ADESSO), null);
  /* Piu' di un anno si accorcia dalla fine. */
  assert.equal(intervalloPersonalizzato(ADESSO - 2 * ORE_MASSIME * ORA, ADESSO, ADESSO).ore, ORE_MASSIME);
  /* Le date si leggono anche scritte. */
  assert.equal(intervalloPersonalizzato("2026-09-04T08:00:00Z", "2026-09-04T09:00:00Z", ADESSO).ore, 1);
});

test("una scelta qualunque diventa un intervallo: ore, chiave, oggetto", () => {
  assert.equal(intervalloDa(168, ADESSO).ore, 168);
  assert.equal(intervalloDa("7g", ADESSO).ore, 168);
  assert.equal(intervalloDa({ ore: 5 }, ADESSO).ore, 5);
  assert.equal(intervalloDa({ start: ADESSO - ORA, end: ADESSO }, ADESSO).personalizzato, true);
  assert.equal(intervalloDa({}, ADESSO), null);
  assert.equal(intervalloDa(null, ADESSO), null);
  /* Un intervallo gia' fatto ripassa uguale. */
  const fatto = intervalloDa(24, ADESSO);
  assert.deepEqual(intervalloDa(fatto, ADESSO), fatto);
});

test("la chiave della memoria: le ore per i periodi di serie, i due istanti a mano", () => {
  assert.equal(chiaveDellIntervallo(intervalloDa(24, ADESSO)), "24h");
  assert.equal(chiaveDellIntervallo(intervalloDa(24, ADESSO + 5000)), "24h", "la stessa chiave a ogni giro");
  const mio = intervalloDa({ start: ADESSO - ORA, end: ADESSO }, ADESSO);
  assert.match(chiaveDellIntervallo(mio), /^\d+-\d+$/);
  assert.equal(chiaveDellIntervallo(null), "");
});

test("la grana dell'asse cresce col periodo, e le tacche con lei", () => {
  assert.equal(granularita(intervalloDa(5, ADESSO)), "ore");
  assert.equal(granularita(intervalloDa(48, ADESSO)), "ore");
  assert.equal(granularita(intervalloDa(168, ADESSO)), "giorni-ore");
  assert.equal(granularita(intervalloDa(720, ADESSO)), "giorni");
  assert.equal(passoDelleTacche(intervalloDa(5, ADESSO)), ORA);
  assert.equal(passoDelleTacche(intervalloDa(24, ADESSO)), 6 * ORA);
  assert.equal(passoDelleTacche(intervalloDa(168, ADESSO)), 24 * ORA);
  assert.equal(passoDelleTacche(intervalloDa(1440, ADESSO)), 7 * 24 * ORA);
  assert.match(etichettaDelTempo(ADESSO, "ore", "it"), /\d{2}:\d{2}/);
  assert.match(etichettaDelTempo(ADESSO, "giorni", "en"), /Sep/);
  assert.equal(etichettaDelTempo(NaN, "ore"), "");
  /* Il pannello della temperatura usa la stessa regola: su due mesi le tacche
   * sono una a settimana, non sessanta. */
  const dueMesi = { start: ADESSO - 1440 * ORA, end: ADESSO, hours: 1440 };
  assert.ok(hourLabels(dueMesi).length <= 10, `${hourLabels(dueMesi).length} tacche`);
  const giorno = { start: ADESSO - 24 * ORA, end: ADESSO, hours: 24 };
  assert.ok(hourLabels(giorno).length >= 4 && hourLabels(giorno).length <= 5);
});

test("le caselle datetime-local parlano ora locale, avanti e indietro", () => {
  const ms = new Date(2026, 8, 4, 8, 30).getTime();
  assert.equal(perInputLocale(ms), "2026-09-04T08:30");
  assert.equal(daInputLocale("2026-09-04T08:30"), ms);
  assert.equal(daInputLocale(""), null);
  assert.equal(daInputLocale("ieri"), null);
  assert.equal(perInputLocale(NaN), "");
});

test("il nome del periodo: quello di serie, o «dal … al …»", () => {
  assert.equal(nomeDelPeriodo(intervalloDa(168, ADESSO), "it"), "7 giorni");
  assert.equal(nomeDelPeriodo(intervalloDa(168, ADESSO), "en"), "7 days");
  assert.match(nomeDelPeriodo(intervalloDa({ start: ADESSO - ORA, end: ADESSO }, ADESSO), "it"), /→/);
  assert.equal(nomeDelPeriodo(null), "");
});

test("il popup delle misure: i periodi di serie e l'intervallo a mano, al posto dei quattro tasti", async () => {
  const storico = await leggi("sections/history-section.js");
  assert.match(storico, /export async function openHistory\(event, entityId, name, range = ORE_DI_SERIE\)/);
  assert.match(storico, /const intervallo = intervalloDa\(range\) \|\| intervalloDa\(ORE_DI_SERIE\);/);
  assert.match(storico, /export function ensureControlli\(\)/);
  assert.match(storico, /data-dm-hist-custom-riga/);
  assert.match(storico, /type="datetime-local" class="ed-input" data-dm-hist-da/);
  /* La domanda al Recorder porta l'intervallo, non piu' le ore da adesso. */
  assert.match(storico, /start_time: new Date\(scelto\.start\)\.toISOString\(\),\s*end_time: new Date\(scelto\.end\)\.toISOString\(\),/);
  /* L'asse cambia grana col periodo. */
  assert.match(storico, /labels\.push\(etichettaDelTempo\(row\.time, grana, locale\(\)\)\);/);
  /* Chi cambia periodo passa sempre dallo stesso cambio, ore o intervallo. */
  assert.match(storico, /export function changeHistoryRange\(range\)/);
});

test("la cache condivisa e il grafico della stanza parlano lo stesso periodo", async () => {
  const condiviso = await leggi("sections/storico-condiviso-section.js");
  assert.match(condiviso, /const chiave = `\$\{nome\}@\$\{chiaveDellIntervallo\(intervallo\)\}`;/);
  assert.match(condiviso, /const intervallo = intervalloDa\(scelta\) \|\| intervalloDa\(3\);/);
  const trend = await leggi("sections/temperature-trend-section.js");
  assert.match(trend, /for \(const periodo of PERIODI\) \{/);
  assert.match(trend, /dm-trend-range-custom/);
  assert.match(trend, /rowsFor\(item\.entity, intervallo\)/);
  assert.match(trend, /export function periodoDelPannello\(/);
  assert.doesNotMatch(trend, /for \(const hours of \[24, 168\]\)/);
});

test("la cronologia della connettivita' ha la sua barra, e ricostruisce le stesse righe", async () => {
  const sezione = await leggi("sections/storico-connettivita-section.js");
  assert.match(sezione, /wrapFunction\("apriSrvHistory", "__dmStoricoConnettivita", dopoLApertura\)/);
  assert.match(sezione, /\/api\/history\/period\//);
  assert.match(sezione, /srv-history-event/);
  const runtime = await leggi("sections/section-runtime.js");
  assert.match(runtime, /installStoricoConnettivita\(\);/);
  assert.match(runtime, /"storico-connettivita",/);
  /* I cambi di stato: uno per cambio, dal piu' recente, al massimo trenta. */
  const righe = [
    { state: "on", time: 1000 },
    { state: "on", time: 2000 },
    { state: "off", time: 3000 },
    { state: "unavailable", time: 4000 },
    { state: "", time: 5000 },
    { state: "on", time: "boh" },
  ];
  assert.deepEqual(cambiDiStato(righe), [
    { stato: "unavailable", quando: 4000 },
    { stato: "off", quando: 3000 },
    { stato: "on", quando: 1000 },
  ]);
  assert.equal(cambiDiStato(righe, 1).length, 1);
  assert.deepEqual(cambiDiStato(null), []);
  assert.equal(durata(0, 90 * 60000), "1h 30m");
  assert.equal(durata(0, 26 * 3600000), "1g 2h");
  assert.equal(durata(0, 5 * 60000), "5m");
  assert.equal(durata(10, 0), "0m");
});
