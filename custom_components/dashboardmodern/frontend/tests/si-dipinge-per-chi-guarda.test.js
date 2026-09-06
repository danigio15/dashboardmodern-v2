/* Si dipinge per chi guarda, e solo di cio' che e' cambiato.
 *
 * Le pagine restano nel documento: il guscio le nasconde, non le toglie. Una
 * sezione che ridisegna a ogni mazzetto di stati — mezzo secondo, e una casa
 * vera ne manda di continuo — lavorava anche per le otto pagine che nessuno ha
 * davanti, e per la plancia messa da parte dietro un'altra pagina di Home
 * Assistant. La regola sta in un posto solo, e queste sono le sue prove.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const documento = {
  visibilityState: "visible",
  pagine: new Map(),
  getElementById(id) {
    return documento.pagine.get(id) || null;
  },
};

function pagina(id, attiva) {
  documento.pagine.set(id, { classList: { contains: (nome) => nome === "active" && attiva } });
}

globalThis.document = documento;
globalThis.localStorage = { getItem: () => null, setItem() {} };

const { ilCambioTocca, paginaVisibile, planciaVisibile } = await import(
  "../src/sections/shared.js"
);

test.afterEach(() => {
  documento.visibilityState = "visible";
  delete globalThis.__DASHBOARDMODERN_PARCHEGGIATA__;
});

test("la scheda in secondo piano spegne il disegno", () => {
  assert.equal(planciaVisibile(), true);
  documento.visibilityState = "hidden";
  assert.equal(planciaVisibile(), false);
});

test("e anche la plancia messa da parte", () => {
  /* Il parcheggio: chi ospita la plancia la mette al riparo quando si va su
   * un'altra pagina di Home Assistant. La cornice resta viva — e' tutto il
   * punto — ma nessuno la guarda: il documento dentro continua a dirsi
   * «visible», quindi senza questo segno le sezioni avrebbero continuato a
   * disegnare, e le telecamere a far lavorare il server di casa. */
  globalThis.__DASHBOARDMODERN_PARCHEGGIATA__ = true;
  assert.equal(planciaVisibile(), false);
  globalThis.__DASHBOARDMODERN_PARCHEGGIATA__ = false;
  assert.equal(planciaVisibile(), true);
});

test("si dipinge la pagina aperta, non le altre otto", () => {
  pagina("page-luci", true);
  pagina("page-prese", false);
  assert.equal(paginaVisibile("page-luci"), true);
  assert.equal(paginaVisibile("page-prese"), false);
  documento.visibilityState = "hidden";
  assert.equal(paginaVisibile("page-luci"), false, "nemmeno quella aperta, a scheda nascosta");
});

test("una pagina che non c'e' non spegne niente", () => {
  /* Chi la cerca disegna altrove — un guscio fatto in un altro modo, una
   * prova — e tacere li' vorrebbe dire spegnere quella sezione per sempre. */
  assert.equal(paginaVisibile("page-che-non-esiste"), true);
});

test("il mazzetto tocca solo chi ci sta dentro", () => {
  const mie = ["light.salone", "switch.presa"];
  const mazzetto = (entity_ids) => ({ detail: { entity_ids, coalesced: true } });
  assert.equal(ilCambioTocca(mazzetto(["light.salone"]), mie), true);
  assert.equal(ilCambioTocca(mazzetto(["sensor.altro", "switch.presa"]), mie), true);
  assert.equal(ilCambioTocca(mazzetto(["sensor.altro", "sensor.ancora"]), mie), false);
  /* Il vecchio avviso con una entita' sola vale come un mazzetto da uno. */
  assert.equal(ilCambioTocca({ detail: { entity_id: "light.salone" } }, mie), true);
  assert.equal(ilCambioTocca({ detail: { entity_id: "sensor.altro" } }, mie), false);
});

test("senza elenco, o senza entita' nell'avviso, si dipinge", () => {
  /* Una sezione che non sa dire cosa legge continua a fare come ha sempre
   * fatto, e un annuncio generico — «gli stati sono pronti» — non si scarta. */
  assert.equal(ilCambioTocca({ detail: { entity_ids: ["sensor.x"] } }, []), true);
  assert.equal(ilCambioTocca({ detail: {} }, ["light.salone"]), true);
  assert.equal(ilCambioTocca(undefined, ["light.salone"]), true);
  /* Un insieme va bene quanto una lista: le sezioni tengono i loro id cosi'. */
  assert.equal(ilCambioTocca({ detail: { entity_ids: ["a.b"] } }, new Set(["a.b"])), true);
  assert.equal(ilCambioTocca({ detail: { entity_ids: ["a.b"] } }, new Set(["c.d"])), false);
});

/* ── e chi disegna, chi lo chiede ────────────────────────────────────────── */

/* Le sezioni che dipingono una pagina sola adesso lo chiedono, invece di
 * dipingerla comunque. Sono tante, e la regola e' una: questa e' la lista di
 * chi la rispetta, cosi' che togliere il cancello a una di loro si veda.
 */
const SRC = new URL("../src/", import.meta.url);
const leggi = (relativo) => readFileSync(new URL(relativo, SRC), "utf8");

test("chi dipinge una pagina chiede prima se quella pagina si vede", () => {
  const attese = [
    ["sections/rooms-page-section.js", /if \(!paginaVisibile\(ROOMS_PAGE_ID\)\) return;/],
    ["sections/prese-section.js", /if \(!paginaVisibile\(PRESE_PAGE_ID\)\) return;/],
    ["sections/rifiuti-section.js", /if \(!paginaVisibile\(RIFIUTI_PAGE_ID\)\) return;/],
    ["sections/allerte-section.js", /if \(!paginaVisibile\(ALLERTE_PAGE_ID\)\) return;/],
    ["sections/termico-del-caldo-section.js", /if \(!laFinestraDelClimaSiVede\(\)\) return false;/],
    ["sections/azioni-rapide-vassoio-section.js", /if \(!paginaVisibile\("page-home"\)\) return;/],
    ["sections/page-masthead-section.js", /if \(!planciaVisibile\(\)\) return;/],
    ["sections/lights-page-section.js", /if \(!doc \|\| !planciaVisibile\(\)\) return 0;/],
  ];
  for (const [file, regola] of attese) assert.match(leggi(file), regola, file);
});

test("e al ritorno sulla linguetta si ridipinge, senza aspettare la casa", () => {
  /* Il cancello da solo lascerebbe la pagina ferma a com'era quando la si e'
   * lasciata: si arriva, e finche' in casa non cambia qualcosa non si aggiorna
   * niente. Chi si e' messo il cancello si e' preso anche il ritorno. */
  for (const file of [
    "sections/rooms-page-section.js",
    "sections/lights-page-section.js",
    "sections/prese-section.js",
    "sections/rifiuti-section.js",
    "sections/allerte-section.js",
    "sections/azioni-rapide-vassoio-section.js",
    "sections/page-masthead-section.js",
    "sections/english-runtime-strings-section.js",
  ])
    assert.match(leggi(file), /quandoSiCambiaPagina\(/, file);
});

test("le card delle luci si riallineano solo dentro la pagina aperta", () => {
  /* Le stesse card stanno su tre pagine — Luci, Stanze, Prese — e la ricerca
   * girava su tutto il documento a ogni mazzetto di stati. */
  const luci = leggi("sections/lights-page-section.js");
  assert.match(luci, /querySelectorAll\("\.page\.active \[data-dm-lucip\]"\)/);
});

test("la finestra della lavatrice si rifa' quando si apre, non a ogni giro", () => {
  /* `replaceChildren` sulla griglia dei programmi butta via i tasti e li
   * ricostruisce: girava due volte al secondo per una finestra chiusa. */
  const lavatrice = leggi("sections/il-popup-della-lavatrice-section.js");
  assert.match(lavatrice, /function laFinestraSiVede\(\)/);
  assert.match(lavatrice, /if \(laFinestraSiVede\(\)\) ridisegna\(\);/);
  assert.match(lavatrice, /wrapFunction\("apriPopupLavatrice", "__dmPopupLavatrice", ridisegna\)/);
});

test("il pannello termico si rifa' quando la sua finestra si apre", () => {
  /* Il pannello sta dentro la finestra del Clima rapido, non nella pagina
   * Clima: `replaceChildren` con una riga per macchina girava a ogni mazzetto
   * di stati con la finestra chiusa. */
  const termico = leggi("sections/termico-del-caldo-section.js");
  assert.match(termico, /function laFinestraDelClimaSiVede\(\)/);
  assert.match(termico, /quick-clima-modal/);
  assert.match(termico, /for \(const nome of \["apriQuickClima", "setQuickClimaMode"\]\)/);
  /* E la pillola della caldaia, che sta nella testata della Home e non nella
   * finestra, si disegna comunque. */
  const pannello = termico.slice(termico.indexOf("export function disegnaPannello"));
  assert.ok(
    pannello.indexOf("pillolaDellaCaldaia()") < pannello.indexOf("laFinestraDelClimaSiVede()"),
    "la pillola si disegna prima del cancello della finestra",
  );
});

test("il cielo della tapparella non ascolta i cambi di stato", () => {
  /* La fascia del giorno la decide l'orologio e cambia cinque volte al giorno:
   * il timer al prossimo cambio la copre tutta, e ogni giro in piu' rimetteva
   * anche quel timer. */
  const cielo = leggi("sections/shutter-sky-section.js");
  assert.doesNotMatch(cielo, /dashboardmodern:state-changed/);
  assert.match(cielo, /millisToNextPhase/);
});

test("il ripasso delle parole inglesi guarda solo le pagine aperte", () => {
  const inglese = leggi("sections/english-runtime-strings-section.js");
  assert.match(inglese, /paginaVisibile\("page-security", doc\)/);
  assert.match(inglese, /paginaVisibile\("page-home", doc\)/);
  /* E il battito dell'allarme tace su una plancia che nessuno guarda. */
  assert.match(inglese, /if \(!planciaVisibile\(doc\)\) return;/);
});

test("la passata delle traduzioni non entra dove nessuno vede", () => {
  const passata = leggi("core/i18n-dom.js");
  assert.match(passata, /const NASCOSTO = "\.page:not\(\.active\)/);
  assert.match(passata, /optedOut\(node\) \|\| hiddenSubtree\(node\)/);
});
