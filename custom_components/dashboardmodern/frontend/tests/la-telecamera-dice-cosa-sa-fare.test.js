/* «A seguito del [Bug]: Continuano i problemi con Cam Arlo #418 continuano ad
 * esserci problemi in quanto si vede un'anteprima ma le live non partono da
 * nessuna schermata» (#502).
 *
 * Il difetto non era delle Arlo, ed era grosso: la plancia sceglie la strada
 * del video da quello che Home Assistant dichiara della telecamera, e lo
 * leggeva dall'attributo `frontend_stream_type` dello stato. Home Assistant
 * l'ha dichiarato superato nel dicembre 2024 e l'ha TOLTO nella 2025.6 — negli
 * attributi non c'è più niente.
 *
 * Chi legge un attributo che non c'è più non trova «hls» e non trova
 * «web_rtc»: trova il vuoto, e il vuoto vuol dire «questa telecamera non sa
 * trasmettere». Così su ogni Home Assistant dalla 2025.6 in poi, per OGNI
 * telecamera, la plancia scartava sia WebRTC sia HLS e finiva sul proxy dei
 * fotogrammi e poi sulle istantanee. È esattamente quello che si vede: una
 * fotografia ferma, e la live che non parte da nessuna parte.
 *
 * Le fonti adesso sono tre, e si guardano nell'ordine in cui sono vere: quello
 * che Home Assistant risponde a `camera/capabilities`, l'attributo vecchio per
 * chi ha una versione vecchia, e `supported_features` — che è il bit da cui
 * Home Assistant stesso ricava le capacità, sta già negli stati e non costa
 * una richiesta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  SA_TRASMETTERE,
  stradaScelta,
  strategieDellaTelecamera,
  tipiDiFlusso,
} from "../src/core/strategie-telecamera.js";

const strada = (strade, nome) => strade.find((voce) => voce.nome === nome);

/* Un'Arlo su Home Assistant 2026: l'attributo non c'è più, e quello che resta
 * è il bit delle funzioni supportate. È la telecamera della segnalazione. */
const ARLO_OGGI = {
  entity_id: "camera.aarlo_ingresso",
  state: "idle",
  attributes: { friendly_name: "Ingresso", supported_features: SA_TRASMETTERE },
};

test("il bit delle funzioni basta a dire che sa trasmettere", () => {
  /* È il numero da cui Home Assistant stesso ricava le capacità, e non è mai
   * cambiato: due, `CameraEntityFeature.STREAM`. */
  assert.equal(SA_TRASMETTERE, 2);
  assert.deepEqual([...tipiDiFlusso(ARLO_OGGI)], ["hls"]);
  /* Insieme ad altre funzioni: è una maschera di bit, non un numero. */
  assert.deepEqual([...tipiDiFlusso({ attributes: { supported_features: 3 } })], ["hls"]);
  /* E chi non lo dichiara non sa trasmettere, che è la risposta giusta. */
  assert.deepEqual([...tipiDiFlusso({ attributes: { supported_features: 1 } })], []);
  assert.deepEqual([...tipiDiFlusso({ attributes: {} })], []);
  assert.deepEqual([...tipiDiFlusso()], []);
});

test("l'attributo vecchio si legge ancora, per chi ha un Home Assistant vecchio", () => {
  assert.deepEqual([...tipiDiFlusso({ attributes: { frontend_stream_type: "web_rtc" } })], [
    "web_rtc",
  ]);
  /* E vince sul bit: è più preciso — dice QUALE flusso, non solo che ce n'è
   * uno — e dove c'è, c'è anche il bit. */
  assert.deepEqual(
    [...tipiDiFlusso({ attributes: { frontend_stream_type: "web_rtc", supported_features: 2 } })],
    ["web_rtc"],
  );
});

test("quello che risponde Home Assistant vince su tutto", () => {
  /* `camera/capabilities` è la domanda che Home Assistant ha messo al posto
   * dell'attributo, ed è la stessa che fa la sua finestra. Con go2rtc
   * integrato la stessa entità ne sa fare due. */
  const capacita = { frontend_stream_types: ["hls", "web_rtc"] };
  assert.deepEqual([...tipiDiFlusso(ARLO_OGGI, capacita)].sort(), ["hls", "web_rtc"]);
  /* Risponde con un insieme, non con una lista: si legge lo stesso. */
  assert.deepEqual(
    [...tipiDiFlusso(ARLO_OGGI, { frontend_stream_types: new Set(["web_rtc"]) })],
    ["web_rtc"],
  );
  /* Una risposta vuota è una risposta: questa telecamera non sa trasmettere. */
  assert.deepEqual([...tipiDiFlusso(ARLO_OGGI, { frontend_stream_types: [] })], []);
  /* Una risposta storta non è una risposta: si torna alle altre fonti. */
  assert.deepEqual([...tipiDiFlusso(ARLO_OGGI, { frontend_stream_types: "hls" })], ["hls"]);
  assert.deepEqual([...tipiDiFlusso(ARLO_OGGI, {})], ["hls"]);
});

test("l'Arlo di oggi prende l'HLS, non le istantanee", () => {
  /* Il difetto, in una riga: senza l'attributo la strada scelta era il proxy,
   * e da lì si finiva sulle istantanee. */
  const strade = strategieDellaTelecamera({ entity: ARLO_OGGI.entity_id }, ARLO_OGGI);
  assert.equal(stradaScelta(strade).nome, "HLS");
  assert.equal(strada(strade, "HLS").salta, undefined);
  /* E con più tempo, perché un'Arlo dorme e va svegliata: è la stessa
   * `camera/stream` che la sveglia nella finestra di Home Assistant. */
  assert.equal(strada(strade, "HLS").sveglia, true);
});

test("e quando Home Assistant dice WebRTC, si negozia", () => {
  const strade = strategieDellaTelecamera({ entity: ARLO_OGGI.entity_id }, ARLO_OGGI, {
    capacita: { frontend_stream_types: ["web_rtc"] },
  });
  assert.equal(stradaScelta(strade).nome, "WebRTC");
  assert.equal(stradaScelta(strade).nativa, true);
  /* L'HLS non si prova: non è stato scartato perché non può, è che la strada
   * era già scelta. */
  assert.equal(strada(strade, "HLS").salta, "strada-gia-scelta");
});

test("una telecamera che davvero non trasmette va al proxy, come prima", () => {
  /* Non si è allargata la rete fino a dire di sì a tutti: chi non dichiara
   * niente e non ha il bit resta quello che era. */
  const muta = { entity_id: "camera.muta", state: "idle", attributes: {} };
  const strade = strategieDellaTelecamera({ entity: "camera.muta" }, muta);
  assert.equal(stradaScelta(strade).nome, "MJPEG");
  assert.equal(strada(strade, "HLS").salta, "senza-flusso-dichiarato");
});

/* ── chi la domanda la fa ─────────────────────────────────────────────── */

const SEZIONE = readFileSync(
  new URL("../src/sections/telecamera-capacita-section.js", import.meta.url),
  "utf8",
);
const PONTE = readFileSync(new URL("../src/legacy/bridge-socket.js", import.meta.url), "utf8");
const APERTURA = readFileSync(
  new URL("../src/sections/telecamera-subito-section.js", import.meta.url),
  "utf8",
);

test("la domanda è quella di Home Assistant, e passa dal ponte", () => {
  assert.match(SEZIONE, /type: "camera\/capabilities", entity_id: cercata/);
  /* Dentro il pannello il socket passa da un ponte con la sua lista: fuori da
   * quella lista la domanda torna «Message type not permitted through the
   * bridge», e la plancia resterebbe a scegliere al buio proprio dove non può
   * fare altrimenti. */
  assert.match(PONTE, /"camera\/capabilities",/);
});

test("si chiede una volta sola, e non si insiste con chi non risponde", () => {
  /* Una risposta mancata si segna: senza, a ogni giro di stati si rifarebbe la
   * stessa domanda a un Home Assistant che quella domanda non ce l'ha. */
  assert.match(SEZIONE, /state\.dette\.set\(cercata, false\);/);
  assert.match(SEZIONE, /if \(state\.dette\.has\(cercata\) \|\| state\.inCorso\.has\(cercata\)\)/);
  /* E non si scrive da nessuna parte: la risposta cambia quando cambia
   * l'impianto, e una vecchia salvata varrebbe meno di nessuna. */
  assert.doesNotMatch(SEZIONE, /writeJson|localStorage/);
});

test("chi apre la telecamera aspetta la risposta, e poi prende quella strada", () => {
  /* Aspettare qui è la differenza fra un video e una fotografia: la prima
   * apertura, senza, sceglierebbe al buio. */
  assert.match(APERTURA, /if \(!capacitaChieste\(entity\)\) \{[\s\S]{0,120}?await chiediLeCapacita\(entity\);/);
  /* E saputa la strada, la si prende: il ricordo dice «ieri è andata così», le
   * capacità dicono «sa fare così», e la seconda vale anche la prima volta. */
  assert.match(
    APERTURA,
    /scorciatoia\(ricordo, strade, Date\.now\(\)\) \|\|\s*\n\s*\(capacitaChieste\(entity\) \? stradaScelta\(strade\) : null\);/,
  );
});
