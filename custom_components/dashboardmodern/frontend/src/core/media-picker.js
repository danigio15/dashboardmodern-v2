/* Scegliere un file dalle cartelle di Home Assistant, invece di scriverne il
 * percorso.
 *
 * La foto dell'auto si impostava digitando "/local/qualcosa.png": bisognava
 * sapere che /config/www si chiama /local, come si chiama il file e come si
 * scrive. Home Assistant sa gia' elencare le proprie cartelle — e' lo stesso
 * elenco che usa per i media — e questo modulo prepara i messaggi per
 * chiederglielo e mette in ordine le risposte.
 *
 * Il modulo e' puro: costruisce messaggi e legge risultati, non parla con
 * nessuno e non tocca il DOM.
 */

const clean = (value) => String(value ?? "").trim();

/** Un riferimento alle cartelle di Home Assistant, non un percorso. */
export const MEDIA_SOURCE_PREFIX = "media-source://";

export const isMediaSourceId = (value) => clean(value).startsWith(MEDIA_SOURCE_PREFIX);

/** Il messaggio che chiede il contenuto di una cartella (la radice se vuoto). */
export function browseMessage(id, mediaContentId = "") {
  const message = { id, type: "media_source/browse_media" };
  const target = clean(mediaContentId);
  if (target) message.media_content_id = target;
  return message;
}

/* Il messaggio che chiede l'indirizzo di un file.
 *
 * Home Assistant firma l'indirizzo e la firma scade: l'indirizzo serve per
 * leggere il file adesso, non per conservarlo in configurazione. */
export function resolveMessage(id, mediaContentId, expires = 3600) {
  return {
    id,
    type: "media_source/resolve_media",
    media_content_id: clean(mediaContentId),
    expires,
  };
}

const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Vero quando la voce e' una foto che si puo' scegliere. */
export function isImageEntry(entry = {}) {
  if (entry.expandable) return false;
  const kind = clean(entry.kind).toLowerCase();
  if (kind === "image") return true;
  if (kind.startsWith("image/")) return true;
  return IMAGE_EXTENSION.test(clean(entry.title)) || IMAGE_EXTENSION.test(clean(entry.id));
}

function normalizeEntry(child = {}) {
  return {
    id: clean(child.media_content_id),
    title: clean(child.title) || clean(child.media_content_id),
    kind: clean(child.media_class || child.media_content_type),
    expandable: child.can_expand === true,
    playable: child.can_play === true,
    thumbnail: clean(child.thumbnail),
  };
}

/**
 * Il contenuto di una cartella, in ordine: prima le cartelle, poi le foto.
 *
 * Il resto — video, musica, playlist — non serve a scegliere una foto e
 * riempirebbe l'elenco di righe su cui non si puo' fare niente.
 */
export function normalizeBrowseResult(result = {}) {
  const entries = (Array.isArray(result.children) ? result.children : []).map(normalizeEntry);
  const folders = entries.filter((entry) => entry.expandable);
  const images = entries.filter((entry) => isImageEntry(entry));
  return {
    id: clean(result.media_content_id),
    title: clean(result.title),
    folders,
    images,
    /* Quante voci sono state lasciate fuori: dirlo e' meglio che far credere
     * che la cartella contenga solo questo. */
    skipped: entries.length - folders.length - images.length,
  };
}

/** La strada a ritroso fino alla radice, per le briciole di pane. */
export function breadcrumbFrom(trail = []) {
  return trail
    .map((step, index) => ({ id: clean(step.id), title: clean(step.title), depth: index }))
    .filter((step) => step.title || !step.id);
}

/** L'indirizzo stabile di una foto caricata nell'archivio immagini. */
export function imageServeUrl(upload = {}) {
  const id = clean(upload.id);
  return id ? `/api/image/serve/${id}/original` : "";
}

/** Il nome file di un riferimento, per dare un nome al caricamento. */
export function fileNameFor(reference, fallback = "foto.png") {
  const tail = clean(reference).split("?")[0].split("/").filter(Boolean).at(-1);
  return tail && /\./.test(tail) ? decodeURIComponent(tail) : fallback;
}

/* L'indirizzo firmato, senza la firma.
 *
 * Serve solo per mostrare da dove arriva la foto: conservato in
 * configurazione smetterebbe di funzionare quando la firma scade. */
export function unsignedPath(url) {
  return clean(url).split("?")[0];
}
