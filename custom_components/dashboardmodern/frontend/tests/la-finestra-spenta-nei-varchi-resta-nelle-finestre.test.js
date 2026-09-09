/* La scelta «nel widget» vale per una tessera, non per un'entita'.
 *
 * «se la finestra e configurata nella sezione finestre e no nei varchi la
 *  segnalazione resta in finestre non deve scomparire»
 *
 * Lo stesso contatto sta scritto due volte: nelle Finestre, accanto alla
 * tapparella, e nei Varchi, che contano cosa e' aperto. Sono due sezioni e due
 * tessere. L'interruttore spegneva l'entita' e non la riga: toccarlo nei
 * Varchi la faceva sparire anche dalle Finestre, dove nessuno aveva chiesto
 * niente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;
/* La plancia si legge dallo store, non dal magazzino: le tessere disegnano
 * solo una casa configurata, e senza store `planciaConfigurata()` direbbe di
 * no e non ci sarebbe niente da guardare. */
const sezioni = { rooms: [{ id: "r1", name: "Camera" }] };
globalThis.DashboardModernModules = { store: { getSection: (nome) => sezioni[nome] } };

const {
  escluseDellaTessera,
  leggiLaVoce,
  rimettiNellaTessera,
  scriviLaVoce,
  tesseraDelBlocco,
  tesseraDellaScheda,
  togliDallaTessera,
  TESSERE_PER_BLOCCO,
  TESSERE_PER_SCHEDA,
} = await import("../src/core/fuori-dai-widget.js");
const { modelliDelleTessere, widgetExcludedEntities } = await import(
  "../src/sections/home-widgets-section.js"
);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");
const scrivi = (chiave, valore) => magazzino.set(chiave, JSON.stringify(valore));

const CONTATTO = "binary_sensor.finestra_camera";
const STATI = {
  [CONTATTO]: {
    entity_id: CONTATTO,
    state: "on",
    attributes: { friendly_name: "Finestra camera", device_class: "window" },
  },
};

/** Le due tessere che raccontano lo stesso contatto, come stanno adesso. */
function tessere() {
  const modelli = modelliDelleTessere(STATI) || [];
  const trova = (chiave) => modelli.find((widget) => widget?.key === chiave) || null;
  const dentro = (widget) => (widget?.rows || []).some((riga) => riga?.entity === CONTATTO);
  return { varchi: dentro(trova("varchi")), finestre: dentro(trova("tapparelle")) };
}

function casaConLaFinestraInDueSezioni() {
  magazzino.clear();
  /* La stessa finestra, dichiarata due volte come chi la usa la dichiara: una
   * riga senza motori nelle Finestre — solo il contatto sull'anta — e nei
   * Varchi nemmeno dichiarata, perche' li' basta il `device_class` di Home
   * Assistant. */
  scrivi("cd_tapparelle", [{ name: "Camera", contact: CONTATTO }]);
}

test("la finestra spenta nei Varchi resta nelle Finestre", () => {
  casaConLaFinestraInDueSezioni();
  assert.deepEqual(tessere(), { varchi: true, finestre: true });

  scrivi("cd_widgets", { excluded: [`varchi|${CONTATTO}`] });
  assert.deepEqual(tessere(), { varchi: false, finestre: true });

  /* E viceversa: spenta nelle Finestre resta nei Varchi. La scelta e' della
   * riga che si tocca, in tutte e due i versi. */
  scrivi("cd_widgets", { excluded: [`tapparelle|${CONTATTO}`] });
  assert.deepEqual(tessere(), { varchi: true, finestre: false });
});

test("una scelta gia' fatta continua a valere ovunque", () => {
  casaConLaFinestraInDueSezioni();
  /* Le voci nude sono quelle che la gente ha gia' in configurazione: valgono
   * quello che valevano, o chi aveva tolto qualcosa dalla Home se lo
   * ritroverebbe tornato al primo aggiornamento. */
  scrivi("cd_widgets", { excluded: [CONTATTO] });
  assert.deepEqual(tessere(), { varchi: false, finestre: false });
});

test("l'elenco si legge per tessera, e le voci di un'altra non contano", () => {
  const elenco = ["light.corridoio", `varchi|${CONTATTO}`, `tapparelle|switch.tenda`];
  assert.deepEqual([...escluseDellaTessera(elenco, "varchi")], ["light.corridoio", CONTATTO]);
  assert.deepEqual([...escluseDellaTessera(elenco, "tapparelle")], [
    "light.corridoio",
    "switch.tenda",
  ]);
  assert.deepEqual([...escluseDellaTessera(elenco, "luci")], ["light.corridoio"]);
  // Senza tessera non si sa di cosa si parla: contano solo le voci nude.
  assert.deepEqual([...escluseDellaTessera(elenco, "")], ["light.corridoio"]);
  assert.deepEqual([...escluseDellaTessera(null, "varchi")], []);

  assert.deepEqual(leggiLaVoce(" varchi | binary_sensor.x "), {
    chiave: "varchi",
    entita: "binary_sensor.x",
  });
  assert.deepEqual(leggiLaVoce("light.a"), { chiave: "", entita: "light.a" });
  assert.equal(leggiLaVoce("  "), null);
  assert.equal(leggiLaVoce("|light.a"), null);
  assert.equal(scriviLaVoce("varchi", "light.a"), "varchi|light.a");
  assert.equal(scriviLaVoce("", "light.a"), "light.a");
  assert.equal(scriviLaVoce("varchi", " "), "");
});

test("togliere e rimettere scrivono la tessera, non l'entita'", () => {
  assert.deepEqual(togliDallaTessera([], "varchi", CONTATTO), [`varchi|${CONTATTO}`]);
  // Chi e' gia' fuori da tutte non si toglie una seconda volta.
  assert.deepEqual(togliDallaTessera([CONTATTO], "varchi", CONTATTO), [CONTATTO]);
  assert.deepEqual(togliDallaTessera([`varchi|${CONTATTO}`], "varchi", CONTATTO), [
    `varchi|${CONTATTO}`,
  ]);
  // Senza tessera la voce nasce nuda, che e' quello che si faceva prima.
  assert.deepEqual(togliDallaTessera([], "", CONTATTO), [CONTATTO]);

  /* Rimettere dentro nei Varchi toglie la voce dei Varchi e quella nuda — che
   * chi tocca l'interruttore ha appena smentito — e lascia stare le Finestre:
   * di quelle non si e' detto niente. */
  assert.deepEqual(
    rimettiNellaTessera([CONTATTO, `varchi|${CONTATTO}`, `tapparelle|${CONTATTO}`], "varchi", CONTATTO),
    [`tapparelle|${CONTATTO}`],
  );
  // Senza tessera non c'e' un «qui» da cui rimettere dentro: si rimette ovunque.
  assert.deepEqual(rimettiNellaTessera([CONTATTO, `varchi|${CONTATTO}`], "", CONTATTO), []);
  assert.deepEqual(rimettiNellaTessera(["light.a"], "varchi", CONTATTO), ["light.a"]);
});

test("ogni tessera chiede il proprio elenco, nessuna chiede quello di tutti", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  const chiamate = ponte.match(/widgetExcludedEntities\([^)]*\)/g) || [];
  // Trentadue tessere che chiedono la propria, piu' il ripiego della firma di
  // `widgetIncludes`: nessun'altra chiamata senza chiave.
  const nude = chiamate.filter((chiamata) => chiamata === "widgetExcludedEntities()");
  assert.equal(nude.length, 1);
  assert.match(ponte, /export function widgetExcludedEntities\(chiave = ""\)/);
  assert.match(ponte, /escluseDellaTessera\(widgetPreferences\(\)\.excluded, chiave\)/);
  // Le chiavi sono quelle delle tessere stesse, non nomi inventati qui.
  for (const [chiamata, chiave] of [
    ['widgetExcludedEntities("varchi")', "varchi"],
    ['widgetExcludedEntities("tapparelle")', "tapparelle"],
    ['widgetExcludedEntities("sicurezza")', "sicurezza"],
  ]) {
    assert.ok(ponte.includes(chiamata), `manca ${chiamata}`);
    assert.match(ponte, new RegExp(`key: "${chiave}"`));
  }
});

test("l'interruttore sa di quale tessera parla prima di scrivere", () => {
  const scelta = leggi("sections/widget-entity-choice-section.js");
  // Il marchio della scheda vince sul posto del blocco, e il posto sulla
  // linguetta: dal piu' preciso al piu' generico.
  assert.match(scelta, /export function tesseraDellaRiga\(nodo\)/);
  assert.match(scelta, /closest\?\.\(`\[\$\{MARCHIO_TESSERA\}\]`\)/);
  assert.match(scelta, /tesseraDelBlocco\(posto\)/);
  assert.match(scelta, /tesseraDellaScheda\(schedaAttiva\(\)\)/);
  // I blocchi si contano fra i figli diretti del corpo, come li conta il
  // guscio quando decide quale lasciare aperto.
  assert.match(scelta, /querySelectorAll\(":scope > details\.ed-acc"\)/);
  // La tessera viaggia addosso al tasto: al tocco non si torna a chiedere alla
  // pagina dov'era la riga.
  assert.match(scelta, /TESSERA_ATTRIBUTE = "data-dm-widget-tessera"/);
  assert.match(scelta, /togliDallaTessera\(elenco, tessera, entity\)/);
  assert.match(scelta, /rimettiNellaTessera\(elenco, tessera, entity\)/);
});

test("le schede che ospitano una tessera d'altri lo dichiarano", () => {
  /* Tre moduli disegnano la loro scheda dentro la linguetta di un'altra
   * sezione: senza il marchio, l'interruttore scriverebbe la scelta a nome
   * della sezione che ospita. */
  for (const [modulo, tessera] of [
    ["sections/vmc-editor-section.js", "vmc"],
    ["sections/macchine-editor-section.js", "macchine"],
  ]) {
    const fonte = leggi(modulo);
    assert.match(fonte, /MARCHIO_TESSERA/);
    assert.ok(fonte.includes(`"${tessera}"`), `${modulo} non nomina ${tessera}`);
  }
  const termici = leggi("sections/impianti-termici-editor-section.js");
  for (const tessera of ["solare", "scaldabagno", "caldaia"])
    assert.match(termici, new RegExp(`\\$\\{MARCHIO_TESSERA\\}="${tessera}"`));
  // L'aria e le allerte stanno nella stessa scheda e sono due tessere.
  assert.match(leggi("sections/allerte-editor-section.js"), /\$\{MARCHIO_TESSERA\}="\$\{CHIAVE_ARIA\}"/);
});

test("le mappe nominano linguette e tessere che esistono davvero", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  const guscio = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "legacy", "dashboard-runtime-it.js"),
    "utf8",
  );
  const chiaviDelleTessere = new Set(
    [...ponte.matchAll(/key: "([a-z-]+)"/g)].map((trovato) => trovato[1]),
  );
  for (const tessera of [...Object.values(TESSERE_PER_SCHEDA), ...Object.values(TESSERE_PER_BLOCCO)])
    assert.ok(chiaviDelleTessere.has(tessera), `nessuna tessera si chiama ${tessera}`);

  /* I posti dei blocchi sono gli stessi che conta il guscio: la Sicurezza ne
   * apre due — il suo e quello delle Telecamere — ed e' il motivo per cui la
   * linguetta da sola non basterebbe. */
  assert.match(guscio, /function cdSecKeyByOrd\(n\)\{ return \['home','energy','ev','boiler','security','','server','temp','','clima',''\]/);
  assert.equal(tesseraDelBlocco(4), "sicurezza");
  assert.equal(tesseraDelBlocco(10), "telecamere");
  assert.equal(tesseraDelBlocco(0), "");
  assert.match(guscio, /var alsoN=\(n===4\)\?10:-1;/);

  /* Le linguette esistono: o le disegna il guscio, o le dichiara un modulo
   * come costante della sua scheda. Una linguetta inventata qui vorrebbe dire
   * una scelta scritta a nome di una pagina che nessuno apre. */
  const moduli = readdirSync(join(SRC, "sections"))
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => readFileSync(join(SRC, "sections", nome), "utf8"))
    .join("\n");
  for (const scheda of Object.keys(TESSERE_PER_SCHEDA))
    assert.ok(
      guscio.includes(`data-tab="${scheda}"`) ||
        new RegExp(`_TAB = "${scheda}"`).test(moduli) ||
        new RegExp(`_TAB = [A-Z_]+;[\\s\\S]*?"${scheda}"`).test(moduli),
      `nessuna scheda si chiama ${scheda}`,
    );
  assert.equal(tesseraDellaScheda("tapp"), "tapparelle");
  assert.equal(tesseraDellaScheda("varchi"), "varchi");
  // Gli Avvisi servono tre tessere sulla stessa pagina: li' non si indovina.
  assert.equal(tesseraDellaScheda("avvisi"), "");
  assert.equal(tesseraDellaScheda(""), "");
});

test("chi legge senza dire la tessera vede solo chi e' fuori da tutte", () => {
  magazzino.clear();
  scrivi("cd_widgets", { excluded: ["light.a", "varchi|light.b"] });
  assert.deepEqual([...widgetExcludedEntities()], ["light.a"]);
  assert.deepEqual([...widgetExcludedEntities("varchi")], ["light.a", "light.b"]);
});
