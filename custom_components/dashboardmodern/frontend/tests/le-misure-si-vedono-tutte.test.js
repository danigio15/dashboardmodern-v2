/* «Quando si apre la scheda batterie, oltre a mostrare quelle più scariche, ci
 * fosse un tasto mostra tutto come per la sezione luci» (#376).
 *
 * La finestra di una tessera taglia le misure a dodici. È un taglio giusto —
 * oltre, la scheda smette di essere un riassunto e diventa un elenco — ma era
 * muto: chi ha venticinque batterie ne vedeva dodici e non aveva modo di
 * sapere che le altre esistevano. Adesso il taglio lo dice, e il tasto lo
 * scavalca; e vale per ogni scheda che nasconde qualcosa, non per le batterie
 * sole, perché il taglio è uno solo.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sorgente = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "home-widgets-section.js"),
  "utf8",
);

test("il taglio delle misure ha un nome, e non e' scritto a mano due volte", () => {
  assert.match(sorgente, /const MISURE_IN_VISTA = 12;/);
  /* Il numero non si ripete: chi taglia e chi riscopre guardano lo stesso. */
  const usi = sorgente.match(/MISURE_IN_VISTA/g) || [];
  assert.ok(usi.length >= 3, `il taglio si usa in ${usi.length} punti`);
  assert.doesNotMatch(sorgente, /\.slice\(0, 12\)/);
});

test("le caselle oltre il taglio ci sono, nascoste, e un tasto le scopre", () => {
  const funzione = sorgente.slice(
    sorgente.indexOf("function caselleDelleMisure(widget)"),
    sorgente.indexOf("/* La corsa della misura"),
  );
  /* Non si buttano via: si scrivono e si nascondono, cosi' il tasto non deve
   * ridisegnare la finestra per farle comparire. */
  assert.match(funzione, /indice >= MISURE_IN_VISTA \? " hidden" : ""/);
  assert.match(sorgente, /data-dm-w-tutte-misure="\$\{esc\(chiave\)\}"/);
  /* Senza niente da nascondere il tasto non c'e': un tasto che non fa niente
   * e' peggio di nessun tasto. */
  assert.match(funzione, /oltre \? tastoMostraTutte/);
  assert.match(sorgente, /Mostra tutte/);
  assert.match(sorgente, /Mostra solo le prime/);
});

/* Lo stesso taglio, e lo stesso tasto, valgono per le pillole dello stato:
 * sono l'altro elenco della stessa finestra, ed erano tagliate a dodici in
 * silenzio esattamente come le misure. Una casa con venti porte le deve poter
 * vedere tutte. */
test("anche le pillole dello stato dicono quello che nascondono", () => {
  const funzione = sorgente.slice(
    sorgente.indexOf("function pilloleDelloStato(widget)"),
    sorgente.indexOf("/* Le righe di sola lettura, fatte caselle."),
  );
  assert.match(funzione, /indice >= MISURE_IN_VISTA \? " hidden" : ""/);
  assert.match(funzione, /oltre \? tastoMostraTutte/);
  assert.doesNotMatch(funzione, /\.slice\(0, 12\)/);
  /* Le due liste della stessa scheda si aprono separatamente. */
  assert.match(sorgente, /chiaveDellElenco\(widget, "stato"\)/);
  assert.match(sorgente, /chiaveDellElenco\(widget, "misure"\)/);
});

test("la scelta di vedere tutto sopravvive al ridisegno", () => {
  /* Il corpo della finestra si riscrive a ogni giro di stati: se l'apertura
   * stesse solo nel documento, si richiuderebbe da sola. */
  assert.match(sorgente, /function misureAperte\(\)/);
  assert.match(sorgente, /state\.tutteLeMisure \|\|= new Set\(\)/);
  const gesto = sorgente.slice(sorgente.indexOf('closest?.("[data-dm-w-tutte-misure]")'));
  assert.match(gesto.slice(0, 900), /misureAperte\(\)\.add\(chiave\)/);
  assert.match(gesto.slice(0, 900), /misureAperte\(\)\.delete\(chiave\)/);
});

test("il [hidden] delle caselle vince sulla griglia che le disegna", () => {
  /* `.dm-w-casella` e' `display:grid`, e `[hidden]` da solo perde: senza una
   * regola piu' specifica le caselle nascoste resterebbero in vista. */
  assert.match(sorgente, /\.dm-w-caselle \.dm-w-casella\[hidden\],/);
  assert.match(sorgente, /\.dm-w-pillole \.dm-w-pillola\[hidden\]\{display:none\}/);
});
