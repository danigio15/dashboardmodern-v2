/* Tapparelle e tende.
 *
 * La sezione disegna una finestra con la tapparella che scende, perche' e' la
 * sola cosa che sapeva esserci. Una tenda pero' non scende: si apre di lato, in
 * due teli che si scostano dal centro, e vederla scendere come una tapparella
 * e' vedere una cosa diversa da quella che si ha in casa.
 *
 * Il tipo si puo' scegliere in configurazione. Chi non lo sceglie non deve
 * scegliere niente: Home Assistant dice gia' che tipo di apertura e' — e'
 * `device_class` — e per quasi tutti quella basta.
 *
 * Il modulo e' puro: guarda un oggetto e uno stato, non legge nient'altro —
 * tranne la lingua attiva, per dire come si chiama quello che ha guardato.
 */

import { SOURCE_LOCALE, getLocale, pick } from "./i18n.js";

const clean = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

/** I tipi che la sezione sa disegnare. */
export const COVER_KINDS = Object.freeze(["tapparella", "tenda", "tenda_sole"]);

export const COVER_KIND_LABELS = Object.freeze({
  tapparella: ["Tapparella", "Roller shutter"],
  tenda: ["Tenda", "Curtain"],
  tenda_sole: ["Tenda da sole", "Awning"],
});

/* Cosa dice Home Assistant. Le classi che restano fuori — window, garage,
 * gate, door, damper — non sono ne' tapparelle ne' tende, e per quelle la
 * finestra con la tapparella resta il disegno meno sbagliato. */
const DA_DEVICE_CLASS = Object.freeze({
  shutter: "tapparella",
  blind: "tenda",
  curtain: "tenda",
  shade: "tenda",
  awning: "tenda_sole",
});

/** Il tipo dichiarato, se e' uno di quelli che sappiamo disegnare. */
export function declaredCoverKind(item = {}) {
  const declared = clean(item.kind || item.cover_kind || item.type);
  return COVER_KINDS.includes(declared) ? declared : "";
}

/**
 * Il tipo di una copertura: quello scelto, altrimenti quello che dice Home
 * Assistant, altrimenti una tapparella — che e' cio' che la sezione ha sempre
 * disegnato, e cambiarlo sotto i piedi di chi ha gia' tutto configurato sarebbe
 * una sorpresa, non un miglioramento.
 */
export function coverKind(item = {}, state = null) {
  const declared = declaredCoverKind(item);
  if (declared) return declared;
  const deviceClass = clean(state?.attributes?.device_class);
  return DA_DEVICE_CLASS[deviceClass] || "tapparella";
}

/* Come si chiama, nella lingua della plancia.
 *
 * Il secondo argomento era un booleano "inglese si'/no", e chi non era inglese
 * leggeva italiano: una tenda si chiamava «Tenda» anche in tedesco. Ora e' la
 * lingua; `true` continua a valere inglese, per chi chiamava com'era prima. */
export function coverKindLabel(kind, locale = getLocale()) {
  const labels = COVER_KIND_LABELS[kind] || COVER_KIND_LABELS.tapparella;
  const code = locale === true ? "en" : locale === false ? SOURCE_LOCALE : locale;
  return pick(labels[0], labels[1], code);
}

/* Il verso in cui si muove.
 *
 * Una tapparella scende dall'alto e la sua "chiusura" e' altezza; una tenda si
 * scosta di lato e la sua chiusura e' larghezza. Detto qui una volta, il
 * disegno non deve piu' indovinarlo. */
export const coverIsSideways = (kind) => kind === "tenda";

/* Una tenda da sole non e' ne' l'una ne' l'altra.
 *
 * Scende dall'alto come una tapparella, e per questo veniva disegnata con le
 * sue stesse stecche: in una card, accanto a una tapparella, era la stessa
 * identica cosa. Ma non e' una lamiera che chiude un vetro — e' un telo teso
 * che sporge sopra la finestra, a righe larghe e col bordo ondulato. Il verso
 * lo condivide con la tapparella; il disegno no. */
export const coverIsAwning = (kind) => kind === "tenda_sole";

/** Quanto e' coperta la finestra, da 0 (tutta aperta) a 100. */
export function coverClosedPercent(position) {
  const value = Number(position);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, 100 - value));
}
