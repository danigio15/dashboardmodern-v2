/* L'HLS vale quando il video si muove davvero (#385).
 *
 * «Problema telecamere Arlo», con i registri del browser allegati. Dentro si
 * legge la sequenza esatta:
 *
 *     [Cam] – WebRTC: senza-nome-di-flusso
 *     [Cam] ✓ HLS
 *     [HLS] { details: "bufferStalledError", buffer: 0.0027… }
 *
 * La plancia ha dichiarato riuscito l'HLS, e un istante dopo il video si e'
 * fermato con due millesimi di secondo in pancia: cioe' non e' mai partito.
 *
 * La ragione sta nel guscio, che considera riuscita la strada al primo fra
 * `loadedmetadata`, `canplay`, `loadeddata` e `playing`. Gli ultimi tre
 * vogliono dire che c'e' un fotogramma; il primo no — `loadedmetadata` scatta
 * appena si e' letta l'intestazione del flusso, quando di immagine non e'
 * arrivato ancora niente. Su una telecamera che risponde subito i quattro
 * eventi arrivano quasi insieme e la differenza non si vede. Su una che dorme
 * in cloud — Arlo, Ring, Blink — l'intestazione arriva e le immagini no: la
 * plancia toglieva la rotella, si fermava li' convinta di aver vinto, e
 * lasciava un rettangolo fermo senza una parola.
 *
 * Il guaio vero non e' il rettangolo fermo: e' che dichiarando riuscita quella
 * strada non si prova piu' nessun'altra. Sotto l'HLS ci sono il flusso del
 * proxy e le istantanee, e le istantanee sono proprio la modalita' pensata per
 * chi trasmette solo su richiesta. Una telecamera che avrebbe potuto farsi
 * vedere a due fotogrammi al secondo non si vedeva affatto.
 *
 * Qui si guarda l'unica cosa che risponde alla domanda: il tempo del video va
 * avanti? Se va avanti la strada e' buona e non cambia niente. Se non va
 * avanti si solleva l'errore che il guscio si aspetta, e la catena scende alla
 * strada dopo — che e' quello che avrebbe fatto se l'HLS avesse fallito
 * subito, perche' e' esattamente quello che e' successo.
 *
 * L'attesa e' quella che AVANZA. Le strategie danno venticinque secondi a una
 * telecamera che dorme, ma il guscio scioglie la promessa all'intestazione:
 * se l'intestazione arriva al primo secondo, ventiquattro secondi di quel
 * permesso non sono stati spesi, e sono esattamente il tempo che serve a
 * un'Arlo per svegliarsi. Dare qui un'attesa fissa e corta avrebbe buttato via
 * il flusso proprio delle telecamere per cui il permesso lungo era stato
 * scritto: si conta quanto ci ha messo il guscio e si guarda per il resto.
 *
 * E chi ha un fotogramma fermo sullo schermo non e' un guasto. Un video che il
 * browser non lascia partire da solo — l'autoplay negato — mostra la prima
 * immagine e aspetta un tocco: li' c'e' qualcosa da vedere, e scendere alle
 * istantanee lo peggiorerebbe. Si distingue dal fermo vero per una cosa sola:
 * quello e' in pausa apposta, l'altro sta andando e non va avanti.
 *
 * ── L'attesa non deve essere nera (#395) ─────────────────────────────────
 *
 * «Quando si apre il popup parte dopo un po' ma con del forte ritardo.» E'
 * questa attesa: il guscio, appena letta l'intestazione, toglie la rotella e
 * resta un rettangolo vuoto per tutti i secondi in cui si guarda se il video
 * si muove. Il controllo serve — senza, si torna al fermo dichiarato riuscito
 * — ma l'attesa si puo' riempire: la telecamera un fotogramma ce l'ha gia',
 * ed e' quello che la tessera del muro mostra da sempre.
 *
 * Lo si mette come POSTER del video, e non come immagine sopra o sotto: il
 * poster e' fatto apposta per questo — il browser lo tiene finche' non c'e' un
 * fotogramma vero e lo toglie da solo appena arriva, senza che nessuno debba
 * ricordarsi di ripulire. Chi aspetta vede la sua telecamera, ferma, invece
 * del nero; e se il video parte, parte sopra la stessa immagine.
 */
import { allStates, clean, doc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_VIDEO_SI_MUOVE__";
const state = (root[KEY] ||= { installed: false });

/* Quanto si guarda, e ogni quanto.
 *
 * `MINIMA` e' il fondo: anche quando del permesso non avanza niente, un flusso
 * sano parte in meno di un secondo e merita di essere guardato. `SENZA_DETTO`
 * e' quella del guscio quando nessuno gliene passa una — la usa `dmAttivaAudio`,
 * che chiama la strada HLS senza attesa. */
export const ATTESA_MINIMA = 4000;
export const ATTESA_SENZA_DETTO = 10_000;
export const PASSO_FOTOGRAMMI = 400;

/* `readyState` di HTMLMediaElement: da 2 (HAVE_CURRENT_DATA) in su il browser
 * ha i dati della posizione corrente, cioe' un'immagine da disegnare. */
const UN_FOTOGRAMMA = 2;

/**
 * Se fra due letture il tempo del video e' andato avanti.
 *
 * La soglia c'e' perche' un flusso dal vivo si posiziona sul bordo appena
 * agganciato: `currentTime` diventa subito un numero grande senza che sia stato
 * mostrato niente, quindi «maggiore di zero» non risponde alla domanda. Quello
 * che risponde e' il MOVIMENTO fra due istanti.
 */
export function siEMosso(prima, dopo) {
  if (!Number.isFinite(prima) || !Number.isFinite(dopo)) return false;
  return dopo > prima + 0.05;
}

/** Il tempo del video adesso, o `NaN` se non c'e' niente da leggere. */
function tempoDi(video) {
  const letto = Number(video?.currentTime);
  return Number.isFinite(letto) ? letto : Number.NaN;
}

/* Se quel video e' ancora quello che si sta guardando.
 *
 * Chi chiude il popup, o apre un'altra telecamera, si porta via l'elemento: da
 * li' in poi il tempo non si muove piu' per forza di cose, e continuare a
 * giudicarlo vorrebbe dire sollevare un errore su una cosa che non c'e'. Il
 * guscio prenderebbe quell'errore per un HLS fallito e proverebbe la strada
 * dopo — scrivendo dentro un popup che nel frattempo e' di qualcun altro. */
function eAncoraSuo(video) {
  if (video?.isConnected === false) return false;
  const adesso = doc?.getElementById?.("cam-hls");
  return !adesso || adesso === video;
}

/**
 * Un fotogramma fermo, mostrato apposta.
 *
 * L'autoplay negato lascia la prima immagine sullo schermo e aspetta un tocco:
 * il tempo non va avanti, ma qualcosa da vedere c'e'. Si riconosce perche' e'
 * in PAUSA: un flusso che si e' piantato sta andando, e non va avanti.
 */
export function ceUnaFotoFerma(video) {
  return Boolean(video) && video.paused === true && Number(video.readyState) >= UN_FOTOGRAMMA;
}

/**
 * Aspetta che quel video si muova; se non si muove, solleva.
 *
 * Il messaggio finisce nell'elenco che il guscio scrive quando nessuna strada
 * ha funzionato, una riga per strada: dice cosa e' successo, non «errore».
 */
export async function aspettaCheSiMuova(video, opzioni = {}) {
  const attesa = Number(opzioni.attesa) > 0 ? Number(opzioni.attesa) : ATTESA_SENZA_DETTO;
  const passo = Number(opzioni.passo) > 0 ? Number(opzioni.passo) : PASSO_FOTOGRAMMI;
  const dormi =
    opzioni.dormi || ((ms) => new Promise((risolvi) => root.setTimeout?.(risolvi, ms) || risolvi()));
  /* Nessun elemento vuol dire che non e' questa la strada che ha disegnato:
   * non si inventa un fallimento su una cosa che non si sta guardando. */
  if (!video) return true;
  let prima = tempoDi(video);
  for (let speso = 0; speso < attesa; speso += passo) {
    await dormi(passo);
    if (!eAncoraSuo(video)) return true;
    const adesso = tempoDi(video);
    if (siEMosso(prima, adesso)) return true;
    if (Number.isFinite(adesso)) prima = adesso;
  }
  /* Finito il tempo senza un passo avanti: se un'immagine c'e' e sta ferma
   * apposta, si tiene — e' piu' di quanto darebbero le istantanee. */
  if (ceUnaFotoFerma(video)) return true;
  /* I secondi si accodano fuori dalla frase: dentro sarebbero parte della
   * chiave da tradurre, e una frase con un numero incorporato non si traduce
   * — cambierebbe chiave a ogni attesa diversa. */
  const detto = t(
    "HLS: l'intestazione arriva ma le immagini no",
    "HLS: the header arrives but the pictures do not",
  );
  throw new Error(`${detto} (${Math.round(attesa / 1000)}s)`);
}

/**
 * Mette l'ultima istantanea come poster del video, se ce n'e' una.
 *
 * `entity_picture` di una telecamera e' l'indirizzo del fotogramma con dentro
 * il suo gettone, quello che Home Assistant rinnova da solo: e' la stessa
 * immagine della tessera, e non costa una richiesta in piu' di quelle che la
 * plancia fa gia'.
 *
 * Torna quello che ha messo, o la stringa vuota: un poster gia' scritto non si
 * tocca, e una telecamera senza fotogramma non ne ha uno da dare.
 */
export function mettiIlPoster(video, entity, states) {
  if (!video || typeof video.setAttribute !== "function") return "";
  if (clean(video.getAttribute?.("poster"))) return "";
  const casa = states || allStates();
  const foto = clean(casa?.[clean(entity)]?.attributes?.entity_picture);
  if (!foto) return "";
  video.setAttribute("poster", foto);
  return foto;
}

export function installVideoSiMuove() {
  if (state.installed) return false;
  const precedente = root.dmCamHLS;
  if (typeof precedente !== "function" || precedente.__dmVideoSiMuove) return false;
  async function avvolta(cam, content, attesa) {
    const inizio = Date.now();
    const esito = await precedente.call(this, cam, content, attesa);
    /* Quello che avanza del permesso di questa strada: il guscio ha sciolto la
     * promessa all'intestazione, e quello che non ha speso serve qui. */
    const concesso = Number(attesa) > 0 ? Number(attesa) : ATTESA_SENZA_DETTO;
    const resto = Math.max(ATTESA_MINIMA, concesso - (Date.now() - inizio));
    const video = doc?.getElementById("cam-hls");
    /* Prima di guardare, si da' qualcosa da guardare: il guscio ha gia' tolto
     * la rotella all'intestazione, e senza questo l'attesa e' un rettangolo
     * nero lungo quanto il permesso che avanza. */
    mettiIlPoster(video, cam?.entity);
    await aspettaCheSiMuova(video, { attesa: resto });
    return esito;
  }
  avvolta.__dmVideoSiMuove = true;
  avvolta.__dmPrevious = precedente;
  root.dmCamHLS = avvolta;
  state.installed = true;
  return true;
}

installVideoSiMuove();
