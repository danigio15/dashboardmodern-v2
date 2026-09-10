/* I bidoni della differenziata sono disegnati, non a emoji.
 *
 * «Icone rifiuti non secondo lo stile del nostro catalogo: rendile omogenee e
 * creale, visto che non ci sono, ma ovviamente devono essere a colori e fatte
 * bene.»
 *
 * Erano le ultime emoji di sistema che si vedevano davvero: 🧴 📦 🍾 🍎 accanto
 * ai disegni in scocca blu notte, e il 📅 del calendario di casa nella stessa
 * lista. Adesso c'e' un disegno per ogni materiale, nella famiglia del
 * catalogo, e un calendario vero al posto dell'alias che rispondeva col
 * cronometro.
 *
 * Queste prove tengono ferme tre cose: che ogni materiale abbia il suo
 * emblema, che le schermate chiamino il disegno e non la faccina, e che gli
 * emblemi restino dentro il riquadro — perche' a ventidue pixel un simbolo che
 * sborda diventa una macchia sul bordo del bidone.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { MATERIALI, materialeDiSerie } from "../src/core/rifiuti-model.js";
import {
  MATERIALI_DISEGNATI,
  corpoDelBidone,
  disegnoDelBidone,
} from "../src/core/disegni-rifiuti.js";
import { chiaveDelDisegno, disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("ogni materiale della differenziata ha il suo emblema", () => {
  for (const voce of MATERIALI)
    assert.ok(MATERIALI_DISEGNATI.includes(voce.chiave), `manca l'emblema di ${voce.chiave}`);
  assert.equal(MATERIALI_DISEGNATI.length, MATERIALI.length);
});

test("il disegno si porta dietro il colore del materiale, non una tinta sua", () => {
  for (const voce of MATERIALI) {
    const corpo = corpoDelBidone(voce.chiave, voce.colore);
    assert.ok(
      corpo.includes(`fill="${voce.colore}"`),
      `il coperchio di ${voce.chiave} non e' del suo colore`,
    );
    assert.ok(
      corpo.includes('class="dm-art-panel"'),
      `${voce.chiave} non ha il pannello della famiglia`,
    );
  }
  /* Un materiale che non conosciamo esce lo stesso: meglio un bidone muto che
   * un buco. */
  assert.ok(corpoDelBidone("mai-visto", "#0ea5e9").includes("dm-art-panel"));
});

test("gli emblemi partono dentro la scocca, non sul bordo", () => {
  /* Nei percorsi i numeri sono quasi tutti spostamenti relativi — non si
   * possono leggere come coordinate. I punti di partenza pero' sono assoluti
   * (la M maiuscola), e cosi' i centri dei cerchi e gli angoli dei rettangoli:
   * se quelli cadono dentro la scocca l'emblema e' al suo posto. E' la prova
   * che avrebbe preso il primo giro, dove il torsolo partiva sul coperchio. */
  const DENTRO = { x: [28, 70], y: [44, 80] };
  const punti = (svg) => {
    const trovati = [];
    for (const pezzo of svg.match(/\sd="[^"]*"/g) || [])
      for (const m of pezzo.matchAll(/M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g))
        trovati.push([Number(m[1]), Number(m[2])]);
    for (const pezzo of svg.match(/<(?:rect|circle|ellipse)\b[^>]*>/g) || []) {
      const leggi = (nome) => {
        const trovato = pezzo.match(new RegExp(`\\s${nome}="(-?[\\d.]+)"`));
        return trovato ? Number(trovato[1]) : null;
      };
      const x = leggi("x") ?? leggi("cx");
      const y = leggi("y") ?? leggi("cy");
      if (x !== null && y !== null) trovati.push([x, y]);
    }
    return trovati;
  };
  for (const chiave of MATERIALI_DISEGNATI) {
    const corpo = corpoDelBidone(chiave, "#0ea5e9");
    /* L'emblema e' quello che viene dopo la linea di luce del coperchio. */
    const emblema = corpo.slice(corpo.indexOf("/>", corpo.lastIndexOf('opacity=".34"')) + 2);
    const trovati = punti(emblema);
    assert.ok(trovati.length, `${chiave}: emblema senza un punto da controllare`);
    for (const [x, y] of trovati) {
      assert.ok(x >= DENTRO.x[0] && x <= DENTRO.x[1], `${chiave}: x ${x} fuori dalla scocca`);
      assert.ok(y >= DENTRO.y[0] && y <= DENTRO.y[1], `${chiave}: y ${y} fuori dalla scocca`);
    }
  }
});

test("il disegno esce col guscio della famiglia, alla misura chiesta", () => {
  const markup = disegnoDelBidone("vetro", materialeDiSerie("vetro").colore, 40);
  assert.ok(markup.includes('data-dm-art="bidone-vetro"'));
  assert.ok(markup.includes('width="40" height="40"'));
  assert.ok(markup.includes('viewBox="0 0 96 96"'));
});

test("il catalogo ha un calendario vero, non il cronometro", () => {
  assert.equal(chiaveDelDisegno("calendar"), "calendar");
  const disegno = disegnoDelCatalogo("calendar", 40);
  assert.ok(disegno.includes('data-dm-art="calendar"'));
  /* Il cronometro e' un cerchio con le lancette: il calendario no. */
  assert.ok(!disegno.includes("M48 40v14l10 7"));
});

test("la sezione e l'editor chiamano il disegno, non la faccina", async () => {
  const sezione = await leggi("sections/rifiuti-section.js");
  const editor = await leggi("sections/rifiuti-editor-section.js");
  for (const fonte of [sezione, editor])
    assert.ok(fonte.includes("disegnoDelBidone("), "qui il bidone non e' disegnato");
  assert.ok(!sezione.includes("riga.icona || materiale.icona"), "la sezione stampa ancora l'emoji");
  assert.ok(
    sezione.includes('disegnoDelCatalogo("calendar"'),
    "il calendario di casa e' ancora un 📅",
  );
  assert.ok(!editor.includes("esc(voce.icona)"), "l'editor stampa ancora l'emoji");
  assert.ok(!editor.includes("esc(materiale.icona)"), "il menu dei turni stampa ancora l'emoji");
  assert.ok(
    !editor.includes("icona.textContent = voce.icona"),
    "cambiando materiale torna l'emoji",
  );
});
