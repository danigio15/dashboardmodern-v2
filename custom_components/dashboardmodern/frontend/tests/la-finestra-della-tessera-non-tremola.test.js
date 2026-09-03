/* «Verifica di nuovo problema flicker su apertura widget.»
 *
 * Nel video la finestra aperta perde per due o tre centesimi la card bianca e
 * la sua testata — resta il solo corpo, sospeso sul fondale sfocato — e poi
 * torna. Più volte al secondo, su due tessere diverse.
 *
 * Non era il disegno che si rifaceva: era il compositore. Chiedendo a Chromium
 * l'elenco degli strati, con la finestra aperta, il velo risultava un unico
 * strato grande quanto lo schermo, e ci stavano dipinte dentro la card e la
 * testata; il corpo, che scorre, aveva uno strato suo. Lo sfocato obbliga a
 * rifare quello strato ogni volta che dietro si muove qualcosa — e dietro si
 * muovevano nove animazioni infinite che nessuno poteva vedere. Quando un
 * fotogramma arriva prima che il ridisegno sia finito, di quello strato non
 * c'è niente: card e testata spariscono, il corpo resta.
 *
 * Queste prove tengono ferme le due cose che lo chiudono: il velo è un
 * elemento suo e la card gli è sorella, e dietro un velo non si muove niente.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SORGENTE = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

test("lo sfocato sta su un elemento suo, non sulla finestra che contiene la card", () => {
  /* Chi ha `backdrop-filter` diventa una superficie a sé, e tutto quello che
   * gli sta dentro ci viene dipinto insieme: la card non deve starci. */
  assert.match(
    SORGENTE,
    /#dm-widget-popup::before\{[\s\S]{0,220}backdrop-filter:blur\(20px\)/,
    "il velo sfocato deve essere il ::before",
  );
  /* E la finestra stessa non sfoca più niente. */
  const regola = SORGENTE.match(/\n#dm-widget-popup\{[^}]*\}/)?.[0] || "";
  assert.ok(regola, "la regola della finestra deve esistere");
  assert.doesNotMatch(regola, /backdrop-filter/, "la finestra non sfoca: sfoca il suo velo");
  assert.match(regola, /background:transparent/);
});

test("la card sta sopra il velo, che adesso è un fratello posizionato", () => {
  /* Il ::before è assoluto, quindi dipinto fra i posizionati: senza dirlo, la
   * card — statica — finirebbe sotto la sfocatura. */
  assert.match(
    SORGENTE,
    /#dm-widget-popup \.dm-widget-detail\{[\s\S]{0,900}position:relative;z-index:1/,
  );
});

test("il velo scuro segue la finestra anche col tema scuro", () => {
  /* Lo sfondo si è spostato sul ::before: se la regola del tema scuro fosse
   * rimasta sull'elemento, di notte il velo sarebbe tornato chiaro. */
  assert.match(SORGENTE, /html\[data-theme="dark"\] #dm-widget-popup::before\{background:/);
});

test("dietro un velo non si muove niente, e riparte tutto alla chiusura", async () => {
  const { animazioniDaFermare } = await import("../src/sections/home-widgets-section.js");

  const finestra = { dentro: true };
  const dentro = (nodo) => nodo === finestra;
  const anim = (nome, playState, target) => ({
    animationName: nome,
    playState,
    effect: { target },
  });

  const scelte = animazioniDaFermare(
    [
      anim("floatBlob", "running", { fondale: true }),
      anim("dmAlertDoor", "running", { tessera: true }),
      /* Dentro la finestra si continua a muovere: è quello che si guarda. */
      anim("dmWidgetIn", "running", finestra),
      /* Già ferma: non si ferma due volte, o alla chiusura ripartirebbe una
       * cosa che nessuno aveva avviato. */
      anim("pulseDot", "paused", { puntino: true }),
      /* Le transizioni non hanno nome e durano un attimo: si lasciano correre. */
      { animationName: "", playState: "running", effect: { target: { riga: true } } },
      /* Un'animazione senza bersaglio non è di nessuno. */
      anim("orfana", "running", null),
    ],
    dentro,
  );
  assert.deepEqual(
    scelte.map((a) => a.animationName),
    ["floatBlob", "dmAlertDoor"],
  );

  /* E niente lista, niente risveglio: la lista vuota non deve rompere. */
  assert.deepEqual(animazioniDaFermare(null, dentro), []);
});

test("si ferma all'apertura e a ogni giro, e riparte da ogni strada di uscita", () => {
  /* All'apertura, e a ogni giro: un avviso che si accende mentre la finestra è
   * aperta comincia a battere dopo, e nessuno l'avrebbe fermato. */
  assert.match(SORGENTE, /fermaCioCheStaDietro\(host\);\s*\n\s*return true;/);
  /* Le finestre si chiudono in due modi — col tasto e perché la tessera non
   * c'è più — e tutti e due devono far ripartire quello che sta dietro:
   * lasciare fuori uno dei due vorrebbe dire una plancia ferma per sempre. */
  const chiusure = SORGENTE.match(/riparteCioCheStaDietro\(\);/g) || [];
  assert.equal(chiusure.length, 2, "le due strade di uscita fanno ripartire tutto");
  assert.match(
    SORGENTE,
    /doc\?\.documentElement\?\.classList\?\.remove\("dm-widget-popup-open"\);\s*\n\s*riparteCioCheStaDietro\(\);/,
  );
  /* In pausa, non spente: `pause` e `play`, così ognuna riprende da dov'era. */
  assert.match(SORGENTE, /anim\.pause\(\);/);
  assert.match(SORGENTE, /anim\.play\(\);/);
});
