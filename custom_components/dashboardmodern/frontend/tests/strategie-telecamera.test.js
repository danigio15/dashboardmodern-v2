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

test("una telecamera di casa prende l'HLS, e chi dorme non lo prende affatto", () => {
  /* L'HLS su una telecamera in cloud vuole che l'integrazione dei flussi
   * svegli l'apparecchio e produca i segmenti, ed e' esattamente il passaggio
   * che non arriva: si aspettavano venticinque secondi per scoprirlo. Adesso
   * chi dorme non ci passa nemmeno — la sua strada e' il proxy dal vivo — e
   * l'HLS resta quello che e' sempre stato per una telecamera di casa. */
  const sveglia = strada(strategieDellaTelecamera({}, LOCALE), "HLS");
  assert.equal(sveglia.attesa, ATTESE.HLS_LOCALE);
  assert.equal(strada(strategieDellaTelecamera({}, RING), "HLS").salta, "strada-gia-scelta");
});

test("chi dorme va DIRITTO al proxy dal vivo, non dopo ventotto secondi di altro", () => {
  /* «Togli tutta quella roba a cascata.» Su un'Arlo il proxy di Home
   * Assistant si muove — e' quello che fa `camera_view: live` di
   * `picture-entity`, e il confronto si e' visto dal vero: «dalla card YAML si
   * muove, dalla plancia no». La plancia ci arrivava lo stesso, ma dopo tre
   * secondi di WebRTC e venticinque di HLS: ventotto secondi sono molto piu'
   * di quanto uno resta a guardare un rettangolo, ed e' per questo che la live
   * «non parte in nessun modo» (#418).
   *
   * Adesso la strada si scegle: chi dorme parte dal proxy. */
  const strade = strategieDellaTelecamera({}, RING);
  assert.equal(stradaScelta(strade).nome, "MJPEG");
  assert.equal(strada(strade, "MJPEG").attesa, ATTESE.MJPEG_SVEGLIA);
  /* Niente fila davanti: WebRTC e HLS non si tentano, e si sa dire perche'. */
  assert.deepEqual(nomiDa(daProvare(strade)), ["MJPEG", "Istantanee"]);
  assert.equal(strada(strade, "WebRTC").salta, "senza-nome-di-flusso");
  assert.equal(strada(strade, "HLS").salta, "strada-gia-scelta");
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

test("chi dorme si riconosce anche senza `frontend_stream_type`", () => {
  /* Le versioni di Home Assistant che non scrivono l'attributo esistono
   * ancora: il ripiego guarda il nome. */
  assert.equal(siSveglia({ entity_id: "camera.arlo_vialetto", state: "idle" }), true);
  assert.equal(siSveglia({ entity_id: "camera.porta", attributes: { brand: "Ring" } }), true);
  assert.equal(siSveglia({ entity_id: "camera.reolink_garage", state: "idle" }), false);
});

test("una telecamera accesa non e' una che dorme", () => {
  assert.equal(siSveglia(LOCALE), false);
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
