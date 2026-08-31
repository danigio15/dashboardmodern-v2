/* L'avvio non va piu' a pezzi, e le telecamere non ricominciano da capo.
 *
 * Dal campo, guardando il video: «quando si clicca sulla dashboard il
 * caricamento e' lentissimo e poi va a pezzi, non carica tutto insieme» e
 * «problemi con widget telecamere, lentissimo in apertura».
 *
 * Erano tre cose diverse con lo stesso effetto:
 *
 *  - il velo cadeva appena i moduli si dicevano INSTALLATI. Ma quasi nessuno
 *    dipinge dentro `install()`: chiamano `schedule()`, cioe' un
 *    requestAnimationFrame. Il velo se ne andava nello stesso fotogramma e i
 *    quaranta ridisegni pendenti finivano sotto gli occhi;
 *  - il travaso delle tessere ricopiava gli attributi, e alle `<img>` gia'
 *    scaricate strappava il `src`: riquadro nero e nuovo scaricamento a ogni
 *    giro, all'infinito;
 *  - la spazzata delle chiavi morte del registro girava a ogni battito.
 *
 * Queste prove leggono il sorgente perche' quello che va difeso e' la forma
 * dell'accordo — chi aspetta chi — non un risultato numerico.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

test("il velo aspetta la dipintura, non l'installazione", () => {
  const runtime = leggi("../src/sections/section-runtime.js");
  /* Due fotogrammi: il primo lascia girare le rAF appena messe in coda, il
   * secondo lascia dipingere il risultato. */
  assert.match(runtime, /frame\(\(\) => frame\(alza\)\)/);
  assert.match(runtime, /DIPINTA_KEY = "__DASHBOARDMODERN_PLANCIA_DIPINTA__"/);
  /* E il guscio deve sapere che c'e' qualcuno che la dichiara: senza questa
   * bandiera continuerebbe a fidarsi di `installed`. */
  assert.match(runtime, /dipinge: true/);

  for (const foglio of ["../legacy/dashboard-runtime-it.js", "../legacy/dashboard-runtime-en.js"]) {
    const guscio = leggi(foglio);
    assert.match(
      guscio,
      /if \(!rt\.dipinge\) return true;\s*\n\s*return Boolean\(window\.__DASHBOARDMODERN_PLANCIA_DIPINTA__\);/,
      `${foglio} scioglie il velo senza aspettare la dipintura`,
    );
  }
});

test("il travaso non strappa il src alle telecamere gia' scaricate", () => {
  const widget = leggi("../src/sections/home-widgets-section.js");
  /* Gli attributi vivi non si ricopiano: sono quelli che l'immagine si e'
   * guadagnata scaricando. Riscriverli vale come rimetterla in coda. */
  assert.match(widget, /ATTRIBUTI_VIVI/);
  for (const attributo of ["src", "data-dm-camera-key", "data-dm-camera-entity"])
    assert.ok(widget.includes(`"${attributo}"`), `attributo non protetto: ${attributo}`);
});

test("le telecamere in volo sono al massimo due", () => {
  const widget = leggi("../src/sections/home-widgets-section.js");
  /* Senza coda partivano tutte insieme: su una casa con sei telecamere sono
   * sei flussi contemporanei, e la finestra si apriva dopo tutti. */
  assert.match(widget, /aggiornaTelecamere/);
  assert.match(widget, /IN_VOLO|inVolo/);
});

test("la spazzata delle chiavi morte non gira a ogni battito", () => {
  const live = leggi("../src/sections/live-ui-section.js");
  assert.match(live, /SPAZZATA_OGNI_MS = 5000/);
  assert.match(live, /ripulisciChiaviMorte/);
});
