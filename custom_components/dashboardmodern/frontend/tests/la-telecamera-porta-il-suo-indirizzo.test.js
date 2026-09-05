/* «Ho una telecamera con flusso video su rtsp://192.168.5.30:8556/Salone, non
 * c'e' possibilita' di configurazione» (#284).
 *
 * Qui si prova la parte pura: leggere quell'indirizzo, ricavarne il nome che
 * go2rtc dà al flusso, mostrarlo senza stampare la password, e dire cosa manca
 * perche' diventi video. Piu' una cosa che non e' pura ed e' quella che ha
 * morso: il modello dei dispositivi tiene solo i campi che dichiara, e un
 * campo nuovo non dichiarato sparisce al primo salvataggio.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  analizzaRtsp,
  cosaManca,
  rigaGo2rtc,
  sembraRtsp,
} from "../src/core/telecamera-rtsp.js";
import { normalizeDevice } from "../src/core/device-model.js";

test("l'indirizzo della segnalazione si legge, e il nome del flusso e' l'ultimo pezzo", () => {
  const letto = analizzaRtsp("rtsp://192.168.5.30:8556/Salone");
  assert.equal(letto.host, "192.168.5.30");
  assert.equal(letto.porta, "8556");
  assert.equal(letto.percorso, "/Salone");
  /* E' la parola che il campo «Nome stream go2rtc» aspetta. */
  assert.equal(letto.nome, "Salone");
  assert.equal(letto.conCredenziali, false);
});

test("la password non esce: l'indirizzo da mostrare la nasconde, quello da copiare no", () => {
  const url = "rtsp://admin:hunter2@192.168.1.50:554/h264Preview_01_main";
  const letto = analizzaRtsp(url);
  assert.equal(letto.utente, "admin");
  assert.equal(letto.conCredenziali, true);
  assert.equal(letto.mascherato, "rtsp://admin:•••@192.168.1.50:554/h264Preview_01_main");
  assert.ok(!letto.mascherato.includes("hunter2"));
  /* La riga per go2rtc invece le credenziali le vuole tutte: e' un file di
   * configurazione, non una schermata. */
  assert.equal(rigaGo2rtc(url), `  h264Preview_01_main: ${url}`);
});

test("un IPv6 non si spezza sui suoi due punti", () => {
  const letto = analizzaRtsp("rtsps://[2001:db8::1]:322/live");
  assert.equal(letto.host, "[2001:db8::1]");
  assert.equal(letto.porta, "322");
  assert.equal(letto.nome, "live");
});

test("senza percorso il nome ripiega sull'host, ripulito per YAML", () => {
  assert.equal(analizzaRtsp("rtsp://192.168.1.9").nome, "192_168_1_9");
  /* La query non fa parte del nome. */
  assert.equal(analizzaRtsp("rtsp://cam.local/stream1?channel=2").nome, "stream1");
});

test("quello che non e' rtsp non lo diventa", () => {
  for (const testo of ["http://192.168.1.9/stream", "camera.salone", "", null, undefined]) {
    assert.equal(sembraRtsp(testo), false);
    assert.equal(analizzaRtsp(testo), null);
    assert.equal(rigaGo2rtc(testo), "");
  }
});

test("cosa manca: l'entita' e' quello che fa la differenza, non l'indirizzo", () => {
  const url = "rtsp://192.168.5.30:8556/Salone";
  assert.equal(cosaManca({}), "senza-indirizzo");
  assert.equal(cosaManca({ rtsp: url }), "senza-entita");
  assert.equal(cosaManca({ rtsp: url, stream: "Salone" }), "senza-entita-con-flusso");
  assert.equal(cosaManca({ rtsp: url, entity: "camera.salone" }), "pronta");
  /* Un'entita' che non e' una telecamera non conta come telecamera. */
  assert.equal(cosaManca({ rtsp: url, entity: "switch.salone" }), "senza-entita");
});

test("il modello si tiene l'indirizzo, che era il modo in cui spariva", () => {
  const salvata = normalizeDevice(
    {
      name: "Salone",
      entity: "camera.salone",
      stream: "Salone",
      rtsp: "rtsp://192.168.5.30:8556/Salone",
    },
    "cameras",
    {},
  );
  assert.equal(salvata.rtsp, "rtsp://192.168.5.30:8556/Salone");
  /* Il nome del flusso e l'indirizzo sono due cose diverse e restano due
   * caselle diverse: uno e' la chiave dentro go2rtc, l'altro e' dove sta la
   * telecamera. */
  assert.equal(salvata.stream, "Salone");
});

test("l'indirizzo lo legge la telecamera, e altrove non lo si butta via", () => {
  /* Il ramo che lo legge e' quello delle telecamere, e li' l'indirizzo si
   * ripulisce prima di scriverlo. Fuori di li' nessuno lo guarda — e nessuno
   * lo cancella: il modello non decide che una cosa configurata non serve
   * piu' solo perche' oggi non sa cosa farne. E' la regola per cui il
   * contatto dell'infisso, l'inferriata e la soglia di una finestra sono
   * spariti, una versione per volta. */
  const telecamera = normalizeDevice(
    { name: "Salone", entity: "camera.salone", rtsp: "  rtsp://192.168.5.30:8556/Salone  " },
    "cameras",
    {},
  );
  assert.equal(telecamera.rtsp, "rtsp://192.168.5.30:8556/Salone");
  const presa = normalizeDevice(
    { name: "Presa", entity: "switch.presa", rtsp: "rtsp://192.168.5.30:8556/Salone" },
    "appliances",
    {},
  );
  assert.equal(presa.rtsp, "rtsp://192.168.5.30:8556/Salone");
});

test("senza indirizzo il campo non compare nel record salvato", () => {
  const salvata = normalizeDevice({ name: "Salone", entity: "camera.salone" }, "cameras", {});
  assert.ok(!("rtsp" in salvata));
});
