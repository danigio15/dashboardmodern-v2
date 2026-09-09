/* Il picco stampava «26.37 kWh» accanto a «68,1 kWh».
 *
 * Nella stessa card, tre riquadri in fila: «68,1 kWh questo mese», «2,27 kWh
 * media giornaliera», «26.37 kWh picco». Un punto in mezzo a delle virgole.
 * Il numero era giusto, la lingua no — e un punto decimale dove si aspetta una
 * virgola non e' un dettaglio: si legge come un separatore delle migliaia.
 *
 * Lo scriveva il guscio storico con `toFixed(2)`, che non sa in che lingua si
 * parla. Adesso lo scrive il modulo, con lo stesso formattatore degli altri
 * due numeri, e lo scrive DOPO il guscio: il nostro risveglio e' agganciato al
 * `finally` della promessa di `edCaricaDettaglio`, quindi e' un ordine e non
 * una corsa.
 *
 * La serie dei giorni non costa una domanda in piu': la risposta del Recorder
 * per un arco mensile arriva a giorni comunque, e prima la si riduceva a un
 * totale buttando via il resto.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ilGiornoDelPicco } from "../src/core/period-service.js";

/* I giorni dello screenshot: settembre, con il 7 a ventisei e trentasette. */
const giorno = (numero, change) => ({
  start: new Date(2026, 8, numero).toISOString(),
  change,
});
const SETTEMBRE = [giorno(3, 5.6), giorno(4, 12), giorno(5, 9.6), giorno(6, 13), giorno(7, 26.37)];

test("il picco e' il giorno che ha consumato piu' di tutti, e si sa quale", () => {
  const picco = ilGiornoDelPicco(SETTEMBRE);
  assert.equal(picco.quanto, 26.37);
  assert.equal(picco.quando.getDate(), 7);
  assert.equal(picco.quando.getMonth() + 1, 9);
});

test("esce il dato, non la scritta: il separatore lo mette chi disegna", () => {
  const picco = ilGiornoDelPicco(SETTEMBRE);
  /* La regola non sa niente di lingue: torna un numero. Ed e' per questo che
   * la virgola puo' arrivarci — con `toFixed` non poteva. */
  assert.equal(typeof picco.quanto, "number");
  assert.equal(
    picco.quanto.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    "26,37",
  );
  assert.equal((26.37).toFixed(2), "26.37");
});

test("un mese senza consumo non ha un picco, e non si inventa uno zero", () => {
  assert.equal(ilGiornoDelPicco([]), null);
  assert.equal(ilGiornoDelPicco([giorno(1, 0), giorno(2, 0)]), null);
  /* Un consumo negativo e' un contatore che e' tornato indietro, non un picco. */
  assert.equal(ilGiornoDelPicco([giorno(1, -4)]), null);
});

test("una serie che non e' una serie non produce un NaN nel riquadro", () => {
  assert.equal(ilGiornoDelPicco(undefined), null);
  assert.equal(ilGiornoDelPicco(null), null);
  assert.equal(ilGiornoDelPicco([{ change: "tanto" }]), null);
  assert.equal(ilGiornoDelPicco("settembre"), null);
});

test("a pari consumo vince il primo, cosi' il numero non balla fra due giri", () => {
  const picco = ilGiornoDelPicco([giorno(2, 10), giorno(5, 10)]);
  assert.equal(picco.quando.getDate(), 2);
});

test("il riquadro del picco passa dal formattatore, e i giorni arrivano col mese", async () => {
  const sezione = await readFile(
    new URL("../src/sections/energy-section.js", import.meta.url),
    "utf8",
  );
  assert.match(
    sezione,
    /const picco = ilGiornoDelPicco\(bundle\.deviceMonthDays\?\.get\(source\)\);/,
  );
  assert.match(
    sezione,
    /setText\("ed-dkpi-picco", `\$\{formatNumber\(picco\.quanto, 2\)\} kWh`\);/,
  );
  /* I giorni si chiedono solo per il mese dei dispositivi: tenerli per tutti i
   * periodi vorrebbe dire portarsi dietro trecento righe per ogni misura. */
  assert.match(sezione, /conIGiorni: lettura === letture\.dispMonth,/);
  assert.match(sezione, /deviceMonthDays: giorniPerEntita\(/);
});

test("il Recorder non viene interrogato una seconda volta per il picco", async () => {
  const sezione = await readFile(
    new URL("../src/sections/energy-section.js", import.meta.url),
    "utf8",
  );
  /* La serie arriva dalla stessa risposta del totale del mese: una chiamata
   * sola a `valoriPerArchi`, come prima. */
  assert.equal((sezione.match(/broker\.valoriPerArchi\(/g) || []).length, 1);
  assert.doesNotMatch(sezione, /statistics\([^)]*"day"[^)]*\)[^;]*picco/i);
});
