/* «Per cortesia mi organizzi le sezioni del config con criterio, vedo cose
 * mischiate in sezioni che non c'entrano nulla.»
 *
 * L'ordine delle trentadue linguette non lo decideva nessuno: diciotto le
 * scrive il guscio in fila, le altre quattordici se le infilano i moduli prima
 * di «Runtime» quando gli capita di installarsi. Adesso l'ordine è un elenco,
 * e queste prove tengono ferme le tre cose che quell'elenco deve garantire:
 * riordinare non è filtrare, una famiglia vuota non si disegna, e quello che
 * l'elenco non conosce non sparisce.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  FAMIGLIE,
  SCHEDE,
  famiglia,
  famigliaDellaScheda,
  famiglieConSchede,
  inOrdine,
} from "../src/core/alberatura-del-config.js";

/* Le trentadue vere, nell'ordine sciagurato in cui si trovavano: le diciotto
 * del guscio e poi le quattordici dei moduli, come le mette l'installazione. */
const COSI_COM_ERANO = [
  "visib",
  "sez0",
  "sez1",
  "sez2",
  "sez3",
  "sez4",
  "sez6",
  "sez7",
  "sez8",
  "sez9",
  "pool",
  "irr",
  "tapp",
  "stanze",
  "luci",
  "appliances",
  "avvisi",
  "backup",
  "todo",
  "ups",
  "allerte",
  "rifiuti",
  "varchi",
  "agenda",
  "robot",
  "people",
  "animali",
  "mie",
  "entita",
  "media",
  "doors",
  "runtime",
];

test("riordinare non è filtrare: escono le stesse schede, tutte", () => {
  const dopo = inOrdine(COSI_COM_ERANO);
  assert.equal(dopo.length, COSI_COM_ERANO.length);
  assert.deepEqual([...dopo].sort(), [...COSI_COM_ERANO].sort());
});

test("le schede escono raggruppate per famiglia, e le famiglie in ordine", () => {
  const dopo = inOrdine(COSI_COM_ERANO);
  const famiglie = dopo.map(famigliaDellaScheda);
  /* Una famiglia non deve ricomparire dopo essersi chiusa: se succede, le
   * schede sono mischiate — che è esattamente la segnalazione. */
  const viste = new Set();
  let corrente = "";
  for (const chiave of famiglie) {
    if (chiave === corrente) continue;
    assert.equal(viste.has(chiave), false, `la famiglia «${chiave}» ricompare più avanti`);
    viste.add(chiave);
    corrente = chiave;
  }
  /* E l'ordine delle famiglie è quello dichiarato. */
  assert.deepEqual(
    [...viste],
    FAMIGLIE.map((voce) => voce.chiave).filter((chiave) => viste.has(chiave)),
  );
});

test("le tre che avevano il posto peggiore adesso ce l'hanno giusto", () => {
  /* Erano queste, e sono la ragione della segnalazione: il riscaldamento sotto
   * «Solare», i rifiuti fra il backup e i varchi, il server in mezzo alle
   * stanze. Adesso ognuna sta con i suoi.
   *
   * La prima al primo giro era stata sistemata male, e questa prova lo diceva
   * senza accorgersene: la sua prosa parlava del riscaldamento e la sua
   * asserzione lo metteva sotto «Energia». La scheda che il guscio chiama
   * «Solare» — e che il suo modulo rinomina «Gestione termica» — non contiene
   * kWh: contiene la pompa solare, il boiler, lo scaldabagno, la caldaia, la
   * pressione dell'acqua e la valvola di sicurezza. È acqua calda, e sta con
   * l'aria che si respira. */
  assert.equal(famigliaDellaScheda("sez3"), "clima");
  assert.equal(famigliaDellaScheda("rifiuti"), "avvisi");
  assert.equal(famigliaDellaScheda("sez6"), "macchine");
  /* E il MiniPC è l'unica cosa che non parla della casa: sta da solo. */
  const macchine = famiglieConSchede(COSI_COM_ERANO).find((voce) => voce.chiave === "macchine");
  assert.deepEqual(macchine.schede, ["sez6"]);
});

test("una famiglia senza schede non si disegna", () => {
  /* Su una plancia dove metà delle sezioni sono spente, un'insegna sopra il
   * vuoto è una promessa che non si mantiene. */
  const poche = famiglieConSchede(["visib", "runtime", "sez6"]);
  assert.deepEqual(
    poche.map((voce) => voce.chiave),
    ["plancia", "macchine"],
  );
  assert.deepEqual(poche[0].schede, ["visib", "runtime"]);
  assert.deepEqual(famiglieConSchede([]), []);
});

test("quello che l'elenco non conosce va in fondo, non sparisce", () => {
  /* Un modulo nuovo, o uno che arriva da fuori: meglio in fondo che in mezzo,
   * e meglio in fondo che via. */
  const con = inOrdine(["zeta-ignota", "sez6", "visib", "alfa-ignota"]);
  assert.deepEqual(con, ["visib", "sez6", "zeta-ignota", "alfa-ignota"]);
  /* Fra due sconosciute vale l'ordine in cui sono arrivate: fermo, non a caso. */
  assert.deepEqual(inOrdine(["alfa-ignota", "zeta-ignota"]), ["alfa-ignota", "zeta-ignota"]);
});

test("nessun doppione, e le schede vuote non contano", () => {
  assert.deepEqual(inOrdine(["visib", "visib", "", "  ", "sez6"]), ["visib", "sez6"]);
});

test("ogni scheda dell'elenco sta in una famiglia che esiste davvero", () => {
  const chiavi = new Set(FAMIGLIE.map((voce) => voce.chiave));
  for (const [id, voce] of Object.entries(SCHEDE)) {
    assert.ok(chiavi.has(voce.famiglia), `${id}: la famiglia «${voce.famiglia}» non esiste`);
    assert.ok(Number.isFinite(voce.posizione), `${id}: senza posizione`);
  }
  /* E ogni famiglia ha almeno una scheda: un'insegna che non ha niente sotto
   * non l'avrebbe mai nessuno. */
  for (const voce of FAMIGLIE) {
    const sue = Object.values(SCHEDE).filter((riga) => riga.famiglia === voce.chiave);
    assert.ok(sue.length > 0, `la famiglia «${voce.chiave}» è vuota`);
    /* Due schede della stessa famiglia non possono avere lo stesso posto:
     * sarebbe un ordine che dipende da chi arriva prima, cioè quello di
     * prima. */
    const posti = sue.map((riga) => riga.posizione);
    assert.equal(new Set(posti).size, posti.length, `la famiglia «${voce.chiave}» ha due pari`);
  }
});

test("ogni famiglia ha un nome in tutte e due le lingue", () => {
  for (const voce of FAMIGLIE) {
    assert.ok(voce.it && voce.en, `${voce.chiave}: manca un nome`);
    assert.notEqual(voce.it, voce.en, `${voce.chiave}: le due lingue dicono la stessa cosa`);
    assert.ok(voce.glifo, `${voce.chiave}: manca il glifo`);
    assert.equal(famiglia(voce.chiave), voce);
  }
  assert.equal(famiglia("fantasia"), null);
});
