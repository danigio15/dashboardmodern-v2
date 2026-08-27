/* Le rifiniture chieste subito dopo il rilascio, ognuna con la sua prova.
 *
 * Sono difetti piccoli e di posti diversi, ma tre di loro hanno la stessa
 * radice — un padrone di troppo su una cosa sola — e vale la pena tenerli
 * insieme, cosi' la prossima volta si riconoscono prima.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const leggi = (relativo) => readFileSync(join(QUI, "..", relativo), "utf8");

test("nella barra la casa e' una sola: Stanze ha la sua porta", () => {
  const sezione = leggi("src/sections/rooms-page-section.js");
  const voce = sezione.slice(sezione.indexOf("export function ensureRoomsTab"));
  const icona = voce.match(/<span class="icon">(.+?)<\/span>/)?.[1];
  assert.equal(icona, "🚪", "due case affiancate nella barra sono due voci indistinguibili");
});

test("l'icona di una stanza si traduce nel simbolo, non si scrive", () => {
  /* Le stanze la tengono come mdi — «mdi:sofa» — e la linguetta la stampava
   * cosi' com'era, sopra il nome. */
  const sezione = leggi("src/sections/rooms-page-section.js");
  assert.match(sezione, /import \{ roomGlyph \} from "\.\.\/core\/personalization-catalog\.js";/);
  const pillole = sezione.slice(sezione.indexOf("export function pillsMarkup"));
  assert.match(pillole, /roomGlyph\(pagina\.icon\)/);
  assert.doesNotMatch(
    pillole.slice(0, pillole.indexOf("</nav>")),
    /const icona = pagina\.icon \|\|/,
    "l'icona grezza non arriva mai alla linguetta",
  );
});

test("la didascalia della tessera ha una riga sua", () => {
  const sezione = leggi("src/sections/home-widgets-section.js");
  const sotto = sezione.slice(sezione.indexOf(".dm-tile-under{"));
  const regola = sotto.slice(0, sotto.indexOf("}"));
  assert.match(regola, /display:grid/,
    "affiancata al nome, su un telefono, della didascalia restava una coda tagliata");
  assert.doesNotMatch(regola, /display:flex/);
});

test("una telecamera che sta gia' mostrando qualcosa non diventa nera per ricaricare", () => {
  const sezione = leggi("src/sections/live-ui-section.js");
  const corpo = sezione.slice(sezione.indexOf("export async function loadCameraFrame"));
  assert.match(
    corpo,
    /if \(!stessaTelecamera \|\| image\.dataset\.dmCameraState !== "ready"\)\n\s*image\.dataset\.dmCameraState = "loading";/,
    "dichiararla in caricamento a ogni giro la porta a opacita' zero: e' il lampo di buio",
  );
});

test("scegliere una vista dell'Energia non spegne le linguette degli impianti", () => {
  /* Una classe sola, `.sub-tab-btn`, la portano le viste, gli impianti e le
   * stanze degli elettrodomestici: spegnerle tutte e' un padrone di troppo. */
  for (const file of ["legacy/dashboard-runtime-it.js", "legacy/dashboard-runtime-en.js"]) {
    const sorgente = leggi(file);
    const corpo = sorgente.slice(
      sorgente.indexOf("function switchEnergyView"),
      sorgente.indexOf("function switchEnergyView") + 900,
    );
    assert.match(corpo, /#page-energy \.sub-tabs-container \.sub-tab-btn/, file);
    assert.doesNotMatch(corpo, /querySelectorAll\('\.sub-tab-btn'\)/, file);
  }
});

test("il telefono non gonfia i caratteri da solo", () => {
  for (const file of ["dashboard-runtime-it.css", "dashboard-runtime-en.css"]) {
    const foglio = leggi(`legacy/${file}`);
    assert.match(foglio, /-webkit-text-size-adjust: 100%/, file);
    assert.match(foglio, /\btext-size-adjust: 100%/, file);
  }
});

test("le linguette dell'editor stanno in colonna", () => {
  for (const file of ["dashboard-runtime-it.css", "dashboard-runtime-en.css"]) {
    const foglio = leggi(`legacy/${file}`);
    const coda = foglio.slice(foglio.indexOf("Le linguette dell'editor, in colonna"));
    assert.ok(coda, file);
    assert.match(coda, /#editor-modal\.modal-wrapper \.ed-tabs \{[\s\S]*?flex-direction: column;/, file);
    assert.match(coda, /#editor-modal\.modal-wrapper \.ed-shell \{[\s\S]*?display: grid;/, file);
    /* Il foglio condiviso impone che a scorrere sia la pagina, non la scheda:
     * la colonna non prova a scorrere per conto suo, si incolla in alto. */
    assert.match(coda, /#editor-modal\.modal-wrapper \.ed-tabs \{[\s\S]*?position: sticky;/, file);
    assert.doesNotMatch(coda, /max-height: 88vh|overflow: hidden !important/, file);
  }
});

test("una tendina non si dichiara mai flex", () => {
  /* Il WebView di Android, con un display flex addosso, disegna le OPZIONI come
   * testo in fila: nel MiniPC la riga diventava l'elenco delle stanze
   * appiccicato al nome dell'entita'. */
  const sezione = leggi("src/sections/room-assign-section.js");
  const regola = sezione.slice(sezione.indexOf("#ed-body .dm-room-entity{"));
  assert.match(regola.slice(0, regola.indexOf("}")), /display:inline-block/);
});

test("nella casella affollata il nome tiene una riga tutta sua", () => {
  const stanze = leggi("src/sections/room-assign-section.js");
  const widget = leggi("src/sections/widget-entity-choice-section.js");
  // Chi impagina e' uno solo; l'altro si limita a dire che la riga e' affollata.
  assert.match(stanze, /\.ed-slot-lbl\.dm-slot-lbl-affollata\{/);
  assert.match(stanze, /dm-slot-lbl-affollata[\s\S]*?>input\{flex:1 1 100%/);
  for (const sorgente of [stanze, widget])
    assert.match(sorgente, /etichetta\.classList\.add\("dm-slot-lbl-affollata"\)/);
  assert.doesNotMatch(widget, /\.dm-slot-lbl-affollata\{/,
    "due fogli che impaginano la stessa riga sono due padroni della stessa cosa");
});

test("da telefono in piedi della linguetta resta il simbolo", () => {
  /* Il nome dentro la linguetta lo nasconde chi quel pezzo lo crea: e' lui a
   * imporgli di vedersi, e nasconderlo da un altro foglio sarebbero due
   * padroni sulla stessa decisione. Qui c'e' solo la geometria della colonna. */
  const padrone = leggi("src/sections/beta4-mobile-polish-section.js");
  assert.match(
    padrone,
    /@media \(orientation:portrait\) and \(max-width:640px\)\{[\s\S]*?dm-beta4-tab-label\{display:none!important\}/,
    "in verticale il nome sparisce, e lo decide chi lo scrive",
  );
  /* E sparendo lascia comunque un modo di sapere chi e': il titolo del tasto. */
  assert.match(padrone, /button\.title = nome/);
  assert.match(padrone, /setAttribute\("aria-label", nome\)/);
  /* La casa nella barra e la casa in configurazione erano la stessa: da
   * telefono, col solo simbolo, sarebbero due voci indistinguibili. */
  assert.match(padrone, /stanze: "🚪"/);

  for (const file of ["dashboard-runtime-it.css", "dashboard-runtime-en.css"]) {
    const foglio = leggi(`legacy/${file}`);
    const coda = foglio.slice(foglio.indexOf("Le linguette dell'editor, in colonna"));
    assert.match(coda, /@media \(orientation: portrait\) and \(max-width: 640px\)/, file);
    /* Quarantasei pixel: la colonna si prende quel poco che le serve per
     * disegnare un simbolo, e il resto torna alla scheda — su un telefono lo
     * spazio per leggere e per toccare e' tutto li'. */
    assert.match(coda, /\.ed-tabs \{\s*width: 46px;/, file);
    assert.doesNotMatch(coda, /tab-label/, `${file}: la visibilita' del nome non e' di questo foglio`);
  }
});
