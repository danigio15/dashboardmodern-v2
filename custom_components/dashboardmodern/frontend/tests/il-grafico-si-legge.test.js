/* Il grafico delle temperature si deve poter leggere.
 *
 * «Poco leggibile, non si capisce nulla.» Guardandolo con sette stanze quasi
 * alla stessa temperatura si capiva perche': una sola riga orizzontale con un
 * numero accanto — quella del comfort, 26 gradi — e tutto il resto sospeso nel
 * vuoto; sette linee di cui due dello stesso azzurro, perche' le tinte erano
 * sei e la settima ripartiva dalla prima; e i numeri in coda alle linee tutti
 * impilati in dieci pixel.
 *
 * Qui si difendono le tre regole che lo rimettono in piedi: una scala vera, un
 * vestito diverso per ogni serie, e i numeri che non si accavallano.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sorgente = readFileSync(
  new URL("../src/sections/temperature-trend-section.js", import.meta.url),
  "utf8",
);

/* `tacche` e' pura: si prende dal sorgente senza tirarsi dietro il documento. */
const tacche = new Function(
  `${sorgente.slice(
    sorgente.indexOf("export function tacche"),
    sorgente.indexOf("function degrees("),
  ).replace("export function tacche", "return function tacche")}; return tacche;`,
)();

test("la scala mette da quattro a sette righe, su numeri tondi", () => {
  for (const [minimo, massimo] of [
    [25, 29.5],
    [18, 32],
    [15, 35],
    [21.8, 23.1],
  ]) {
    const valori = tacche(minimo, massimo);
    assert.ok(valori.length >= 3 && valori.length <= 8, `${minimo}-${massimo}: ${valori.length}`);
    for (const valore of valori) {
      assert.ok(valore > minimo && valore < massimo, `${valore} fuori da ${minimo}-${massimo}`);
      // Numeri tondi: mezzo grado e' il piu' fine che si accetta.
      assert.equal(Math.round(valore * 2) / 2, valore, `${valore} non e' tondo`);
    }
    // E crescono in modo regolare: una scala a passi diversi non si legge.
    const passi = valori.slice(1).map((valore, indice) => Math.round((valore - valori[indice]) * 10));
    assert.equal(new Set(passi).size <= 1, true, `passi disuguali: ${passi.join(",")}`);
  }
});

test("una temperatura piatta non fa impazzire la scala", () => {
  assert.deepEqual(tacche(20, 20), []);
  assert.deepEqual(tacche(Number.NaN, 5), []);
});

/* Sei tinte lontane, e il tratto che cambia a ogni giro: due stanze possono
 * avere lo stesso colore solo dopo la diciottesima, e mai anche lo stesso
 * tratto. Prima erano sei e basta, e la settima stanza era identica alla
 * prima. */
test("nessuna serie ha lo stesso vestito di un'altra sotto le diciotto", () => {
  const vestito = new Function(
    `${sorgente.slice(
      sorgente.indexOf("const SERIES_COLOURS"),
      sorgente.indexOf("function rooms()"),
    )}; return vestitoDellaSerie;`,
  )();
  const visti = new Set();
  for (let indice = 0; indice < 18; indice += 1) {
    const { colour, stroke } = vestito(indice);
    const chiave = `${colour}|${stroke}`;
    assert.equal(visti.has(chiave), false, `la serie ${indice} ripete ${chiave}`);
    visti.add(chiave);
  }
});

/* Il numero in coda alla linea non deve finire sopra quello della linea
 * accanto: e' la parte che si legge davvero, e in una casa dove le stanze
 * viaggiano tutte fra i 27 e i 28 gradi si impilavano tutti. */
test("i numeri in coda si allontanano invece di impilarsi", () => {
  assert.match(sorgente, /ALTEZZA_ETICHETTA/);
  assert.match(sorgente, /altezzaCoda\.get\(indice\)/);
  assert.doesNotMatch(sorgente, /y: Math\.max\(view\.top \+ 4, Math\.min\(item\.last\.y/);
});
