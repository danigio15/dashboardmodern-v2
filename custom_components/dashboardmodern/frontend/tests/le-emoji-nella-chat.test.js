/* «Ecco mancano le emoji :) :) :)»
 *
 * Una frase scritta di corsa suona piu' secca di com'e' stata pensata, e chi
 * legge dall'altra parte non ha il tono di voce per correggerla. Un pollice in
 * su chiude uno scambio meglio di «ok».
 *
 * Qui si prova la sola cosa che ha delle regole: dove va a finire l'emoji, e
 * dove va a finire il cursore dopo. Il pannello che si apre lo prova un
 * browser.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { EMOJI_DELLA_CHAT, conLEmoji } from "../src/sections/assistenza-section.js";

test("l'emoji va dove sta il cursore, non in fondo", () => {
  /* Chi ha scritto una frase e torna indietro a metterci una faccia si aspetta
   * che vada li'. */
  const esito = conLEmoji("grazie mille", "🙏", 6, 6, 4000);
  assert.equal(esito.testo, "grazie🙏 mille");
  assert.equal(esito.cursore, 6 + "🙏".length);
  assert.equal(esito.pieno, false);
});

test("senza cursore l'emoji va in fondo", () => {
  assert.equal(conLEmoji("ci sono", "👍").testo, "ci sono👍");
  assert.equal(conLEmoji("", "👍").testo, "👍");
});

test("con del testo selezionato l'emoji lo sostituisce", () => {
  /* E' quello che fa qualunque campo quando si scrive sopra una selezione. */
  assert.equal(conLEmoji("va bene cosi'", "👍", 0, 7, 4000).testo, "👍 cosi'");
});

test("il cursore resta dopo l'emoji, pronto a scrivere ancora", () => {
  const esito = conLEmoji("ok", "🎉", 2, 2, 4000);
  assert.equal(esito.testo.slice(esito.cursore), "");
  assert.equal(conLEmoji("ok", "🎉", 0, 0, 4000).cursore, "🎉".length);
});

test("un'emoji che sfonda il tetto non entra, e non entra a meta'", () => {
  /* Mezzo segno non vuol dire niente: o ci sta tutto o non ci sta. */
  const pieno = "x".repeat(10);
  const esito = conLEmoji(pieno, "🙂", 10, 10, 10);
  assert.equal(esito.testo, pieno);
  assert.equal(esito.pieno, true);
  assert.equal(esito.cursore, 10);
});

test("posizioni impossibili non rompono niente", () => {
  assert.equal(conLEmoji("ciao", "👋", 99, 99, 4000).testo, "ciao👋");
  assert.equal(conLEmoji("ciao", "👋", -3, -3, 4000).testo, "ciao👋");
  /* Una fine prima dell'inizio non e' una selezione: si tratta come un punto. */
  assert.equal(conLEmoji("ciao", "👋", 2, 1, 4000).testo, "ci👋ao");
  assert.equal(conLEmoji(null, null).testo, "");
});

test("senza emoji il testo non si tocca", () => {
  assert.equal(conLEmoji("una frase", "", 3, 5, 4000).testo, "una frase");
});

test("l'elenco e' corto, scelto, e senza doppioni", () => {
  /* Un catalogo intero vorrebbe dire una ricerca, una tastiera e un pannello
   * che copre la conversazione — e mille segni per trovarne cinque. */
  assert.ok(EMOJI_DELLA_CHAT.length >= 20, "troppo poche per servire");
  assert.ok(EMOJI_DELLA_CHAT.length <= 60, "e' diventato un catalogo");
  assert.equal(new Set(EMOJI_DELLA_CHAT).size, EMOJI_DELLA_CHAT.length, "ci sono doppioni");
  for (const segno of EMOJI_DELLA_CHAT) {
    assert.ok(segno.trim() === segno && segno.length > 0, `«${segno}» non e' pulita`);
    /* Niente tonalita' di pelle: sono le sequenze che il campo e il centralino
     * si passano peggio, e qui non servono a niente. */
    assert.ok(!/[\u{1F3FB}-\u{1F3FF}]/u.test(segno), `«${segno}» porta una tonalita' di pelle`);
  }
});
