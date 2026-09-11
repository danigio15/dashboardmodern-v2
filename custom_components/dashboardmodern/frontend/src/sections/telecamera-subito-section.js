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
import { fermaIlNegoziatoDelPopup } from "./telecamera-webrtc-section.js";

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

/**
 * Il fermo immagine attaccato al popup, non al suo contenuto.
 *
 * «Guardalo tu stesso: non si vede nulla.» E infatti: l'istantanea si
 * disegnava dentro `content.innerHTML`, e un attimo dopo il guscio riscriveva
 * QUELLO STESSO `content.innerHTML` col suo video e il suo velo
 * («Connessione WebRTC…»). Il fotogramma veniva cancellato prima che
 * qualcuno lo vedesse: restava il segnaposto nero del `<video>` vuoto, cioe'
 * esattamente il rettangolo che questa correzione doveva togliere.
 *
 * Percio' non si mette DENTRO: si mette addosso a `content`, che e' l'elemento
 * che il guscio non tocca — ne riscrive i figli. Da li' il foglio di stile lo
 * dipinge come fondo del riquadro del video, qualunque cosa il guscio ci abbia
 * scritto dentro e quante volte lo riscriva. E quando il video parte non c'e'
 * niente da ripulire: un fotogramma opaco lo copre da se'.
 */
export function vestiIlPopup(cam, content, states = allStates()) {
  if (!content?.style) return false;
  const foto = istantaneaDi(cam?.entity, states);
  if (!foto) {
    content.classList?.remove?.("dm-cam-con-fermo");
    content.style.removeProperty("--dm-cam-fermo");
    return false;
  }
  /* Le parentesi e gli apici nell'URL si citano: un `entity_picture` porta un
   * gettone di accesso, e un apice li' dentro romperebbe la regola. */
  content.style.setProperty("--dm-cam-fermo", `url("${String(foto).replaceAll('"', "%22")}")`);
  content.classList?.add?.("dm-cam-con-fermo");
  return true;
}

/**
 * Il fermo immagine si toglie appena il video vero dipinge.
 *
 * «Sembrano 2 immagini sovrapposte» (#476). Erano due davvero: il fermo resta
 * come SFONDO del riquadro, e il commento qui sopra dava per scontato che il
 * video, opaco, lo coprisse. Lo copre solo se lo riempie. Una telecamera
 * verticale dentro un riquadro 16:9 lascia scoperte le due bande ai lati, e
 * li' sotto continuava a vedersi l'istantanea di prima — piu' il velo che la
 * smorza, addosso al video vivo.
 *
 * Quindi il fermo non e' un fondo permanente: e' quello che si guarda mentre
 * il video arriva, e appena arriva se ne va. «Arrivato» vuol dire che
 * l'elemento ha dipinto qualcosa — il primo fotogramma di un `video`, il
 * `load` di un'immagine MJPEG, il caricamento di un iframe — non che il
 * negoziato e' partito.
 */
export function spogliaIlPopup(content) {
  if (!content?.classList?.contains?.("dm-cam-con-fermo")) return false;
  content.classList.remove("dm-cam-con-fermo");
  content.style?.removeProperty?.("--dm-cam-fermo");
  return true;
}

/* Gli eventi con cui ogni lettore dice «sto dipingendo». Sono diversi perche'
 * sono elementi diversi, e aspettare quello sbagliato vorrebbe dire togliere
 * il fermo troppo presto — cioe' tornare al rettangolo nero. */
const PRONTO = Object.freeze({
  VIDEO: ["loadeddata", "playing"],
  IMG: ["load"],
  IFRAME: ["load"],
});

function quandoDipinge(content) {
  if (!content?.querySelectorAll) return;
  for (const nodo of content.querySelectorAll("video,img,iframe")) {
    if (nodo.dataset?.dmCamAtteso === "1") continue;
    if (nodo.classList?.contains?.("dm-cam-anteprima")) continue;
    if (nodo.dataset) nodo.dataset.dmCamAtteso = "1";
    for (const evento of PRONTO[nodo.tagName] || [])
      nodo.addEventListener(evento, () => spogliaIlPopup(content), { once: true });
    /* Un'immagine che era gia' in cache il suo `load` l'ha gia' fatto. */
    if (nodo.tagName === "IMG" && nodo.complete && nodo.naturalWidth) spogliaIlPopup(content);
    if (nodo.tagName === "VIDEO" && nodo.readyState >= 2) spogliaIlPopup(content);
  }
}

/* Il guscio riscrive i figli del popup quando una strada vince: l'osservatore
 * e' l'unico modo per accorgersene senza mettere le mani nel guscio. Si spegne
 * da solo quando il popup si chiude. */
function guardaIlPopup(content) {
  if (!content || content.__dmCamGuardia) return;
  const Osservatore = root.MutationObserver;
  if (typeof Osservatore !== "function") return;
  const guardia = new Osservatore(() => quandoDipinge(content));
  guardia.observe(content, { childList: true, subtree: true });
  content.__dmCamGuardia = guardia;
  quandoDipinge(content);
}

/** Disegna subito l'istantanea dentro il popup. Torna `true` se ce n'era una. */
export function mostraSubito(cam, content) {
  if (!content) return false;
  const foto = istantaneaDi(cam?.entity);
  content.innerHTML = anteprimaMarkup(foto, clean(cam?.name) || clean(cam?.entity));
  /* E il fermo resta anche dopo che il guscio avra' riscritto tutto — ma solo
   * finche' il video non dipinge davvero. */
  vestiIlPopup(cam, content);
  guardaIlPopup(content);
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
    /* Prima il negoziato ancora in volo, poi quello che il guscio sa chiudere.
     *
     * La pulizia del guscio chiude la connessione che trova nella sua
     * variabile, e li' dentro ci arriva solo una connessione RIUSCITA. La
     * scorciatoia invece fallisce quasi sempre per tempo scaduto, cioe' mentre
     * la trattativa e' ancora aperta: quella il guscio non la vede, e restava
     * a trattare con la telecamera mentre la fila intera ne apriva una seconda.
     * E' la doppia connessione che si vedeva nel popup. */
    fermaIlNegoziatoDelPopup();
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
  /* Il fermo immagine come fondo del riquadro del video.
     La regola parte dal contenuto del popup — l'elemento che il guscio non
     rifa', ne riscrive i figli — e arriva al contenitore che ci scrive
     dentro: cosi' vale anche dopo che ha riscritto tutto, che e' il momento in
     cui l'istantanea spariva.
     Spenta e smorzata, perche' e' un fotogramma vecchio e non deve sembrare
     il video: appena arriva quello vero, opaco, la copre da se'. */
  .dm-cam-con-fermo .cam-zoom-container,
  .dm-cam-con-fermo #video-iframe-container{
    background-image:var(--dm-cam-fermo);background-size:cover;
    background-position:center;background-repeat:no-repeat}
  .dm-cam-con-fermo .cam-zoom-container::after,
  .dm-cam-con-fermo #video-iframe-container::after{
    content:"";position:absolute;inset:0;pointer-events:none;
    background:rgba(11,18,32,.34)}
  /* Il velo del guscio sta sopra il fermo, e il video sopra tutto: un video
     senza fotogrammi e' trasparente, quindi il fermo si vede attraverso.
     L'ordine lo danno gia' i piani del guscio — il video e l'immagine stanno a
     2, il velo a 4, la pastiglia dell'audio a 6 — e il velo scuro qui sopra e'
     un pseudo-elemento senza piano, quindi sta sotto tutti e tre: e'
     esattamente il posto che gli serve. Qui non si tocca la posizione di
     nessun figlio: vedi la prova «il riquadro del video non si sfonda col
     fermo dietro». */
  .dm-cam-con-fermo video{background:transparent}
  `;
}
