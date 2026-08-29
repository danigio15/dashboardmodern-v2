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

test("una telecamera che dorme ha piu' tempo per svegliarsi", () => {
  const dorme = strada(strategieDellaTelecamera({}, RING), "HLS");
  const sveglia = strada(strategieDellaTelecamera({}, LOCALE), "HLS");
  assert.equal(dorme.attesa, ATTESE.HLS_SVEGLIA);
  assert.equal(sveglia.attesa, ATTESE.HLS_LOCALE);
  assert.ok(
    dorme.attesa > 10_000,
    "dieci secondi sono meno di quanto ci mette una telecamera in cloud ad accendersi: si mollava proprio sul piu' bello",
  );
});

test("a una telecamera che dorme non si chiede un flusso continuo", () => {
  const strade = strategieDellaTelecamera({}, RING);
  assert.equal(strada(strade, "MJPEG").salta, "telecamera-che-dorme");
  assert.deepEqual(nomiDa(daProvare(strade)), ["HLS", "Istantanee"]);
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
