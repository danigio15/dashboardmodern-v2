/* Le zone e gli ingressi della centrale (#511).
 *
 * «Tutti i miei sensori di presenza sono riferiti alla centrale: magari
 * aprendo Sicurezza, dove leggo zone — sarebbero i sensori di presenza — e
 * dove leggo ingressi — sarebbero i varchi mappati dalla centrale.»
 *
 * La prova che conta e' la prima: una centrale ha SOLO le zone che ha
 * dichiarato. Qui c'era la regola opposta — chi non dichiara niente le ha
 * tutte — scritta per far comparire il riquadro senza configurare nulla, e
 * costava troppo: «in zone sicurezza non devi rilevare tu e mettere tutto».
 * Una casa con settanta sensori di presenza apriva Sicurezza e li trovava
 * tutti dentro la centrale, dichiarati da noi al posto suo. Adesso la centrale
 * parte vuota, il riquadro non c'e' finche' non le si dice niente, e la scelta
 * si fa anche con una centrale sola — altrimenti chi ne ha una non potrebbe
 * mai averne.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CAMPO_INGRESSI,
  CAMPO_ZONE,
  ceQualcosaDaMostrare,
  conEntita,
  elencoDiEntita,
  ingressiDellaCentrale,
  ingressiScritti,
  zoneDellaCentrale,
  zoneScritte,
} from "../src/core/le-zone-della-centrale.js";
import { centraliAllarme } from "../src/core/alarm-panel.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (percorso) => readFileSync(join(QUI, "..", percorso), "utf8");

const PRESENZA = [
  { entity: "binary_sensor.salotto_movimento", name: "Salotto", stato: "attivo" },
  { entity: "binary_sensor.corridoio_movimento", name: "Corridoio", stato: "libero" },
];
const VARCHI = [
  { entity: "binary_sensor.porta_ingresso", name: "Porta d'ingresso", stato: "chiuso" },
  { entity: "binary_sensor.finestra_bagno", name: "Finestra bagno", stato: "aperto" },
];

test("una centrale che non dichiara niente non ha zone", () => {
  const centrale = { id: "centrale", nome: "Casa" };
  assert.deepEqual(zoneDellaCentrale(PRESENZA, centrale), []);
  assert.deepEqual(ingressiDellaCentrale(VARCHI, centrale), []);
  assert.deepEqual(zoneScritte(centrale), []);
  assert.deepEqual(ingressiScritti(centrale), []);
  /* E allora in pagina non c'e' niente da disegnare: nessun riquadro vuoto, e
   * nessuna zona adottata da noi. */
  assert.equal(
    ceQualcosaDaMostrare(zoneDellaCentrale(PRESENZA, centrale), ingressiDellaCentrale(VARCHI, centrale)),
    false,
  );
});

test("dichiarandole, restano solo le sue", () => {
  const centrale = {
    [CAMPO_ZONE]: ["binary_sensor.salotto_movimento"],
    [CAMPO_INGRESSI]: ["binary_sensor.finestra_bagno"],
  };
  assert.deepEqual(
    zoneDellaCentrale(PRESENZA, centrale).map((riga) => riga.entity),
    ["binary_sensor.salotto_movimento"],
  );
  assert.deepEqual(
    ingressiDellaCentrale(VARCHI, centrale).map((riga) => riga.entity),
    ["binary_sensor.finestra_bagno"],
  );
});

test("un nome dichiarato che non esiste piu' non inventa una riga", () => {
  /* Un sensore tolto dalla Presenza resta scritto nell'area finche' nessuno la
   * riapre: filtrare e' la strada giusta, elencare sarebbe stato il modo di
   * disegnare una zona che non c'e'. */
  const centrale = { [CAMPO_ZONE]: ["binary_sensor.mai_esistito"] };
  assert.deepEqual(zoneDellaCentrale(PRESENZA, centrale), []);
});

test("l'elenco si legge come array e come stringa, senza vuoti ne' doppioni", () => {
  assert.deepEqual(elencoDiEntita("a.uno, a.due"), ["a.uno", "a.due"]);
  assert.deepEqual(elencoDiEntita(["a.uno", "a.uno", "", "senza-punto"]), ["a.uno"]);
});

test("aggiungere e togliere non tocca la centrale che c'era", () => {
  const prima = { id: "centrale", nome: "Casa" };
  const con = conEntita(prima, CAMPO_ZONE, "binary_sensor.salotto_movimento", true);
  assert.equal(prima[CAMPO_ZONE], undefined, "l'originale non si tocca");
  assert.deepEqual(con[CAMPO_ZONE], ["binary_sensor.salotto_movimento"]);
  /* Tolta l'ultima il campo sparisce: «nessuna» e «non l'ho detto» sono la
   * stessa cosa, e fra le due si scrive la piu' corta. */
  const senza = conEntita(con, CAMPO_ZONE, "binary_sensor.salotto_movimento", false);
  assert.equal(CAMPO_ZONE in senza, false);
  assert.equal(senza.nome, "Casa");
});

test("senza righe non c'e' niente da disegnare", () => {
  assert.equal(ceQualcosaDaMostrare([], []), false);
  assert.equal(ceQualcosaDaMostrare(PRESENZA, []), true);
  assert.equal(ceQualcosaDaMostrare([], VARCHI), true);
});

test("la pagina Sicurezza legge le righe che esistono gia', e non ne fa altre", () => {
  const pagina = sorgente("src/sections/security-showcase-section.js");
  assert.match(pagina, /from "\.\.\/core\/le-zone-della-centrale\.js"/);
  /* Le righe sono quelle della Presenza e dei Varchi: un secondo elenco della
   * stessa casa sarebbe il modo di far dire due numeri diversi alle stesse
   * porte, ed e' gia' successo altrove in questa plancia. */
  assert.match(pagina, /presenzaDiCasa\(/);
  assert.match(pagina, /varchiDiCasa\(/);
  assert.match(pagina, /syncZone\(shell, labels\);/);
  /* E il riquadro sparisce quando non c'e' niente da dire. */
  assert.match(pagina, /if \(!ceQualcosaDaMostrare\(zone, ingressi\)\) \{/);
});

test("l'area salva le sue zone, e non le perde al salvataggio successivo", () => {
  const scheda = sorgente("src/sections/centrali-allarme-editor-section.js");
  assert.match(scheda, /from "\.\.\/core\/le-zone-della-centrale\.js"/);
  /* `salva` riscriveva la riga da zero con tre campi soli: un campo che non
   * conosceva se ne andava in silenzio. E' il modo in cui una scelta appena
   * fatta sparisce al salvataggio dopo. */
  assert.match(scheda, /for \(const campo of \[CAMPO_ZONE, CAMPO_INGRESSI\]\) \{\s*const elenco = elencoDiEntita\(riga\?\.\[campo\]\);/);
  /* E si salva quello che e' acceso, senza scorciatoie: la fila tutta accesa
   * si scriveva vuota — «non l'ho detto» — e col vuoto che vuol dire «nessuna»
   * quella scorciatoia cancellerebbe la scelta appena fatta. */
  assert.doesNotMatch(scheda, /accese\.length === pastiglie\.length/);
  assert.match(scheda, /return elencoDiEntita\(accese\.map\(\(nodo\) => nodo\.dataset\.areaVoce\)\);/);
  /* Niente si accende da solo: la pastiglia e' accesa se e' fra le scelte. */
  assert.match(scheda, /data-on="\$\{dentro\.has\(riga\.entity\)\}"/);
  assert.doesNotMatch(scheda, /const tutte = dentro\.size === 0;/);
  assert.doesNotMatch(scheda, /tutteSeNessuna/);
});

/* La scelta si fa anche con una centrale sola.
 *
 * Prima viveva soltanto dentro la riga di un'area, e le aree nascono da due in
 * su: con la regola nuova — sono sue solo le zone dichiarate — chi ha una
 * centrale sola non avrebbe mai avuto una zona, e il riquadro in pagina non lo
 * avrebbe visto mai. Le stesse pastiglie stanno anche sotto la casella della
 * centrale del guscio, e si salvano nello stesso posto. */
test("le zone si scelgono anche senza una seconda area", () => {
  const scheda = sorgente("src/sections/centrali-allarme-editor-section.js");
  assert.match(scheda, /function zoneDellaSolaMarkup\(voce\) \{/);
  assert.match(scheda, /\$\{zoneDellaSolaMarkup\(lista\[0\]\)\}/);
  /* E una riga sola in elenco non e' una casa spezzata in aree: la casella del
   * guscio resta al suo posto e la fila per passare da un'area all'altra non
   * compare. */
  assert.match(scheda, /function aree\(inElenco\) \{\s*return Array\.isArray\(inElenco\) && inElenco\.length > 1;/);
  assert.match(scheda, /if \(!aree\(inElenco\)\) \{/);
  assert.match(scheda, /const pieno = aree\(inElenco\);/);
  /* Cancellando la penultima area, le zone di quella che resta non si buttano:
   * l'elenco non si svuota piu'. */
  assert.doesNotMatch(scheda, /writeJsonIfChanged\(CHIAVE_CENTRALI, \[\]\);/);
});

/* Passare da un'area all'altra non le spoglia delle sue zone.
 *
 * `passaAllAreaAllarme` riscriveva l'elenco con tre campi — `id`, `nome`,
 * `caselle` — e le zone di tutte le aree se ne andavano al primo passaggio: lo
 * stesso modo in cui le perdeva `normalizzaVoce`, nello stesso giro. */
test("cambiando area, le zone di tutte restano scritte", () => {
  const pagina = sorgente("src/sections/security-showcase-section.js");
  assert.doesNotMatch(pagina, /lista\.map\(\(riga\) => \(\{ id: riga\.id, nome: riga\.nome, caselle: riga\.caselle \}\)\)/);
  assert.match(pagina, /lista\.map\(\(\{ corrente: _inPagina, \.\.\.riga \}\) => riga\)/);
});

/* La lettura canonica non spoglia la riga.
 *
 * `centraliAllarme` e' il posto da cui leggono tutti — l'editor e la card — e
 * passava per una normalizzazione che riscriveva la voce con tre campi:
 * `id`, `nome`, `caselle`. Le zone salvate uscivano da li' sparite, e una
 * riga senza zone nel modello vuol dire «tutte»: il filtro si vedeva
 * funzionare fino al primo ridisegno, poi mostrava di nuovo tutto, e il
 * salvataggio successivo riscriveva le righe spogliate. La prova sta qui e non
 * dentro il modulo dell'elenco, perche' quello che conta e' che le zone
 * arrivino a chi disegna. */
test("le zone e gli ingressi sopravvivono alla lettura della centrale", () => {
  const salvato = [
    {
      id: "centrale",
      nome: "Casa",
      caselle: { "dm.alarm_panel": "alarm_control_panel.casa" },
      [CAMPO_ZONE]: ["binary_sensor.salone", "binary_sensor.cucina"],
      [CAMPO_INGRESSI]: ["binary_sensor.ingresso"],
    },
  ];
  const [voce] = centraliAllarme(salvato, {}, "centrale");
  assert.deepEqual(voce[CAMPO_ZONE], ["binary_sensor.salone", "binary_sensor.cucina"]);
  assert.deepEqual(voce[CAMPO_INGRESSI], ["binary_sensor.ingresso"]);
  /* E il filtro, che e' cio' a cui servivano, taglia davvero. */
  const righe = [
    { entity: "binary_sensor.salone" },
    { entity: "binary_sensor.cucina" },
    { entity: "binary_sensor.mansarda" },
  ];
  assert.deepEqual(
    zoneDellaCentrale(righe, voce).map((riga) => riga.entity),
    ["binary_sensor.salone", "binary_sensor.cucina"],
  );
});

/* Chi non dichiara niente esce senza campi, e non con due array vuoti dentro:
 * la lettura non deve inventare niente, in nessuna delle due direzioni. */
test("una centrale che non dichiara niente esce ancora senza campi", () => {
  const [voce] = centraliAllarme([{ id: "centrale", nome: "Casa", caselle: {} }], {}, "centrale");
  assert.equal(voce[CAMPO_ZONE], undefined);
  assert.equal(voce[CAMPO_INGRESSI], undefined);
});

/* I sommari della card non contano fra quelli a posto chi non risponde.
 *
 * I contatori tengono `liberi`, `chiusi` e `muti` proprio per questo, e la card
 * usava `totale`: con quattro zone tutte scollegate scriveva «4 in quiete». Su
 * una sezione Sicurezza non e' un'imprecisione, e' dire che una centrale
 * sorveglia mentre non sta guardando niente. */
test("i sommari delle zone chiedono i liberi e i muti, non il totale", () => {
  const sorgente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "security-showcase-section.js"),
    "utf8",
  );
  assert.match(sorgente, /zoneSommario\(conto\.attivi, conto\.liberi, conto\.muti\)/);
  assert.match(sorgente, /ingressiSommario\(varchi\.aperti, varchi\.chiusi, varchi\.muti\)/);
  assert.doesNotMatch(sorgente, /zoneSommario\(conto\.attivi, conto\.totale\)/);
  assert.doesNotMatch(sorgente, /ingressiSommario\(varchi\.aperti, ingressi\.length\)/);
});
