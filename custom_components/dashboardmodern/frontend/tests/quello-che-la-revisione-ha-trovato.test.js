/* Le cinque cose che la revisione della 1.4.14 ha trovato, e che restano corrette.
 *
 * Cinque rilievi su una PR sola, tutti veri, tutti dello stesso genere: codice
 * che funziona il giorno in cui lo scrivi e mente il mese dopo. Una data senza
 * anno letta a fine dicembre, un tasto che promette un gesto e ne fa un altro,
 * una scritta che l'orologio muove ma nessuno ridisegna, una pila accoppiata
 * dopo la prima accensione, una pagina nuova senza intestazione.
 *
 * Stanno qui insieme perche' sono un fatto solo: nessuno di questi si vede
 * provando la funzione appena scritta.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { leggiData } from "../src/core/rifiuti-model.js";
import { batterieDiCasa } from "../src/core/batterie-di-casa.js";
import {
  prossimoCambioDelDaQuando,
  quandoCambiaIlDaQuando,
} from "../src/core/varchi-di-casa.js";

const sorgente = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

/* ── 1. una data senza anno guarda avanti ───────────────────────────────── */

test("«2 gennaio» letto il 30 dicembre e' fra tre giorni, non undici mesi fa", () => {
  const trenta = new Date(2026, 11, 30, 10, 0).getTime();
  const letta = leggiData("2 gennaio", { adesso: trenta });
  assert.equal(letta?.getFullYear(), 2027);
  assert.equal(letta?.getMonth(), 0);
  assert.equal(letta?.getDate(), 2);
});

test("una data senza anno gia' passata quest'anno vale l'anno prossimo", () => {
  const trenta = new Date(2026, 11, 30, 10, 0).getTime();
  assert.equal(leggiData("10 settembre", { adesso: trenta })?.getFullYear(), 2027);
});

test("il giorno stesso non scivola all'anno dopo", () => {
  const oggi = new Date(2026, 0, 2, 10, 0).getTime();
  const letta = leggiData("2 gennaio", { adesso: oggi });
  assert.equal(letta?.getFullYear(), 2026);
  assert.equal(letta?.getDate(), 2);
});

test("l'anno scritto vince sempre su quello indovinato", () => {
  const trenta = new Date(2026, 11, 30, 10, 0).getTime();
  assert.equal(leggiData("10 set 2029", { adesso: trenta })?.getFullYear(), 2029);
});

/* ── 2. le batterie si riconoscono anche dopo la prima accensione ───────── */

const pila = (livello) => ({
  state: String(livello),
  attributes: { device_class: "battery", unit_of_measurement: "%" },
});

test("una pila che nessuno ha dichiarato si riconosce dallo stato", () => {
  const elenco = batterieDiCasa({
    configurate: ["sensor.vecchia"],
    stati: { "sensor.vecchia": pila(80), "sensor.nuova": pila(12) },
  });
  assert.deepEqual([...elenco], ["sensor.vecchia", "sensor.nuova"]);
});

test("quello che non e' una batteria resta fuori", () => {
  const elenco = batterieDiCasa({
    stati: {
      "sensor.pila": pila(50),
      "sensor.gradi": { state: "21", attributes: { device_class: "temperature" } },
      "sensor.carica_auto": { state: "70", attributes: { device_class: "battery" } },
    },
  });
  assert.deepEqual([...elenco], ["sensor.pila"]);
});

test("una tolta a mano resta tolta, anche se lo stato la riconoscerebbe", () => {
  const elenco = batterieDiCasa({
    configurate: ["sensor.tolta"],
    stati: { "sensor.tolta": pila(30), "sensor.resta": pila(90) },
    tolte: ["sensor.tolta"],
  });
  assert.deepEqual([...elenco], ["sensor.resta"]);
});

test("l'ordine di chi ha configurato viene prima, e nessuno compare due volte", () => {
  const elenco = batterieDiCasa({
    configurate: ["sensor.b", "sensor.a"],
    stati: { "sensor.a": pila(10), "sensor.b": pila(20), "sensor.c": pila(30) },
  });
  assert.deepEqual([...elenco], ["sensor.b", "sensor.a", "sensor.c"]);
});

test("il filtro dei widget non entra qui: lo mette la tessera, e solo lei", async () => {
  const elenco = await sorgente("../src/sections/batterie-elenco-section.js");
  assert.doesNotMatch(elenco, /widgetExcluded|gruppoEntita/);
  const home = await sorgente("../src/sections/home-widgets-section.js");
  assert.match(home, /batterieDiCasa\(\{[\s\S]{0,200}?widgetIncludes/);
});

/* ── 3. la scritta «da quanto» si ridisegna quando cambia ───────────────── */

test("si sa fra quanto la scritta dira' un'altra cosa", () => {
  const ora = 1_000_000_000;
  assert.equal(quandoCambiaIlDaQuando(ora - 30_000, ora), 30_000);
  assert.equal(quandoCambiaIlDaQuando(ora - 310_000, ora), 50_000);
  assert.equal(quandoCambiaIlDaQuando(ora - 2 * 3_600_000, ora), 3_600_000);
  assert.equal(quandoCambiaIlDaQuando(ora - 30 * 86_400_000, ora), 86_400_000);
});

test("una riga senza istante non chiede nessuna sveglia", () => {
  assert.equal(quandoCambiaIlDaQuando(null, 1000), null);
  assert.equal(prossimoCambioDelDaQuando([{ da: null }, {}], 1000), null);
});

test("la sveglia la detta la riga che cambia per prima", () => {
  const ora = 1_000_000_000;
  assert.equal(
    prossimoCambioDelDaQuando([{ da: ora - 310_000 }, { da: ora - 30_000 }], ora),
    30_000,
  );
});

test("la firma del ridisegno guarda anche la scritta, non solo le righe", async () => {
  const sezione = await sorgente("../src/sections/varchi-section.js");
  assert.match(sezione, /righe\.map\(daQuandoTesto\)/);
  assert.match(sezione, /function svegliamiQuandoCambia/);
});

/* ── 4. il tasto della porta si chiama come il gesto che fa ─────────────── */

test("in Home e nelle Stanze il nome del tasto arriva dal gesto, non da una parola fissa", async () => {
  for (const dove of [
    "../src/sections/home-widgets-section.js",
    "../src/sections/rooms-page-section.js",
  ]) {
    const testo = await sorgente(dove);
    assert.match(testo, /parolaDelGesto\(/, `${dove}: la parola non arriva dal gesto`);
    assert.doesNotMatch(
      testo,
      /t\("Apri, col PIN"|t\("Apri — chiede il PIN"/,
      `${dove}: c'e' ancora una parola scritta a mano`,
    );
  }
});

/* ── 5. la pagina nuova ha la sua intestazione ──────────────────────────── */

test("la pagina delle Batterie e' nel catalogo delle intestazioni, come tutte", async () => {
  const testata = await sorgente("../src/sections/page-masthead-section.js");
  assert.match(testata, /id: "page-batterie"/);
  const voce = testata.slice(testata.indexOf('id: "page-batterie"'));
  assert.match(voce.slice(0, 300), /it: \["Batterie"/);
  assert.match(voce.slice(0, 300), /en: \["Batteries"/);
});
