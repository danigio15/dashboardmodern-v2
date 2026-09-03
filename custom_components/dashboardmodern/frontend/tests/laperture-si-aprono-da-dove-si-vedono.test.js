/* Tre cose dalla stessa segnalazione (#275).
 *
 * «Dalla home cliccando sicurezza mostra le porte per aprire, si clicca il
 * lucchetto e il popup di conferma non viene mostrato perché accavallato dal
 * primo popup.»
 *
 * «Sarebbe carino la possibilità in configurazione di decidere se attivare la
 * doppia conferma d'apertura o meno, per essere più celeri all'apertura.»
 *
 * «Le aperture assegnate alle stanze: quando si entra nella sezione stanze e si
 * seleziona la stanza mostra la card dell'apertura ma non permette l'apertura —
 * se si clicca ti porta nella home.»
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (nome) =>
  readFileSync(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");

test("una conferma sta sopra a chi la chiede", () => {
  /* Due veli sullo stesso piano e vince il più giovane nel documento. Il velo
   * delle conferme sta nel guscio vendorizzato, cioè PRIMA della finestra
   * della tessera, che nasce a runtime: la conferma si apriva davvero, sotto,
   * e il tocco sul tasto arrivava al corpo della finestra. */
  const ponte = leggi("home-widgets-section.js");
  assert.match(ponte, /#confirm-modal,#custom-keypad,#dm-door-keypad\{z-index:10050!important\}/);
  /* E la finestra resta dov'era: alzare lei avrebbe spostato il problema al
   * prossimo velo che nasce dopo. */
  assert.match(ponte, /#dm-widget-popup\{[\s\S]{0,80}z-index:9999/);
});

test("la doppia conferma si può spegnere, il PIN no", async () => {
  const { siChiedeConferma, SECURITY_DOORS_CONFIRM_KEY } = await import(
    "../src/sections/security-doors-section.js"
  );
  assert.equal(SECURITY_DOORS_CONFIRM_KEY, "cd_porte_conferma");
  const porte = leggi("security-doors-section.js");
  /* Di serie la conferma c'è: un cancello che si apre al primo tocco sbagliato
   * è un cancello aperto. Si spegne solo dicendolo. */
  assert.match(porte, /readJson\(SECURITY_DOORS_CONFIRM_KEY, true\) !== false/);
  assert.equal(typeof siChiedeConferma, "function");
  /* Il PIN viene prima e non si spegne da qui: quella è una chiave, non una
   * conferma, e una porta protetta continua a chiederla. */
  assert.match(
    porte,
    /if \(door\.pin\) openKeypad\(door\);\s*else if \(siChiedeConferma\(\)\) confirmAndOpen\(door\);/,
  );
  /* E l'interruttore c'è dove si configurano le aperture. */
  assert.match(leggi("security-doors-editor-section.js"), /data-door-conferma/);
});

test("un'apertura in una stanza si apre, invece di riportare in Home", () => {
  const stanze = leggi("rooms-page-section.js");
  /* Un'entità assegnata a mano finisce nel blocco «Altro», e quel blocco
   * riporta in Home — che per un comando che apre un cancello è la risposta
   * sbagliata: non si vuole andare da nessuna parte, si vuole aprire. */
  assert.match(stanze, /altro: "home"/, "il blocco «Altro» porta ancora in Home, ed è giusto");
  /* La riga di un'apertura porta il segno delle aperture, e da lì in poi è la
   * sezione che le disegna a occuparsene: conferma, PIN e attesa comprese. */
  assert.match(stanze, /data-dm-door="\$\{esc\(porta\.id\)\}"/);
  assert.match(stanze, /function aperturePerEntita\(\)/);
  /* E il giro delle stanze si tira indietro, come già fa per l'interruttore
   * dentro la riga: senza, la riga porterebbe altrove mentre la conferma si
   * apre. */
  assert.match(stanze, /if \(event\.target\?\.closest\?\.\("\[data-dm-door\]"\)\) return;/);
});

test("la scelta sulla conferma viaggia con la configurazione", () => {
  const persistenza = readFileSync(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  /* Chi la spegne dal telefono la vuole spenta anche dal tablet: è una scelta
   * sulla casa, non su questo dispositivo. */
  assert.match(persistenza, /"cd_porte_conferma"/);
});
