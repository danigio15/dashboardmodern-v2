/* «Nella sezione persone, se clicco sul luogo individuato può aprirsi la
 *  mappa?» (#438)
 *
 * Può, e il pezzo che serviva c'era già dall'altra parte: la scheda grande
 * porta «Apri in mappa» da quando esiste. Sulla card l'indirizzo era una
 * scritta e basta, quindi arrivare alla mappa costava due tocchi — apri la
 * persona, poi la mappa — per una cosa che si guarda di sfuggita, tipicamente
 * col telefono in mano mentre si sta uscendo.
 *
 * Qui si tiene fermo che il collegamento c'è, che toccarlo NON apre anche la
 * persona — due gesti diversi su due pezzi diversi, non uno che indovina cosa
 * volevi — e che la mappa è quella di casa.
 *
 * «Intendevo la mappa interna di HA... adesso punta su googlemap.» Giusto:
 * portava l'indirizzo scritto a Google, che è un altro sito e non sa niente di
 * questa casa. La mappa che serve ce l'ha Home Assistant, e la mostra in due
 * posti — la scheda dell'entità, col segnaposto di QUESTA persona, e il
 * pannello Mappa. Il tocco prova la prima e ripiega sul secondo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sezione = await readFile(new URL("../src/sections/people-section.js", import.meta.url), "utf8");
const modello = await readFile(new URL("../src/core/person-model.js", import.meta.url), "utf8");

test("l'indirizzo sulla card è un collegamento alla mappa", () => {
  assert.match(sezione, /function mappaDi\(indirizzo\)/);
  assert.match(sezione, /<a class="dm-person-address" data-person-mappa="\$\{esc\(view\.entity\)\}" href=/);
  assert.match(sezione, /target="_blank" rel="noopener"/);
});

test("la mappa è quella di casa, non quella di Google", () => {
  /* Google non sa niente di questa casa: il link porta al pannello Mappa di
   * Home Assistant, che sta allo stesso indirizzo. */
  assert.match(sezione, /const MAPPA_DI_CASA = "\/map";/);
  assert.doesNotMatch(sezione, /maps\.google\.com|google\.com\/maps/);
});

test("toccare il luogo apre la scheda dell'entità, e non anche la persona", () => {
  /* Il gestore della card sta in cattura su tutto il documento: senza uscire
   * qui il tocco aprirebbe la scheda grande e la mappa insieme. */
  assert.match(
    sezione,
    /const mappa = event\.target\?\.closest\?\.\("\[data-person-mappa\]"\);\s*if \(mappa\) \{\s*if \(apriLaMappaDiCasa\(mappa\.dataset\.personMappa\)\) event\.preventDefault\(\);\s*return;\s*\}/,
  );
  /* L'annuncio è quello che usa qualunque card di Home Assistant, e parte dal
   * pannello che ospita la cornice: da lì sale fino a chi apre le schede. */
  assert.match(sezione, /new vista\.CustomEvent\("hass-more-info", \{\s*bubbles: true,\s*composed: true,\s*detail: \{ entityId: id \},/);
  assert.match(sezione, /cornice\.getRootNode\?\.\(\)\?\.host \|\| cornice/);
});

test("senza Home Assistant intorno non si annuncia a nessuno", () => {
  /* Un annuncio che non arriva a nessuno, con il link annullato, sarebbe un
   * tocco che non fa niente: prima si guarda che ci sia qualcuno. */
  assert.match(sezione, /function dentroHomeAssistant\(\)/);
  assert.match(sezione, /root\.parent\?\.document\?\.querySelector\?\.\("home-assistant"\)/);
  assert.match(sezione, /if \(!id \|\| !dentroHomeAssistant\(\)\) return false;/);
});

test("l'url della mappa si scrive in un posto solo", () => {
  /* Era scritto due volte — card e popup — e due copie della stessa riga
   * diventano due comportamenti diversi al primo ritocco. */
  assert.equal((sezione.match(/MAPPA_DI_CASA/g) || []).length, 2);
  assert.match(sezione, /const mapUrl = mappaDi\(view\.address\);/);
});

test("la persona sa come si chiama la sua entità", () => {
  /* Per chiedere la scheda bisogna saperla nominare: il modello porta
   * l'entità di Home Assistant accanto al nostro identificativo. */
  assert.match(modello, /entity: clean\(person\.entity\),/);
});

test("senza indirizzo non c'è niente da toccare", () => {
  assert.match(sezione, /function indirizzoMarkup\(view\) \{\s*const mappa = mappaDi\(view\.address\);\s*if \(!mappa\) return "";/);
});
