/* Il video vero di una telecamera: WebRTC e HLS, come li parla Home Assistant.
 *
 * «Continuano a non funzionare in live streaming, e nemmeno se metto nome
 * webrtc parte.» Una telecamera in cloud — Arlo, Ring, Nest — non ha un
 * flusso MJPEG da dare: il proxy di Home Assistant ripete l'ultima istantanea,
 * e il video «dal vivo» e' una foto ferma con scritto LIVE sopra. Il video
 * vero passa da un'altra porta: Home Assistant dichiara, su ogni telecamera,
 * `frontend_stream_type` — `web_rtc` quando negozia via `camera/webrtc/offer`
 * (go2rtc e' dentro Home Assistant dal 2024.12), `hls` quando serve una
 * playlist da `camera/stream`. E' un dato, e questo modulo lo legge.
 *
 * Il modulo e' puro: niente socket, niente DOM. Decide che strada prendere,
 * traduce la risposta dei server ICE, e tiene la regola delle pause — un
 * video che non e' partito non si richiede ogni quattro secondi.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La strada che Home Assistant dichiara per questa telecamera. */
export function tipoDiFlusso(stato = {}) {
  const tipo = pulito(stato?.attributes?.frontend_stream_type).toLowerCase();
  if (tipo === "web_rtc" || tipo === "webrtc") return "web_rtc";
  if (tipo === "hls") return "hls";
  return "";
}

/* I server ICE di casa.
 *
 * `camera/webrtc/get_client_config` risponde con la configurazione che Home
 * Assistant vuole per quella telecamera: gli STUN di go2rtc e, per chi ha
 * Home Assistant Cloud, i TURN di Nabu Casa — che sono la differenza fra un
 * video che parte da fuori casa e uno che resta nero. Senza risposta si
 * ripiega su uno STUN pubblico, che in casa basta. */
export const STUN_DI_RIPIEGO = Object.freeze([{ urls: "stun:stun.l.google.com:19302" }]);

export function serverIce(risposta) {
  const configurazione = risposta?.configuration || risposta || {};
  const elenco = Array.isArray(configurazione.iceServers) ? configurazione.iceServers : [];
  const validi = elenco.filter(
    (voce) => voce && (typeof voce.urls === "string" || Array.isArray(voce.urls)),
  );
  return {
    iceServers: validi.length ? validi : [...STUN_DI_RIPIEGO],
    /* `getCandidatesUpfront`: alcuni server vogliono l'offerta gia' completa
     * dei candidati, senza trickle. Lo dice Home Assistant. */
    tuttiPrima: Boolean(risposta?.getCandidatesUpfront ?? configurazione.getCandidatesUpfront),
  };
}

/** Un candidato ICE come lo vuole il socket: solo i tre campi che contano. */
export function candidatoInJson(candidato) {
  if (!candidato) return null;
  const dato = typeof candidato.toJSON === "function" ? candidato.toJSON() : candidato;
  const testo = pulito(dato?.candidate);
  if (!testo) return null;
  return {
    candidate: testo,
    sdpMid: dato.sdpMid ?? null,
    sdpMLineIndex: Number.isFinite(dato.sdpMLineIndex) ? dato.sdpMLineIndex : null,
  };
}

/** Il candidato che arriva da Home Assistant: a volte e' una stringa nuda. */
export function candidatoDaEvento(evento) {
  const grezzo = evento?.candidate;
  if (!grezzo) return null;
  if (typeof grezzo === "string") return { candidate: grezzo, sdpMid: null, sdpMLineIndex: 0 };
  return candidatoInJson(grezzo);
}

/* ── le pause ─────────────────────────────────────────────────────────── */

/* Un video che non e' partito si riprova fra un minuto, non fra quattro
 * secondi: una telecamera che dorme ci mette dieci secondi a svegliarsi e
 * richiederla di continuo la tiene sveglia per niente. Il segno sta
 * sull'immagine della tessera, dove sta anche quello del flusso MJPEG. */
export const PAUSA_VIDEO_MS = 60_000;

export function videoInPausa(immagine, adesso = Date.now()) {
  const fino = Number(immagine?.dataset?.dmCameraVideoPausa);
  return Number.isFinite(fino) && fino > adesso;
}

export function mettiInPausaIlVideo(immagine, adesso = Date.now(), durata = PAUSA_VIDEO_MS) {
  if (!immagine?.dataset) return 0;
  const fino = adesso + Math.max(0, Number(durata) || 0);
  immagine.dataset.dmCameraVideoPausa = String(fino);
  return fino;
}

/** Quanto aspettare il primo fotogramma: chi dorme ha bisogno di piu' tempo. */
export const ATTESA_VIDEO = Object.freeze({ SVEGLIA: 25_000, LOCALE: 12_000 });

export function attesaDelVideo(stato = {}) {
  const acceso = pulito(stato?.state).toLowerCase() === "streaming";
  return acceso ? ATTESA_VIDEO.LOCALE : ATTESA_VIDEO.SVEGLIA;
}
