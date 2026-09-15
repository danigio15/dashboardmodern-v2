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
  mesiDellArco,
  periodoInCorso,
  quotaDaRifare,
  quotaSuArchi,
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

test("le ore si chiedono per mese e per tutte e tre le entità insieme", () => {
  assert.match(SORGENTE, /leggiLeOre\(\[dispositivo, casa, rete\], pezzo, unita\)/);
  assert.match(
    SORGENTE,
    /broker\.statistics\(entita, baseline\.start, pezzo\.end, "hour", unita\)/,
  );
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
    /if \(state\.quoteInCorso\.has\(chiave\)\) return state\.quote\.get\(chiave\);/,
  );
  assert.match(SORGENTE, /if \(gia && !quotaDaRifare\(gia, bundle\.period, adesso\)\) return gia;/);
  /* Ma se cambia la configurazione cambia anche chi è la casa e chi è la rete. */
  assert.match(SORGENTE, /state\.quote\.clear\(\);/);
});

test("il mese in corso, però, si rimisura: continua a riempirsi", () => {
  const settembre = { year: 2026, month: 9 };
  const agosto = { year: 2026, month: 8 };
  const adesso = new Date(2026, 8, 11, 2, 0);
  const appena = { quando: adesso.getTime() - 60_000 };
  const vecchia = { quando: adesso.getTime() - 60 * 60_000 };

  assert.equal(periodoInCorso(settembre, adesso), true);
  assert.equal(periodoInCorso(agosto, adesso), false);

  assert.equal(quotaDaRifare(appena, settembre, adesso), false, "misurata da poco: va bene");
  assert.equal(quotaDaRifare(vecchia, settembre, adesso), true, "di un'ora fa: si rifà");
  assert.equal(
    quotaDaRifare(vecchia, agosto, adesso),
    false,
    "un mese chiuso non cambia più: si tiene per sempre",
  );
  assert.equal(quotaDaRifare(null, settembre, adesso), true);
  assert.equal(quotaDaRifare({}, settembre, adesso), true, "senza data non si sa: si rifà");
});

test("la riga sotto somma sempre al numero grande, anche se la misura è di stamattina", () => {
  /* Dei kWh misurati stamattina resterebbero quelli di stamattina, e la riga
   * sotto smetterebbe di sommare al totale scritto sopra: due numeri sulla
   * stessa riga che si contraddicono. Si tiene la FRAZIONE e la si rimoltiplica
   * per il numero che si sta scrivendo. */
  assert.match(SORGENTE, /if \(misurata && Number\.isFinite\(misurata\.quotaRete\)\)/);
  assert.match(SORGENTE, /grid: valore \* rete, solar: valore \* \(1 - rete\)/);
});

/* ── L'anno non è una domanda sola ──────────────────────────────────────────
 *
 * Seconda puntata della stessa segnalazione, con la foto della scheda sotto
 * gli occhi: sulla Wallbox il MESE diceva 54,9 kWh dal sole e 80,5 dalla rete
 * — il 59,5% dalla rete, che è quello che fa una macchina attaccata la sera —
 * e l'ANNO, tre centimetri più sotto, 473,4 dal sole e 139,9 dalla rete, cioè
 * il 22,8% dalla rete. Lo stesso apparecchio, la stessa card, due numeri che
 * non possono essere veri insieme.
 *
 * Il mese era misurato ora per ora. L'anno no: le sue ore si chiedevano in una
 * domanda sola da gennaio a oggi — seimila righe per entità, diciottomila in
 * una risposta — e quando quella domanda cadeva cadeva l'anno intero, e la
 * card tornava a incollarci sopra la media della casa senza dirlo.
 */

test("l'anno si chiede un mese per volta, non in un colpo solo", () => {
  const pezzi = mesiDellArco({
    kind: "year",
    period: "day",
    start: new Date(2026, 0, 1),
    end: new Date(2026, 8, 1),
  });
  assert.equal(pezzi.length, 8, "da gennaio ad agosto");
  assert.deepEqual(
    pezzi.map((pezzo) => pezzo.start.getMonth()),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  /* Ogni pezzo finisce dove comincia il successivo, e l'ultimo sul confine. */
  pezzi.forEach((pezzo, indice) => {
    const dopo = pezzi[indice + 1];
    assert.equal(pezzo.end.getTime(), dopo ? dopo.start.getTime() : new Date(2026, 8, 1).getTime());
    /* Un mese, non un anno: è quello che decide la linea di base, e quella di
     * un mese guarda due giorni indietro invece di un mese. */
    assert.equal(pezzo.kind, "month");
    assert.equal(pezzo.period, "hour");
  });
});

test("un pezzo di mese resta un pezzo, e un arco vuoto non è niente", () => {
  const aperto = mesiDellArco({
    kind: "month",
    start: new Date(2026, 8, 1),
    end: new Date(2026, 8, 15, 14, 0),
  });
  assert.equal(aperto.length, 1);
  assert.equal(aperto[0].end.getTime(), new Date(2026, 8, 15, 14, 0).getTime());

  /* Un arco che comincia a metà mese: il primo pezzo arriva al primo del mese
   * dopo, non a trenta giorni da lì. */
  const storto = mesiDellArco({ start: new Date(2026, 6, 20), end: new Date(2026, 8, 5) });
  assert.deepEqual(
    storto.map((pezzo) => [pezzo.start.getTime(), pezzo.end.getTime()]),
    [
      [new Date(2026, 6, 20).getTime(), new Date(2026, 7, 1).getTime()],
      [new Date(2026, 7, 1).getTime(), new Date(2026, 8, 1).getTime()],
      [new Date(2026, 8, 1).getTime(), new Date(2026, 8, 5).getTime()],
    ],
  );

  assert.deepEqual(mesiDellArco({ start: new Date(2026, 8, 1), end: new Date(2026, 8, 1) }), []);
  assert.deepEqual(mesiDellArco({ start: new Date(2026, 8, 5), end: new Date(2026, 8, 1) }), []);
  assert.deepEqual(mesiDellArco(), []);
});

/* Le tre serie di un mese finto: l'apparecchio tira solo di notte, la casa
 * consuma sempre, e la rete copre tutto di notte e niente di giorno. Le righe
 * sono cumulate, perché è così che risponde il Recorder. */
function mesePerLaProva(anno, mese, giorni, kwhDiNotte) {
  const righe = { disp: [], casa: [], rete: [] };
  let disp = 100;
  let casa = 1000;
  let rete = 500;
  /* La riga di partenza, un'ora prima del mese: senza, il primo secchiello si
   * butta (ed è giusto che si butti). */
  const partenza = new Date(anno, mese, 1, -1);
  righe.disp.push({ start: partenza.toISOString(), sum: disp });
  righe.casa.push({ start: partenza.toISOString(), sum: casa });
  righe.rete.push({ start: partenza.toISOString(), sum: rete });
  for (let giorno = 1; giorno <= giorni; giorno += 1) {
    for (let ora = 0; ora < 24; ora += 1) {
      const notte = ora < 6 || ora >= 22;
      disp += notte ? kwhDiNotte : 0;
      casa += 1;
      rete += notte ? 1 : 0;
      const quando = new Date(anno, mese, giorno, ora).toISOString();
      righe.disp.push({ start: quando, sum: disp });
      righe.casa.push({ start: quando, sum: casa });
      righe.rete.push({ start: quando, sum: rete });
    }
  }
  return righe;
}

test("un mese che non arriva costa le sue ore, non l'anno intero", async () => {
  /* Gennaio e febbraio, a ore. L'apparecchio tira solo di notte, e di notte la
   * casa prende tutto dalla rete: la spartizione vera è il 100% dalla rete. */
  const GENNAIO = mesePerLaProva(2026, 0, 31, 2);
  const FEBBRAIO = mesePerLaProva(2026, 1, 28, 2);
  const arco = { kind: "year", start: new Date(2026, 0, 1), end: new Date(2026, 2, 1) };
  const totale = (31 + 28) * 8 * 2;

  const rispostaDi = (pezzo) => {
    const righe = pezzo.start.getMonth() === 0 ? GENNAIO : FEBBRAIO;
    return {
      "sensor.wallbox": righe.disp,
      "sensor.casa": righe.casa,
      "sensor.rete": righe.rete,
    };
  };

  const tutto = await quotaSuArchi(
    [arco],
    "sensor.wallbox",
    "sensor.casa",
    "sensor.rete",
    {},
    totale,
    async (_entita, pezzo) => rispostaDi(pezzo),
  );
  assert.equal(tutto.fonte, "secchielli", "due mesi su due: si misura");
  assert.equal(Math.round(tutto.quotaRete * 100), 100, "di notte viene tutto dalla rete");
  assert.equal(Math.round(tutto.grid), totale);

  /* Ora febbraio non risponde. Prima questa sola caduta portava giù l'anno
   * intero — l'`await` non era riparato e l'eccezione usciva dalla funzione. */
  const mezzo = await quotaSuArchi(
    [arco],
    "sensor.wallbox",
    "sensor.casa",
    "sensor.rete",
    {},
    totale,
    async (_entita, pezzo) => {
      if (pezzo.start.getMonth() === 1) throw new Error("Recorder lento");
      return rispostaDi(pezzo);
    },
  );
  /* Gennaio è arrivato, ed è più della metà del periodo ma non i tre quarti:
   * il guardiano della copertura dice che non basta, e lo dice invece di
   * spacciare per misurata la metà che c'è. */
  assert.equal(mezzo.fonte, "", "mezzo anno non è l'anno");
  assert.ok(mezzo.coperto > 0, "quello che è arrivato si conta lo stesso");
  assert.ok(mezzo.coperto < totale);
});

test("una spartizione dice da quale strada è arrivata", () => {
  /* «Una percentuale inventata scritta come se fosse misurata è il difetto che
   * questo modulo esiste per non rifare»: sta scritto in testa a
   * `quota-solare-del-dispositivo.js`, e lascia a chi chiama il compito di
   * ripiegare sulla stima DICENDO che è una stima. Non lo diceva. */
  assert.match(SORGENTE, /solar: valore \* \(1 - rete\), misurata: true/);
  assert.match(SORGENTE, /\.\.\.splitFor\(bundle\?\.\[quale\], valore\), misurata: false/);
  /* E la riga si scrive sotto TUTTI E DUE i blocchi, non solo sotto quello che
   * ha sbagliato: due blocchi che dicono la stessa cosa si strutturano uguali. */
  assert.match(SORGENTE, /scriviLaStrada\("ed-dkpi-risp-eur", monthSplit\.misurata\)/);
  assert.match(SORGENTE, /scriviLaStrada\("ed-dkpi-anno-risp-eur", yearSplit\.misurata\)/);
});
