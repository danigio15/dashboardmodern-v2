/* «Da mobile il radar non compare, da desktop sì» (#351).
 *
 * Il blocco si disegnava quando qualcuno TOCCAVA il documento: ogni clic
 * riguardava la finestra del meteo un decimo di secondo dopo. Un tocco fermato
 * per strada — e sul telefono, fra la testata e i gestori della navigazione,
 * succede — lasciava il radar senza nascere, e la finestra aperta in qualunque
 * altro modo non lo faceva nascere affatto.
 *
 * Il modulo si installa da solo appena importato e vive nel DOM: qui si legge
 * il sorgente, come le altre prove di questo radar.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(
  new URL("../src/sections/radar-meteo-section.js", import.meta.url),
  "utf8",
);

test("il radar guarda la finestra, non i tocchi sul documento", () => {
  /* La finestra dice da sola quando si apre. */
  assert.match(sorgente, /new root\.MutationObserver\(/);
  assert.match(sorgente, /attributeFilter: \["class", "style"\]/);
  /* E il giro appeso a ogni clic se n'e' andato. */
  const onClick = sorgente.slice(
    sorgente.indexOf("async function onClick("),
    sorgente.indexOf("function installStyles("),
  );
  assert.ok(onClick.length > 0, "onClick deve esistere");
  assert.doesNotMatch(onClick, /setTimeout\?\.\(guarda/);
});

test("l'osservatore si attacca una volta sola, e all'installazione", () => {
  const osserva = sorgente.slice(
    sorgente.indexOf("function osservaLaFinestra()"),
    sorgente.indexOf("/* ── la prova dell'indirizzo"),
  );
  /* Due osservatori sulla stessa finestra sarebbero due disegni per ogni
   * apertura: ci si ferma se e' gia' quella che si sta guardando. */
  assert.match(osserva, /state\.osservata === modale/);
  assert.match(osserva, /state\.osservatore\?\.disconnect\?\.\(\)/);
  const installa = sorgente.slice(sorgente.indexOf("export function installRadarMeteo("));
  assert.match(installa, /osservaLaFinestra\(\)/);
});

test("la larghezza si misura dall'impaginazione, non dal disegno animato", () => {
  const misure = sorgente.slice(
    sorgente.indexOf("function misureDelQuadro("),
    sorgente.indexOf("function daTessere("),
  );
  /* `getBoundingClientRect` durante l'animazione di apertura risponde con la
   * misura rimpicciolita: i quadratini finivano calcolati per un riquadro che
   * un istante dopo non esisteva piu'. */
  assert.match(misure, /quadro\.offsetWidth \|\|/);
  /* E il minimo del conto e' lo stesso del foglio: 213 dentro una scatola da
   * 240 e' una mappa scentrata rispetto al suo mirino. */
  assert.match(misure, /Math\.max\(ALTEZZA_MINIMA/);
  assert.match(sorgente, /const ALTEZZA_MINIMA = 240;/);
  assert.match(sorgente, /min-height:\$\{ALTEZZA_MINIMA\}px/);
});

/* «C'è ancora quella scritta sullo zoom e non mi sembra di vedere le piogge»
 * (#323): la riga sotto la mappa è quella che si chiede di mandare per capire
 * da dove arrivano i quadratini e a che livello. Quando il servizio non
 * rispondeva si usciva prima di scriverla, cioè proprio quando serviva. */
test("la riga sotto la mappa si scrive anche quando il servizio tace", () => {
  const tessere = sorgente.slice(
    sorgente.indexOf("function daTessere("),
    sorgente.indexOf("export function disegnaRadar()"),
  );
  const scritture = [...tessere.matchAll(/scriviLaNota\(/g)];
  assert.ok(scritture.length >= 3, "la nota si scrive su tutte le strade, non solo su quella buona");
  /* L'inquadratura si calcola prima di sapere se il fotogramma arriva: senza,
   * lo zoom nella riga non ci sarebbe proprio nel caso che lo richiede. */
  const doveFinestra = tessere.indexOf("const finestraTessere = finestraDiTessere(");
  const doveModello = tessere.indexOf("const modelli = modelliVivi(scelto);");
  assert.ok(doveFinestra > 0 && doveModello > doveFinestra);
});
