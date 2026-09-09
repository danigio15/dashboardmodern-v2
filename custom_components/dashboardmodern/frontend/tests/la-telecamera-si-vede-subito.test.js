/* La telecamera si vede subito, e la seconda volta si apre di corsa.
 *
 * «Vanno riviste completamente le connessioni che avvengono con le telecamere:
 * sono lentissime e non carica immediatamente immagine.» E' la stessa cosa che
 * hanno portato la #227, la #294, la #385 e la #395 sulle Arlo, guardata dal
 * lato di chi apre: non «quale strada regge» ma «quanto ci mette a comparire
 * qualcosa».
 *
 * Il guscio prova le strade in fila e ognuna disegna solo quando riesce: prima
 * di allora il riquadro e' vuoto, e su una telecamera che dorme il solo HLS ha
 * venticinque secondi di permesso. E la fila si rifa' uguale a ogni apertura,
 * anche per la telecamera che va in HLS da sempre.
 *
 * Queste prove tengono ferme le due regole che tolgono l'attesa: si ricorda
 * quale strada ha funzionato, e la si riprova per prima con un permesso corto —
 * corto apposta, perche' un ricordo sbagliato deve costare pochissimo.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTESA_MASSIMA_DEL_RICORDO_MS,
  CHIAVE_STRADE_TELECAMERE,
  MARGINE_DEL_RICORDO_MS,
  VALIDITA_DEL_RICORDO_MS,
  attesaDelRicordo,
  conIlRicordo,
  normalizzaMemoria,
  ricordoDellaTelecamera,
  ricordoScaduto,
  scorciatoia,
  senzaIlRicordo,
} from "../src/core/apertura-telecamera.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";
import { stradaScelta, strategieDellaTelecamera } from "../src/core/strategie-telecamera.js";

const ORA = 1_700_000_000_000;
const GIORNO = 24 * 60 * 60 * 1000;

test("la strada buona non viaggia con la casa: è di questo dispositivo", () => {
  /* Quale strada regge non è una proprietà della telecamera, è una proprietà
   * della strada di rete fra chi guarda e la telecamera. Dal divano si passa in
   * HLS, dal telefono fuori casa magari no: scrivere la scelta di uno sull'altro
   * vuol dire far sbagliare strada a tutti e due. */
  assert.ok(!CONFIG_KEYS.includes(CHIAVE_STRADE_TELECAMERE));
});

test("si ricorda quale strada ha funzionato, telecamera per telecamera", () => {
  let memoria = conIlRicordo({}, "camera.salone", "HLS", 1800, ORA);
  memoria = conIlRicordo(memoria, "camera.giardino", "WebRTC", 900, ORA);
  assert.deepEqual(
    Object.fromEntries(Object.entries(memoria).map(([id, voce]) => [id, voce.strada])),
    { "camera.salone": "HLS", "camera.giardino": "WebRTC" },
  );
  assert.equal(ricordoDellaTelecamera(memoria, "camera.salone", ORA).ms, 1800);
  assert.equal(ricordoDellaTelecamera(memoria, "camera.ingresso", ORA), null);
});

test("una memoria sporca non fa aprire una strada che non esiste", () => {
  const memoria = normalizzaMemoria({
    "camera.buona": { strada: "HLS", quando: ORA, ms: 100 },
    "camera.inventata": { strada: "Piccioni", quando: ORA },
    "senza-punto": { strada: "HLS", quando: ORA },
    "camera.senza-quando": { strada: "HLS" },
    rotta: null,
  });
  assert.deepEqual(Object.keys(memoria), ["camera.buona"]);
});

test("un ricordo vecchio non si crede più", () => {
  const memoria = conIlRicordo({}, "camera.salone", "HLS", 1800, ORA);
  assert.ok(ricordoDellaTelecamera(memoria, "camera.salone", ORA + 6 * GIORNO));
  assert.equal(ricordoDellaTelecamera(memoria, "camera.salone", ORA + 8 * GIORNO), null);
  assert.equal(VALIDITA_DEL_RICORDO_MS, 7 * GIORNO);
});

test("un orologio che va indietro non fa scadere niente", () => {
  /* Il fuso che cambia, il dispositivo che si risincronizza: un ricordo che
   * sembra venire dal futuro non è vecchio, è solo mal datato. */
  const memoria = conIlRicordo({}, "camera.salone", "HLS", 1800, ORA);
  assert.ok(ricordoDellaTelecamera(memoria, "camera.salone", ORA - 3 * GIORNO));
});

test("il permesso della scorciatoia è quanto ci mise, più un margine", () => {
  assert.equal(attesaDelRicordo({ ms: 1800 }), 1800 + MARGINE_DEL_RICORDO_MS);
  /* Il margine è anche il minimo: una strada che agganciò in mezzo secondo ha
   * comunque i suoi quattro secondi, perché la rete di oggi non è quella di
   * ieri. */
  assert.equal(attesaDelRicordo({ ms: 100 }), 100 + MARGINE_DEL_RICORDO_MS);
  assert.equal(attesaDelRicordo(null), MARGINE_DEL_RICORDO_MS);
  /* E il tetto è basso: un ricordo sbagliato deve costare pochissimo, perché
   * subito dopo c'è la fila intera da rifare. */
  assert.equal(attesaDelRicordo({ ms: 60_000 }), ATTESA_MASSIMA_DEL_RICORDO_MS);
});

test("la scorciatoia salta il WebRTC che non porta da nessuna parte", () => {
  /* È il caso di ogni casa senza go2rtc: tre secondi buttati a ogni apertura,
   * prima ancora di cominciare. Con il ricordo dell'HLS si parte da lì. */
  const cam = { entity: "camera.salone" };
  const stato = { entity_id: "camera.salone", attributes: {} };
  const strade = strategieDellaTelecamera(cam, stato, {});
  assert.equal(strade[0].nome, "WebRTC");
  assert.equal(strade[0].salta, "senza-nome-di-flusso");

  const memoria = conIlRicordo({}, "camera.salone", "HLS", 1800, ORA);
  const corta = scorciatoia(ricordoDellaTelecamera(memoria, "camera.salone", ORA), strade, ORA);
  assert.equal(corta.nome, "HLS");
  assert.equal(corta.attesa, 5800);
  assert.equal(corta.scorciatoia, true);
});

test("non si prende una scorciatoia su una strada che oggi si salterebbe", () => {
  /* A questa telecamera hanno tolto il nome del flusso go2rtc: in WebRTC non ci
   * va più, per quanto ci sia andata ieri, e provarci sarebbe esattamente il
   * tempo buttato che questa memoria esiste per togliere. */
  const strade = strategieDellaTelecamera(
    { entity: "camera.salone" },
    { entity_id: "camera.salone", attributes: {} },
    {},
  );
  const memoria = conIlRicordo({}, "camera.salone", "WebRTC", 900, ORA);
  assert.equal(
    scorciatoia(ricordoDellaTelecamera(memoria, "camera.salone", ORA), strade, ORA),
    null,
  );
});

test("senza ricordo non si scorcia niente, e la fila del guscio resta la sua", () => {
  const strade = strategieDellaTelecamera(
    { entity: "camera.salone" },
    { entity_id: "camera.salone", attributes: {} },
    {},
  );
  assert.equal(scorciatoia(null, strade, ORA), null);
  assert.equal(scorciatoia({ strada: "HLS", quando: ORA }, [], ORA), null);
  assert.deepEqual(
    strade.map((strada) => strada.nome),
    ["WebRTC", "HLS", "MJPEG", "Istantanee"],
  );
});

test("la strada che cade si dimentica: insistere domani costerebbe di nuovo", () => {
  let memoria = conIlRicordo({}, "camera.salone", "HLS", 1800, ORA);
  memoria = conIlRicordo(memoria, "camera.giardino", "MJPEG", 700, ORA);
  memoria = senzaIlRicordo(memoria, "camera.salone");
  assert.deepEqual(Object.keys(memoria), ["camera.giardino"]);
  assert.equal(ricordoScaduto(memoria["camera.salone"], ORA), true);
});

test("l'Arlo che dorme non passa piu' dall'HLS che Home Assistant le dichiara", () => {
  /* Questa e' la #418, scritta come dato: un'Arlo ferma (`idle`) per cui Home
   * Assistant dichiara `frontend_stream_type: hls`. Prima ci si fidava di
   * quella dichiarazione e le si davano venticinque secondi. La dichiarazione
   * dice che l'integrazione dei flussi c'e', non che l'apparecchio in cloud
   * riesca a svegliarsi e a produrre segmenti — ed e' quel passaggio che non
   * arriva: «la live non parte in nessun modo».
   *
   * Il proxy dal vivo non chiede a nessuno di svegliarsi: manda i fotogrammi
   * che ha, appena li ha. E' quello che fa `camera_view: live` di
   * `picture-entity`, la card che su questa stessa telecamera si muove.
   * Adesso e' la strada, non il quarto tentativo dopo ventotto secondi. */
  const strade = strategieDellaTelecamera(
    { entity: "camera.arlo" },
    { entity_id: "camera.arlo", state: "idle", attributes: { frontend_stream_type: "hls" } },
    {},
  );
  assert.equal(stradaScelta(strade).nome, "MJPEG");
  assert.equal(strade.find((strada) => strada.nome === "HLS").salta, "strada-gia-scelta");
});

/* Le istantanee non si scorciano, e il tasto dell'audio resta vivo.
 *
 * La scorciatoia esiste per saltare un negoziato lento e arrivare a un video.
 * Le istantanee un video non sono: sono l'ultima rete della fila, e il loro
 * fotogramma la plancia lo mette già da sé appena apre il riquadro — saltare
 * la fila per arrivare lì non fa guadagnare niente.
 *
 * In cambio costava. Chi salta la fila non passa dalla porta del guscio
 * (`dmCamOpen`), che è l'unica riga che scrive quale telecamera è aperta:
 * dopo la pulizia quel posto resta vuoto, e «Attiva audio» — il tasto che le
 * istantanee disegnano, e che di lì chiede il salto all'HLS — non trovava più
 * niente da attivare. Succedeva solo dalla seconda apertura in poi, cioè
 * esattamente quando la scorciatoia entra in gioco.
 */
test("il ricordo delle istantanee non diventa una scorciatoia", () => {
  const strade = [
    { nome: "HLS", attesa: 10_000 },
    { nome: "Istantanee", attesa: 0 },
  ];
  const adesso = 1_000_000;
  assert.equal(
    scorciatoia({ strada: "Istantanee", ms: 120, quando: adesso - 1000 }, strade, adesso),
    null,
    "l'ultima rete non è una scorciatoia: il fotogramma c'è già",
  );
  /* E una strada vera invece sì, come sempre. */
  const corta = scorciatoia({ strada: "HLS", ms: 1800, quando: adesso - 1000 }, strade, adesso);
  assert.equal(corta?.nome, "HLS");
  assert.equal(corta?.scorciatoia, true);
});
