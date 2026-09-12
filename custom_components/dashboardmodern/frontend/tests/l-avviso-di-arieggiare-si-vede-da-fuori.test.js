/* «L'avviso di arieggiare funziona ma è presente solo se entri nella sezione,
 * andrebbe messo a livello di widget e/o di avviso» (#500).
 *
 * Il consiglio c'era già e funzionava bene: quello che mancava è che si
 * vedesse da fuori. Un avviso che si scopre soltanto entrando nella stanza
 * dove sta scritto non ha avvisato nessuno — e per l'umidità in casa
 * l'avviso conta più della card, perché è una cosa su cui si può fare
 * qualcosa adesso e che passa da sola fra un'ora.
 *
 * La regola resta una: `consiglioDiArieggiare`, che decide da tre numeri.
 * Qui si tiene ferma la parte nuova — l'elenco di chi chiede aria, in ordine
 * di quanto ne ha bisogno — e il fatto che la stanza di una finestra la
 * trovino tutt'e due chiamando la stessa funzione.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  finestreDaArieggiare,
  sogliaDellaFinestra,
  stanzaDiUnaFinestra,
} from "../src/core/arieggiare.js";

const sorgente = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

test("chiede aria solo la stanza che sta sopra la sua soglia", () => {
  const elenco = finestreDaArieggiare([
    { nome: "Bagno", dentro: 78, soglia: 60, aperta: false },
    { nome: "Salone", dentro: 48, soglia: 60, aperta: false },
    /* Senza igrometro non si inventa: tace. */
    { nome: "Cantina", dentro: null, soglia: 60, aperta: false },
    /* Zero sulla riga spegne il consiglio per quella finestra sola — e lo
     * spegne dove la soglia si legge, non dove si decide: `sogliaDellaFinestra`
     * risponde `null`, e senza soglia non si consiglia niente. Passarle uno
     * zero crudo qui direbbe «apri sempre», che è il contrario. */
    { nome: "Studio", dentro: 90, soglia: sogliaDellaFinestra({ umidita: 0 }, 60), aperta: false },
  ]);
  assert.deepEqual(
    elenco.map((voce) => voce.nome),
    ["Bagno"],
  );
  assert.equal(elenco[0].esito.dentro, 78);
  assert.equal(elenco[0].esito.soglia, 60);
});

test("l'anta già aperta non chiede di essere aperta", () => {
  /* Sta già arieggiando: dirle di aprire è un avviso che non serve a nulla, e
   * un avviso inutile insegna a ignorare gli altri. */
  const elenco = finestreDaArieggiare([{ nome: "Bagno", dentro: 78, soglia: 60, aperta: true }]);
  assert.deepEqual(elenco, []);
});

test("davanti sta quella che ne ha più bisogno", () => {
  /* La tessera ne nomina una: deve essere quella che supera la soglia di più,
   * non quella che capita prima nell'elenco della configurazione. */
  const elenco = finestreDaArieggiare([
    { nome: "Camera", dentro: 65, soglia: 60 },
    { nome: "Bagno", dentro: 85, soglia: 60 },
    { nome: "Cucina", dentro: 72, soglia: 55 },
  ]);
  assert.deepEqual(
    elenco.map((voce) => voce.nome),
    ["Bagno", "Cucina", "Camera"],
  );
});

test("i numeri si leggono come li scrive Home Assistant", () => {
  /* La virgola e le parole di servizio arrivano dal vero, e il nucleo le sa
   * leggere: chi chiama passa lo stato com'è invece di ripulirlo per conto
   * suo — che sarebbe la stessa regola scritta in un secondo posto. */
  const elenco = finestreDaArieggiare([
    { nome: "Bagno", dentro: "78,4", soglia: 60 },
    { nome: "Cantina", dentro: "unavailable", soglia: 60 },
    { nome: "Soffitta", dentro: "unknown", soglia: 60 },
  ]);
  assert.deepEqual(
    elenco.map((voce) => voce.nome),
    ["Bagno"],
  );
  assert.equal(elenco[0].esito.dentro, 78.4);
});

test("la stanza di una finestra si trova per identificativo o per nome", () => {
  const stanze = [
    { id: "room-bagno", name: "Bagno", hum: "sensor.bagno_umidita" },
    { id: "room-salone", name: "Salone", hum: "sensor.salone_umidita" },
  ];
  assert.equal(stanzaDiUnaFinestra({ room_id: "room-bagno" }, stanze)?.name, "Bagno");
  assert.equal(stanzaDiUnaFinestra({ room: "Salone" }, stanze)?.name, "Salone");
  assert.equal(stanzaDiUnaFinestra({ roomId: "room-bagno" }, stanze)?.name, "Bagno");
  /* Una finestra senza stanza non ha un'umidità da guardare. */
  assert.equal(stanzaDiUnaFinestra({}, stanze), null);
  assert.equal(stanzaDiUnaFinestra({ room_id: "room-che-non-ce" }, stanze), null);
});

test("la tessera della Home si accende solo quando c'è da fare", () => {
  /* Rosso quando serve, e non sempre: una tessera che avvisa sempre non
   * avvisa. Le finestre aperte restano uno stato, non un avviso. */
  assert.match(sorgente, /alert: daArieggiare\.length > 0,/);
  assert.match(sorgente, /finestreDaArieggiare\(/);
  /* E la regola arriva dal nucleo, non riscritta qui: la sezione importa già
   * la Home, quindi il contrario farebbe un anello, ed è la ragione per cui
   * il conto sta in mezzo invece che da una delle due parti. */
  assert.match(sorgente, /from "\.\.\/core\/arieggiare\.js"/);
  assert.doesNotMatch(sorgente, /consiglioDiArieggiare\(/);
  /* Le altre si contano con un segno: una chiave di traduzione con dentro un
   * numero non è una chiave. */
  assert.doesNotMatch(sorgente, /t\(`e altre/);
});
