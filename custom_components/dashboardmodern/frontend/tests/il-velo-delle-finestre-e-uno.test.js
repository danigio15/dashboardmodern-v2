/* «Se apro alcune card come quella persona sullo sfondo resta la dash sfocata;
 *  se apro tutte le altre invece lo sfondo è nero.» (#522)
 *
 * Non è il difetto di una finestra: è che il velo era scritto ogni volta da
 * capo, e ogni volta con numeri diversi. Il guscio storico copre all'85% sul
 * chiaro e all'82% sullo scuro con venti pixel di sfocatura — a quell'opacità
 * la plancia dietro non si distingue più, e si legge «nero». Quella della
 * persona copriva al 55% con sei pixel: la plancia dietro si vedeva eccome.
 *
 * Adesso il velo è uno e si scrive in un posto solo. Le due cose da difendere
 * sono che resti uno, e che sia quello giusto: allinearsi al guscio vuol dire
 * che non cambia niente per nessuno tranne che per la finestra che stonava.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { VELO_DELLE_FINESTRE, tokenDelVelo } from "../src/core/il-velo-delle-finestre.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

test("il velo prende i suoi due numeri dai token, non dal codice di chi lo porta", () => {
  /* Se il fondo o la sfocatura fossero scritti dentro la regola, cambiarli
   * vorrebbe dire ritoccare ogni finestra: è esattamente com'è nato il
   * difetto. */
  assert.match(VELO_DELLE_FINESTRE, /background:var\(--dm-velo-fondo\)/);
  assert.match(VELO_DELLE_FINESTRE, /backdrop-filter:blur\(var\(--dm-velo-sfocatura\)\)/);
  assert.match(VELO_DELLE_FINESTRE, /-webkit-backdrop-filter:blur\(var\(--dm-velo-sfocatura\)\)/);
  /* E non si porta dietro le misure di chi lo usa: raggio, imbottitura e
   * impilamento sono della finestra. */
  assert.doesNotMatch(VELO_DELLE_FINESTRE, /z-index|padding|border-radius/);
});

test("e i numeri sono quelli del guscio, in tutti e due i temi", () => {
  const token = tokenDelVelo(".prova");
  /* Alla lettera quelli di `.modal-wrapper` nel foglio storico: è il velo che
   * chi usa la plancia vede quasi ogni volta che apre qualcosa. */
  assert.match(
    token,
    /\.prova\{\s*--dm-velo-fondo:rgba\(230,235,241,\.85\);\s*--dm-velo-sfocatura:20px\}/,
  );
  assert.match(token, /html\[data-theme="dark"\] \.prova/);
  assert.match(token, /--dm-velo-fondo:rgba\(8,12,22,\.82\)\}/);

  /* E il foglio storico dice ancora quei numeri: il giorno che li cambia,
   * questa prova lo dice invece di lasciare la plancia con due veli. */
  for (const foglio of [
    "../legacy/dashboard-runtime-it.css",
    "../legacy/dashboard-runtime-en.css",
  ]) {
    const css = leggi(foglio);
    assert.ok(
      css.includes("background: rgba(230, 235, 241, 0.85)"),
      `${foglio} non ha più il velo chiaro del guscio`,
    );
    assert.ok(
      css.includes('html[data-theme="dark"] .modal-wrapper { background: rgba(8, 12, 22, 0.82); }'),
      `${foglio} non ha più il velo scuro del guscio`,
    );
  }
});

test("la finestra della persona porta il velo di tutti", () => {
  const sorgente = leggi("../src/sections/people-section.js");
  assert.match(sorgente, /\$\{tokenDelVelo\("\.dm-person-pop-overlay"\)\}/);
  assert.match(sorgente, /\.dm-person-pop-overlay\{\$\{VELO_DELLE_FINESTRE\}/);
  /* E non ha più i suoi numeri: era il velo più trasparente della plancia. */
  assert.doesNotMatch(sorgente, /rgba\(9,14,24,\.55\)/);
  assert.doesNotMatch(sorgente, /\.dm-person-pop-overlay\{[^}]*backdrop-filter:blur\(6px\)/);
});
