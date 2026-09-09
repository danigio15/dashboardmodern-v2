/* Il flusso dell'energia, sulla Home (#415, #416).
 *
 * «Sarebbe veramente perfetta se sulla home, accanto magari alle card delle
 * persone, potessimo mettere un'immagine con il flusso dal fotovoltaico alla
 * casa, dalla casa alle batterie, dalla casa all'auto ecc ecc.»
 *
 * Il conto non e' nuovo: `core/energy-flow-truth.js` sa gia' come si spartisce
 * l'energia fra le sorgenti, con le convenzioni di sempre — rete positiva =
 * prelievo, batteria positiva = scarica. Qui ci si appoggia sopra e si aggiunge
 * l'unico arco che quella non conosce, la casa che carica l'auto. Le prove
 * tengono ferma la cosa che conta piu' del disegno: che questa mappa e quella
 * della sezione Energia raccontino la STESSA casa.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  NODI_DEL_FLUSSO,
  arcoPiuGrande,
  flussoDiCasa,
  forzaDellArco,
  sorgenteDiCasa,
} from "../src/core/flusso-di-casa.js";
import { allocateSourceFlows } from "../src/core/energy-flow-truth.js";
import { BLOCCHI_DELLA_HOME, ordineDeiBlocchi } from "../src/core/ordine-dei-blocchi.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const archiDi = (modello) =>
  modello.archi.map((arco) => `${arco.da}>${arco.a}:${Math.round(arco.watt)}`);

test("il flusso non è un blocco: è una card delle persone, e la sua scelta viaggia con la casa", () => {
  /* «Accanto alle card delle persone» lo diceva la segnalazione, e la prima
   * stesura ne aveva fatto un blocco largo quanto la pagina, SOTTO di loro.
   * Adesso è una card dentro la loro griglia: si muove con le persone, e
   * spostarlo per conto proprio non vorrebbe più dire niente. */
  assert.ok(!BLOCCHI_DELLA_HOME.includes("flusso"));
  assert.ok(CONFIG_KEYS.includes("cd_flusso_home"), "accenderlo e spegnerlo resta dov'era");
  /* Chi l'aveva messo in fila quando era un blocco non ci resta impigliato: un
   * nome che non esiste più si butta via, ed è la stessa regola con cui uno
   * nuovo entra al suo posto. */
  assert.deepEqual(ordineDeiBlocchi(["azioni", "flusso", "persone", "widget", "dispositivi"]), [
    "azioni",
    "persone",
    "widget",
    "dispositivi",
  ]);
});

test("il titolo della mappa è da dove viene adesso quello che la casa usa", () => {
  /* Il colore della card e la pastiglia in cima li decide questo: fra sole,
   * rete e batteria comanda chi ne manda di più IN CASA — non l'arco più
   * grande del disegno, che con il fotovoltaico che vende sarebbe la rete. */
  const sole = flussoDiCasa({ solare: 3000, rete: -500, batteria: -800, casa: 1700 });
  assert.equal(sorgenteDiCasa(sole.archi), "solare");
  const notte = flussoDiCasa({ solare: 0, rete: 2200, batteria: -1500, casa: 700 });
  assert.equal(sorgenteDiCasa(notte.archi), "rete");
  const isola = flussoDiCasa({ solare: 0, rete: 0, batteria: 900, casa: 900 });
  assert.equal(sorgenteDiCasa(isola.archi), "batteria");
  /* In casa non entra niente: non c'è nessun titolo da dare, e inventarne uno
   * sarebbe dire una cosa che non si sa. */
  const fermo = flussoDiCasa({ solare: 1200, rete: -1200, casa: 0 });
  assert.equal(sorgenteDiCasa(fermo.archi), "");
  assert.equal(sorgenteDiCasa(), "");
  assert.equal(sorgenteDiCasa(null), "");
});

test("una giornata di sole: il solare carica, alimenta e vende", () => {
  const modello = flussoDiCasa({ solare: 3000, rete: -500, batteria: -800, casa: 1700, soc: 62 });
  assert.deepEqual(archiDi(modello), [
    "solare>casa:1700",
    "solare>batteria:800",
    "solare>rete:500",
  ]);
  assert.equal(modello.nodi.batteria.verso, "dentro", "la batteria si sta caricando");
  assert.equal(modello.nodi.rete.verso, "dentro", "si sta immettendo in rete");
  assert.equal(modello.nodi.batteria.soc, 62);
});

test("di notte la rete alimenta casa e carica la batteria", () => {
  const modello = flussoDiCasa({ solare: 0, rete: 2200, batteria: -1500, casa: 700 });
  assert.deepEqual(archiDi(modello), ["rete>casa:700", "rete>batteria:1500"]);
  assert.equal(modello.nodi.rete.verso, "fuori", "si sta prelevando dalla rete");
});

test("non si inventa un conto nuovo: è quello della sezione Energia", () => {
  const letture = { solar: 1200, grid: 400, battery: 300 };
  const suo = allocateSourceFlows(letture);
  const modello = flussoDiCasa({
    solare: letture.solar,
    rete: letture.grid,
    batteria: letture.battery,
    casa: 1900,
  });
  const mio = Object.fromEntries(
    modello.archi
      .filter((arco) => arco.a !== "auto")
      .map((arco) => [`${arco.da}${arco.a}`, arco.watt]),
  );
  assert.equal(mio.solarecasa, suo.solarToHome);
  assert.equal(mio.retecasa, suo.gridToHome);
  assert.equal(mio.batteriacasa, suo.batteryToHome);
});

test("l'auto è un ramo di casa, non una sorgente in più", () => {
  const modello = flussoDiCasa({ solare: 0, rete: 5000, batteria: 0, casa: 5000, auto: 3600 });
  assert.deepEqual(archiDi(modello), ["rete>casa:5000", "casa>auto:3600"]);
  /* Una casa non può mandare all'auto più corrente di quanta ne prende: una
   * lettura della colonnina più grande del consumo di casa è una delle due
   * sbagliata, e la mappa non deve disegnare l'assurdo. */
  const troppo = flussoDiCasa({ rete: 1000, casa: 1000, auto: 7400 });
  assert.deepEqual(archiDi(troppo), ["rete>casa:1000", "casa>auto:1000"]);
});

test("senza la casa si crede alla colonnina: è l'unica cosa che si sa", () => {
  const modello = flussoDiCasa({ rete: 2000, auto: 3600 });
  assert.ok(archiDi(modello).includes("casa>auto:3600"));
});

test("un nodo senza numero non si disegna, e con un nodo solo non c'è flusso", () => {
  const solo = flussoDiCasa({ casa: 400 });
  assert.deepEqual(solo.presenti, ["casa"]);
  assert.equal(solo.disegnabile, false, "un numero solo lo dice già la tessera dell'energia");
  const due = flussoDiCasa({ casa: 400, rete: 400 });
  assert.deepEqual(due.presenti, ["rete", "casa"]);
  assert.equal(due.disegnabile, true);
  assert.equal(flussoDiCasa({}).disegnabile, false);
});

test("i nodi si leggono nell'ordine in cui scende la corrente", () => {
  assert.deepEqual([...NODI_DEL_FLUSSO], ["solare", "rete", "batteria", "casa", "auto"]);
  const tutti = flussoDiCasa({ solare: 1, rete: 1, batteria: 1, casa: 1, auto: 1 });
  assert.deepEqual(tutti.presenti, [...NODI_DEL_FLUSSO]);
});

test("zero non è «non lo so»: uno zero letto è un nodo che si disegna", () => {
  const modello = flussoDiCasa({ solare: 0, casa: 900, rete: 900 });
  assert.ok(modello.presenti.includes("solare"));
  assert.equal(modello.nodi.solare.watt, 0);
  assert.equal(modello.nodi.solare.verso, "");
});

test("la forza dell'arco serve allo spessore, e col solo arco vale uno", () => {
  const modello = flussoDiCasa({ solare: 0, rete: 1500, casa: 1500 });
  const massimo = arcoPiuGrande(modello.archi);
  assert.equal(massimo, 1500);
  assert.equal(forzaDellArco(1500, massimo), 1);
  assert.equal(forzaDellArco(750, massimo), 0.5);
  assert.equal(forzaDellArco(9000, massimo), 1, "non si va oltre il più grande");
  assert.equal(forzaDellArco(100, 0), 0, "senza archi non c'è paragone");
});
