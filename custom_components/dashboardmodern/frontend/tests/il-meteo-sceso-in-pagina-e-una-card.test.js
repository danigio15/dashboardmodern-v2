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

/* Scesa in pagina porta le vesti delle altre card.
 *
 * «Contorno meteo non uguale alle altre card.» In pagina la card indossava
 * ancora le vesti della striscia — fondo `--surface-2`, filo di bordo, nessuna
 * ombra, e il bordo che si scalda d'accento al passaggio: fra le carte della
 * Home si vedeva una fascia pallina appoggiata sopra. Le vesti sono quelle
 * della plancia, le stesse delle persone: carta, bordo e ombra scolpita. */
test("la card scesa in pagina si veste come le altre card", () => {
  const card = leggi("sections/la-card-del-meteo-section.js");
  const blocco = card.slice(
    card.indexOf('body .dm-testata-riga[data-dm-meteo="card"]{'),
    card.indexOf('body .dm-testata-riga[data-dm-meteo="card"]>.weather-widget'),
  );
  assert.match(blocco, /background:var\(--card-bg,#fff\)/);
  assert.match(blocco, /border:1px solid var\(--card-border,#e8edf3\)/);
  assert.match(blocco, /box-shadow:var\(--shadow-sculpted,/);
  /* E si alza al passaggio, invece di tingersi d'accento come la fascia. */
  assert.match(card, /\[data-dm-meteo="card"\]:hover\{\s*transform:translateY\(-4px\);/);
  /* Le vesti della striscia non arrivano piu' fino a qui: non si scavalcano,
     non valgono. */
  const striscia = leggi("sections/weather-in-masthead-section.js");
  assert.match(
    striscia,
    /body \.dm-testata-riga:not\(\[data-dm-meteo="card"\]\)\{\s*padding:6px 12px/,
  );
  assert.match(striscia, /body \.dm-testata-riga:not\(\[data-dm-meteo="card"\]\):hover\{/);
  assert.doesNotMatch(striscia, /body \.dm-testata-riga\{[^}]*background:var\(--surface-2/);
});

/* Manca vuol dire manca, non zero.
 *
 * `Number(null)` e `Number("")` fanno entrambi zero, e zero e' un numero
 * finito: un provider che per la minima di un giorno pubblica `null` — capita,
 * e capita a giorni alterni sullo stesso — si vedeva disegnato come `0°`. Una
 * previsione di gelo inventata e' peggio di mezza forbice che manca. */
test("una massima o una minima vuota non diventa zero gradi", () => {
  const previsioni = [
    { datetime: "2026-09-13T00:00:00+00:00", condition: "sunny", temperature: 24, templow: null },
    { datetime: "2026-09-14T00:00:00+00:00", condition: "rainy", temperature: "", templow: 11 },
  ];
  const [primo, secondo] = giorniCheVengono(previsioni, 2, Date.parse("2026-09-12T09:00:00Z"));
  assert.equal(primo.alta, 24);
  assert.equal(primo.bassa, null, "la minima non c'e', e non e' zero");
  assert.equal(secondo.alta, null, "nemmeno la massima vuota");
  assert.equal(secondo.bassa, 11);
});
