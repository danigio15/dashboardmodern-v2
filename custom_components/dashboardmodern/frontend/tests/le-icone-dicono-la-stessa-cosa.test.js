/* Le icone dicono la stessa cosa dappertutto, o tacciono.
 *
 * Tre difetti visti sul campo nello stesso giro di editor:
 *
 * 1. Nel form delle Stanze l'anteprima accanto al campo mdi: diceva l'emoji
 *    di sistema (🚿 per mdi:shower) mentre il catalogo e le righe salvate
 *    dicono il disegno di casa — «prima si mostra un'icona poi se ne vede
 *    un'altra e quando si salva si vede quella del catalogo».
 *
 * 2. Nelle tendine «Seleziona stanza» (Temperatura, Clima, Finestre) i nomi
 *    uscivano con l'emoji davanti — «il catalogo non nostro delle icone». In
 *    un option nativo il disegno di casa non si puo' mettere: allora niente
 *    icona, solo il nome.
 *
 * 3. Nel catalogo, cercando, l'icona trovata restava nella sua posizione in
 *    fondo a una finestra ad altezza fissa: il guscio dei dialoghi prevede due
 *    figli (testata + corpo) ma il picker ne ha tre (testata, ricerca,
 *    griglia), e la riga elastica finiva alla ricerca.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const SEZIONI = join(QUI, "..", "src", "sections");
const leggi = (nome) => readFileSync(join(SEZIONI, nome), "utf8");

test("l'anteprima del form Stanze chiede il disegno al motore delle icone", () => {
  const testo = leggi("beta4-mobile-polish-section.js");
  const refresh = testo.slice(testo.indexOf("const refresh = () => {"));
  assert.match(
    refresh.slice(0, 600),
    /DashboardModernIconEngine\?\.markup\?\.\("room"/,
    "l'anteprima deve passare dal motore dei disegni, non dall'emoji",
  );
});

test("le tendine delle stanze dicono solo il nome, senza l'emoji davanti", () => {
  const testo = leggi("beta16-real-device-layout-section.js");
  assert.doesNotMatch(
    testo,
    /directEmoji|roomGlyph/,
    "beta16 non deve piu' anteporre il glifo emoji alle option",
  );
  assert.match(
    testo,
    /option\.textContent = clean\(room\.name\) \|\| option\.value/,
    "l'option porta il nome della stanza e basta",
  );
});

test("il dialogo del picker ha una riga per ognuno dei suoi tre figli", () => {
  const testo = leggi("icon-engine-section.js");
  assert.match(
    testo,
    /\.dm-section-modal \.dm-section-dialog\.dm-picker-dialog\{height:auto!important;grid-template-rows:auto auto minmax\(0,1fr\)!important/,
    "testata, ricerca e griglia: la riga elastica va alla griglia, non alla ricerca",
  );
});
