/* La telecamera si vede subito, e la seconda volta si apre di corsa.
 *
 * «Vanno riviste completamente le connessioni che avvengono con le telecamere:
 * sono lentissime e non carica immediatamente immagine.»
 *
 * Il guscio prova le strade IN FILA — WebRTC, HLS, MJPEG, istantanee — e ogni
 * strada scrive dentro il popup solo quando riesce. Prima di allora nel
 * riquadro non c'e' niente: la rotella e la scritta «Connessione…», su una
 * telecamera che dorme, per venticinque secondi buoni. E la fila si rifa'
 * identica a ogni apertura, anche sulla telecamera che va in HLS da sempre.
 *
 * Qui si tolgono le due attese, senza toccare la cascata del guscio — che
 * resta la rete di sicurezza, intera, per quando le cose vanno storte.
 *
 *   1. IL FOTOGRAMMA SUBITO. L'ultima istantanea della telecamera e' gia' in
 *      casa: `entity_picture` sta negli stati, con dentro il suo gettone, ed
 *      e' la stessa immagine che la tessera del muro mostra da sempre. Non
 *      costa una richiesta, non costa un giro sul socket: si disegna prima di
 *      cominciare a negoziare. Chi apre vede la sua telecamera in un istante,
 *      ferma, con sopra scritto che il video sta arrivando — invece di un
 *      rettangolo nero che non dice niente.
 *
 *   2. LA STRADA CHE HA FUNZIONATO. Quale strada regge non e' una proprieta'
 *      della telecamera: e' una proprieta' della strada di rete fra chi guarda
 *      e la telecamera. Percio' si ricorda su QUESTO dispositivo — non viaggia
 *      con la casa — e la volta dopo si prova per prima, con un permesso corto,
 *      tarato su quanto ci mise. Se regge, il video parte in quel tempo li'; se
 *      non regge, si e' perso pochissimo e riparte la fila intera del guscio,
 *      senza riprovare la strada appena caduta.
 *
 * Chi decide sta nel modulo puro `core/apertura-telecamera.js`; qui c'e' la
 * mano che disegna e che chiama le funzioni del guscio.
 */
import {
  CHIAVE_STRADE_TELECAMERE,
  conIlRicordo,
  ricordoDellaTelecamera,
  scorciatoia,
  senzaIlRicordo,
} from "../core/apertura-telecamera.js";
import { strategieDellaTelecamera } from "../core/strategie-telecamera.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TELECAMERA_SUBITO__";
const STYLE_ID = "dm-cam-subito-style";
const state = (root[KEY] ||= { installed: false });

/* Da quale elemento si capisce quale strada ha disegnato: sono gli
 * identificativi che il guscio da' ai suoi lettori, uno per strada. */
const SEGNI = Object.freeze([
  ["cam-video", "WebRTC"],
  ["cam-hls", "HLS"],
  ["cam-mjpeg", "MJPEG"],
  ["cam-polling", "Istantanee"],
]);

/** Quale strada sta mostrando il popup adesso, o "". */
export function stradaMostrata(documento = doc) {
  for (const [id, nome] of SEGNI) if (documento?.getElementById?.(id)) return nome;
  return "";
}

function memoria() {
  return readJson(CHIAVE_STRADE_TELECAMERE, {});
}

function scriviLaMemoria(prossima) {
  writeJsonIfChanged(CHIAVE_STRADE_TELECAMERE, prossima);
}

/** L'ultima istantanea di questa telecamera, o "" se non ne ha una. */
export function istantaneaDi(entity, states = allStates()) {
  return clean(states?.[clean(entity)]?.attributes?.entity_picture);
}

/**
 * Il fotogramma che si vede mentre il video negozia.
 *
 * Le classi sono quelle del guscio, cosi' il riquadro ha gia' la sua forma e la
 * sua rotella: quando una strada riesce e riscrive il corpo, non si vede
 * nessun salto — cambia solo cosa c'e' dentro la stessa cornice.
 */
export function anteprimaMarkup(foto, nome = "") {
  return `<div class="cam-popup-body"><div class="cam-zoom-container dm-cam-attesa"
      style="position:relative; padding-top:56.25%;">
      ${foto ? `<img class="dm-cam-anteprima" src="${esc(foto)}" alt="${esc(nome)}">` : ""}
      <div class="cam-video-loader-overlay"><div class="cam-popup-spinner"></div>
        <div>${esc(t("Il video sta arrivando…", "The video is on its way…"))}</div></div>
    </div></div>`;
}

/** Disegna subito l'istantanea dentro il popup. Torna `true` se ce n'era una. */
export function mostraSubito(cam, content) {
  if (!content) return false;
  const foto = istantaneaDi(cam?.entity);
  content.innerHTML = anteprimaMarkup(foto, clean(cam?.name) || clean(cam?.entity));
  return Boolean(foto);
}

/* Le strade che il guscio proverebbe adesso, chieste allo stesso modulo che
 * usa lui: non si indovina un elenco parallelo che poi diverge dal suo. */
function stradeDiAdesso(cam) {
  const states = allStates();
  const stato = states[clean(cam?.entity)] || { entity_id: clean(cam?.entity) };
  let hlsNelBrowser = true;
  try {
    hlsNelBrowser =
      typeof root.Hls !== "undefined" ||
      doc?.createElement?.("video")?.canPlayType?.("application/vnd.apple.mpegurl") !== "";
  } catch (_error) {}
  return strategieDellaTelecamera(cam || {}, stato, {
    webrtcNelBrowser: typeof root.RTCPeerConnection !== "undefined",
    hlsNelBrowser,
  });
}

/* Le corse del guscio, con le firme che hanno la'. Le istantanee non tornano
 * una promessa: e' l'ultima rete, e non fallisce. */
function corsaDelGuscio(strada, cam, content) {
  const nome = clean(strada?.nome);
  if (nome === "WebRTC") return root.dmCamWebRTC?.(cam, strada, content, strada.attesa);
  if (nome === "HLS") return root.dmCamHLS?.(cam, content, strada.attesa);
  if (nome === "MJPEG") return root.dmCamMJPEG?.(cam, content, strada.attesa);
  if (nome === "Istantanee") return Promise.resolve(root.dmCamPolling?.(cam, content));
  return Promise.reject(new Error(`strada sconosciuta: ${nome}`));
}

function ripulisci() {
  try {
    root.dmCleanupWebRTC?.();
    root.dmCleanupHLS?.();
  } catch (_error) {}
}

/** Segna che questa strada ha funzionato, e quanto ci ha messo. */
export function imparaLaStrada(entity, strada, ms, adesso = Date.now()) {
  const nome = clean(strada);
  if (!nome) return false;
  scriviLaMemoria(conIlRicordo(memoria(), entity, nome, ms, adesso));
  return true;
}

export function installTelecameraSubito() {
  if (state.installed) return false;
  const precedente = root.dmCamOpen;
  if (typeof precedente !== "function" || precedente.__dmTelecameraSubito) return false;
  installStyle(STYLE_ID, css());

  async function avvolta(cam, title, content) {
    const entity = clean(cam?.entity);
    /* Prima di qualunque negoziato: la telecamera si vede. Anche quando la
     * cascata sotto ci mettera' venti secondi, e anche quando finira' male —
     * un'istantanea ferma e' piu' di un rettangolo nero. */
    mostraSubito(cam, content);
    if (!entity) return precedente.call(this, cam, title, content);

    const ricordo = ricordoDellaTelecamera(memoria(), entity, Date.now());
    const strade = stradeDiAdesso(cam);
    const corta = scorciatoia(ricordo, strade, Date.now());
    if (corta) {
      const inizio = Date.now();
      try {
        root.dmCamCleanup?.();
        await corsaDelGuscio(corta, cam, content);
        imparaLaStrada(entity, corta.nome, Date.now() - inizio);
        return undefined;
      } catch (_errore) {
        /* La strada di ieri oggi non regge, o il permesso corto non le e'
         * bastato. Si dimentica — insistere domani costerebbe di nuovo questo
         * tempo — e si riparte con la fila intera del guscio, che non e' stata
         * toccata. La stessa strada la' dentro ci ritorna col suo permesso
         * pieno, che e' proprio quello che qui le e' mancato: non e' lavoro
         * doppio, e' la seconda meta' dello stesso tentativo. */
        ripulisci();
        scriviLaMemoria(senzaIlRicordo(memoria(), entity));
        mostraSubito(cam, content);
      }
    }

    const esito = await precedente.call(this, cam, title, content);
    /* Cosa ha vinto lo dice il popup: ogni strada del guscio disegna il suo
     * lettore, e ognuno ha il suo identificativo.
     *
     * Il tempo che si segna non e' quello passato qui dentro — ci sono anche
     * le strade cadute prima — ma il permesso che quella strada ha di suo: e'
     * il tetto onesto per la volta prossima, e appena la scorciatoia riesce
     * davvero viene sostituito dal tempo vero, che e' piu' corto. */
    const vincitrice = clean(stradaMostrata());
    const suo = strade.find((strada) => clean(strada?.nome) === vincitrice);
    if (vincitrice) imparaLaStrada(entity, vincitrice, Number(suo?.attesa) || 0);
    return esito;
  }

  avvolta.__dmTelecameraSubito = true;
  avvolta.__dmPrevious = precedente;
  root.dmCamOpen = avvolta;
  state.installed = true;
  return true;
}

function css() {
  return `
  .dm-cam-attesa{overflow:hidden;border-radius:14px;background:#0b1220}
  .dm-cam-anteprima{
    position:absolute;inset:0;width:100%;height:100%;
    object-fit:cover;display:block;filter:saturate(.85) brightness(.72)}
  .dm-cam-attesa .cam-video-loader-overlay{background:transparent}
  `;
}
