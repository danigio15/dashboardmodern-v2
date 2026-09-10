/* Le strade per aprire una telecamera, e perche' Ring e Arlo non si vedevano.
 *
 * Due difetti, uno per ciascuno dei due modi in cui si sbaglia una scelta: si
 * prova una cosa che non puo' funzionare, e si smette di provare quella che
 * stava per riuscire.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTESE,
  daProvare,
  diagnosi,
  siSveglia,
  stradaScelta,
  strategieDellaTelecamera,
} from "../src/core/strategie-telecamera.js";

const nomiDa = (strade) => strade.map((strada) => strada.nome);
const strada = (strade, nome) => strade.find((voce) => voce.nome === nome);

/* Una Ring come la vede Home Assistant: il flusso c'e', l'apparecchio dorme. */
const RING = {
  entity_id: "camera.ingresso_ring",
  state: "idle",
  attributes: { friendly_name: "Ingresso", frontend_stream_type: "hls" },
};

/* Una telecamera di casa, sempre accesa, con il suo flusso su go2rtc. */
const LOCALE = {
  entity_id: "camera.giardino",
  state: "streaming",
  attributes: { friendly_name: "Giardino", frontend_stream_type: "hls" },
};

test("senza un nome di flusso WebRTC non si prova nemmeno", () => {
  const strade = strategieDellaTelecamera({ entity: "camera.ingresso_ring" }, RING);
  assert.equal(strada(strade, "WebRTC").salta, "senza-nome-di-flusso");
  assert.ok(
    !nomiDa(daProvare(strade)).includes("WebRTC"),
    "indovinare il nome del flusso dall'entita' costava tre secondi a ogni apertura, a tutti",
  );
});

test("con un nome di flusso WebRTC si prova, ed e' il primo", () => {
  const strade = strategieDellaTelecamera(
    { entity: "camera.giardino", stream: "giardino_go2rtc" },
    LOCALE,
  );
  assert.equal(nomiDa(daProvare(strade))[0], "WebRTC");
  assert.equal(strada(strade, "WebRTC").flusso, "giardino_go2rtc");
});

test("chi dichiara un flusso prende l'HLS, e chi dorme lo prende con piu' tempo", () => {
  /* Per un po' qui c'era scritto il contrario: «chi dorme non lo prende
   * affatto». Era stato scritto credendo che il proxy MJPEG fosse quello che
   * fa `camera_view: live` di `picture-entity`, e non lo e' — `live` disegna
   * il flusso, HLS o WebRTC. Cosi' a un'Arlo si toglieva proprio la strada che
   * nella finestra di Home Assistant le funziona, e la #418 continuava.
   *
   * Il dormire non cambia la strada: cambia il tempo che le si concede. E il
   * tempo si puo' concedere perche' intanto l'istantanea e' gia' a schermo. */
  const casa = strada(strategieDellaTelecamera({}, LOCALE), "HLS");
  assert.equal(casa.attesa, ATTESE.HLS_LOCALE);
  assert.equal(casa.sveglia, false);
  const cloud = strada(strategieDellaTelecamera({}, RING), "HLS");
  assert.equal(cloud.attesa, ATTESE.HLS_SVEGLIA);
  assert.equal(cloud.sveglia, true);
  assert.equal(stradaScelta(strategieDellaTelecamera({}, RING)).nome, "HLS");
});

test("chi un flusso non lo dichiara va DIRITTO al proxy dal vivo", () => {
  /* «Togli tutta quella roba a cascata.» Una telecamera senza
   * `frontend_stream_type` non sa trasmettere: chiederle `camera/stream`
   * vorrebbe dire spendere un'attesa per un no gia' scritto, e prima la si
   * spendeva. Il proxy manda i fotogrammi che ha, appena li ha, e non chiede
   * al browser di saper suonare niente. */
  const muta = { entity_id: "camera.vecchia", state: "idle" };
  const strade = strategieDellaTelecamera({}, muta);
  assert.equal(stradaScelta(strade).nome, "MJPEG");
  assert.equal(strada(strade, "MJPEG").attesa, ATTESE.MJPEG_SVEGLIA);
  /* Niente fila davanti: WebRTC e HLS non si tentano, e si sa dire perche'. */
  assert.deepEqual(nomiDa(daProvare(strade)), ["MJPEG", "Istantanee"]);
  assert.equal(strada(strade, "WebRTC").salta, "senza-nome-di-flusso");
  assert.equal(strada(strade, "HLS").salta, "senza-flusso-dichiarato");
});

test("le istantanee restano sempre, che e' l'ultima rete", () => {
  for (const stato of [RING, LOCALE, {}]) {
    const strade = strategieDellaTelecamera({}, stato);
    assert.equal(nomiDa(daProvare(strade)).at(-1), "Istantanee");
  }
});

test("il browser che non sa fare WebRTC lo dice, e non si prova", () => {
  const strade = strategieDellaTelecamera({ stream: "giardino" }, LOCALE, {
    webrtcNelBrowser: false,
  });
  assert.equal(strada(strade, "WebRTC").salta, "browser-senza-webrtc");
});

test("chi dorme si riconosce dall'integrazione, non da come sta adesso", () => {
  assert.equal(siSveglia({ entity_id: "camera.arlo_vialetto", state: "idle" }), true);
  assert.equal(siSveglia({ entity_id: "camera.porta", attributes: { brand: "Ring" } }), true);
  assert.equal(siSveglia({ entity_id: "camera.reolink_garage", state: "idle" }), false);
});

test("una telecamera di casa ferma non e' una che dorme", () => {
  /* Questa e' la regola che sbagliava: «dichiara un flusso e non sta
   * trasmettendo, quindi dorme». Lo stato di una telecamera e' `idle` finche'
   * qualcuno non la guarda, anche per quella cablata in corridoio — cosi'
   * dormivano tutte, e tutte finivano sulla strada di chi dorme. */
  assert.equal(siSveglia(LOCALE), false);
  assert.equal(
    siSveglia({
      entity_id: "camera.corridoio",
      state: "idle",
      attributes: { frontend_stream_type: "hls" },
    }),
    false,
  );
});

test("la diagnosi dice cosa e' successo a ogni strada, saltate comprese", () => {
  const resoconto = diagnosi([
    { nome: "WebRTC", salta: "senza-nome-di-flusso" },
    { nome: "HLS", errore: "Timeout" },
    { nome: "", errore: "niente" },
  ]);
  assert.deepEqual(resoconto, [
    { nome: "WebRTC", salta: "senza-nome-di-flusso", errore: null },
    { nome: "HLS", salta: null, errore: "Timeout" },
  ]);
});

test("chi dichiara WebRTC nativo lo prova senza nome di flusso", () => {
  /* Home Assistant moderno negozia da solo (`frontend_stream_type:
   * "web_rtc"`, go2rtc integrato, Ring e Nest): «WebRTC ancora non
   * funzionante» era la plancia che parlava solo il dialetto
   * dell'estensione go2rtc e saltava la strada per mancanza del nome. */
  const NATIVA_SVEGLIA = {
    entity_id: "camera.ingresso_ring",
    state: "idle",
    attributes: { friendly_name: "Ingresso", frontend_stream_type: "web_rtc" },
  };
  const strade = strategieDellaTelecamera({ entity: "camera.ingresso_ring" }, NATIVA_SVEGLIA);
  const webrtc = strada(strade, "WebRTC");
  assert.equal(webrtc.salta, undefined);
  assert.equal(webrtc.nativa, true);
  // In cloud deve prima svegliarsi: il tempo e' quello della sveglia.
  assert.equal(webrtc.attesa, ATTESE.HLS_SVEGLIA);
  assert.equal(nomiDa(daProvare(strade))[0], "WebRTC");

  const NATIVA_LOCALE = {
    entity_id: "camera.giardino",
    state: "streaming",
    attributes: { frontend_stream_type: "web_rtc" },
  };
  assert.equal(
    strada(strategieDellaTelecamera({}, NATIVA_LOCALE), "WebRTC").attesa,
    ATTESE.HLS_LOCALE,
  );
});

test("il nome di flusso configurato vince sul nativo: e' una scelta esplicita", () => {
  const NATIVA = {
    entity_id: "camera.giardino",
    state: "streaming",
    attributes: { frontend_stream_type: "web_rtc" },
  };
  const webrtc = strada(strategieDellaTelecamera({ stream: "giardino_go2rtc" }, NATIVA), "WebRTC");
  assert.equal(webrtc.flusso, "giardino_go2rtc");
  assert.equal(webrtc.nativa, undefined);
});
