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
 * L'attesa e' corta apposta: il guscio ha gia' speso la sua — venticinque
 * secondi per chi dorme — ad aspettare l'intestazione. Da li' alle immagini,
 * su un flusso sano, passa meno di un secondo.
 */
import { doc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_VIDEO_SI_MUOVE__";
const state = (root[KEY] ||= { installed: false });

/** Quanto si aspetta che il tempo del video parta, e ogni quanto lo si guarda. */
export const ATTESA_FOTOGRAMMI = 6000;
export const PASSO_FOTOGRAMMI = 400;

/* `readyState` di HTMLMediaElement: da 3 in su il browser dichiara di avere
 * abbastanza per andare avanti, e quello e' un si' senza aspettare. */
const ABBASTANZA_PER_ANDARE = 3;

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

/**
 * Aspetta che quel video si muova; se non si muove, solleva.
 *
 * Il messaggio finisce nell'elenco che il guscio scrive quando nessuna strada
 * ha funzionato, una riga per strada: dice cosa e' successo, non «errore».
 */
export async function aspettaCheSiMuova(video, opzioni = {}) {
  const attesa = Number(opzioni.attesa) > 0 ? Number(opzioni.attesa) : ATTESA_FOTOGRAMMI;
  const passo = Number(opzioni.passo) > 0 ? Number(opzioni.passo) : PASSO_FOTOGRAMMI;
  const dormi =
    opzioni.dormi || ((ms) => new Promise((risolvi) => root.setTimeout?.(risolvi, ms) || risolvi()));
  /* Nessun elemento vuol dire che non e' questa la strada che ha disegnato:
   * non si inventa un fallimento su una cosa che non si sta guardando. */
  if (!video) return true;
  if (Number(video.readyState) >= ABBASTANZA_PER_ANDARE) return true;
  let prima = tempoDi(video);
  for (let speso = 0; speso < attesa; speso += passo) {
    await dormi(passo);
    if (Number(video.readyState) >= ABBASTANZA_PER_ANDARE) return true;
    const adesso = tempoDi(video);
    if (siEMosso(prima, adesso)) return true;
    if (Number.isFinite(adesso)) prima = adesso;
  }
  /* I secondi si accodano fuori dalla frase: dentro sarebbero parte della
   * chiave da tradurre, e una frase con un numero incorporato non si traduce
   * — cambierebbe chiave a ogni attesa diversa. */
  const detto = t(
    "HLS: l'intestazione arriva ma le immagini no",
    "HLS: the header arrives but the pictures do not",
  );
  throw new Error(`${detto} (${Math.round(attesa / 1000)}s)`);
}

export function installVideoSiMuove() {
  if (state.installed) return false;
  const precedente = root.dmCamHLS;
  if (typeof precedente !== "function" || precedente.__dmVideoSiMuove) return false;
  async function avvolta(cam, content, attesa) {
    const esito = await precedente.call(this, cam, content, attesa);
    await aspettaCheSiMuova(doc?.getElementById("cam-hls"));
    return esito;
  }
  avvolta.__dmVideoSiMuove = true;
  avvolta.__dmPrevious = precedente;
  root.dmCamHLS = avvolta;
  state.installed = true;
  return true;
}

installVideoSiMuove();
