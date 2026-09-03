/* «Nello smartphone la barra inferiore è parzialmente coperta dai tasti
 * Android. Se fosse possibile alzarla leggermente sarebbe perfetto» (#249).
 *
 * La risposta era già scritta, e giusta: non alzare la barra di un tanto fisso
 * — su un telefono a gesti o su un tablet resterebbe sospesa per niente — ma
 * alzarla di quello che il sistema si è preso, che lo dice il dispositivo con
 * `env(safe-area-inset-bottom)`.
 *
 * Solo che quel valore, nella plancia, era sempre zero. La plancia ospitata
 * vive in una cornice `srcdoc` dentro il pannello di Home Assistant, e le zone
 * sicure sono una proprietà della finestra in cima: dentro una cornice
 * `env(safe-area-inset-bottom)` risponde zero comunque, per quanto la cornice
 * dichiari `viewport-fit=cover`. La regola c'era e non si è mai accesa — «era
 * già stato fatto ma non sta funzionando», che è esattamente com'è.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { FONDO_MASSIMO, fondoDiSistema, inPixel } from "../src/core/fondo-di-sistema.js";

test("dove non c'è niente da scansare non ci si alza di un pixel", () => {
  /* Un computer, un tablet, un telefono a gesti in una pagina normale: zero, e
   * la barra resta dov'è sempre stata. */
  assert.equal(fondoDiSistema(0, 0), 0);
  assert.equal(fondoDiSistema(null, undefined), 0);
  assert.equal(fondoDiSistema("", ""), 0);
  /* Un numero che non è un numero non alza niente. */
  assert.equal(fondoDiSistema("ciao", NaN), 0);
  assert.equal(fondoDiSistema(-40, 0), 0, "una misura negativa non è una fascia");
});

test("la pagina normale usa il proprio, la plancia ospitata quello di sopra", () => {
  /* Standalone: il documento è quello in cima e il valore è suo. */
  assert.equal(fondoDiSistema(48, 0), 48);
  /* Ospitata: il proprio è zero — è una cornice — e vale quello del documento
   * in cima, che è dove le zone sicure esistono. */
  assert.equal(fondoDiSistema(0, 48), 48);
  /* Tutti e due, per qualunque ragione: vince il più grande. Sbagliare per
   * eccesso lascia la barra un po' più alta; sbagliare per difetto la lascia
   * sotto i tasti, che è il difetto segnalato. */
  assert.equal(fondoDiSistema(24, 48), 48);
  assert.equal(fondoDiSistema(48, 24), 48);
});

test("quello che scansa l'ospite non lo scansiamo noi", () => {
  /* Se un giorno Home Assistant lascerà libero il fondo per conto suo, qui non
   * si aggiunge più niente: la barra non si alza due volte. */
  assert.equal(fondoDiSistema(0, 48, 48), 0);
  assert.equal(fondoDiSistema(0, 48, 20), 28);
  /* Uno spazio più grande della fascia non diventa un valore negativo. */
  assert.equal(fondoDiSistema(0, 48, 200), 0);
  /* E quello che lascia l'ospite non toglie niente al proprio, che è di un
   * altro documento. */
  assert.equal(fondoDiSistema(34, 48, 48), 34);
});

test("una misura assurda non manda la barra in mezzo allo schermo", () => {
  /* I tre tasti stanno sui 48 punti, la barra a gesti sui 24, la tacca sui 34.
   * Duecento pixel arrivano da una misura presa mentre la pagina si stava
   * ancora impaginando, e alzare la barra di duecento è peggio del difetto. */
  assert.equal(fondoDiSistema(0, 2000), FONDO_MASSIMO);
  assert.ok(FONDO_MASSIMO >= 48 && FONDO_MASSIMO <= 120);
});

test("il valore esce come lo scrive un foglio di stile", () => {
  assert.equal(inPixel(48), "48px");
  assert.equal(inPixel(47.6), "48px");
  assert.equal(inPixel(0), "0px");
  assert.equal(inPixel(null), "0px");
});

test("la barra si misura invece di chiedere, e riscrive la sua variabile", () => {
  const barra = readFileSync(
    new URL("../src/sections/navigation-section.js", import.meta.url),
    "utf8",
  );
  /* Non c'è modo di leggere una variabile d'ambiente da JavaScript, ma c'è di
   * mettere un elemento alto quanto lei e guardare quanto è venuto. */
  assert.match(barra, /height:env\(safe-area-inset-bottom,0px\)/);
  /* E lo si chiede anche al documento in cima, che è dove le zone sicure
   * esistono davvero. */
  assert.match(barra, /root\.top && root\.top !== root \? root\.top\.document : null/);
  /* Il risultato entra nella variabile che il foglio di stile usa già: la
   * regola scritta per #249 resta quella, e finalmente riceve un numero. */
  assert.match(barra, /setProperty\("--dm-fondo-di-sistema", inPixel\(valore\)\)/);
  assert.match(barra, /bottom:calc\(18px \+ var\(--dm-fondo-di-sistema\)\)/);
  /* Nessun numero cablato: alzare di un tanto fisso è proprio quello che non
   * si doveva fare. */
  assert.doesNotMatch(barra, /bottom:calc\(18px \+ \d+px\)/);
});
