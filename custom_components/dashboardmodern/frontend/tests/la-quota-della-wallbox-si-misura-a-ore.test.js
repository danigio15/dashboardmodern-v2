/* «49,4 kWh da FV e 18,7 dalla rete» — e i numeri veri erano 22,8 e 45,3.
 *
 * La card non stava misurando niente: prendeva la quota di rete della CASA nel
 * mese e la incollava sui kWh dell'apparecchio. 18,7 / 68,1 = 0,2746, che è
 * esattamente la quota di rete della casa. Per un frigorifero quella copia è
 * quasi giusta; per un'auto, che si attacca la sera e stacca la mattina, è il
 * rovescio del vero — e più grossa è la ricarica, più sbaglia.
 *
 * Qui si prova che la spartizione la fanno le ore, e che le tre serie da cui
 * escono si prendono dai posti giusti.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  chiaveDellaQuota,
  entitaDelleFonti,
  secchielliNellArco,
} from "../src/sections/energy-section.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/energy-section.js", import.meta.url),
  "utf8",
);

test("la casa e la rete si prendono dai piani delle fonti", () => {
  const piani = [
    { key: "house", entity: "sensor.casa_mese", direct: true },
    { key: "house", entity: "sensor.casa_totale", direct: false },
    { key: "gridImport", entity: "sensor.rete_totale", direct: false },
    { key: "solar", entity: "sensor.fv_totale", direct: false },
  ];
  assert.deepEqual(entitaDelleFonti(piani), {
    casa: "sensor.casa_totale",
    rete: "sensor.rete_totale",
  });
});

test("senza contatore di sempre si usa l'aiutante del periodo", () => {
  const piani = [
    { key: "house", entity: "sensor.casa_mese", direct: true },
    { key: "gridImport", entity: "sensor.rete_mese", direct: true },
  ];
  assert.deepEqual(entitaDelleFonti(piani), {
    casa: "sensor.casa_mese",
    rete: "sensor.rete_mese",
  });
});

test("senza fonti configurate non si inventa niente", () => {
  assert.deepEqual(entitaDelleFonti([]), { casa: "", rete: "" });
  assert.deepEqual(entitaDelleFonti(), { casa: "", rete: "" });
});

const ORA = (giorno, ora) =>
  `2026-09-${String(giorno).padStart(2, "0")}T${String(ora).padStart(2, "0")}:00:00Z`;
const ARCO = {
  kind: "month",
  period: "hour",
  start: new Date(ORA(1, 0)),
  end: new Date(ORA(1, 4)),
};

test("i secchielli di un arco portano la crescita, non il contatore", () => {
  const righe = [
    { start: ORA(0 + 31, 23), sum: 1000 },
    { start: ORA(1, 0), sum: 1002 },
    { start: ORA(1, 1), sum: 1005 },
    { start: ORA(1, 2), sum: 1005 },
    { start: ORA(1, 3), sum: 1011 },
  ];
  /* La riga di agosto sta fuori dall'arco e fa da partenza. */
  righe[0].start = "2026-08-31T23:00:00Z";
  const secchielli = secchielliNellArco(righe, ARCO);
  assert.deepEqual(
    secchielli.map((riga) => riga.change),
    [2, 3, 0, 6],
  );
});

test("senza la riga di partenza il primo secchiello si butta, non si gonfia", () => {
  /* A grana oraria prenderlo per buono vorrebbe dire scrivere il contatore di
   * vita — mille e passa kWh — come consumo di un'ora sola. */
  const righe = [
    { start: ORA(1, 0), sum: 1002 },
    { start: ORA(1, 1), sum: 1005 },
    { start: ORA(1, 2), sum: 1011 },
  ];
  const secchielli = secchielliNellArco(righe, ARCO);
  assert.deepEqual(
    secchielli.map((riga) => riga.change),
    [3, 6],
  );
});

test("la chiave di una quota tiene insieme apparecchio e periodo", () => {
  assert.equal(
    chiaveDellaQuota("sensor.wallbox", { year: 2026, month: 9 }),
    "sensor.wallbox|2026-9",
  );
  assert.notEqual(
    chiaveDellaQuota("sensor.wallbox", { year: 2026, month: 9 }),
    chiaveDellaQuota("sensor.wallbox", { year: 2026, month: 8 }),
  );
});

test("la scheda del dispositivo non chiama più la stima della casa", () => {
  /* `splitFor` resta, come ripiego di quando le ore non ci sono, ma chi
   * disegna passa da `quotaDaScrivere`: è lì che la misura vince sulla stima. */
  assert.match(
    SORGENTE,
    /const monthSplit = quotaDaScrivere\(bundle, source, "month", monthValue\);/,
  );
  assert.match(SORGENTE, /const yearSplit = quotaDaScrivere\(bundle, source, "year", yearValue\);/);
  assert.match(SORGENTE, /scriviLaQuota\(row, quotaDaScrivere\(bundle, entity, "month", value\)\)/);
});

test("le ore si chiedono per arco e per tutte e tre le entità insieme", () => {
  assert.match(SORGENTE, /broker\.statistics\(\s*\[dispositivo, casa, rete\],/);
  assert.match(SORGENTE, /"hour",/);
});

test("una quota che i secchielli non spiegano non si scrive", () => {
  /* `fonte` vale `"secchielli"` solo quando la divisione l'hanno fatta i dati:
   * senza quel sigillo si resta sulla stima, invece di scrivere una
   * percentuale inventata come se fosse misurata. */
  assert.match(SORGENTE, /if \(mese\?\.fonte === "secchielli"\)/);
  assert.match(SORGENTE, /if \(anno\?\.fonte === "secchielli"\)/);
});

test("le ore non si chiedono se la scheda non la sta guardando nessuno", () => {
  /* Il Report si aggiorna anche a sezione chiusa — la tessera dell'Energia in
   * Home legge lo stesso pacchetto — e una domanda a ore per un anno intero
   * fatta a nessuno è il carico sul Recorder che questo conto si è impegnato a
   * non rifare. */
  assert.match(
    SORGENTE,
    /if \(!entity \|\| !schedaDelDispositivoAperta\(selettore\)\) return null;/,
  );
  assert.match(SORGENTE, /nodo\.checkVisibility\(\)/);
});

test("una quota misurata non si rimisura a ogni giro", () => {
  /* Sono ore di statistiche, e il numero di un periodo chiuso non cambia più. */
  assert.match(
    SORGENTE,
    /if \(state\.quote\.has\(chiave\) \|\| state\.quoteInCorso\.has\(chiave\)\)/,
  );
  /* Ma se cambia la configurazione cambia anche chi è la casa e chi è la rete. */
  assert.match(SORGENTE, /state\.quote\.clear\(\);/);
});
