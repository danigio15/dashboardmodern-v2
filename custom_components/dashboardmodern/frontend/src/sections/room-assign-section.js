/* La stanza si puo' dire ovunque, non solo dove la scheda la chiede.
 *
 * Luci, clima, tapparelle, elettrodomestici, telecamere, carichi, robot e zone
 * d'irrigazione la stanza ce l'hanno addosso: la loro scheda la chiede, e la
 * pagina Stanze li trova. Tutto il resto della casa no — un sensore di
 * allagamento, una sonda, la finestra di un avviso, la pompa della piscina, il
 * termico solare — e senza di loro la pagina di una stanza ne racconta meta'.
 *
 * Aggiungere il campo stanza a dieci schede vorrebbe dire dieci punti in cui
 * scriverlo, dieci in cui leggerlo e dieci modi di sbagliarlo. Qui ce n'e' uno
 * solo: la riga in cui l'entita' e' gia' scritta prende una tendina, in
 * qualunque scheda si trovi, e la scelta va in una casella sola.
 *
 * Le righe le disegna il runtime, ognuna a modo suo, ma tutte scrivono
 * l'entity_id in chiaro — dentro `.ed-row-old` per gli elenchi, dentro il
 * campo `.ed-slot-in[data-ref]` per le caselle. E' quello il gancio, lo stesso
 * che usa l'interruttore dei widget.
 *
 * Chi la stanza ce l'ha gia' per mestiere non riceve niente: due tendine sulla
 * stessa luce sarebbero due padroni della stessa cosa, ed e' il difetto che
 * questo progetto ha gia' pagato abbastanza volte.
 */
import { ROOM_ASSIGN_KEY } from "../core/room-overview.js";
import { renderRoomsPage, roomSources } from "./rooms-page-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  roomOptionsMarkup,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROOM_ASSIGN__";
const STYLE_ID = "dm-room-assign-style";
const state = (root[KEY] ||= { installed: false });

const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/i;
export const ASSIGN_ATTRIBUTE = "data-dm-room-entity";

/* ── la memoria ───────────────────────────────────────────────────────── */

export function roomAssignments() {
  const stored = readJson(ROOM_ASSIGN_KEY, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function assegna(entity, room) {
  const mappa = { ...roomAssignments() };
  if (clean(room)) mappa[entity] = clean(room);
  else delete mappa[entity];
  writeJsonIfChanged(ROOM_ASSIGN_KEY, mappa);
  try {
    renderRoomsPage();
  } catch (_error) {}
}

/* ── chi la stanza ce l'ha gia' ───────────────────────────────────────── */

/** Gli entity_id che una sezione tiene gia' legati a una stanza sua. */
export function ownedEntities(sorgenti = roomSources()) {
  const dentro = new Set();
  const guarda = (item) => {
    if (!item || typeof item !== "object") return;
    for (const campo of ["entity", "entity_id", "id", "cam", "camera_entity"]) {
      const valore = clean(item[campo]);
      if (ENTITY_RE.test(valore)) dentro.add(valore);
    }
    for (const campo of ["entities", "ents"]) {
      const elenco = item[campo];
      if (!Array.isArray(elenco)) continue;
      for (const voce of elenco) {
        const valore = clean(typeof voce === "string" ? voce : voce?.entity);
        if (ENTITY_RE.test(valore)) dentro.add(valore);
      }
    }
  };
  for (const [nome, valore] of Object.entries(sorgenti || {})) {
    if (nome === "rooms" || nome === "assigned") continue;
    if (Array.isArray(valore)) valore.forEach(guarda);
    else if (valore && typeof valore === "object") Object.values(valore).forEach(guarda);
  }
  return dentro;
}

/* ── la tendina ───────────────────────────────────────────────────────── */

function tendina(entity, scelta) {
  const select = doc.createElement("select");
  select.className = "ed-input dm-room-entity";
  select.setAttribute(ASSIGN_ATTRIBUTE, entity);
  select.setAttribute(
    "aria-label",
    t("Stanza di questa entità", "This entity's room"),
  );
  select.title = t(
    "La stanza in cui si trova: serve alla pagina Stanze, non cambia niente qui.",
    "The room it sits in: it feeds the Rooms page and changes nothing here.",
  );
  select.innerHTML = roomOptionsMarkup(scelta, t("Nessuna stanza", "No room"));
  return select;
}

function attacca(contenitore, entity, mappa, dove) {
  let select = contenitore.querySelector(`:scope [${ASSIGN_ATTRIBUTE}]`);
  const scelta = clean(mappa[entity]);
  if (select) {
    if (select.getAttribute(ASSIGN_ATTRIBUTE) !== entity) {
      select.setAttribute(ASSIGN_ATTRIBUTE, entity);
      select.innerHTML = roomOptionsMarkup(scelta, t("Nessuna stanza", "No room"));
    } else if (clean(select.value) !== scelta) select.value = scelta;
    return false;
  }
  select = tendina(entity, scelta);
  dove(select);
  return true;
}

/** L'entita' scritta in chiaro su una riga d'elenco. */
function entityOfRow(row) {
  const testo = clean(row?.querySelector?.(".ed-row-old")?.textContent);
  if (!testo) return "";
  const ids = testo
    .split(/[,\s]+/)
    .map(clean)
    .filter((value) => ENTITY_RE.test(value));
  // Una riga che ne nomina piu' d'una e' un gruppo: la stanza si dice sulla
  // riga che nomina una cosa sola, altrimenti non si sa a chi si riferisce.
  return ids.length === 1 ? ids[0] : "";
}

export function ensureRoomChoices() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return 0;
  const mappa = roomAssignments();
  let suoi;
  try {
    suoi = ownedEntities();
  } catch (_error) {
    suoi = new Set();
  }
  let messi = 0;
  const salta = (entity) => !entity || suoi.has(entity);

  for (const slot of body.querySelectorAll(".ed-slot")) {
    if (slot.closest("[data-load-form]")) continue;
    const entity = clean(slot.querySelector(".ed-slot-in[data-ref]")?.value);
    if (!ENTITY_RE.test(entity) || salta(entity)) {
      slot.querySelector(`:scope [${ASSIGN_ATTRIBUTE}]`)?.remove();
      continue;
    }
    if (
      attacca(slot, entity, mappa, (select) => {
        select.classList.add("dm-room-entity-slot");
        const etichetta = slot.querySelector(".ed-slot-lbl");
        if (etichetta) etichetta.append(select);
        else slot.append(select);
      })
    )
      messi += 1;
  }

  for (const row of body.querySelectorAll(".ed-row")) {
    if (row.matches(".dm-people-row")) continue;
    const entity = entityOfRow(row);
    if (salta(entity)) {
      row.querySelector(`:scope [${ASSIGN_ATTRIBUTE}]`)?.remove();
      continue;
    }
    if (
      attacca(row, entity, mappa, (select) => {
        const testo = row.querySelector(".ed-row-main");
        if (testo) testo.append(select);
        else row.append(select);
      })
    )
      messi += 1;
  }
  return messi;
}

function onChange(event) {
  const select = event.target?.closest?.(`[${ASSIGN_ATTRIBUTE}]`);
  if (!select) return;
  const entity = clean(select.getAttribute(ASSIGN_ATTRIBUTE));
  if (!entity) return;
  event.stopPropagation();
  assegna(entity, select.value);
  root.edToast?.(
    clean(select.value)
      ? t("📍 Assegnata alla stanza", "📍 Assigned to the room")
      : t("📍 Senza stanza", "📍 No room"),
  );
}

function css() {
  return `
      #ed-body .dm-room-entity{
        display:inline-flex;width:auto;max-width:190px;margin:5px 0 0;padding:4px 26px 4px 9px;
        font-size:11px;font-weight:700;border-radius:999px;
        background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e2e8f0);
        color:var(--text-dim,#64748b)}
      #ed-body .dm-room-entity:focus{outline:2px solid var(--primary-color,#0ea5e9);outline-offset:1px}
      /* Assegnata: si vede da lontano quali righe una stanza ce l'hanno. */
      #ed-body .dm-room-entity:not([data-dm-vuota="true"]){color:var(--text,#0f172a)}
      #ed-body .ed-slot .dm-room-entity-slot{margin:5px 0 0;align-self:flex-start}
      @media(max-width:520px){
        #ed-body .dm-room-entity{max-width:150px;font-size:10.5px}
      }`;
}

export function installRoomAssignSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("change", onChange, true);
  onEditorRedraw("dmRoomAssign", ensureRoomChoices);
  ensureRoomChoices();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installRoomAssignSection, { once: true });
} else {
  installRoomAssignSection();
}
