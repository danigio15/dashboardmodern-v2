/* «Nella sezione persone, se clicco sul luogo individuato può aprirsi la
 *  mappa?» (#438)
 *
 * Può, e il pezzo che serviva c'era già dall'altra parte: la scheda grande
 * porta «Apri in mappa» da quando esiste. Sulla card l'indirizzo era una
 * scritta e basta, quindi arrivare alla mappa costava due tocchi — apri la
 * persona, poi la mappa — per una cosa che si guarda di sfuggita, tipicamente
 * col telefono in mano mentre si sta uscendo.
 *
 * Qui si tiene fermo che il collegamento c'è, che l'indirizzo ci passa dentro
 * citato (una virgola o uno spazio non spezzano l'indirizzo), e soprattutto
 * che toccarlo NON apre anche la persona: due gesti diversi su due pezzi
 * diversi, non uno che indovina cosa volevi.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sezione = await readFile(new URL("../src/sections/people-section.js", import.meta.url), "utf8");

test("l'indirizzo sulla card è un collegamento alla mappa", () => {
  assert.match(sezione, /function mappaDi\(indirizzo\)/);
  assert.match(sezione, /https:\/\/maps\.google\.com\/\?q=\$\{encodeURIComponent\(scritto\)\}/);
  assert.match(sezione, /<a class="dm-person-address" data-person-mappa href=/);
  assert.match(sezione, /target="_blank" rel="noopener"/);
});

test("toccare il luogo non apre anche la persona", () => {
  /* Il gestore della card sta in cattura su tutto il documento: senza questa
   * riga il tocco sul collegamento aprirebbe la scheda grande e la mappa
   * insieme. */
  assert.match(sezione, /if \(event\.target\?\.closest\?\.\("\[data-person-mappa\]"\)\) return;/);
});

test("l'url della mappa si scrive in un posto solo", () => {
  /* Era scritto due volte — card e popup — e due copie della stessa riga
   * diventano due comportamenti diversi al primo ritocco. */
  assert.equal((sezione.match(/maps\.google\.com/g) || []).length, 1);
  assert.match(sezione, /const mapUrl = mappaDi\(view\.address\);/);
});

test("senza indirizzo non c'è niente da toccare", () => {
  assert.match(sezione, /function indirizzoMarkup\(view\) \{\s*const mappa = mappaDi\(view\.address\);\s*if \(!mappa\) return "";/);
});
