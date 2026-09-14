/* «Correggi bene le icone, ancora roba non del nostro catalogo e comunque non
 * si vedono nella configurazione.»
 *
 * Le azioni rapide uscivano con l'emoji del telefono — una lampadina pallida,
 * un torii giapponese al posto del cancello — invece che col disegno di casa,
 * sia nella scheda della configurazione sia sulla Home. La causa non era il
 * disegno che mancava: era il valore salvato. Scegliendo «Cancello» dal
 * catalogo si salvava ⛩️ al posto di `mdi:gate`, e dal segno il disegno non si
 * ritrova piu' — il segno non e' un nome, la stessa 💡 sta sulla lampada e sul
 * gruppo.
 *
 * Queste prove fissano le tre cose che rimettono le icone a posto: il segno
 * torna a essere riconosciuto (cosi' le configurazioni gia' salvate guariscono
 * da sole), il nome resta quello che si salva, e la tabella di che icona
 * spetta a che tipo e' una sola.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { iconGlyphMarkup } from "../src/sections/icon-engine-section.js";
import {
  ACTION_ICON_CATALOG,
  actionCatalogMatch,
  AZIONI_DI_SERIE,
  azioneDiSerie,
  chiaveDellAzione,
  loadCatalogMatch,
  roomCatalogMatch,
} from "../src/core/personalization-catalog.js";

const leggi = (relativo) => readFile(new URL(`../${relativo}`, import.meta.url), "utf8");

test("un'icona salvata come segno ritrova la sua voce del catalogo", () => {
  /* Sono i quattro valori che c'erano davvero nelle configurazioni: senza
   * questa riga restano emoji di sistema per sempre, perche' nessuno riscrive
   * le azioni gia' salvate. */
  for (const [segno, atteso] of [
    ["💡", "lights"],
    ["❄️", "climate"],
    ["🧺", "laundry"],
    ["⛩️", "gate"],
    ["🛡️", "security"],
  ]) {
    assert.equal(actionCatalogMatch(segno)?.id, atteso, `${segno} deve essere ${atteso}`);
  }
});

test("lo stesso segno scritto senza il selettore di variante vale uguale", () => {
  /* Una tastiera manda ⛩️ (col selettore U+FE0F), un'altra ⛩ senza: e' lo
   * stesso segno, e chi l'ha salvato dall'una non deve restare senza disegno
   * per aver usato l'altra. */
  assert.equal(actionCatalogMatch("⛩")?.id, "gate");
  assert.equal(actionCatalogMatch("🛡")?.id, "security");
});

test("il segno e' l'ultimo nome provato, mai il primo", () => {
  /* 🚪 lo portano la porta, l'ingresso e il corridoio: se il segno contasse
   * quanto un nome, cercare «room-hallway» potrebbe finire sulla porta. Il
   * nome vince sempre. */
  assert.equal(actionCatalogMatch("mdi:door-closed")?.id, "door");
  assert.equal(actionCatalogMatch("room-hallway")?.id, "room-hallway");
  assert.equal(actionCatalogMatch("room-entrance")?.id, "room-entrance");
  /* E quando il segno e' l'unica cosa che si ha, vince la prima voce del
   * catalogo, che e' la voce vera e propria e non la stanza omonima. */
  assert.equal(actionCatalogMatch("🚪")?.id, "door");
});

test("anche le stanze e i carichi riconoscono il proprio segno", () => {
  assert.equal(roomCatalogMatch("🛏️")?.id, "bedroom");
  assert.equal(roomCatalogMatch("🧸")?.id, "kids");
  assert.ok(loadCatalogMatch("🍳"), "un carico salvato col suo segno deve trovarsi");
});

test("ogni azione di serie esce come disegno di casa, non come emoji", () => {
  /* Il punto di tutto: dal valore salvato si deve arrivare a un DISEGNO. Se
   * per una di queste voci il tratto non c'e', la plancia ripiega sull'emoji
   * di sistema — diversa su ogni telefono, ed e' esattamente quello che non si
   * vuole vedere. Si chiede al motore, cioe' alla stessa funzione che dipinge
   * la scheda e la Home, invece che a un pezzo per volta. */
  for (const [tipo, nome] of Object.entries(AZIONI_DI_SERIE)) {
    assert.ok(actionCatalogMatch(nome), `${tipo}: «${nome}» deve essere una voce del catalogo`);
    const markup = iconGlyphMarkup("action", nome, { size: 32 });
    assert.match(markup, /\|32\|disegno"/, `${tipo}: «${nome}» deve uscire come disegno`);
    assert.match(markup, /<svg/, `${tipo}: il disegno e' un tratto, non una lettera`);
  }
});

test("un'azione salvata come emoji esce comunque come disegno di casa", () => {
  /* La prova che chi ha gia' configurato non deve rifare niente: il valore
   * salvato resta ⛩️, ma quello che si vede e' il cancello disegnato. */
  for (const segno of ["💡", "❄️", "🧺", "⛩️", "🛡️"]) {
    const markup = iconGlyphMarkup("action", segno, { size: 42 });
    assert.match(markup, /\|42\|disegno"/, `${segno} deve uscire come disegno`);
    assert.match(markup, /<svg/, `${segno} non deve restare un'emoji di sistema`);
  }
});

test("il tipo dell'azione si legge uguale scritto in due modi", () => {
  /* Il guscio lo scrive ora `builtin_clima` (nella tendina) e ora `clima`
   * (nell'azione salvata): sono lo stesso pulsante. */
  assert.equal(chiaveDellAzione("builtin_clima"), "clima");
  assert.equal(azioneDiSerie("builtin_clima"), azioneDiSerie("clima"));
  assert.equal(azioneDiSerie("builtin_luci"), azioneDiSerie("luci"));
  assert.equal(azioneDiSerie("una-cosa-che-non-esiste"), "mdi:star");
});

test("la tabella di che icona spetta a che tipo e' una sola", async () => {
  /* Stava scritta tre volte — nel motore delle icone, un'altra volta per la
   * scheda, e negli editor come emoji — e le tre non dicevano la stessa cosa:
   * le luci erano una lampadina di la' e un gruppo di qua. Chi ne correggeva
   * una lasciava indietro le altre due. */
  const motore = await leggi("src/sections/icon-engine-section.js");
  const editor = await leggi("src/sections/unified-editors-section.js");
  for (const [dove, sorgente] of [
    ["il motore delle icone", motore],
    ["gli editor", editor],
  ]) {
    assert.doesNotMatch(sorgente, /mdi:washing-machine/, `${dove} non riscrive la tabella`);
    assert.doesNotMatch(sorgente, /mdi:shield-home/, `${dove} non riscrive la tabella`);
    assert.match(sorgente, /azioneDiSerie/, `${dove} chiede il nome al catalogo`);
  }
  /* E le emoji della tendina degli editor se ne vanno col resto: un `<option>`
   * sa tenere solo del testo, ma il segno lo da' il catalogo. */
  assert.match(editor, /function actionTypeGlyph/);
  assert.match(editor, /actionCatalogMatch\(azioneDiSerie\(value\)\)\?\.glyph/);
});

test("la passata delle icone degli Avvisi resta dentro la scheda degli Avvisi", async () => {
  /* Cercava «la prima casella di ogni riga di ogni scheda» e disegnava anche
   * sulle Azioni rapide, che il motore aveva gia' sistemato: due simboli sulla
   * stessa riga, uno a sinistra e uno in mezzo ai tasti. */
  const avvisi = await leggi("src/sections/alerts-section.js");
  /* Si guardano i SELETTORI, non i commenti: il selettore vecchio nel commento
   * che spiega il guasto e' la memoria di cosa non rifare. */
  const senzaCommenti = avvisi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(senzaCommenti, /#editor-modal \.ed-acc \.ed-row/);
  /* Si segue il segno che la sezione stessa mette sulle righe che ha
   * riconosciuto come avvisi, e nient'altro. */
  assert.match(avvisi, /const RIGA_DI_UN_AVVISO = "#editor-modal \.ed-row\[data-alert-entity\]";/);
  assert.match(avvisi, /row\.dataset\.alertEntity = entity;/);
});

test("nessun modulo si tiene una copia del cercatore del catalogo", async () => {
  /* Ce n'era una quarta in beta9 — con le sue quattro emoji di ripiego — che
   * non chiamava piu' nessuno: codice morto che diceva una cosa diversa dal
   * catalogo. */
  const beta9 = await leggi("src/sections/beta9-real-device-polish-section.js");
  assert.doesNotMatch(beta9, /actionCatalogItem|ACTION_DEFAULTS/);
  assert.doesNotMatch(beta9, /ACTION_ICON_CATALOG/);
});

test("il catalogo delle azioni non ha voci senza segno", () => {
  /* Il segno e' il ripiego quando il disegno non c'e': una voce senza segno
   * non avrebbe niente da mostrare, e non sarebbe nemmeno ritrovabile da chi
   * l'ha salvata com'era prima. */
  for (const voce of ACTION_ICON_CATALOG) {
    assert.ok(voce.glyph, `la voce ${voce.id} deve avere un segno`);
    assert.ok(voce.mdi?.startsWith("mdi:"), `la voce ${voce.id} deve avere un nome mdi`);
  }
});
