/* «Display the track title and artist name on the media player; use the
 * vertical three-dot button in the top right corner to open the pop-up for full
 * media player control. Remove the speaker icon and its name from the media
 * player.» (#460)
 *
 * Il titolo e l'artista c'erano già, ma dentro la stessa riga della didascalia,
 * separati da un trattino e scritti tutti uguali: due fatti diversi detti come
 * se fossero uno. E il disegno dell'altoparlante diceva cos'è la tessera — che
 * si sa dal nome — invece di dire cosa sta suonando.
 *
 * Il nome della tessera resta: in una Home di venti mattonelle una senza nome è
 * una mattonella che non si trova. Quello che cambia è cosa ci sta sopra la
 * pastiglia, non la forma della tessera.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leggi = () =>
  readFile(new URL("../src/sections/home-widgets-section.js", import.meta.url), "utf8");

const dentroIlModello = async () => {
  const sorgente = await leggi();
  const dentro = sorgente.slice(
    sorgente.indexOf("function mediaModel(states)"),
    sorgente.indexOf("const CASELLE_MINIPC"),
  );
  assert.ok(dentro, "mediaModel non si trova più dove questa prova lo cerca");
  return dentro;
};

test("con una cosa sola in riproduzione il titolo va in didascalia e l'artista sotto", async () => {
  const dentro = await dentroIlModello();
  assert.match(dentro, /const unico = suonano\.length === 1 \? suonano\[0\] : null;/);
  assert.match(dentro, /caption: unico\s*\n\s*\? titoloDelLettore\(unico\)/);
  assert.match(dentro, /sottotitolo: chiSuona,/);
  /* Senza artista va l'album, e senza nemmeno quello la cassa: mai
   * l'entity_id, che sulla plancia non si legge mai. */
  assert.match(dentro, /unico\.artista \|\| unico\.album \|\| unico\.nome/);
});

test("con più casse accese la seconda riga tace, invece di scegliere per chi guarda", async () => {
  const dentro = await dentroIlModello();
  /* `chiSuona` nasce da `unico`, che con due casse è null: la riga resta
   * vuota e la didascalia torna a elencarle col posto davanti. */
  assert.match(dentro, /const chiSuona = unico \? /);
  assert.match(dentro, /suonano\.map\(\(riga\) => cosaSuona\(riga, conIlPosto\)\)\.join\(" · "\)/);
});

test("la copertina prende il posto dell'altoparlante mentre suona", async () => {
  const dentro = await dentroIlModello();
  assert.match(dentro, /faccia: unico\?\.copertina/);
  assert.match(dentro, /class="dm-tile-arte"/);
  /* Senza copertina la faccia resta vuota e la tessera torna al suo disegno:
   * una radio senza artwork non deve diventare una pastiglia bianca. */
  assert.match(dentro, /facciaFirma: unico\?\.copertina \|\| "",/);
  const sorgente = await leggi();
  assert.match(sorgente, /if \(widget\?\.faccia\) return widget\.faccia;/);
});

test("i tre puntini sono un segno, non un secondo tasto", async () => {
  const sorgente = await leggi();
  /* La mattonella è già un <button>: un <button> dentro un <button> non è
   * HTML valido, e toccare la mattonella apre già la finestra coi comandi.
   * I puntini dicono che lì dentro si comanda qualcosa. */
  assert.match(sorgente, /\$\{widget\.menu \? `<span class="dm-tile-menu" aria-hidden="true">⋮<\/span>` : ""\}/);
  assert.doesNotMatch(sorgente, /<button[^>]*class="dm-tile-menu"/);
  const dentro = await dentroIlModello();
  assert.match(dentro, /menu: true,/);
});

test("la mattonella resta la mattonella di tutte le altre", async () => {
  const sorgente = await leggi();
  const markup = sorgente.slice(
    sorgente.indexOf("function tileMarkup(widget, index = 0)"),
    sorgente.indexOf("/* ── markup: i dettagli"),
  );
  /* Pastiglia e nome ci sono su ogni tessera, musica compresa: una Home di
   * venti mattonelle con una senza nome è una mattonella che non si trova. */
  assert.match(markup, /<span class="dm-tile-chip"/);
  assert.match(markup, /<span class="dm-tile-label" data-dm-tile-label>\$\{esc\(widget\.label\)\}<\/span>/);
  /* La seconda riga è nella struttura di TUTTE, nascosta dove non serve: una
   * tessera con un fondo diverso dalle altre sarebbe una tessera diversa. */
  assert.match(markup, /data-dm-tile-sotto\$\{widget\.sottotitolo \? "" : " hidden"\}/);
  assert.match(markup, /<span class="dm-tile-testo">/);
});

test("copertina e artista si riscrivono senza rifare la tessera", async () => {
  const sorgente = await leggi();
  /* Rifare la tessera a ogni canzone vorrebbe dire farle ricominciare
   * l'animazione di apertura mentre uno la sta guardando. */
  assert.match(sorgente, /const sotto = tile\.querySelector\("\[data-dm-tile-sotto\]"\);/);
  assert.match(sorgente, /sotto\.hidden = !testoSotto;/);
  assert.match(sorgente, /chip\.innerHTML = facciaDellaTessera\(widget\);/);
  assert.match(sorgente, /clean\(chip\.dataset\.dmFaccia\) !== firmaFaccia/);
});

test("nella pillola compatta i puntini non ci sono", async () => {
  const sorgente = await leggi();
  /* In compatta `dm-tile-cima` è `display:contents`: non fa più da
   * riferimento a niente, e una pillola alta quarantotto pixel è già piena. */
  assert.match(sorgente, /\$\{radice\} \.dm-tile-menu\{display:none\}/);
});
