/* «Il lettore che ho messo fra le Azioni rapide mostra solo la copertina di
 * sfondo, il simbolo della cassa in mezzo e il nome dell'apparecchio. Dovrebbe
 * dire il titolo del brano, l'artista, e avere i tre puntini in alto a destra
 * che aprono una finestra con tutti i comandi del lettore» (#460, dopo la
 * chiusura).
 *
 * La correzione della 1.4.18 aveva rifatto la TESSERA della Home. Il tasto
 * delle Azioni rapide e' un'altra cosa — lo disegna il guscio, e il nostro
 * modulo gli posava addosso la copertina e nient'altro — quindi li' non era
 * cambiato niente, ed e' quello che chi ha segnalato stava guardando.
 *
 * Qui si prova la regola di cosa scrivere: non «cosa c'e' a schermo», che si
 * prova nel browser, ma la decisione — che e' una funzione pura, e ha un caso
 * che conta piu' degli altri.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { scrittaDelTasto } from "../src/sections/media-in-azioni-section.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("con un brano il tasto dice il titolo e, sotto, chi lo suona", () => {
  const scritta = scrittaDelTasto({
    titolo: "So What",
    artista: "Miles Davis",
    album: "Kind of Blue",
  });
  assert.equal(scritta.titolo, "So What");
  assert.equal(scritta.sotto, "Miles Davis · Kind of Blue");
});

test("senza album resta l'artista da solo, senza il puntino appeso", () => {
  const scritta = scrittaDelTasto({ titolo: "Radio Deejay", artista: "" });
  assert.equal(scritta.titolo, "Radio Deejay");
  assert.equal(scritta.sotto, "");
});

test("una radio senza titolo dice almeno la sorgente", () => {
  assert.equal(scrittaDelTasto({ sorgente: "Spotify" }).titolo, "Spotify");
  assert.equal(scrittaDelTasto({ applicazione: "YouTube" }).titolo, "YouTube");
});

test("a cassa spenta il tasto resta quello di sempre", () => {
  /* Qui il titolo sarebbe la parola di stato — «Spento» — e la riga sotto
   * sarebbe l'entita': due righe che ripetono quello che il tasto dice gia',
   * su un tasto grande come un pollice. Meglio niente. */
  const scritta = scrittaDelTasto({ spento: true, entity: "media_player.salotto" });
  assert.equal(scritta.titolo, "");
  assert.equal(scritta.sotto, "");
  assert.deepEqual(scrittaDelTasto(null), { titolo: "", sotto: "" });
});

test("i tre puntini aprono la finestra del lettore, e non mettono in pausa", () => {
  /* Il tasto del vassoio e' un `div` con il suo `onclick` scritto dal guscio:
   * senza fermare il tocco sui puntini, un dito farebbe due cose insieme —
   * aprire la finestra E mettere in pausa. */
  const sorgente = leggi("sections/media-in-azioni-section.js");
  const dentro = sorgente.slice(sorgente.indexOf("function metteIPuntini"));
  assert.match(dentro, /stopPropagation\(\)/, "il tocco sui puntini non si ferma");
  assert.match(dentro, /apriIlLettore\(/, "i puntini non aprono niente");
});

test("la finestra non ridisegna un secondo lettore: e' la card della pagina Musica", () => {
  /* Un secondo disegno vorrebbe dire due modi di mettere in pausa, e prima o
   * poi due modi diversi. La finestra monta `cardMarkup`, che e' la stessa che
   * la pagina Musica mette in fila. */
  const sorgente = leggi("sections/media-player-section.js");
  const dentro = sorgente.slice(sorgente.indexOf("function disegnaIlLettoreAperto"));
  assert.match(dentro.slice(0, 1400), /cardMarkup\(riga\)/);
  /* E si ridisegna solo quando cambia qualcosa, o strapperebbe il cursore del
   * volume di sotto al dito di chi lo sta muovendo. */
  assert.match(dentro.slice(0, 1400), /firmaDelLettore\(riga\)/);
});

test("la firma di una card sta in un posto solo", () => {
  /* Le card disegnate sono due — la pagina e la finestra — e due elenchi di
   * cose da guardare diventerebbero due elenchi diversi al primo campo
   * aggiunto, con una delle due card ferma su un brano vecchio. */
  const sorgente = leggi("sections/media-player-section.js");
  assert.equal((sorgente.match(/function firmaDelLettore\(/g) || []).length, 1);
  assert.equal((sorgente.match(/firmaDelLettore\b/g) || []).length, 3);
});
