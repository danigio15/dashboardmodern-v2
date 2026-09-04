/* Le telecamere parlano il WebRTC di casa (#294).
 *
 * «Continuano a non funzionare in live streaming, e nemmeno se metto nome
 * webrtc parte.» Dentro il pannello di Home Assistant il ponte non lasciava
 * passare `camera/webrtc/offer`, e le tessere «dal vivo» chiedevano al proxy
 * un MJPEG che per una telecamera in cloud e' una foto ferma. Queste prove
 * tengono fermi il ponte — l'offerta e' una sottoscrizione, gli eventi tornano
 * con lo stesso id — la lettura di quello che Home Assistant dichiara, e la
 * strada che le tessere e il popup percorrono.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  ATTESA_VIDEO,
  PAUSA_VIDEO_MS,
  STUN_DI_RIPIEGO,
  attesaDelVideo,
  candidatoDaEvento,
  candidatoInJson,
  mettiInPausaIlVideo,
  serverIce,
  tipoDiFlusso,
  videoInPausa,
} from "../src/core/telecamera-webrtc.js";
import { ALLOWED_MESSAGE_TYPES, createBridgeSocket } from "../src/legacy/bridge-socket.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("la strada la dichiara Home Assistant: web_rtc, hls, o niente", () => {
  assert.equal(tipoDiFlusso({ attributes: { frontend_stream_type: "web_rtc" } }), "web_rtc");
  assert.equal(tipoDiFlusso({ attributes: { frontend_stream_type: "WebRTC" } }), "web_rtc");
  assert.equal(tipoDiFlusso({ attributes: { frontend_stream_type: "hls" } }), "hls");
  assert.equal(tipoDiFlusso({ attributes: {} }), "");
  assert.equal(tipoDiFlusso(null), "");
});

test("i server ICE di casa, e lo STUN pubblico quando casa non risponde", () => {
  const casa = serverIce({
    configuration: { iceServers: [{ urls: "stun:casa:3478" }, { urls: ["turn:nabu:3478"], username: "u", credential: "c" }] },
    getCandidatesUpfront: true,
  });
  assert.equal(casa.iceServers.length, 2);
  assert.equal(casa.tuttiPrima, true);
  const vuoto = serverIce(null);
  assert.deepEqual(vuoto.iceServers, [...STUN_DI_RIPIEGO]);
  assert.equal(vuoto.tuttiPrima, false);
  assert.deepEqual(serverIce({ configuration: { iceServers: [{ boh: 1 }] } }).iceServers, [...STUN_DI_RIPIEGO]);
});

test("i candidati: i tre campi che contano, in tutte e due le direzioni", () => {
  assert.deepEqual(candidatoInJson({ candidate: "candidate:1 1 udp", sdpMid: "0", sdpMLineIndex: 0 }), {
    candidate: "candidate:1 1 udp",
    sdpMid: "0",
    sdpMLineIndex: 0,
  });
  assert.deepEqual(candidatoInJson({ toJSON: () => ({ candidate: "c", sdpMid: null, sdpMLineIndex: 1 }) }), {
    candidate: "c",
    sdpMid: null,
    sdpMLineIndex: 1,
  });
  assert.equal(candidatoInJson({ candidate: "" }), null);
  assert.equal(candidatoInJson(null), null);
  assert.deepEqual(candidatoDaEvento({ candidate: "candidate:9" }), { candidate: "candidate:9", sdpMid: null, sdpMLineIndex: 0 });
  assert.equal(candidatoDaEvento({ candidate: { candidate: "x", sdpMid: "0", sdpMLineIndex: 0 } }).candidate, "x");
  assert.equal(candidatoDaEvento({}), null);
});

test("un video caduto si riprova fra un minuto, e chi dorme ha piu' tempo", () => {
  const immagine = { dataset: {} };
  assert.equal(videoInPausa(immagine, 1000), false);
  assert.equal(mettiInPausaIlVideo(immagine, 1000), 1000 + PAUSA_VIDEO_MS);
  assert.equal(videoInPausa(immagine, 1000 + PAUSA_VIDEO_MS - 1), true);
  assert.equal(videoInPausa(immagine, 1000 + PAUSA_VIDEO_MS), false);
  assert.equal(mettiInPausaIlVideo(null), 0);
  assert.equal(attesaDelVideo({ state: "streaming" }), ATTESA_VIDEO.LOCALE);
  assert.equal(attesaDelVideo({ state: "idle" }), ATTESA_VIDEO.SVEGLIA);
});

test("il ponte lascia passare il WebRTC di Home Assistant", () => {
  for (const tipo of ["camera/webrtc/offer", "camera/webrtc/candidate", "camera/webrtc/get_client_config", "camera/web_rtc_offer"])
    assert.ok(ALLOWED_MESSAGE_TYPES.includes(tipo), tipo);
});

test("l'offerta e' una sottoscrizione: risposta, poi eventi con lo stesso id, poi si chiude", async () => {
  const consegne = [];
  let callback = null;
  let chiusa = 0;
  const connection = {
    sendMessagePromise: async (payload) => ({ eco: payload }),
    subscribeMessage: async (cb, payload) => {
      callback = cb;
      consegne.push(["sub", payload]);
      return () => {
        chiusa += 1;
      };
    },
  };
  const Socket = createBridgeSocket({ connection });
  const socket = new Socket();
  const ricevuti = [];
  socket.onmessage = (evento) => ricevuti.push(JSON.parse(evento.data));
  await new Promise((r) => setTimeout(r, 0));
  await socket.send(JSON.stringify({ id: 41, type: "camera/webrtc/offer", entity_id: "camera.a", offer: "sdp" }));
  assert.deepEqual(consegne[0], ["sub", { type: "camera/webrtc/offer", entity_id: "camera.a", offer: "sdp" }]);
  assert.deepEqual(ricevuti.at(-1), { id: 41, type: "result", success: true, result: null });
  callback({ type: "session", session_id: "s1" });
  callback({ type: "answer", answer: "sdp-risposta" });
  assert.deepEqual(ricevuti.slice(-2), [
    { id: 41, type: "event", event: { type: "session", session_id: "s1" } },
    { id: 41, type: "event", event: { type: "answer", answer: "sdp-risposta" } },
  ]);
  /* Il candidato locale e' una richiesta normale, con la sua risposta. */
  await socket.send(JSON.stringify({ id: 42, type: "camera/webrtc/candidate", entity_id: "camera.a", session_id: "s1", candidate: {} }));
  assert.equal(ricevuti.at(-1).id, 42);
  assert.equal(ricevuti.at(-1).success, true);
  await socket.send(JSON.stringify({ id: 43, type: "unsubscribe_events", subscription: 41 }));
  assert.equal(chiusa, 1);
});

test("senza subscribeMessage il ponte lo dice, invece di restare muto", async () => {
  const Socket = createBridgeSocket({ connection: { sendMessagePromise: async () => null } });
  const socket = new Socket();
  const ricevuti = [];
  socket.onmessage = (evento) => ricevuti.push(JSON.parse(evento.data));
  await new Promise((r) => setTimeout(r, 0));
  await socket.send(JSON.stringify({ id: 7, type: "camera/webrtc/offer", entity_id: "camera.a", offer: "sdp" }));
  assert.equal(ricevuti.at(-1).success, false);
  assert.equal(ricevuti.at(-1).error.code, "unsupported");
});

test("le tessere provano il video prima del MJPEG, e lo spengono lasciando la pagina", async () => {
  const live = await leggi("sections/live-ui-section.js");
  assert.match(live, /import \{ fermaIVideo, provaIlVideo \} from "\.\/telecamera-webrtc-section\.js";/);
  const video = live.indexOf("if (await provaIlVideo(camera, image)) return true;");
  const mjpeg = live.indexOf("if (!flussoInPausa(image) && (await avviaIlFlusso(camera, image, picture, registry))) return true;");
  assert.ok(video > 0 && mjpeg > video, "il video viene prima del flusso MJPEG");
  assert.match(live, /function stopCameraTimer\(\) \{[\s\S]{0,300}fermaIVideo\(\);/);
  /* Un fotogramma mostrato resta a schermo anche se il flusso cade. */
  assert.match(live, /image\.dataset\.dmCameraFrame = "1";/);
  const sicurezza = await leggi("sections/security-showcase-section.js");
  assert.match(sicurezza, /img\[data-dm-camera-state="unavailable"\]:not\(\[data-dm-camera-frame\]\)\{opacity:0\}/);
  assert.match(sicurezza, /\.dm-cam-feed\[data-dm-video="on"\]>video\.dm-cam-video\{opacity:1\}/);
});

test("il popup negozia con i server ICE di casa, rispettando la pulizia del guscio", async () => {
  const sezione = await leggi("sections/telecamera-webrtc-section.js");
  assert.match(sezione, /type: "camera\/webrtc\/get_client_config"/);
  assert.match(sezione, /type: "camera\/webrtc\/offer"/);
  assert.match(sezione, /type: "camera\/webrtc\/candidate"/);
  assert.match(sezione, /type: "camera\/web_rtc_offer"/);
  assert.match(sezione, /type: "camera\/stream", entity_id: entity, format: "hls"/);
  assert.match(sezione, /root\.dmStartWebRTCNative = avviaPerIlPopup;/);
  assert.match(sezione, /_dmPc = __dmWebRtcPc/);
  assert.match(sezione, /root\._dmNativeSubId = sessione\.idSottoscrizione;/);
  assert.match(sezione, /avvolto\.keepAlive = true;/);
  const runtime = await leggi("sections/section-runtime.js");
  const vivo = runtime.indexOf("installLiveUiSection();");
  const webrtc = runtime.indexOf("installTelecameraWebRtc();");
  assert.ok(vivo > 0 && webrtc > vivo);
  assert.match(runtime, /"telecamera-webrtc",/);
});
