/* Il video che si muove, invece dell'istantanea.
 *
 * «Le telecamere che configura sono delle Arlo, ma dalla sezione Sicurezza
 * vede solo un'istantanea: il video non si muove, né dalla card né quando apre
 * il popup. Con una card YAML fatta così — `type: picture-entity`,
 * `camera_view: live` — riesce a vederlo sempre in trasmissione.»
 *
 * `camera_view: live` è la riga che fa la differenza, e quello che chiede a
 * Home Assistant è un flusso continuo invece di un fotogramma. La tessera del
 * muro, invece, ha sempre chiesto fotogrammi: uno ogni quattro secondi, presi
 * dal `camera_proxy` e rimessi nell'immagine. Sembra un video finché non ci si
 * mette accanto quello vero.
 *
 * Il flusso continuo è la stessa porta con un nome diverso — `camera_proxy` per
 * un fotogramma, `camera_proxy_stream` per il MJPEG — e ci si arriva senza
 * niente da installare: è un `<img>`, come prima, con un indirizzo diverso.
 * L'unica cosa che serve saper fare è ricavare quell'indirizzo, ed è quello che
 * fa questo modulo: aritmetica di stringhe, provabile senza rete.
 *
 * Perché non sempre e per tutti: un flusso continuo tiene aperta una
 * connessione per ogni telecamera e spinge fotogrammi finché la si guarda.
 * Su un muro da otto, al telefono e fuori casa, è un conto diverso da uno
 * scatto ogni quattro secondi. Perciò è una scelta della telecamera, come il
 * suo nome e la sua stanza.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* La porta delle istantanee, e quella dei flussi. Sono i due percorsi di Home
 * Assistant, e l'unica differenza fra loro è il suffisso. */
export const PORTA_ISTANTANEA = "/api/camera_proxy/";
export const PORTA_FLUSSO = "/api/camera_proxy_stream/";

/** Se questa telecamera è stata messa «dal vivo». */
export function vuoleIlVivo(cam = {}) {
  const scelta = cam?.vivo;
  return scelta === true || scelta === "true" || scelta === 1 || scelta === "1";
}

/**
 * L'indirizzo del flusso, ricavato da quello dell'istantanea.
 *
 * `entity_picture` di una telecamera si porta dietro il proprio gettone —
 * `?token=…`, che Home Assistant rinnova da solo — e quel gettone vale anche
 * per il flusso: è la stessa telecamera e la stessa autorizzazione. Cambia
 * soltanto la porta. Chi non ha `entity_picture` non ha nemmeno il gettone, e
 * per lui c'è `percorsoDelFlusso`, da far firmare al socket.
 */
export function flussoDaIstantanea(entityPicture) {
  const foto = pulito(entityPicture);
  if (!foto || !foto.includes(PORTA_ISTANTANEA)) return "";
  return foto.replace(PORTA_ISTANTANEA, PORTA_FLUSSO);
}

/** Il percorso del flusso di un'entità, da far firmare quando manca la foto. */
export function percorsoDelFlusso(entity) {
  const nome = pulito(entity);
  return nome ? `${PORTA_FLUSSO}${encodeURIComponent(nome)}` : "";
}

/**
 * Se un'immagine sta già mostrando questo flusso.
 *
 * Un MJPEG è una risposta che non finisce mai: riassegnare `src` allo stesso
 * indirizzo la chiude e la riapre, e a ogni giro del cronometro il muro
 * ripartirebbe da capo — lampeggiando, e aprendo una connessione nuova ogni
 * quattro secondi. Il confronto è sul gettone oltre che sul percorso, perché
 * quando Home Assistant lo rinnova l'indirizzo cambia davvero.
 */
export function stessoFlusso(immagine, indirizzo) {
  if (!immagine || !indirizzo) return false;
  return pulito(immagine.dataset?.dmCameraStream) === pulito(indirizzo);
}
