/* «Ho una gestione carichi che mi stacca e attacca gli elettrodomestici in
 *  base al carico, e ho un boolean che se attivo mi indica con un popup il suo
 *  intervento: vorrei sfruttarlo in questo fantastico lavoro» (#445).
 *
 * La tessera dell'avviso personalizzato c'era già e si accende. Ma un
 * intervento del distacco carichi non è una cosa da vedere passando: è una
 * cosa da sapere adesso, ed è la differenza fra una tessera e un popup. Una
 * tessera aspetta lo sguardo, un popup lo va a prendere.
 *
 * Aprire una finestra addosso a chi guarda è però il gesto più facile da
 * sbagliare di tutta la plancia, e i modi di sbagliarlo sono tre: aprirla al
 * primo sguardo su un avviso acceso da stamattina, riaprirla a ogni disegno
 * mentre l'avviso resta acceso, e aprirla sopra una finestra che c'è già.
 * I primi due si evitano rispondendo bene a una domanda sola — quali si sono
 * ACCESI ADESSO, non quali sono accesi — ed è quella che si prova qui.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { avvisiAppenaAccesi } from "../src/core/avvisi-che-si-aprono.js";

const aperti = (prima, adesso) => avvisiAppenaAccesi(prima, adesso).aperti;

test("il primo sguardo non apre niente: prende nota e basta", () => {
  /* L'avviso è acceso da stamattina. Aprire la Home e trovarsi la finestra in
   * faccia, ogni volta, per una cosa che si sa già, è il modo più rapido di
   * far spegnere la funzione. */
  const passo = avvisiAppenaAccesi(null, ["custom-0"]);
  assert.deepEqual(passo.aperti, []);
  assert.deepEqual([...passo.memoria], ["custom-0"]);
});

test("si apre solo quello che si è acceso adesso", () => {
  assert.deepEqual(aperti([], ["custom-0"]), ["custom-0"]);
  assert.deepEqual(aperti(["custom-0"], ["custom-0", "custom-2"]), ["custom-2"]);
});

test("finché resta acceso non si riapre, a nessun disegno", () => {
  /* Lo stato non cambia per ore, e ogni disegno riproporrebbe la stessa
   * finestra — anche subito dopo che l'hai chiusa. */
  assert.deepEqual(aperti(["custom-0"], ["custom-0"]), []);
  assert.deepEqual(aperti(["custom-0", "custom-1"], ["custom-0", "custom-1"]), []);
});

test("spento e riacceso si apre di nuovo: è un intervento nuovo", () => {
  const spento = avvisiAppenaAccesi(["custom-0"], []);
  assert.deepEqual(spento.aperti, []);
  assert.deepEqual(aperti(spento.memoria, ["custom-0"]), ["custom-0"]);
});

test("niente acceso, niente da aprire", () => {
  assert.deepEqual(aperti([], []), []);
  assert.deepEqual(aperti(undefined, []), []);
});

test("la Home non si sovrappone a una finestra già aperta, e l'interruttore sta spento di suo", async () => {
  const home = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  /* Chi sta guardando un'altra finestra ha già scelto cosa guardare:
   * sovrapporsi non sarebbe avvisarlo, sarebbe interromperlo. */
  assert.match(home, /if \(state\.expanded\) return false;/);
  /* Una finestra che si apre da sola è una cosa che si chiede, non che si
   * subisce: senza l'interruttore acceso non succede niente. */
  assert.match(home, /!widgetPreferences\(\)\.avvisiInPopup/);
  assert.match(home, /avvisiInPopup = stored\?\.avvisiInPopup === true/);
  /* E la memoria nasce a `null`, che è quello che tiene fermo il primo
   * sguardo. */
  assert.match(home, /avvisiVisti: null/);
});

test("l'interruttore sta nella scheda delle tessere, con la sua spiegazione", async () => {
  const editor = await readFile(
    new URL("../src/sections/todo-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(editor, /data-widget-avvisi-popup/);
  assert.match(editor, /scriviPreferenze\(\{ avvisiInPopup: Boolean\(finestraAvvisi\.checked\) \}\)/);
  assert.match(editor, /Avvisi personalizzati a finestra/);
});
