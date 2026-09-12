/* «Have the option to display a block on the home screen — like a widget or a
 * quick action — showing the rooms or areas of the house (such as the garden,
 * garage, etc.). It should also be possible to choose which rooms or areas
 * appear on the home screen» (#493).
 *
 * Le stanze la plancia le aveva già tutte: la loro pagina, le loro entità, la
 * loro icona. Quello che non aveva è il pezzo di casa da cui si guardano senza
 * aprire niente.
 *
 * Due cose da difendere. La prima: quali si vedono lo sceglie chi ha la casa, e
 * nessuna scelta vuol dire nessun blocco — una plancia non deve riempirsi da
 * sola di roba che nessuno ha chiesto. La seconda: l'ordine è quello della
 * configurazione delle stanze, non quello in cui sono state spuntate, o si
 * finirebbe con due ordini da tenere a mente per la stessa cosa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_STANZE_IN_PLANCIA,
  conLaStanza,
  idDellaStanza,
  laStanzaSiVede,
  STANZE_MASSIME,
  stanzeInPlancia,
} from "../src/core/stanze-in-plancia.js";
import { BLOCCHI_DELLA_HOME } from "../src/core/ordine-dei-blocchi.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import { riassuntoDellaStanza } from "../src/sections/stanze-in-plancia-section.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const STANZE = [
  { id: "room-giardino", name: "Giardino", icon: "mdi:flower" },
  { id: "room-garage", name: "Garage", icon: "mdi:garage" },
  { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
];

test("senza nessuna scelta il blocco non c'è", () => {
  assert.deepEqual(stanzeInPlancia([], STANZE), []);
  assert.deepEqual(stanzeInPlancia(null, STANZE), []);
  const sorgente = leggi("sections/stanze-in-plancia-section.js");
  /* E il nodo se ne va davvero: un blocco vuoto sarebbe un titolo che annuncia
   * il nulla, che è peggio di niente. */
  assert.match(sorgente, /if \(!pagine\.length\) \{[\s\S]{0,300}?nodo\?\.remove\(\);/);
});

test("l'ordine è quello delle stanze, non quello delle spunte", () => {
  /* Spuntate al contrario, escono nell'ordine in cui stanno in configurazione:
   * è l'ordine che chi ha la casa ha già deciso una volta. */
  const scelte = ["room-salone", "room-giardino"];
  assert.deepEqual(
    stanzeInPlancia(scelte, STANZE).map((stanza) => stanza.id),
    ["room-giardino", "room-salone"],
  );
});

test("una stanza cancellata sparisce da sé, senza toccare il magazzino", () => {
  /* Un elenco che si ripulisce da solo mentre nessuno guarda è il modo in cui
   * si perdono le configurazioni: qui l'id resta scritto e semplicemente non
   * trova più la sua stanza. */
  assert.deepEqual(stanzeInPlancia(["room-sparita", "room-garage"], STANZE).map((s) => s.id), [
    "room-garage",
  ]);
});

test("spuntare e togliere, senza doppioni e senza sforare il tetto", () => {
  let scelte = conLaStanza([], STANZE[0], true);
  assert.deepEqual(scelte, ["room-giardino"]);
  assert.equal(laStanzaSiVede(scelte, STANZE[0]), true);
  assert.equal(laStanzaSiVede(scelte, STANZE[1]), false);
  /* Spuntare due volte non la scrive due volte. */
  scelte = conLaStanza(scelte, STANZE[0], true);
  assert.deepEqual(scelte, ["room-giardino"]);
  scelte = conLaStanza(scelte, STANZE[0], false);
  assert.deepEqual(scelte, []);
  /* Il tetto: la nona non entra, e l'elenco resta quello di prima. */
  const piene = Array.from({ length: STANZE_MASSIME }, (_, i) => `room-${i}`);
  assert.deepEqual(conLaStanza(piene, { id: "room-troppa" }, true), piene);
  assert.equal(STANZE_MASSIME, 8, "le parole della scheda dicono «al massimo otto»");
});

test("una stanza cancellata non tiene occupato un posto in plancia", () => {
  /* Il tetto è alla plancia, non alla memoria. Chi ne aveva otto e ne cancella
   * una in plancia ne vede sette — `stanzeInPlancia` l'id orfano non lo trova
   * — ma il tetto lo contava lo stesso: nessuna spunta nuova entrava più, e la
   * casella tornava indietro da sola senza dire perché.
   *
   * L'id orfano resta scritto: ripulirlo qui vorrebbe dire cancellare una
   * configurazione mentre nessuno guarda, ed è la stessa regola per cui una
   * stanza cancellata «sparisce da sé, senza toccare il magazzino». */
  const scritte = [
    ...Array.from({ length: STANZE_MASSIME - 1 }, (_, i) => `room-${i}`),
    "room-cancellata",
  ];
  const esistono = scritte
    .filter((id) => id !== "room-cancellata")
    .map((id) => ({ id, name: id }));

  /* Senza l'elenco delle stanze si conta tutto, che è l'unica cosa che si può
   * dire: è il caso di chi chiama senza saperle. */
  assert.deepEqual(conLaStanza(scritte, { id: "room-nuova" }, true), scritte);

  /* Con l'elenco davanti, il posto lasciato libero dalla cancellata è libero. */
  const dopo = conLaStanza(scritte, { id: "room-nuova" }, true, esistono);
  assert.deepEqual(dopo, [...scritte, "room-nuova"]);
  /* E l'id orfano è ancora lì: non si è ripulito niente di nascosto. */
  assert.ok(dopo.includes("room-cancellata"));

  /* Il tetto resta un tetto: con otto stanze vere la nona non entra. */
  const tutte = Array.from({ length: STANZE_MASSIME }, (_, i) => `room-${i}`);
  assert.deepEqual(
    conLaStanza(
      tutte,
      { id: "room-troppa" },
      true,
      tutte.map((id) => ({ id, name: id })),
    ),
    tutte,
  );
});

test("chi spunta una stanza le stanze di casa le passa", () => {
  /* Il tetto si conta su quelle vere solo se chi chiama dice quali sono: la
   * scheda le ha già in mano per disegnare l'elenco. */
  const blocchi = leggi("sections/home-blocchi-section.js");
  assert.match(blocchi, /conLaStanza\(stanzeScelte\(\), \{ id \}, stanza\.checked, stanzeDiCasa\(\)\)/);
});

test("l'id di una stanza è quello della sua pagina", () => {
  assert.equal(idDellaStanza({ id: "room-garage", name: "Garage" }), "room-garage");
  /* Una stanza vecchia senza id si riconosce dal nome, come fa il resto. */
  assert.equal(idDellaStanza({ name: "Garage" }), "Garage");
  assert.equal(idDellaStanza(null), "");
});

test("la card dice i gradi, l'umidità e quante cose sono accese", () => {
  const stati = {
    "sensor.giardino_t": { state: "18.4" },
    "sensor.giardino_h": { state: "61" },
    "light.giardino": { state: "on" },
    "switch.irrigazione": { state: "off" },
  };
  const riassunto = riassuntoDellaStanza(
    {
      id: "room-giardino",
      temp: "sensor.giardino_t",
      hum: "sensor.giardino_h",
      count: 2,
      blocchi: [
        { voci: [{ entity: "light.giardino" }, { entity: "switch.irrigazione" }] },
      ],
    },
    stati,
  );
  assert.equal(riassunto.gradi, 18.4);
  assert.equal(riassunto.umidita, 61);
  assert.equal(riassunto.accese, 1);
  assert.equal(riassunto.quante, 2);
});

test("una stanza senza sensori non inventa numeri", () => {
  const riassunto = riassuntoDellaStanza({ id: "room-garage", blocchi: [] }, {});
  assert.equal(riassunto.gradi, null);
  assert.equal(riassunto.umidita, null);
  assert.equal(riassunto.accese, 0);
});

test("è un blocco come gli altri: si sposta, e la scelta viaggia con la casa", () => {
  assert.ok(BLOCCHI_DELLA_HOME.includes("stanze"));
  assert.ok(
    CONFIG_KEYS.includes(CHIAVE_STANZE_IN_PLANCIA),
    "quali stanze uno vuole davanti è una scelta della casa, non dello schermo",
  );
  const blocchi = leggi("sections/home-blocchi-section.js");
  assert.match(blocchi, /if \(nome === "stanze"\) return \[dentro\(doc\.getElementById\(BLOCCO_STANZE\)\)\]/);
  assert.match(blocchi, /data-dm-stanza-plancia-scelta/);
});

test("il tocco porta dentro la stanza, non apre una finestra", () => {
  /* La stanza ha già la sua pagina, e ci si comanda tutto: una finestra che
   * rifà metà di quella pagina sarebbe una seconda pagina da tenere in pari. */
  const sorgente = leggi("sections/stanze-in-plancia-section.js");
  assert.match(sorgente, /apriLaStanza\(card\.getAttribute\("data-dm-stanza-plancia"\)/);
  const pagina = leggi("sections/rooms-page-section.js");
  assert.match(pagina, /export function apriLaStanza\(id\)/);
  assert.match(pagina, /state\.room = scelta;/);
});
