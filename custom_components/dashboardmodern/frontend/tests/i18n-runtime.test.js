/*
 * Il runtime vendorizzato deve restare dentro il vocabolario.
 *
 * La plancia dipinge da tre strati, e il corpus per molto tempo ne ha letti
 * due: i punti di chiamata di questo repository e i due gusci HTML. Il terzo —
 * `legacy/dashboard-runtime-{it,en}.js`, 600 kB di build vendorizzata — disegna
 * l'intera procedura guidata, gli editor degli elettrodomestici, degli avvisi e
 * delle luci, e ogni messaggio che sollevano. Quattrocento stringhe visibili
 * stavano fuori da ogni catalogo mentre la suite era verde: chi apriva la
 * plancia in francese faceva il primo avvio in inglese, e nessuna prova poteva
 * accorgersene, perche' una stringa che nessuno ha raccolto e' una stringa che
 * nessuna prova guarda.
 *
 * Queste prove chiudono il giro. La prova sui gusci legge i due file HTML dopo
 * aver tolto i blocchi `<script>`: per costruzione non poteva vedere niente di
 * quel runtime. Questa lo legge.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { MESSAGE_KEYS } from "./i18n-message-keys.js";
import { SOURCE_INDEX } from "../src/i18n/source-index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const VOCABULARY = join(ROOT, "scripts/i18n-runtime-vocabulary.json");
const REPAIRS = join(ROOT, "scripts/i18n-runtime-repairs.json");

const KEYS = new Set(MESSAGE_KEYS);
const vocabulary = JSON.parse(readFileSync(VOCABULARY, "utf8"));
const repairs = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(REPAIRS, "utf8"))).filter(([key]) => !key.startsWith("_")),
);

test("ogni coppia estratta dal runtime ha una chiave nel corpus", () => {
  const orfane = Object.keys(vocabulary)
    .map((english) => repairs[english] ?? english)
    .filter((english) => !KEYS.has(english));
  assert.deepEqual(
    orfane,
    [],
    `il runtime dipinge testo che nessun catalogo risponde: ${orfane.slice(0, 6).join(" | ")}`,
  );
});

test("l'italiano del runtime arriva a una chiave", () => {
  /*
   * Il passaggio sul DOM vede il testo dipinto, non la coppia: e' l'indice a
   * portare l'italiano sulla chiave inglese. Un'estrazione che entra nel corpus
   * ma non nell'indice tradurrebbe la build inglese e lascerebbe quella
   * italiana com'e'.
   *
   * Si chiede una chiave, non *quella* chiave. L'indice e' molti-a-uno per
   * costruzione — la stessa parola italiana non e' sempre la stessa inglese — e
   * il pareggio lo decide la precedenza scritta nell'estrattore: il vocabolario
   * del guscio, scritto a mano su una build letta da una persona, batte questa
   * miniera. Cosi' «Configura Entità» resta «Configure entities» del guscio
   * invece del «Configure Entities» del runtime, e «kWh ×» — che l'italiano
   * scrive una volta sola e completa col prezzo a runtime — tiene l'ultima
   * delle due tariffe. In entrambi i casi il testo si traduce; pretendere la
   * coppia esatta significherebbe pretendere che l'indice sia uno-a-uno, che
   * non e'.
   */
  const fuori = Object.entries(vocabulary)
    .map(([english, italian]) => [italian, repairs[english] ?? english])
    .filter(([italian, english]) => italian !== english && !KEYS.has(SOURCE_INDEX[italian]))
    .map(([italian]) => italian);
  assert.deepEqual(
    fuori,
    [],
    `sorgenti italiane che l'indice non porta a nessuna chiave: ${fuori.slice(0, 6).join(" | ")}`,
  );
});

test("nessuna riparazione punta a testo che il runtime non dipinge piu'", () => {
  /*
   * Il runtime e' vendorizzato e si muove: una release che riscrive la sezione
   * antifurto si porta via «Armamento Total», e la riparazione che lo indicava
   * resta li' a indicare niente. Non rompe la build — l'estrattore la ignora —
   * ma e' peso morto che nasconde quello che serve davvero, e va tolta.
   */
  const morte = Object.keys(repairs).filter((broken) => !(broken in vocabulary));
  assert.deepEqual(
    morte,
    [],
    `riparazioni per testo che non esiste piu' — toglierle: ${morte.slice(0, 6).join(" | ")}`,
  );
});

test("l'inglese rotto del runtime arriva alla chiave giusta", () => {
  /*
   * La build inglese e' stata tradotta a forza di sostituzioni e la passata non
   * e' mai finita: «Potenza batteria (W)» ne e' uscita «Power batteria (W)».
   * Ogni riparazione dichiarata deve valere per il passaggio sul DOM, o
   * l'inglese resta l'unica lingua che legge italiano.
   */
  const nonRiparate = Object.entries(repairs)
    .filter(([broken]) => broken in vocabulary)
    .filter(([broken, english]) => SOURCE_INDEX[broken] !== english)
    .map(([broken]) => broken);
  assert.deepEqual(
    nonRiparate,
    [],
    `riparazioni che l'indice non applica: ${nonRiparate.slice(0, 6).join(" | ")}`,
  );
});

test("nessuna riparazione resta una chiave del catalogo", () => {
  /* Una stringa che qualcuno ha dichiarato sbagliata non si chiede ai
   * traduttori: la chiave e' l'inglese corretto, non l'errore. */
  const ancoraChiavi = Object.keys(repairs)
    .filter((broken) => broken in vocabulary)
    .filter((broken) => KEYS.has(broken));
  assert.deepEqual(
    ancoraChiavi,
    [],
    `l'errore e' rimasto una chiave: ${ancoraChiavi.slice(0, 6).join(" | ")}`,
  );
});

test("il vocabolario del runtime e' rigenerabile dal runtime", async () => {
  /*
   * Il file e' generato, e la sua fonte e' una build vendorizzata che torna a
   * ogni sincronizzazione. Se la miniera smette di produrre quello che c'e'
   * scritto qui, il corpus sta rispondendo a stringhe che non si dipingono
   * piu' — o, peggio, non risponde a quelle nuove.
   */
  const { execFileSync } = await import("node:child_process");
  execFileSync(process.execPath, [join(ROOT, "scripts/mine-runtime-vocabulary.mjs"), "--check"], {
    stdio: "pipe",
  });
});
