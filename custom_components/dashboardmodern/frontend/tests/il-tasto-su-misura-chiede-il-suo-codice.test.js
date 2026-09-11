/* Il PIN sui tasti d'inserimento su misura (#336).
 *
 * «Sarebbe comodo che nella sezione allarme, oltre a scegliere l'entita', si
 * possa inserire un pin ed esca il tastierino, come succede gia' nella sezione
 * aperture mettendo una serratura.»
 *
 * Una centrale vera il codice lo dichiara lei — `code_format` — e lo verifica
 * Home Assistant. Uno script, una scena, un interruttore un codice non lo
 * accettano: l'unico posto dove chiederlo e' la plancia, prima di mandare il
 * comando. E' esattamente quello che fanno gia' le aperture della Sicurezza.
 *
 * Le prove tengono ferme quattro cose:
 *
 * 1. la regola del codice e' UNA — quattro-otto cifre — e vale per le aperture
 *    e per i tasti su misura, perche' e' scritta in un posto solo;
 * 2. un tasto col PIN dichiara di volere il tastierino, uno senza no;
 * 3. il tastierino e' quello del guscio e non un secondo: chi ha il PIN passa
 *    dalla funzione di sempre invece di scavalcarla;
 * 4. all'OK il codice si confronta, e col codice sbagliato non parte niente.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ilCodiceApreIlModo,
  ilModoChiedeIlCodice,
  normalizzaModiSuMisura,
  normalizzaModoSuMisura,
} from "../src/core/antifurto-su-misura.js";
import { doorPinMatches, normalizeDoorPin } from "../src/core/security-door-model.js";
import {
  ilCodiceCombacia,
  ilCodiceServe,
  normalizzaIlCodice,
} from "../src/core/codice-a-tastierino.js";

const sorgenteDi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

test("la regola del codice e' una sola, e le aperture usano quella", () => {
  for (const buono of ["1234", "0000", "12345678"]) {
    assert.equal(normalizzaIlCodice(buono), buono);
    assert.equal(normalizeDoorPin(buono), buono);
  }
  /* Tre cifre e' piu' corto di qualunque tastierino, nove piu' lungo di quello
   * che la centrale accetta, e una lettera su dieci tasti non si scrive. Niente
   * di tutto questo diventa un codice a meta': sparisce. */
  for (const storto of ["123", "123456789", "12a4", " 12 34 ", "", null, undefined]) {
    assert.equal(normalizzaIlCodice(storto), "");
    assert.equal(normalizeDoorPin(storto), "");
  }
  /* E la regola sta scritta in un posto solo: se la cifra tornasse a essere
   * battuta anche altrove, un giorno due di quei posti accetterebbero codici
   * che il terzo rifiuta. */
  const aperture = sorgenteDi("../src/core/security-door-model.js");
  const suMisura = sorgenteDi("../src/core/antifurto-su-misura.js");
  for (const sorgente of [aperture, suMisura]) {
    assert.doesNotMatch(sorgente, /\{4,8\}/);
    assert.match(sorgente, /codice-a-tastierino\.js/);
  }
});

test("senza codice atteso si apre sempre, col codice atteso solo se combacia", () => {
  assert.equal(ilCodiceCombacia("", "qualunque"), true);
  assert.equal(ilCodiceCombacia("1234", "1234"), true);
  assert.equal(ilCodiceCombacia("1234", "4321"), false);
  assert.equal(ilCodiceServe("1234"), true);
  assert.equal(ilCodiceServe(""), false);
  /* Un codice scritto male non e' un codice: il tasto parte, come prima che
   * quella casella esistesse. Correggere chi scrive si fa nella scheda. */
  assert.equal(ilCodiceServe("12a4"), false);
  assert.equal(ilCodiceCombacia("12a4", ""), true);
  /* E le aperture rispondono identiche, perche' e' la stessa regola. */
  assert.equal(doorPinMatches({ pin: "1234" }, "1234"), true);
  assert.equal(doorPinMatches({ pin: "1234" }, "4321"), false);
  assert.equal(doorPinMatches({ pin: "" }, ""), true);
});

test("il PIN viaggia col tasto e decide se chiedere il tastierino", () => {
  const [colPin, senzaPin] = normalizzaModiSuMisura([
    { id: "fuori", nome: "Fuori casa", entita: "script.antifurto_totale", pin: "4815" },
    { id: "notte", nome: "Notte", entita: "switch.antifurto_notte" },
  ]);

  assert.equal(colPin.pin, "4815");
  assert.equal(senzaPin.pin, "");
  assert.equal(ilModoChiedeIlCodice(colPin), true);
  assert.equal(ilModoChiedeIlCodice(senzaPin), false);

  assert.equal(ilCodiceApreIlModo(colPin, "4815"), true);
  assert.equal(ilCodiceApreIlModo(colPin, "1111"), false);
  assert.equal(ilCodiceApreIlModo(colPin, ""), false);
  /* Un tasto senza PIN parte comunque: il PIN e' facoltativo, e chi non l'ha
   * scritto preme e basta come ha sempre fatto. */
  assert.equal(ilCodiceApreIlModo(senzaPin, ""), true);

  /* Un PIN scritto male non blocca il tasto — sarebbe un tasto che non si
   * preme piu' per colpa di una casella lasciata a meta'. */
  const storto = normalizzaModoSuMisura({ entita: "script.a", pin: "12" });
  assert.equal(storto.pin, "");
  assert.equal(ilModoChiedeIlCodice(storto), false);
  assert.equal(ilCodiceApreIlModo(storto, ""), true);
});

test("il tastierino e' quello del guscio, non un secondo uguale", () => {
  const sorgente = sorgenteDi("../src/sections/security-showcase-section.js");

  /* `dmAlarmCodeNeeded` e' la domanda che il guscio fa prima di aprire il
   * tastierino. Adesso risponde anche per i tasti nostri: e' cosi' che il
   * tastierino di sempre si apre anche per loro. */
  assert.match(sorgente, /root\.dmAlarmCodeNeeded = \(service\) => \{/);
  assert.match(sorgente, /if \(id\) return ilModoChiedeIlCodice\(/);

  /* Un tasto col PIN NON scavalca il guscio: gli lascia fare quello che ha
   * sempre fatto, tastierino compreso. Senza PIN parte dritto. */
  assert.match(sorgente, /if \(ilModoChiedeIlCodice\(modo\)\) \{\s*\n\s*const esito = originale\.apply/);
  assert.match(sorgente, /premiIlModoSuMisura\(id\);\s*\n\s*return undefined;/);

  /* All'OK il guscio chiama `callAlarmService(servizio, codice)`: li' si
   * confronta il codice, e solo se combacia parte l'entita'. */
  assert.match(sorgente, /const nome = "callAlarmService";/);
  assert.match(sorgente, /if \(modo && ilCodiceApreIlModo\(modo, argomenti\[1\]\)\) premiIlModoSuMisura\(id\);/);

  /* E non esiste un secondo tastierino: quello delle aperture resta il loro,
   * e qui non se ne disegna nessuno. */
  assert.doesNotMatch(sorgente, /keypad-grid|keypad-btn/);
});

test("la casella del PIN sta nella scheda del tasto, come in quella delle aperture", () => {
  const sorgente = sorgenteDi("../src/sections/antifurto-su-misura-editor-section.js");
  assert.match(sorgente, /data-suo-field="pin"/);
  assert.match(sorgente, /t\("PIN \(facoltativo\)", "PIN \(optional\)"\)/);
  assert.match(sorgente, /inputmode="numeric"/);
  /* Il messaggio e' quello che le aperture danno gia' per lo stesso errore:
   * la stessa casella sbagliata nello stesso modo si dice nello stesso modo. */
  assert.match(sorgente, /t\("Il PIN è di 4-8 cifre\.", "The PIN is 4-8 digits\."\)/);
});
