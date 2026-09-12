/* «Nel caso in cui il meteo viene spostato da sotto all'intestazione crea una
 *  card più bella: la striscia così piccola e sottile non mi piace.»
 *
 * Quello che la card dice in più viene dalle previsioni, ed è la parte che si
 * prova senza un documento e senza un socket: il segno del tempo, la massima e
 * la minima di oggi, i giorni che vengono.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  SEGNI,
  giorniCheVengono,
  oggiFraMassimaEMinima,
  segnoDelTempo,
} from "../src/core/la-card-del-meteo.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const GIORNO = 24 * 60 * 60 * 1000;
const ADESSO = Date.parse("2026-09-12T14:32:00Z");

const previsione = (giorni, condizione, alta, bassa) => ({
  datetime: new Date(ADESSO + giorni * GIORNO).toISOString(),
  condition: condizione,
  temperature: alta,
  templow: bassa,
});

test("il segno del tempo è quello della condizione, e senza condizione è il sole", () => {
  assert.equal(segnoDelTempo("partlycloudy"), "⛅");
  assert.equal(segnoDelTempo("POURING"), "🌧️");
  assert.equal(segnoDelTempo("clear-night"), "🌙");
  /* Una condizione che Home Assistant inventa domani non lascia la casella
     vuota. */
  assert.equal(segnoDelTempo("meteorite"), "☀️");
  assert.equal(segnoDelTempo(""), "☀️");
  assert.ok(Object.keys(SEGNI).length >= 14);
});

test("la massima e la minima sono quelle di oggi, non della prima riga", () => {
  const previsioni = [
    previsione(1, "sunny", 26, 14),
    previsione(0, "partlycloudy", 24, 13),
    previsione(2, "rainy", 19, 12),
  ];
  assert.deepEqual(oggiFraMassimaEMinima(previsioni, ADESSO), { alta: 24, bassa: 13 });
});

test("se oggi non c'è, la riga non si scrive: meglio in meno che sbagliata", () => {
  const previsioni = [previsione(1, "sunny", 26, 14), previsione(2, "rainy", 19, 12)];
  assert.equal(oggiFraMassimaEMinima(previsioni, ADESSO), null);
  assert.equal(oggiFraMassimaEMinima([], ADESSO), null);
  assert.equal(oggiFraMassimaEMinima(null, ADESSO), null);
});

test("i giorni che vengono sono quelli dopo oggi, in ordine", () => {
  const previsioni = [
    previsione(2, "rainy", 19, 12),
    previsione(0, "partlycloudy", 24, 13),
    previsione(1, "sunny", 26, 14),
    previsione(3, "cloudy", 23, 14),
    previsione(4, "windy", 22, 13),
  ];
  const giorni = giorniCheVengono(previsioni, 4, ADESSO);
  /* Oggi sta già in cima alla card: ripeterlo nella striscia sarebbe dirlo due
     volte nello stesso riquadro. */
  assert.deepEqual(
    giorni.map((giorno) => [giorno.condizione, giorno.alta, giorno.bassa]),
    [
      ["sunny", 26, 14],
      ["rainy", 19, 12],
      ["cloudy", 23, 14],
      ["windy", 22, 13],
    ],
  );
  assert.equal(giorniCheVengono(previsioni, 2, ADESSO).length, 2);
});

test("una previsione senza data non entra, e non fa cadere il conto", () => {
  const previsioni = [{ condition: "sunny" }, previsione(1, "rainy", 19, 12)];
  assert.deepEqual(
    giorniCheVengono(previsioni, 4, ADESSO).map((giorno) => giorno.condizione),
    ["rainy"],
  );
});

test("la card è un vestito: il meteo resta uno, e i suoi nodi li scrive il guscio", () => {
  const sorgente = leggi("sections/la-card-del-meteo-section.js");
  /* Il riquadro lo possiede la sezione del meteo: qui si chiede dov'è, non lo
     si sposta né se ne fabbrica un secondo. */
  assert.match(sorgente, /import \{ rigaDellaTestata \} from "\.\/weather-in-masthead-section\.js"/);
  assert.doesNotMatch(sorgente, /createElement\("div"\)[\s\S]{0,80}weather-widget/);
  /* E vale solo in pagina: nell'intestazione la striscia resta quella che è. */
  assert.match(sorgente, /parentElement\?\.id === "page-home"/);
  assert.match(sorgente, /riga\.dataset\.dmMeteo = "card"/);
  /* Le previsioni si chiedono col riposo: sono previsioni, non misure. */
  assert.match(sorgente, /const RIPOSO = 30 \* 60 \* 1000/);
});
