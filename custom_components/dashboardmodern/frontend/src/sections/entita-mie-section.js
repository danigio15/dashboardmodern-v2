/* Le entità che uno si aggiunge dove vuole, disegnate (#271).
 *
 * «In alcune schede non è possibile inserire entità o sensori personalizzati.»
 *
 * Alcune sezioni sono elenchi — Luci, Prese, Telecamere, Robot — e lì aggiungere
 * un'entità si è sempre potuto: l'elenco è la sezione. Altre sono fatte di
 * caselle con un ruolo preciso — l'Energia ha una rete e un fotovoltaico, la
 * Sicurezza una centrale — e lì non c'era posto per un sensore in più.
 *
 * Il blocco va in fondo alla pagina, dopo quello che la pagina disegna di suo:
 * sono cose aggiunte, e mettersele davanti a quelle di serie vorrebbe dire far
 * sembrare la sezione un'altra. Compare solo dove ci sono voci — una pagina che
 * non ne ha non guadagna un titolo vuoto.
 */
import { CHIAVE_ENTITA_MIE, lettureDellaSezione, sezioniConEntita } from "../core/entita-mie.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  readJson,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITA_MIE__";
const STYLE_ID = "dm-entita-mie-style";
const state = (root[KEY] ||= { installed: false, frame: 0, firme: new Map() });

/* La chiave la possiede il nucleo; la scheda che scrive la prende da qui, cosi'
 * chi disegna e chi compila leggono lo stesso cassetto senza scriverne il nome
 * due volte. */
export { CHIAVE_ENTITA_MIE };

const voci = () => readJson(CHIAVE_ENTITA_MIE, []);

/* Le parole di stato più comuni, dette qui e non nel nucleo: il raccoglitore
 * delle traduzioni guarda le sezioni, e una `t()` scritta dentro `src/core` non
 * finirebbe nei cataloghi. Quelle che non stanno in tabella si mostrano come
 * Home Assistant le manda — meglio una parola inglese vera che un trattino al
 * posto di un'informazione che c'è. */
function parolaDiStato(grezzo) {
  const tabella = {
    on: t("Acceso", "On"),
    off: t("Spento", "Off"),
    open: t("Aperto", "Open"),
    closed: t("Chiuso", "Closed"),
    home: t("In casa", "Home"),
    not_home: t("Fuori", "Away"),
    idle: t("Fermo", "Idle"),
    playing: t("In riproduzione", "Playing"),
    paused: t("In pausa", "Paused"),
    locked: t("Chiuso a chiave", "Locked"),
    unlocked: t("Aperto", "Unlocked"),
  };
  return tabella[clean(grezzo).toLowerCase()] || clean(grezzo);
}

function valoreMarkup(riga) {
  if (riga.muto) return `<b class="dm-mie-muta">${esc(t("Non risponde", "Not reporting"))}</b>`;
  if (riga.numero !== null)
    return (
      `<b>${esc(formatNumber(riga.numero, Number.isInteger(riga.numero) ? 0 : 1))}` +
      `${riga.unita ? `<small> ${esc(riga.unita)}</small>` : ""}</b>`
    );
  return `<b>${esc(parolaDiStato(riga.stato))}</b>`;
}

/* Il disegno di casa quando l'icona non l'ha scelta nessuno.
 *
 * L'icona e' una delle quattro cose che si possono cambiare — «modificando il
 * nome, icona, stanza di destinazione» — e quella scelta vince sempre. Ma il
 * ripiego non puo' essere un'emoji: sono gli stessi oggetti delle tessere e
 * della barra, e una lampadina di sistema in mezzo a loro si vede subito. */
function disegno(riga) {
  const scelta = clean(riga.icona);
  if (scelta) return esc(scelta);
  return oggettoWidget(riga.comandabile ? "azioni" : "evidenza");
}

function rigaMarkup(riga) {
  return `<article class="dm-mie-riga" data-on="${riga.acceso}" data-muta="${riga.muto}">
    <span class="dm-mie-ic" aria-hidden="true">${disegno(riga)}</span>
    <span class="dm-mie-nome"><strong>${esc(riga.nome)}</strong><small class="mono">${esc(riga.entity)}</small></span>
    <span class="dm-mie-val">${valoreMarkup(riga)}</span>
    ${
      riga.comandabile && !riga.muto
        ? `<button type="button" class="dm-mie-lev" data-dm-mie-tocca="${esc(riga.entity)}"
             role="switch" aria-checked="${riga.acceso}" aria-label="${esc(riga.nome)}"><i></i></button>`
        : `<span class="dm-mie-vuoto" aria-hidden="true"></span>`
    }
  </article>`;
}

/* Dove sta il contenuto di questa pagina.
 *
 * Alcune pagine tengono le loro card dentro un contenitore che ne fissa la
 * larghezza, altre le lasciano correre per tutta la scheda: un blocco appeso
 * sempre alla pagina restava largo il doppio del resto su meta' della plancia.
 * La domanda pero' e' gia' stata risolta da chi disegna le intestazioni, che
 * per ogni pagina sceglie dove nascere — e allora si va dove e' nata lei. */
function casaDelContenuto(pagina) {
  const fascia = pagina.querySelector(".dm-page-mast");
  const casa = fascia?.parentElement;
  return casa && pagina.contains(casa) ? casa : pagina;
}

function blocco(pagina) {
  const casa = casaDelContenuto(pagina);
  let nodo = casa.querySelector(":scope > .dm-mie-ent");
  if (nodo) return nodo;
  nodo = doc.createElement("section");
  nodo.className = "dm-mie-ent";
  nodo.innerHTML = `<div class="dm-mie-testa">
    <span class="dm-mie-testa-ic" aria-hidden="true">${oggettoWidget("mie")}</span>
    <h3>${esc(t("Le tue entità", "Your own entities"))}</h3>
  </div><div class="dm-mie-lista"></div>`;
  casa.append(nodo);
  return nodo;
}

export function renderEntitaMie() {
  if (!doc) return false;
  const stored = voci();
  const conVoci = new Set(sezioniConEntita(stored));
  /* I blocchi delle sezioni che non hanno più voci se ne vanno: un titolo
   * senza righe sotto è una sezione che sembra rotta. */
  for (const nodo of doc.querySelectorAll(".dm-mie-ent")) {
    const pagina = nodo.closest(".page");
    const quale = clean(pagina?.id).replace(/^page-/, "");
    if (!conVoci.has(quale)) {
      nodo.remove();
      state.firme.delete(quale);
    }
  }
  const states = allStates();
  const resolve = root.resolveEntity || ((valore) => valore);
  for (const sezione of conVoci) {
    const pagina = doc.getElementById(`page-${sezione}`);
    if (!pagina) continue;
    const letture = lettureDellaSezione(stored, sezione, states, resolve);
    if (!letture.length) continue;
    const nodo = blocco(pagina);
    /* Sempre ultimo: la pagina disegna le sue cose a ogni giro e le rimette in
     * fondo, e un blocco nato prima si ritrovava in mezzo. */
    const casa = nodo.parentElement;
    if (casa && casa.lastElementChild !== nodo) casa.append(nodo);
    const firma = JSON.stringify(letture);
    if (state.firme.get(sezione) === firma) continue;
    state.firme.set(sezione, firma);
    const lista = nodo.querySelector(".dm-mie-lista");
    if (lista) lista.innerHTML = letture.map(rigaMarkup).join("");
  }
  return true;
}

async function chiamaHa(dominio, servizio, payload) {
  try {
    if (typeof root.dmCallHaService === "function")
      return await root.dmCallHaService(dominio, servizio, payload);
    if (typeof root.callService === "function")
      return await root.callService(dominio, servizio, payload);
    return await (root.hass || root._hass)?.callService?.(dominio, servizio, payload);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] entità mie", errore);
    return undefined;
  }
}

function onClick(event) {
  const leva = event.target?.closest?.("[data-dm-mie-tocca]");
  if (!leva) return;
  event.preventDefault();
  const entity = clean(leva.dataset.dmMieTocca);
  const dominio = entity.split(".")[0];
  if (!dominio) return;
  root.navigator?.vibrate?.(8);
  /* La leva si muove subito, senza aspettare Home Assistant: chi tocca deve
   * vedere qualcosa muoversi. La conferma o la correzione arriva col cambio
   * di stato. */
  const acceso = leva.getAttribute("aria-checked") === "true";
  leva.setAttribute("aria-checked", acceso ? "false" : "true");
  /* `scene` e `script` non si spengono: si fanno partire. */
  const servizio = dominio === "scene" || dominio === "script" ? "turn_on" : "toggle";
  chiamaHa(dominio, servizio, { entity_id: entity });
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderEntitaMie();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] entità mie", errore);
      }
    }) || 0;
}

export function ridisegnaEntitaMie() {
  state.firme.clear();
  schedule();
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      .dm-mie-ent{display:grid;gap:10px;margin:22px 0 8px}
      .dm-mie-testa{display:flex;align-items:center;gap:10px;padding:0 4px}
      .dm-mie-testa-ic{display:grid;place-items:center;width:30px;height:30px;flex:0 0 30px}
      .dm-mie-testa-ic .dm-oggetto{width:100%;height:100%}
      .dm-mie-ic .dm-oggetto{width:25px;height:25px}
      .dm-mie-testa h3{
        margin:0;font-family:'Oswald',sans-serif;font-weight:700;font-size:16px;
        letter-spacing:.06em;text-transform:uppercase;color:var(--text,#0f172a)}
      .dm-mie-lista{display:grid;gap:9px}
      .dm-mie-riga{
        display:grid;grid-template-columns:40px minmax(0,1fr) auto 48px;align-items:center;gap:11px;
        padding:11px 13px;border-radius:16px;
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0)}
      .dm-mie-riga[data-muta="true"]{opacity:.62}
      .dm-mie-ic{
        display:grid;place-items:center;width:40px;height:40px;border-radius:13px;font-size:19px;
        background:var(--bg-sculpted,#f0f4f8)}
      .dm-mie-riga[data-on="true"] .dm-mie-ic{background:rgba(249,115,22,.14)}
      .dm-mie-nome{display:grid;gap:2px;min-width:0}
      .dm-mie-nome strong{font-size:13.5px;font-weight:800;color:var(--text,#0f172a)}
      .dm-mie-nome small{
        font-size:10.5px;color:var(--text-dim,#64748b);
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dm-mie-val b{font-family:'Oswald',sans-serif;font-size:19px;font-weight:700;color:var(--text,#0f172a)}
      .dm-mie-val small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
      .dm-mie-muta{font-size:11px!important;font-weight:800!important;color:var(--text-dim,#64748b)!important}
      .dm-mie-lev{
        width:46px;height:27px;border-radius:999px;border:1px solid var(--card-border,#e2e8f0);
        background:var(--bg-sculpted,#f0f4f8);position:relative;cursor:pointer;padding:0}
      .dm-mie-lev>i{
        position:absolute;top:2px;left:2px;width:21px;height:21px;border-radius:50%;
        background:#cbd5e1;transition:transform .18s ease,background .18s ease}
      .dm-mie-lev[aria-checked="true"]{border-color:rgba(249,115,22,.55)}
      .dm-mie-lev[aria-checked="true"]>i{transform:translateX(19px);background:#f97316}
      .dm-mie-vuoto{display:block;width:46px;height:1px}
    `,
  );
}

export function installEntitaMie() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  for (const nome of ["render", "cdApplyNavVis"]) wrapFunction(nome, "__dmEntitaMie", schedule);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}
