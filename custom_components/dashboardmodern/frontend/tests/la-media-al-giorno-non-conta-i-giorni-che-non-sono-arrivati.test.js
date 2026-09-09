/* «Consumi sbagliati»: la media al giorno divideva per il mese intero.
 *
 * Nello screenshot della sezione Energia: 68,1 kWh questo mese, e sotto
 * «MEDIA GIORNALIERA 2,27 kWh». Era il 9 settembre, e 68,1 diviso trenta fa
 * esattamente 2,27. Il vero era 7,57 — 68,1 diviso i nove giorni passati —
 * e chi lo leggeva vedeva un terzo del suo consumo.
 *
 * I ventun giorni che non sono ancora arrivati non hanno consumato niente.
 * Metterli al denominatore non fa una media, fa una previsione per difetto.
 *
 * Il guscio storico questo conto lo faceva giusto: `daysElapsed` era
 * `now.getDate()` sul mese in corso. E' la nostra passata canonica, che gli
 * scrive sopra lo stesso riquadro, ad averlo perso. Per questo la regola
 * adesso sta in una funzione pura, dove una prova la puo' tenere ferma.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { giorniPerLaMedia } from "../src/core/period-service.js";

/* Il 9 settembre 2026, il giorno dello screenshot. */
const QUEL_GIORNO = new Date(2026, 8, 9);

test("sul mese in corso si divide per i giorni passati, non per quelli del mese", () => {
  assert.equal(giorniPerLaMedia(2026, 9, QUEL_GIORNO), 9);
  /* Il numero della segnalazione, rifatto: prima 2,27, adesso 7,57. */
  const consumo = 68.1;
  assert.equal((consumo / giorniPerLaMedia(2026, 9, QUEL_GIORNO)).toFixed(2), "7.57");
  assert.equal((consumo / new Date(2026, 9, 0).getDate()).toFixed(2), "2.27");
});

test("il primo del mese si divide per uno, non per zero e non per il mese", () => {
  /* Il caso che rompe chi «conta i giorni passati» sottraendo: il giorno uno
   * e' un giorno, e la media del primo giorno e' tutto quello che si e'
   * consumato. */
  assert.equal(giorniPerLaMedia(2026, 9, new Date(2026, 8, 1)), 1);
});

test("un mese finito porta i suoi giorni, e il febbraio bisestile ne ha ventinove", () => {
  assert.equal(giorniPerLaMedia(2026, 8, QUEL_GIORNO), 31);
  assert.equal(giorniPerLaMedia(2025, 2, QUEL_GIORNO), 28);
  assert.equal(giorniPerLaMedia(2024, 2, QUEL_GIORNO), 29);
  assert.equal(giorniPerLaMedia(2025, 12, QUEL_GIORNO), 31);
});

test("un mese che non e' ancora cominciato non ha giorni da dividere", () => {
  /* Non si divide per zero e non si inventa un numero: si risponde zero, e
   * chi scrive nel riquadro mette un trattino. */
  assert.equal(giorniPerLaMedia(2026, 10, QUEL_GIORNO), 0);
  assert.equal(giorniPerLaMedia(2027, 1, QUEL_GIORNO), 0);
});

test("una data che non e' una data non produce un NaN nel riquadro", () => {
  assert.equal(giorniPerLaMedia(undefined, undefined, QUEL_GIORNO), 0);
  assert.equal(giorniPerLaMedia("settembre", "2026", QUEL_GIORNO), 0);
});

test("il riquadro della media usa la regola, e a zero giorni scrive un trattino", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/energy-section.js", import.meta.url),
    "utf8",
  );
  /* Non piu' «i giorni del mese»: la regola, per nome. */
  assert.match(sorgente, /const days = giorniPerLaMedia\(selectedYear, selectedMonth\);/);
  assert.doesNotMatch(sorgente, /const days = new Date\(selectedYear, selectedMonth, 0\)/);
  assert.match(
    sorgente,
    /setText\("ed-dkpi-media", days \? `\$\{formatNumber\(monthValue \/ days, 2\)\} kWh` : "—"\);/,
  );
});
