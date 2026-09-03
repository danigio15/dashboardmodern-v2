/* «Cambia nome ad Aperture nei widget dove si inseriscono i sensori porta:
 * chiamali Porte/Finestre, altrimenti si confonde con le altre aperture.
 * Quelle nella sezione Sicurezza, invece di Aperture, chiamale comandi apri
 * porte/cancelli.»
 *
 * Due cose diverse portavano lo stesso nome: i contatti che dicono se una
 * finestra è aperta, e i pulsanti che aprono un cancello. Delle due ne è
 * rimasta una: la tessera dei contatti non c'è più — «viene già gestito da
 * Finestre, se li si mette il sensore finestra dice quale è aperto, quindi è
 * un duplicato» — e con lei se ne sono andati il suo gruppo negli avvisi e il
 * nome che si confondeva.
 *
 * Resta da difendere il nome dei comandi, che è la metà che sopravvive: sono
 * una pagina loro, e dire «Aperture» dove si aprono i cancelli era esattamente
 * l'equivoco della segnalazione.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("i comandi delle aperture dicono cosa aprono", () => {
  /* Adesso sono una pagina loro (#275): il nome per esteso sta nella sua
   * intestazione, che e' dove lo si legge arrivandoci. */
  assert.match(
    leggi("sections/security-doors-section.js"),
    /it: \["Apri porte\/cancelli", sottotitolo\(doors0\)\]/,
  );
  /* Nel menu stretto della configurazione la stessa cosa si dice corta, o si
   * tronca a meta' parola. */
  assert.match(
    leggi("sections/security-doors-editor-section.js"),
    /t\("Apri porte\/cancelli", "Door & gate openers"\)/,
  );
  /* E la Sicurezza non le promette piu': se ne sono andate, e il sottotitolo
   * lo dice — prometterle dove non ci sono e' peggio del nome vecchio. */
  assert.match(leggi("sections/page-masthead-section.js"), /"Antifurto · Telecamere"\]/);
  assert.doesNotMatch(leggi("sections/page-masthead-section.js"), /Porte e cancelli/);
});

test("la tessera dei contatti non c'è più, e non ne restano pezzi", () => {
  /* «Elimina tutti i riferimenti a quell'avviso e non mi lasciare pezzi
   * sparsi»: la tessera, la sua finestra, la riga del catalogo ordina/accendi,
   * il gruppo nella scheda degli avvisi. */
  const ponte = leggi("sections/home-widgets-section.js");
  assert.doesNotMatch(ponte, /openingsModel|openingsDetail|iconaApertura/);
  assert.doesNotMatch(ponte, /key: "aperture"/);
  assert.doesNotMatch(leggi("sections/todo-editor-section.js"), /\["aperture",/);
  assert.doesNotMatch(leggi("sections/alerts-section.js"), /\["win",/);
  assert.doesNotMatch(leggi("core/racconto-tessera.js"), /^\s*aperture:/m);
  /* Il gruppo `win` sparisce anche dalla scheda: accordion e voce del menu se
   * ne vanno con gli altri orfani, o resterebbe una lista da riempire che
   * nessuno legge. */
  assert.match(
    leggi("sections/todo-editor-section.js"),
    /const GRUPPI_ORFANI = Object\.freeze\(\["luci", "clima", "risc", "tapp", "win"\]\);/,
  );
});

test("quello che diceva la tessera lo dice Finestre, ed è l'unico a dirlo", () => {
  /* La ragione per cui la tessera se n'è andata: i contatti degli infissi li
   * legge già la tessera delle coperture, e la sua didascalia NOMINA quelle
   * aperte — non le conta soltanto. Se un giorno tornasse a contarle, questa
   * richiesta tornerebbe indietro senza che nessuno se ne accorga. */
  const ponte = leggi("sections/home-widgets-section.js");
  const coperture = ponte.slice(
    ponte.indexOf("function coversModel"),
    ponte.indexOf("function securityModel"),
  );
  assert.match(coperture, /label: t\("Finestre", "Windows"\)/);
  assert.match(coperture, /caption: nomiAccesi\(open, \(\) => true,/);
  /* E i contatti li legge davvero: senza, resterebbe la sola posizione della
   * tapparella, che di una finestra aperta non dice niente. */
  assert.match(coperture, /contactEntity\(item\)/);
});
