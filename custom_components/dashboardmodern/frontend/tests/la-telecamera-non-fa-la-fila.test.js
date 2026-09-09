/* «Togli tutta quella roba a cascata: se sono WebRTC va configurata, in
 *  alternativa recupera il flusso live e deve essere immediato.»
 *
 * Aprire una telecamera provava quattro strade in fila, ognuna col suo
 * permesso di tempo: WebRTC tre secondi, HLS venticinque, MJPEG otto, e in
 * fondo le istantanee. Ogni attesa serviva soltanto a scoprire che quella
 * strada non era la sua, e chi arrivava in fondo aveva guardato un rettangolo
 * per mezzo minuto.
 *
 * Adesso la strada si sceglie da quattro fatti che si sanno prima di partire,
 * e se ne percorre UNA. Le istantanee restano, ma non fanno fila con nessuno:
 * non hanno attesa, e sono li' perche' nessuno resti davanti al nero.
 *
 * Queste prove guardano la regola nel suo insieme: per ogni telecamera, una
 * strada dal vivo e una sola, e nessuna attesa spesa per scoprire un no.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  daProvare,
  stradaScelta,
  strategieDellaTelecamera,
} from "../src/core/strategie-telecamera.js";

const CASI = [
  {
    che: "il nome del flusso go2rtc scritto a mano accende WebRTC",
    cam: { stream: "salone" },
    stato: { entity_id: "camera.salone" },
    attesa: "WebRTC",
  },
  {
    che: "Home Assistant che dichiara web_rtc lo negozia da se'",
    cam: {},
    stato: { entity_id: "camera.ring", attributes: { frontend_stream_type: "web_rtc" } },
    attesa: "WebRTC",
  },
  {
    che: "una telecamera di casa col flusso pronto prende l'HLS",
    cam: {},
    stato: {
      entity_id: "camera.ingresso",
      state: "streaming",
      attributes: { frontend_stream_type: "hls" },
    },
    attesa: "HLS",
  },
  {
    che: "un'Arlo che dorme prende il proxy dal vivo",
    cam: {},
    stato: { entity_id: "camera.arlo_giardino" },
    attesa: "MJPEG",
  },
  {
    che: "una che non dichiara niente e non dorme prende l'HLS",
    cam: {},
    stato: { entity_id: "camera.generica" },
    attesa: "HLS",
  },
];

for (const caso of CASI) {
  test(`una strada sola, scelta: ${caso.che}`, () => {
    const strade = strategieDellaTelecamera(caso.cam, caso.stato, {});
    assert.equal(stradaScelta(strade)?.nome, caso.attesa);
    /* Percorribili: la strada scelta e l'ultima rete. Nient'altro — cioe'
     * nessun'altra attesa da spendere per sentirsi dire no. */
    assert.deepEqual(
      daProvare(strade).map((strada) => strada.nome),
      [caso.attesa, "Istantanee"],
    );
  });
}

test("ogni strada non tentata sa dire perche', cosi' l'errore si legge", () => {
  for (const caso of CASI) {
    const strade = strategieDellaTelecamera(caso.cam, caso.stato, {});
    for (const strada of strade)
      if (strada.salta)
        assert.match(
          strada.salta,
          /^[a-z-]+$/,
          `«${strada.nome}» deve portare un codice, non una frase: le parole le mette chi disegna`,
        );
  }
});

test("le istantanee non hanno attesa: e' per questo che non sono un tentativo", () => {
  for (const caso of CASI) {
    const strade = strategieDellaTelecamera(caso.cam, caso.stato, {});
    const rete = strade.find((strada) => strada.nome === "Istantanee");
    assert.ok(rete, "l'ultima rete c'e' sempre");
    assert.equal(rete.salta, undefined);
    assert.equal(rete.attesa, undefined);
  }
});

test("un browser che non sa fare ne' WebRTC ne' HLS resta col proxy dal vivo", () => {
  /* Questa prova diceva «resta con le istantanee», e la ragione scritta era
   * «e' l'unica strada che c'e'». Non lo era: il proxy MJPEG e' un `<img>` su
   * un altro indirizzo — `camera_proxy_stream` invece di `camera_proxy` — e non
   * chiede al browser di saper suonare niente. Chi non ha ne' WebRTC ne' HLS
   * puo' vedere il vivo lo stesso, e ci veniva mandato sopra i fotogrammi a
   * intervalli per una convinzione sbagliata. */
  const strade = strategieDellaTelecamera(
    {},
    { entity_id: "camera.generica" },
    { webrtcNelBrowser: false, hlsNelBrowser: false },
  );
  assert.equal(stradaScelta(strade)?.nome, "MJPEG");
  assert.deepEqual(
    daProvare(strade).map((strada) => strada.nome),
    ["MJPEG", "Istantanee"],
  );
  assert.equal(strade.find((s) => s.nome === "WebRTC").salta, "browser-senza-webrtc");
  assert.equal(strade.find((s) => s.nome === "HLS").salta, "browser-senza-hls");
  /* E le istantanee restano sotto: la rete non si toglie mai. */
  assert.equal(strade.find((s) => s.nome === "Istantanee").salta, undefined);
  /* Non si dice di svegliare una telecamera che non dorme: il proxy qui e' la
   * strada scelta, non la sveglia di una che sta in cloud. */
  assert.equal(strade.find((s) => s.nome === "MJPEG").sveglia, false);
});
