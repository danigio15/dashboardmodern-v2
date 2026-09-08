/* La guardia che tiene separato lo scorrimento dal comando (#397).
 *
 * «Quando sei in un menù pieno di entità, tipo le luci o le temperature,
 *  quando scorri con il dito oltre allo scorrere prende anche il comando.
 *  Sulle luci mentre passi con il dito per scorrere le accende pure.»
 *
 * Sta qui e non dentro una sezione perché il difetto non è di una sezione: è
 * di ogni elenco lungo che si scorre col dito, e le sezioni che comandano al
 * `click` sono decine. Scriverne la guardia in ognuna vorrebbe dire scriverla
 * male in qualcuna, e soprattutto vorrebbe dire riscriverla in quella nuova.
 *
 * ── Come funziona ────────────────────────────────────────────────────────
 *
 * Si segna dove il dito ha toccato, e quando il `click` arriva si guarda da
 * dove viene. Se nel frattempo il dito si è spostato più di dodici pixel, quel
 * click è la coda di uno scorrimento e non un comando: si ferma qui, in fase
 * di cattura, prima che qualunque sezione lo veda.
 *
 * ── Cosa NON ferma, e perché ─────────────────────────────────────────────
 *
 * Un click senza un dito dietro — tastiera, lettore di schermo, `.click()` di
 * un altro modulo — non ha un punto di partenza, e passa sempre. Rifiutarlo
 * vorrebbe dire rompere la plancia per chi non la tocca con le dita.
 *
 * E non ferma niente dentro le cose che si trascinano apposta: un cursore
 * della tapparella o della luce si USA spostando il dito, e lì lo spostamento
 * è il comando, non il suo contrario. Quelle si riconoscono da sole — sono
 * `input`, o portano `draggable` — e chi ne ha una fatta a mano la marca con
 * `data-dm-si-trascina`.
 */
import { stavaScorrendo } from "../core/il-dito-scorre-o-tocca.js";
import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_DITO__";
const state = (root[KEY] ||= { installed: false, partenza: null, id: null });

/* Quello che si comanda trascinando: lì lo spostamento è il gesto giusto. */
const SI_TRASCINA =
  'input,textarea,select,[draggable="true"],[data-dm-si-trascina],[contenteditable="true"]';

const punto = (evento) => {
  const x = evento?.clientX;
  const y = evento?.clientY;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

function segnaLaPartenza(evento) {
  /* Solo il dito e il mouse: la penna scorre come il dito, e va bene lo stesso.
   * Un tocco con più dita è una pinza, e quella non comanda niente. */
  if (evento?.isPrimary === false) return;
  state.id = evento?.pointerId ?? null;
  state.partenza = evento?.target?.closest?.(SI_TRASCINA) ? null : punto(evento);
}

function scordaLaPartenza() {
  state.partenza = null;
  state.id = null;
}

function fermaSeScorreva(evento) {
  const partenza = state.partenza;
  /* Ogni click consuma la sua partenza: due click di fila senza un tocco in
   * mezzo — succede con `.click()` da codice — non devono ereditarla. */
  scordaLaPartenza();
  if (!partenza || !stavaScorrendo(partenza, punto(evento))) return;
  if (evento.target?.closest?.(SI_TRASCINA)) return;
  evento.stopPropagation();
  evento.preventDefault();
}

export function installIlDitoScorreOTocca() {
  if (!doc || state.installed) return false;
  state.installed = true;
  /* In cattura, sul documento: è l'unico posto da cui si arriva prima di
   * tutte le sezioni, comprese quelle che ancora non esistono. */
  doc.addEventListener("pointerdown", segnaLaPartenza, true);
  doc.addEventListener("pointercancel", scordaLaPartenza, true);
  doc.addEventListener("click", fermaSeScorreva, true);
  return true;
}

installIlDitoScorreOTocca();
