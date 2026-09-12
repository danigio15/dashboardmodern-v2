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
import { attesaDelFlusso } from "../core/strategie-telecamera.js";
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

/* ── far partire il video ─────────────────────────────────────────────── */

/**
 * Far partire un video, e se il browser non lo lascia partire con l'audio,
 * farlo partire muto.
 *
 * «Telecamere nemmeno va»: il popup restava su «Connessione WebRTC…» con
 * l'istantanea dietro e, in mezzo, il triangolo di play che disegna il
 * browser. Non era il negoziato: quello era andato a buon fine. Era l'ultimo
 * passo.
 *
 * Nessun browser di telefono lascia partire da solo un video con l'audio
 * acceso — e' la regola dell'autoplay, e vale per tutti. Il popup del guscio
 * accende l'audio prima ancora che il flusso arrivi (`videoEl.muted = false`),
 * e poi si aspetta l'evento `playing` per togliere il velo. Chiedendo `play()`
 * con l'audio acceso si riceve un rifiuto, `playing` non arriva mai, e il velo
 * resta li' per sempre sopra un fotogramma fermo.
 *
 * Il guscio quel rifiuto lo sapeva gestire — `dmTryPlayUnmuted` riprova muto e
 * accende la scritta «Tap per audio» — ma quella riga sta dentro la sua
 * versione del negoziato, e questo modulo la sostituisce (per portarci i TURN
 * di casa, che da fuori sono la differenza fra il video e il nero). Nel
 * cambio, la riprova muta si era persa: il rifiuto veniva ingoiato e basta.
 *
 * L'ordine e' quello: prima con l'audio, perche' chi apre un popup di solito
 * lo vuole; poi muto, e lo si dice — la pastiglia «Tap per audio» e' il modo
 * di riaverlo con un dito. Le tessere del muro non ci provano nemmeno: una
 * parete di telecamere che parlano tutte insieme non la vuole nessuno.
 */
export async function faiPartireIlVideo(video, { conAudio = false } = {}) {
  if (!video || typeof video.play !== "function") return "";
  const prova = async (muto) => {
    video.muted = muto;
    if (muto) video.setAttribute("muted", "");
    else {
      video.removeAttribute("muted");
      try {
        video.volume = 1;
      } catch (_errore) {}
    }
    await video.play();
  };
  if (conAudio) {
    try {
      await prova(false);
      try {
        root.dmHideAudioMini?.();
      } catch (_errore) {}
      return "audio";
    } catch (_errore) {}
  }
  try {
    await prova(true);
    if (conAudio) {
      try {
        root.dmShowAudioMini?.();
      } catch (_errore) {}
    }
    return "muto";
  } catch (_errore) {}
  return "fermo";
}

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
      await chiediAHomeAssistant(
        { type: "camera/webrtc/get_client_config", entity_id: entity },
        4000,
      ),
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
  return chiediAHomeAssistant(
    { type: "camera/web_rtc_offer", entity_id: entity, offer: sdp },
    12000,
  ).then((risposta) => {
    const answer = clean(risposta?.answer);
    if (!answer) throw new Error("web_rtc_offer");
    return pc.setRemoteDescription({ type: "answer", sdp: answer });
  });
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
export async function avviaWebRtcNativo(
  entity,
  video,
  { attesa = 15000, conAudio = false, quandoSiPuoChiudere = null } = {},
) {
  if (typeof root.RTCPeerConnection !== "function") throw new Error("browser-senza-webrtc");
  presa();
  const ice = await serverIceDiCasa(entity);
  const pc = new root.RTCPeerConnection({ iceServers: ice.iceServers, bundlePolicy: "max-bundle" });
  /* Il modo di chiuderlo esiste da subito, non solo a negoziato finito.
   *
   * «Vedi che parte doppia connessione insieme.» Un negoziato dura secondi, e
   * in quei secondi chi ha aperto il popup puo' aprirlo di nuovo — o la strada
   * ricordata puo' scadere e far ripartire la fila intera. Finche' l'unico modo
   * di chiudere arrivava insieme alla sessione RIUSCITA, un negoziato ancora in
   * volo non si poteva fermare: restava li' a trattare con la telecamera mentre
   * il secondo faceva lo stesso. Due connessioni sulla stessa telecamera, e
   * nessuna delle due che arriva in fondo.
   *
   * Adesso chi chiama puo' tenersi il modo di chiuderlo appena c'e' qualcosa da
   * chiudere. Chiuderlo due volte non fa niente: `chiusa` lo sa gia'. */
  let chiudiPresto = () => {
    try {
      pc.close();
    } catch (_error) {}
  };
  quandoSiPuoChiudere?.((...argomenti) => chiudiPresto(...argomenti));
  pc.ontrack = (evento) => {
    const flusso = evento.streams?.[0];
    if (flusso && video && video.srcObject !== flusso) {
      video.srcObject = flusso;
      faiPartireIlVideo(video, { conAudio }).catch(() => {});
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
    chiudiPresto = chiudi;
    const riuscita = () => {
      if (chiusa) return;
      root.clearTimeout?.(timer);
      resolve({ pc, chiudi, idSottoscrizione: sottoscrizione?.id ?? null });
    };
    const mandaCandidato = (candidato) => {
      try {
        spedisci({
          type: "camera/webrtc/candidate",
          entity_id: entity,
          session_id: sessione,
          candidate: candidato,
        });
      } catch (_error) {}
    };
    pc.onicecandidate = (evento) => {
      const candidato = candidatoInJson(evento.candidate);
      if (!candidato || ice.tuttiPrima) return;
      if (sessione) mandaCandidato(candidato);
      else inAttesa.push(candidato);
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState) && !chiusa)
        fallisci(new Error(pc.connectionState));
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
      sottoscrizione = sottoscrivi(
        { type: "camera/webrtc/offer", entity_id: entity, offer: sdp },
        gestore,
      );
    } catch (errore) {
      fallisci(errore);
    }
  });
}

/* HLS: la playlist da `camera/stream`, nel video. Safari la legge da solo;
 * gli altri passano da hls.js, che il guscio porta con se'. */
export async function avviaHls(entity, video) {
  const risposta = await chiediAHomeAssistant(
    { type: "camera/stream", entity_id: entity, format: "hls" },
    15000,
  );
  const url = clean(risposta?.url);
  if (!url) throw new Error("hls-senza-url");
  const nativo =
    typeof video?.canPlayType === "function" &&
    video.canPlayType("application/vnd.apple.mpegurl") !== "";
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
  if (!Hls || typeof Hls.isSupported !== "function" || !Hls.isSupported())
    throw new Error("hls-non-supportato");
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
  const avvio =
    tipo === "web_rtc"
      ? avviaWebRtcNativo(entity, video, { attesa: attesaDelVideo(stato) })
      : avviaHls(entity, video);
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
      faiPartireIlVideo(video, { conAudio: false }).catch(() => {});
    })
    .catch(() => caduta());
  return true;
}

/** Tutti i video si fermano: si e' lasciata la pagina, o la scheda e' nascosta. */
export function fermaIVideo() {
  let fermati = 0;
  for (const entity of [...state.sessioni.keys()])
    if (spegniSessione(entity, { pausa: false })) fermati += 1;
  return fermati;
}

/* ── il popup del guscio ──────────────────────────────────────────────── */

/* Il popup della telecamera negozia il WebRTC nativo con la funzione del
 * guscio, che tiene lo STUN pubblico scritto a mano e non sa dei TURN di
 * casa. La si sostituisce con la nostra, rispettando il suo contratto: torna
 * la connessione, e lascia in `_dmPc` e `_dmNativeSubId` quello che la sua
 * pulizia chiude. `_dmPc` e' un `let` del guscio: ci si arriva con l'eval
 * indiretto, passando per una variabile di appoggio. */
/* Un negoziato per volta, per il popup: quello di prima si chiude prima che
 * cominci questo.
 *
 * «Telecamere continua a dare problema, vedi che parte doppia connessione
 * insieme.» Il popup puo' chiedere di aprire due volte per la stessa
 * telecamera senza che nessuno abbia sbagliato: la strada ricordata ha un
 * permesso di tempo corto, e quando scade la plancia riparte con la fila
 * intera del guscio — che rifa' lo stesso negoziato. Il primo pero' non si era
 * fermato: nessuno lo aveva fermato, perche' finche' non riesce non c'e'
 * niente da chiudere in mano a nessuno.
 *
 * Risultato: due trattative aperte sulla stessa telecamera, due `<video>` di
 * cui uno gia' staccato dalla pagina, e il velo «Connessione WebRTC…» agganciato
 * a quello staccato che nessuno togliera' mai piu'.
 *
 * Qui si tiene il modo di chiudere quello in corso, e la prima cosa che fa
 * un'apertura nuova e' chiudere la vecchia. */
let chiudiIlNegoziatoDelPopup = null;

async function avviaPerIlPopup(entityId, videoEl) {
  const entity = clean(entityId);
  try {
    chiudiIlNegoziatoDelPopup?.();
  } catch (_error) {}
  chiudiIlNegoziatoDelPopup = null;
  /* E la tessera della stessa telecamera, se stava trasmettendo: il popup si
   * apre sopra di lei, quindi nessuno la sta guardando — e per una telecamera
   * che regge un flusso solo, due sono uno di troppo. */
  spegniSessione(entity, { pausa: false });
  /* Il tempo e' quello che la strategia ha dato a QUESTA strada, non un numero
   * scritto qui.
   *
   * Qui c'erano quindici secondi fissi, e il guscio intanto ne concedeva
   * dieci a una telecamera di casa e venticinque a una in cloud: il negoziato
   * e il velo «Connessione WebRTC…» andavano ognuno per conto suo. Da una
   * parte cinque secondi di velo in piu' prima che la fila passasse alla
   * strada dopo — il guscio aspetta che questa funzione torni PRIMA di
   * guardare il suo cronometro, quindi quei secondi li paga chi guarda. Dall
   * altra, peggio: a un'Arlo o a una Ring la trattativa veniva interrotta al
   * quindicesimo secondo, dieci prima della fine del tempo che il guscio le
   * aveva dato — cioe' proprio alle telecamere che di tempo hanno bisogno si
   * toglieva la strada che avrebbe funzionato.
   *
   * `attesaDelFlusso` e' lo stesso conto che fa la strategia per la strada
   * nativa: un tempo solo, e questa funzione lo rispetta invece di averne
   * uno suo. */
  const sessione = await avviaWebRtcNativo(entity, videoEl, {
    attesa: attesaDelFlusso(allStates()?.[entity]),
    conAudio: true,
    quandoSiPuoChiudere: (chiudi) => {
      chiudiIlNegoziatoDelPopup = chiudi;
    },
  });
  root.__dmWebRtcPc = sessione.pc;
  try {
    root.eval('typeof _dmPc !== "undefined" && (_dmPc = __dmWebRtcPc)');
  } catch (_error) {}
  root._dmNativeSubId = sessione.idSottoscrizione;
  return sessione.pc;
}

/** Ferma il negoziato del popup, se ce n'e' uno in volo. */
export function fermaIlNegoziatoDelPopup() {
  if (!chiudiIlNegoziatoDelPopup) return false;
  try {
    chiudiIlNegoziatoDelPopup();
  } catch (_error) {}
  chiudiIlNegoziatoDelPopup = null;
  return true;
}

function installaNelPopup() {
  if (
    typeof root.dmStartWebRTCNative !== "function" ||
    root.dmStartWebRTCNative.__dmTelecameraWebRtc
  )
    return false;
  avviaPerIlPopup.__dmTelecameraWebRtc = true;
  avviaPerIlPopup.__dmPrevious = root.dmStartWebRTCNative;
  root.dmStartWebRTCNative = avviaPerIlPopup;
  /* Chiudere il popup ferma anche il negoziato che stava ancora trattando.
   *
   * La pulizia del guscio chiude quello che trova in `_dmPc`, e li' dentro una
   * connessione ci arriva solo a negoziato RIUSCITO: una trattativa ancora in
   * volo la pulizia non la vedeva, e restava aperta sulla telecamera dopo che
   * il popup era gia' chiuso. */
  const pulizia = root.dmCamCleanup;
  if (typeof pulizia === "function" && !pulizia.__dmTelecameraWebRtc) {
    const nostra = (...argomenti) => {
      fermaIlNegoziatoDelPopup();
      return pulizia.apply(root, argomenti);
    };
    nostra.__dmTelecameraWebRtc = true;
    nostra.__dmPrevious = pulizia;
    root.dmCamCleanup = nostra;
  }
  return true;
}

export function installTelecameraWebRtc() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaNelPopup();
  for (const evento of ["dashboardmodern:legacy-ready", "pageshow"])
    root.addEventListener?.(evento, installaNelPopup);
  return true;
}

installTelecameraWebRtc();
