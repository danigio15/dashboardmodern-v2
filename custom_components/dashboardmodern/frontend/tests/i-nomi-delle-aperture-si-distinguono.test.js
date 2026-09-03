/* «Cambia nome ad Aperture nei widget dove si inseriscono i sensori porta:
 * chiamali Porte/Finestre, altrimenti si confonde con le altre aperture.
 * Quelle nella sezione Sicurezza, invece di Aperture, chiamale comandi apri
 * porte/cancelli.»
 *
 * Due cose diverse portavano lo stesso nome: i contatti che dicono se una
 * finestra e' aperta, e i pulsanti che aprono un cancello. Qui si prova che
 * adesso si chiamano in due modi, e — la parte che conta — che il cambio di
 * nome non ha fatto perdere il gruppo alle righe gia' salvate: quella tabella
 * serve a due padroni, e' quello che stampiamo *e* quello con cui
 * riconosciamo le intestazioni che stampa il guscio vendorizzato.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("i sensori di porte e finestre si chiamano Porte/Finestre, ovunque si scelgano", () => {
  /* La tessera in Home. */
  assert.match(leggi("sections/home-widgets-section.js"), /t\("Porte\/Finestre", "Doors\/Windows"\)/);
  /* L'interruttore che la accende, nella scheda dei widget. */
  assert.match(leggi("sections/todo-editor-section.js"), /t\("Porte\/Finestre", "Doors\/Windows"\)/);
  /* Il gruppo del Quadro Avvisi, dove le entita' si inseriscono davvero. */
  assert.match(leggi("sections/alerts-section.js"), /\["win", "🚪", "Porte\/Finestre", "Doors\/Windows"/);
});

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

test("il nome vecchio resta come alias: le righe gia' salvate non perdono il gruppo", async () => {
  /* Il guscio vendorizzato stampa ancora «🚪 Aperture» come intestazione, e il
   * gruppo di una riga si deduce da li' quando non e' scritto sulla riga. Senza
   * l'alias, il giorno del cambio di nome quelle righe finivano senza gruppo —
   * e un avviso senza gruppo e' un avviso che al riavvio sparisce. */
  const sorgente = leggi("sections/alerts-section.js");
  assert.match(sorgente, /\["Aperture", "Openings"\]/);
  assert.match(sorgente, /\[it, en, \.\.\.alias\]\.some/);
});

test("la briciola della tessera non ripete il titolo", async () => {
  const { bricioleDellaSezione } = await import("../src/core/racconto-tessera.js");
  /* Prima diceva «Porte e finestre · Sorveglianza» sotto un titolo che gia'
   * diceva «Aperture». Adesso il titolo dice porte e finestre, e la briciola
   * dice cosa sta guardando. */
  assert.deepEqual(bricioleDellaSezione("aperture"), ["Contatti", "Sorveglianza"]);
});
