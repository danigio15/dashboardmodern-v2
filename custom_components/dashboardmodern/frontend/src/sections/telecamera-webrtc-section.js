/* Il video vero nelle tessere e nel popup: WebRTC nativo e HLS.
 *
 * «Continuano a non funzionare in live streaming, e nemmeno se metto nome
 * webrtc parte.» Due cose non tornavano.
 *
 * La prima: dentro il pannello di Home Assistant — e quindi da Nabu Casa — il
 * ponte verso il socket non lasciava passare `camera/webrtc/offer`, e il
 * WebRTC nativo del popup moriva prima di cominciare. Il campo «nome del
 * flusso» e' un'altra cosa: e' per chi ha l'estensione go2rtc con un nome
 * suo, e scriverci «webrtc» non accende niente. Il ponte adesso lascia
 * passare l'offerta e i suoi eventi, e questo modulo la negozia con i server
 * ICE che Home Assistant dichiara per la telecamera — i TURN di Nabu Casa
 * compresi, che da fuori casa sono la differenza fra il video e il nero.
 *
 * La seconda: le tessere «dal vivo» usavano il MJPEG del proxy, che per una
 * telecamera in cloud e' l'ultima istantanea ripetuta. Quando Home Assistant
 * dichiara `web_rtc` o `hls`, la tessera monta un video e lo guarda da li';
 * il MJPEG e le istantanee restano come rete sotto, per chi non dichiara
 * niente e per quando il video non parte. La regola sta in
 * `core/telecamera-webrtc.js`; qui ci sono il socket e il DOM.
 */
import {
  attesaDelVideo,
  candidatoDaEvento,
  candidatoInJson,
  mettiInPausaIlVideo,
  serverIce,
  tipoDiFlusso,
  videoInPausa,
} from "../core/telecamera-webrtc.js";
import { allStates, chiediAHomeAssistant, clean, doc, lexicalGlobal, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TELECAMERA_WEBRTC__";
const state = (root[KEY] ||= { installed: false, sessioni: new Map() });

/* ── il socket ────────────────────────────────────────────────────────── */

function presa() {
  const socket = lexicalGlobal("ws");
  const pending = lexicalGlobal("pendingWsCallbacks");
  if (!socket || socket.readyState !== 1 || !pending) throw new Error("socket");
  return { socket, pending };
}

function prossimoId() {
  return root.eval("msgId++");
}

/* Una sottoscrizione: piu' messaggi con lo stesso id. Il guscio la rispetta
 * quando il gestore porta `keepAlive`, e il ponte del pannello consegna gli
 * eventi con lo stesso id della richiesta. */
function sottoscrivi(payload, gestore) {
  const { socket, pending } = presa();
  const id = prossimoId();
  const avvolto = (messaggio) => gestore(messaggio);
  avvolto.keepAlive = true;
  pending[id] = avvolto;
  socket.send(JSON.stringify({ ...payload, id }));
  return {
    id,
    chiudi() {
      delete pending[id];
      /* E si chiude anche di la'. Togliere il gestore di qua lasciava la
       * sottoscrizione viva nel ponte del pannello — e con lei la sessione —
       * finche' non cadeva l'intero socket: una in piu' a ogni visita della
       * pagina. Il socket puo' essere gia' chiuso: allora se n'e' andata con
       * lui. */
      try {
        if (socket.readyState === 1)
          socket.send(
            JSON.stringify({ id: prossimoId(), type: "unsubscribe_events", subscription: id }),
          );
      } catch (_error) {}
    },
  };
}

function spedisci(payload) {
  const { socket } = presa();
  socket.send(JSON.stringify({ ...payload, id: prossimoId() }));
}

async function serverIceDiCasa(entity) {
  try {
    return serverIce(
      await chiediAHomeAssistant({ type: "camera/webrtc/get_client_config", entity_id: entity }, 4000),
    );
  } catch (_error) {
    return serverIce(null);
  }
}

function raccoltaIceFinita(pc, attesa = 2500) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const fine = () => {
      pc.removeEventListener("icegatheringstatechange", controlla);
      resolve();
    };
    const controlla = () => {
      if (pc.iceGatheringState === "complete") fine();
    };
    pc.addEventListener("icegatheringstatechange", controlla);
    root.setTimeout?.(fine, attesa);
  });
}

/* Il dialetto vecchio: una domanda, una risposta con la answer intera. */
function offertaVecchia(entity, pc, sdp) {
  return chiediAHomeAssistant({ type: "camera/web_rtc_offer", entity_id: entity, offer: sdp }, 12000).then(
    (risposta) => {
      const answer = clean(risposta?.answer);
      if (!answer) throw new Error("web_rtc_offer");
      return pc.setRemoteDescription({ type: "answer", sdp: answer });
    },
  );
}

/**
 * Il WebRTC come lo parla Home Assistant.
 *
 * L'offerta parte con `camera/webrtc/offer`; le risposte arrivano come
 * eventi sulla stessa sottoscrizione — session, answer, candidate, error — e
 * i candidati locali si spediscono con `camera/webrtc/candidate` appena la
 * sessione ha un nome. Torna la sessione, con la connessione e il modo di
 * chiuderla; il video si riempie da solo quando arriva la traccia.
 */
export async function avviaWebRtcNativo(entity, video, { attesa = 15000 } = {}) {
  if (typeof root.RTCPeerConnection !== "function") throw new Error("browser-senza-webrtc");
  presa();
  const ice = await serverIceDiCasa(entity);
  const pc = new root.RTCPeerConnection({ iceServers: ice.iceServers, bundlePolicy: "max-bundle" });
  pc.ontrack = (evento) => {
    const flusso = evento.streams?.[0];
    if (flusso && video && video.srcObject !== flusso) {
      video.srcObject = flusso;
      try {
        video.play?.()?.catch?.(() => {});
      } catch (_error) {}
    }
  };
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });
  const offerta = await pc.createOffer();
  await pc.setLocalDescription(offerta);
  if (ice.tuttiPrima) await raccoltaIceFinita(pc);
  const sdp = (ice.tuttiPrima && pc.localDescription?.sdp) || offerta.sdp;

  return new Promise((resolve, reject) => {
    let chiusa = false;
    let sessione = "";
    let sottoscrizione = null;
    const inAttesa = [];
    const timer = root.setTimeout?.(() => fallisci(new Error("timeout-webrtc")), attesa);
    const chiudi = () => {
      if (chiusa) return;
      chiusa = true;
      root.clearTimeout?.(timer);
      sottoscrizione?.chiudi();
      try {
        pc.close();
      } catch (_error) {}
    };
    const fallisci = (errore) => {
      if (chiusa) return;
      chiudi();
      reject(errore);
    };
    const riuscita = () => {
      if (chiusa) return;
      root.clearTimeout?.(timer);
      resolve({ pc, chiudi, idSottoscrizione: sottoscrizione?.id ?? null });
    };
    const mandaCandidato = (candidato) => {
      try {
        spedisci({ type: "camera/webrtc/candidate", entity_id: entity, session_id: sessione, candidate: candidato });
      } catch (_error) {}
    };
    pc.onicecandidate = (evento) => {
      const candidato = candidatoInJson(evento.candidate);
      if (!candidato || ice.tuttiPrima) return;
      if (sessione) mandaCandidato(candidato);
      else inAttesa.push(candidato);
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState) && !chiusa) fallisci(new Error(pc.connectionState));
    };
    const gestore = async (messaggio) => {
      if (messaggio?.type === "result") {
        if (messaggio.success === false) {
          const codice = clean(messaggio.error?.code);
          if (codice === "unknown_command" || codice === "unknown_type") {
            sottoscrizione?.chiudi();
            offertaVecchia(entity, pc, sdp).then(riuscita, fallisci);
            return;
          }
          fallisci(new Error(clean(messaggio.error?.message) || "camera/webrtc/offer"));
        }
        return;
      }
      const evento = messaggio?.event || {};
      if (evento.type === "session") {
        sessione = clean(evento.session_id);
        while (sessione && inAttesa.length) mandaCandidato(inAttesa.shift());
      } else if (evento.type === "answer") {
        try {
          await pc.setRemoteDescription({ type: "answer", sdp: evento.answer });
          riuscita();
        } catch (errore) {
          fallisci(errore);
        }
      } else if (evento.type === "candidate") {
        const candidato = candidatoDaEvento(evento);
        if (candidato) {
          try {
            await pc.addIceCandidate(candidato);
          } catch (_error) {}
        }
      } else if (evento.type === "error") {
        fallisci(new Error(clean(evento.message) || clean(evento.code) || "webrtc"));
      }
    };
    try {
      sottoscrizione = sottoscrivi({ type: "camera/webrtc/offer", entity_id: entity, offer: sdp }, gestore);
    } catch (errore) {
      fallisci(errore);
    }
  });
}

/* HLS: la playlist da `camera/stream`, nel video. Safari la legge da solo;
 * gli altri passano da hls.js, che il guscio porta con se'. */
export async function avviaHls(entity, video) {
  const risposta = await chiediAHomeAssistant({ type: "camera/stream", entity_id: entity, format: "hls" }, 15000);
  const url = clean(risposta?.url);
  if (!url) throw new Error("hls-senza-url");
  const nativo = typeof video?.canPlayType === "function" && video.canPlayType("application/vnd.apple.mpegurl") !== "";
  if (nativo) {
    video.src = url;
    return {
      chiudi() {
        try {
          video.removeAttribute("src");
          video.load?.();
        } catch (_error) {}
      },
    };
  }
  const Hls = root.Hls;
  if (!Hls || typeof Hls.isSupported !== "function" || !Hls.isSupported()) throw new Error("hls-non-supportato");
  const lettore = new Hls({ lowLatencyMode: true, backBufferLength: 10, maxBufferLength: 8 });
  lettore.loadSource(url);
  lettore.attachMedia(video);
  return {
    chiudi() {
      try {
        lettore.destroy();
      } catch (_error) {}
    },
  };
}

/* ── le tessere ───────────────────────────────────────────────────────── */

function videoDellaTessera(image) {
  const cornice = image?.parentElement;
  if (!cornice) return null;
  let video = cornice.querySelector(":scope > video.dm-cam-video");
  if (!video) {
    video = doc.createElement("video");
    video.className = "dm-cam-video";
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    image.after(video);
  }
  return video;
}

function spegniSessione(entity, { pausa = true } = {}) {
  const sessione = state.sessioni.get(entity);
  if (!sessione) return false;
  state.sessioni.delete(entity);
  root.clearTimeout?.(sessione.timer);
  try {
    sessione.chiudi?.();
  } catch (_error) {}
  const { video, image } = sessione;
  if (video) {
    try {
      video.srcObject = null;
      video.removeAttribute("src");
      video.load?.();
    } catch (_error) {}
    const cornice = video.parentElement;
    if (cornice) delete cornice.dataset.dmVideo;
  }
  if (pausa && image) mettiInPausaIlVideo(image);
  return true;
}

/**
 * Il video nella tessera, se Home Assistant dichiara una strada.
 *
 * Torna `true` quando il video e' in mano sua — in volo o gia' vivo — e chi
 * chiama non deve fare altro; `false` quando non c'e' strada, o e' in pausa
 * dopo una caduta, e allora tocca al MJPEG e alle istantanee.
 */
export async function provaIlVideo(camera, image) {
  const entity = clean(camera?.entity);
  if (!entity || !image || !doc) return false;
  const stato = allStates()?.[entity];
  const tipo = tipoDiFlusso(stato);
  if (!tipo) return false;
  const viva = state.sessioni.get(entity);
  if (viva) {
    if (viva.image === image) return true;
    spegniSessione(entity, { pausa: false });
  }
  if (videoInPausa(image)) return false;
  const video = videoDellaTessera(image);
  if (!video) return false;
  const sessione = { entity, image, video, tipo, chiudi: null, timer: 0, viva: false };
  state.sessioni.set(entity, sessione);
  const cornice = video.parentElement;
  const primoFotogramma = () => {
    if (state.sessioni.get(entity) !== sessione) return;
    sessione.viva = true;
    root.clearTimeout?.(sessione.timer);
    if (cornice) cornice.dataset.dmVideo = "on";
    image.dataset.dmCameraFrame = "1";
    image.dataset.dmCameraState = "ready";
  };
  video.addEventListener("playing", primoFotogramma);
  video.addEventListener("loadeddata", primoFotogramma);
  const caduta = () => {
    if (state.sessioni.get(entity) !== sessione) return;
    spegniSessione(entity);
  };
  video.addEventListener("error", caduta, { once: true });
  sessione.timer = root.setTimeout?.(() => {
    if (!sessione.viva) caduta();
  }, attesaDelVideo(stato));
  const avvio = tipo === "web_rtc" ? avviaWebRtcNativo(entity, video, { attesa: attesaDelVideo(stato) }) : avviaHls(entity, video);
  avvio
    .then((esito) => {
      if (state.sessioni.get(entity) !== sessione) {
        esito?.chiudi?.();
        return;
      }
      sessione.chiudi = esito?.chiudi || null;
      const pc = esito?.pc;
      if (pc)
        pc.addEventListener("connectionstatechange", () => {
          if (["failed", "disconnected", "closed"].includes(pc.connectionState)) caduta();
        });
      try {
        video.play?.()?.catch?.(() => {});
      } catch (_error) {}
    })
    .catch(() => caduta());
  return true;
}

/** Tutti i video si fermano: si e' lasciata la pagina, o la scheda e' nascosta. */
export function fermaIVideo() {
  let fermati = 0;
  for (const entity of [...state.sessioni.keys()]) if (spegniSessione(entity, { pausa: false })) fermati += 1;
  return fermati;
}

/** Quante tessere stanno mostrando un video adesso. */
export function videoVivi() {
  return [...state.sessioni.values()].filter((sessione) => sessione.viva).length;
}

/* ── il popup del guscio ──────────────────────────────────────────────── */

/* Il popup della telecamera negozia il WebRTC nativo con la funzione del
 * guscio, che tiene lo STUN pubblico scritto a mano e non sa dei TURN di
 * casa. La si sostituisce con la nostra, rispettando il suo contratto: torna
 * la connessione, e lascia in `_dmPc` e `_dmNativeSubId` quello che la sua
 * pulizia chiude. `_dmPc` e' un `let` del guscio: ci si arriva con l'eval
 * indiretto, passando per una variabile di appoggio. */
async function avviaPerIlPopup(entityId, videoEl) {
  const sessione = await avviaWebRtcNativo(clean(entityId), videoEl, { attesa: 15000 });
  root.__dmWebRtcPc = sessione.pc;
  try {
    root.eval('typeof _dmPc !== "undefined" && (_dmPc = __dmWebRtcPc)');
  } catch (_error) {}
  root._dmNativeSubId = sessione.idSottoscrizione;
  return sessione.pc;
}

function installaNelPopup() {
  if (typeof root.dmStartWebRTCNative !== "function" || root.dmStartWebRTCNative.__dmTelecameraWebRtc) return false;
  avviaPerIlPopup.__dmTelecameraWebRtc = true;
  avviaPerIlPopup.__dmPrevious = root.dmStartWebRTCNative;
  root.dmStartWebRTCNative = avviaPerIlPopup;
  return true;
}

export function installTelecameraWebRtc() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaNelPopup();
  for (const evento of ["dashboardmodern:legacy-ready", "pageshow"]) root.addEventListener?.(evento, installaNelPopup);
  return true;
}

installTelecameraWebRtc();
