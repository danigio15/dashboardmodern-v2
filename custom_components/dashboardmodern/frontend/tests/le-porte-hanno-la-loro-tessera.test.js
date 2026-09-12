/* Le porte e i cancelli escono dalla Sicurezza (#457).
 *
 * «Create a doors widget in the home, separate from the security widget.»
 *
 * Il motivo per cui è una richiesta giusta e non un gusto: le due tessere
 * rispondono a due domande diverse. La Sicurezza dice **come sta la casa** —
 * inserito, disinserito, allarme — mentre le aperture sono **comandi**: aprimi
 * il portone. Tenerle insieme voleva dire aprire la tessera per una qualunque
 * delle due, e leggere lo stato dell'antifurto in una didascalia che invece
 * portava il nome della prima porta.
 *
 * Quello che va provato però non è che la tessera esista. È che nessuno perda
 * niente nel passaggio, e sono tre cose diverse:
 *
 * - chi aveva **spento un'apertura** dalla Home aveva scritto «sicurezza|…»,
 *   perché allora la tessera si chiamava così. Quella scelta deve restare in
 *   piedi col nome nuovo — e deve potersi disdire, o l'apertura resterebbe
 *   spenta per sempre;
 * - chi aveva **nascosto la Sicurezza** aveva nascosto anche le porte, perché
 *   non c'era altro posto dove stessero: non devono ricomparire da sole. Ma
 *   una volta sola: se poi le accende, restano accese;
 * - chi aveva **ordinato** le tessere ha «sicurezza» a un certo posto e
 *   «porte» da nessuna parte: vanno accanto a quella da cui sono uscite, non
 *   in fondo alla Home.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  escluseDellaTessera,
  rimettiNellaTessera,
  tesseraDellaScheda,
} from "../src/core/fuori-dai-widget.js";
import { haOggettoWidget, oggettoWidget } from "../src/core/oggetti-widget.js";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { porteAperte, widgetPreferences } = await import("../src/sections/home-widgets-section.js");

const PONTE = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);
const EDITOR = readFileSync(
  new URL("../src/sections/todo-editor-section.js", import.meta.url),
  "utf8",
);

function scrivi(valore) {
  magazzino.clear();
  magazzino.set("cd_widgets", JSON.stringify(valore));
}

/* ── quante ne sono aperte, e quali sanno dirlo ──────────────────────── */

test("solo le serrature dicono di stare aperte: un relè acceso non è un cancello aperto", () => {
  const doors = [
    { entity: "lock.portone" },
    { entity: "lock.ingresso" },
    { entity: "switch.cancelletto" },
    { entity: "button.citofono" },
  ];
  const states = {
    "lock.portone": { state: "unlocked" },
    "lock.ingresso": { state: "locked" },
    /* Acceso, sì — ma l'acceso di un relè dura un secondo e non vuol dire che
     * il cancello sia rimasto aperto. Contarlo sarebbe inventare un allarme. */
    "switch.cancelletto": { state: "on" },
    "button.citofono": { state: "on" },
  };
  assert.deepEqual(
    porteAperte(doors, states).map((door) => door.entity),
    ["lock.portone"],
  );
});

test("aperta, in apertura e sbloccata contano; chiusa a chiave e muta no", () => {
  const stato = (state) => porteAperte([{ entity: "lock.x" }], { "lock.x": { state } }).length;
  assert.equal(stato("unlocked"), 1);
  assert.equal(stato("open"), 1);
  assert.equal(stato("opening"), 1);
  assert.equal(stato("locked"), 0);
  assert.equal(stato("unavailable"), 0);
  assert.equal(porteAperte([{ entity: "lock.x" }], {}).length, 0);
});

/* ── quello che era già stato scelto ─────────────────────────────────── */

test("un'apertura spenta ai tempi della Sicurezza resta spenta, col nome nuovo", () => {
  const elenco = ["sicurezza|switch.cancelletto"];
  assert.ok(
    escluseDellaTessera(elenco, "porte").has("switch.cancelletto"),
    "l'apertura tolta dalla Home ci tornerebbe da sola: è una scelta cancellata in silenzio",
  );
});

test("e si può riaccendere: la voce vecchia se ne va con quella nuova", () => {
  assert.deepEqual(
    rimettiNellaTessera(["sicurezza|switch.cancelletto"], "porte", "switch.cancelletto"),
    [],
  );
  /* Le scelte di altre tessere non si toccano: è la regola di sempre. */
  assert.deepEqual(
    rimettiNellaTessera(
      ["sicurezza|switch.cancelletto", "varchi|binary_sensor.finestra"],
      "porte",
      "switch.cancelletto",
    ),
    ["varchi|binary_sensor.finestra"],
  );
});

test("il nome nuovo non cammina all'indietro: «porte|…» non parla della Sicurezza", () => {
  assert.equal(escluseDellaTessera(["porte|switch.x"], "sicurezza").has("switch.x"), false);
  assert.equal(escluseDellaTessera(["porte|switch.x"], "varchi").has("switch.x"), false);
});

test("la scheda delle aperture parla adesso della tessera delle Porte", () => {
  assert.equal(tesseraDellaScheda("doors"), "porte");
});

/* ── nascoste e ordinate ─────────────────────────────────────────────── */

test("chi aveva nascosto la Sicurezza non si ritrova le porte in Home", () => {
  scrivi({ hidden: ["sicurezza"] });
  assert.ok(widgetPreferences().hidden.includes("porte"));
});

test("ma una volta sola: accese una volta, restano accese", () => {
  /* Salvando da questa versione l'editor scrive tutto il catalogo nell'ordine,
   * «porte» compresa: è il segno che la scelta l'ha fatta chi la usa. */
  scrivi({ hidden: ["sicurezza"], order: ["sicurezza", "porte", "luci"] });
  assert.equal(widgetPreferences().hidden.includes("porte"), false);
});

test("chi non aveva nascosto niente le vede, ed è quello che ha chiesto", () => {
  scrivi({ hidden: ["luci"] });
  const preferenze = widgetPreferences();
  assert.equal(preferenze.hidden.includes("porte"), false);
  assert.ok(preferenze.hidden.includes("luci"));
});

test("le porte si mettono accanto alla Sicurezza, non in fondo alla Home", () => {
  scrivi({ order: ["luci", "sicurezza", "clima"] });
  assert.deepEqual(widgetPreferences().order, ["luci", "sicurezza", "porte", "clima"]);
});

test("e chi le ha già ordinate se le tiene dove le ha messe", () => {
  scrivi({ order: ["porte", "luci", "sicurezza"] });
  assert.deepEqual(widgetPreferences().order, ["porte", "luci", "sicurezza"]);
});

test("senza un ordine salvato non si inventa un ordine", () => {
  scrivi({});
  assert.deepEqual(widgetPreferences().order, []);
});

/* ── la tessera, e chi la disegna ────────────────────────────────────── */

test("il disegno è il nostro, ed è quello stesso delle aperture: non una seconda copia", () => {
  assert.equal(haOggettoWidget("porte"), true);
  assert.equal(oggettoWidget("porte"), oggettoWidget("aperture"));
  assert.match(oggettoWidget("porte"), /<svg class="dm-oggetto"/);
});

test("la tessera esiste, porta in «Apri porte» e si può ordinare e spegnere", () => {
  assert.match(PONTE, /key: "porte"/);
  assert.match(PONTE, /porteModel\(states\),/);
  /* Qui c'era scritto «security», ed era giusto quando le porte stavano nella
   * Sicurezza. Con la #275 sono uscite: hanno la loro pagina e la loro voce, e
   * questa riga era rimasta indietro — il tasto «Apri sezione» portava in una
   * pagina dove quelle porte non ci sono piu' (#501). Il nome della voce lo
   * dichiara la sezione che la crea, e da qui si nomina la sua costante invece
   * di ribatterlo: e' il modo di non restare indietro un'altra volta. */
  assert.match(PONTE, /porte: APERTURE_TAB,/);
  assert.doesNotMatch(PONTE, /porte: "security",/);
  /* «Apri porte» e non «Porte» (#513): la voce con cui si spegne la tessera si
   * chiama come la tessera, o il config e la Home direbbero due nomi per la
   * stessa cosa. */
  assert.match(EDITOR, /\["porte", "🚪", t\("Apri porte", "Openers"\)\]/);
});

/* La fascia sotto il meteo legge questo campo, e senza non ha niente da dire
 * (#482). Chi tocchera' la tessera se ne accorge qui, non dalla segnalazione
 * di chi ha le porte aperte e la fascia muta. */
test("la tessera pubblica le porte aperte, che è quello che la fascia legge", () => {
  const inizio = PONTE.indexOf('key: "porte"');
  assert.notEqual(inizio, -1);
  const corpo = PONTE.slice(inizio, PONTE.indexOf("};", inizio));
  assert.match(corpo, /open: aperte\.map\(/, "le porte aperte non escono col modello");
});

test("il tasto che apre è uno solo, e adesso sta nelle Porte", () => {
  /* Conferma, tastierino del PIN e chiamata li ascolta il documento intero
   * dalla pagina Sicurezza: qui non si ricopia niente, si sposta e basta. */
  const corpo = (firma) => {
    const inizio = PONTE.indexOf(firma);
    assert.notEqual(inizio, -1, `non c'è più nessuna ${firma}`);
    return PONTE.slice(inizio, PONTE.indexOf("\n}\n", inizio));
  };
  assert.match(corpo("function porteDetail("), /data-dm-door=/);
  assert.doesNotMatch(
    corpo("function securityDetail("),
    /data-dm-door=/,
    "le porte si aprono da due posti: due mani per lo stesso gesto",
  );
});
