/* Il popup della lavatrice: programmi tuoi, immagine di casa, veste di casa.
 *
 * Dal campo: «prima c'erano i comandi rapidi dei programmi, ora non aggancia
 * piu' l'entita' lavatrice; dare in config la scelta dei programmi da
 * inserire come tasti; l'immagine deve essere la stessa della sezione
 * Elettrodomestici; rivedere l'estetica del popup che non e' congrua».
 *
 * I quattro tasti dei programmi erano scritti nel guscio — Rapido 59',
 * Rapido 14', Rapido 30', Colorati — su quattro slot fissi: chi non aveva
 * QUEGLI script vedeva tasti che non facevano niente. Ora i programmi
 * abitano in `cd_lavatrice_programmi` (nome, entita', icona, quanti se ne
 * vogliono) e si modificano dalla scheda della lavatrice in configurazione,
 * dentro la sua fisarmonica: senza programmi, la griglia sparisce. Chi
 * aveva i quattro storici mappati se li ritrova seminati.
 *
 * L'immagine non e' piu' il file `/local/foto-pkg/lavatrice_on.gif` che
 * quasi nessuno ha (e che al primo 404 spariva): e' il disegno della
 * lavatrice della sezione Elettrodomestici — o la foto vera, se nella
 * scheda dell'apparecchio ne e' stata scelta una.
 */
import { applianceHeroArtwork } from "../core/appliance-hero-artwork.js";
import { applianceVisualKey } from "../core/device-model.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  section,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_POPUP_LAVATRICE__";
const state = (root[KEY] ||= { installed: false });

const CHIAVE = "cd_lavatrice_programmi";

/* I quattro tasti che il guscio teneva cablati: si seminano SOLO per chi ha
 * quegli script davvero mappati negli slot storici. */
const STORICI = Object.freeze([
  { name: "Rapido 14'", entity: "dm.lavatrice_script_programma_rapido_14", icon: "⚡" },
  { name: "Rapido 30'", entity: "dm.lavatrice_script_programma_30", icon: "⏲️" },
  { name: "Rapido 59'", entity: "dm.lavatrice_script_programma_59", icon: "⏱️" },
  { name: "Colorati", entity: "dm.lavatrice_script_programma_misto_colorati", icon: "👕" },
]);

function normalizza(voce) {
  const name = clean(voce?.name);
  const entity = clean(voce?.entity);
  if (!name || !entity.includes(".")) return null;
  return { name, entity, icon: clean(voce?.icon) || "🧺" };
}

/** I programmi, puri: dalla config se scritta, altrimenti la semina storica
 * per chi ha quegli slot mappati. `null` = mai scritta; `[]` = svuotata. */
export function programmiLavatrice(config, overrides = {}) {
  if (Array.isArray(config)) return config.map(normalizza).filter(Boolean);
  return STORICI.filter((voce) => Boolean(clean(overrides[voce.entity]))).map((voce) => ({
    ...voce,
  }));
}

function leggiConfig() {
  try {
    const grezzo = root.localStorage?.getItem?.(CHIAVE);
    if (grezzo == null) return null;
    const dati = JSON.parse(grezzo);
    return Array.isArray(dati) ? dati : null;
  } catch (_errore) {
    return null;
  }
}

function scriviConfig(lista) {
  try {
    root.localStorage?.setItem?.(CHIAVE, JSON.stringify(lista));
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_errore) {}
  disegnaProgrammi();
}

function programmiAttuali() {
  return programmiLavatrice(leggiConfig(), root.cdCfg?.("cd_entity_overrides") || {});
}

function tasto(voce) {
  const nodo = doc.createElement("button");
  nodo.type = "button";
  nodo.className = "lav-preset-btn";
  nodo.dataset.dmLavProgramma = voce.entity;
  nodo.innerHTML = `<div class="icon-wrap">${esc(voce.icon)}</div><div class="name">${esc(voce.name)}</div>`;
  nodo.addEventListener("click", () => {
    root.navigator?.vibrate?.(12);
    /* La strada del guscio: toggle risolve il riferimento e per gli script
     * il servizio e' «esegui». */
    root.toggle?.(voce.entity);
  });
  return nodo;
}

export function disegnaProgrammi() {
  const griglia = doc?.querySelector?.("#lavatrice-modal .lav-preset-grid");
  if (!griglia) return false;
  const voci = programmiAttuali();
  griglia.replaceChildren(...voci.map(tasto));
  /* Senza programmi ne' griglia ne' titolo: tasti che non fanno niente non
   * sono un'informazione. */
  const titolo = griglia.previousElementSibling;
  griglia.style.display = voci.length ? "" : "none";
  if (titolo?.tagName === "H4") titolo.style.display = voci.length ? "" : "none";
  return true;
}

/* L'immagine della sezione Elettrodomestici: la foto scelta nella scheda
 * dell'apparecchio se c'e', altrimenti il disegno di casa. */
function immagineDellaSezione() {
  const apparecchi = section("appliances", readJson("cd_appliances", []));
  const lavatrice = (Array.isArray(apparecchi) ? apparecchi : []).find(
    (voce) => applianceVisualKey(voce) === "lavatrice",
  );
  return clean(lavatrice?.image || lavatrice?.image_url);
}

export function vesteImmagine() {
  const area = doc?.querySelector?.("#lavatrice-modal .lav-area-img");
  if (!area) return false;
  /* L'onerror del vecchio <img> puo' accendere il cestino di ripiego anche
   * DOPO questo giro: lo si spegne a ogni passata, non solo alla prima. */
  area.classList.remove("img-fallback");
  if (area.querySelector("[data-dm-lav-veste]")) return false;
  const foto = immagineDellaSezione();
  const veste = doc.createElement("span");
  veste.dataset.dmLavVeste = "";
  veste.className = "dm-lav-veste";
  /* Il disegno e' QUELLO della card della sezione — l'oblo' fotorealistico
   * dell'hero — non l'iconcina del catalogo: «voglio quella proprio nella
   * sezione, non icona». */
  veste.innerHTML = foto
    ? `<img src="${esc(foto)}" alt="" loading="lazy">`
    : applianceHeroArtwork("lavatrice", 170);
  /* Il vecchio <img> puntava a un file /local che quasi nessuno ha: si
   * spegne, non si combatte. E il cestino di ripiego che il suo onerror
   * aveva acceso sul contenitore se ne va con lui. */
  const vecchia = area.querySelector("#img-lavatrice");
  if (vecchia) vecchia.style.display = "none";
  area.classList.remove("img-fallback");
  area.append(veste);
  /* E via il cesto di paglia dalla testata: l'identita' del popup e' la
   * lavatrice disegnata qui sotto, non un cesto. */
  const testata = doc.querySelector("#lavatrice-modal .ev-waw-title .icon");
  if (testata) testata.style.display = "none";
  return true;
}

/* ── la scheda in configurazione, dentro la fisarmonica della lavatrice ── */

function rigaEditor(voce) {
  const nodo = doc.createElement("div");
  nodo.className = "dm-lav-riga";
  nodo.innerHTML =
    `<input class="ed-input dm-lav-icona" maxlength="4" value="${esc(voce.icon || "")}" placeholder="🧺" aria-label="${t("Icona", "Icon")}">` +
    `<input class="ed-input dm-lav-nome" value="${esc(voce.name || "")}" placeholder="${t("Nome (es. Rapido 30')", "Name (e.g. Quick 30')")}">` +
    `<input class="ed-input ed-slot-in mono dm-lav-entita" value="${esc(voce.entity || "")}" placeholder="script.lavatrice_rapido">` +
    `<button type="button" class="ed-del dm-lav-via" aria-label="${t("Elimina", "Delete")}">🗑️</button>`;
  return nodo;
}

function raccogli(carta) {
  return [...carta.querySelectorAll(".dm-lav-riga")]
    .map((nodo) => ({
      icon: clean(nodo.querySelector(".dm-lav-icona")?.value),
      name: clean(nodo.querySelector(".dm-lav-nome")?.value),
      entity: clean(nodo.querySelector(".dm-lav-entita")?.value),
    }))
    .filter((voce) => voce.name || voce.entity);
}

export function montaEditor() {
  /* La fisarmonica della lavatrice si riconosce dal suo slot. */
  const slot = doc?.querySelector?.('input[data-ref="dm.lavatrice_programma"]');
  const fisarmonica = slot?.closest?.("details.ed-acc");
  if (!fisarmonica) return false;
  if (fisarmonica.querySelector("[data-dm-lav-programmi]")) return true;
  fisarmonica.append(creaCarta());
  return true;
}

function creaCarta() {
  const carta = doc.createElement("div");
  carta.className = "ed-form dm-lav-carta";
  carta.dataset.dmLavProgrammi = "";
  carta.innerHTML =
    `<div class="ed-sec-title">🧺 ${t("Programmi rapidi del popup", "Quick programs of the popup")}</div>` +
    `<div class="ed-hint">${t(
      "I tasti dei programmi nel popup della lavatrice: nome, entità (script o switch), icona — quanti ne vuoi. Senza programmi la griglia sparisce.",
      "The program buttons in the washing machine popup: name, entity (script or switch), icon — as many as you need. With no programs the grid disappears.",
    )}</div>` +
    `<div class="dm-lav-righe"></div>` +
    `<button type="button" class="ed-btn-add dm-lav-aggiungi">＋ ${t("Aggiungi programma", "Add program")}</button>`;
  const righe = carta.querySelector(".dm-lav-righe");
  programmiAttuali().forEach((voce) => righe.append(rigaEditor(voce)));

  const salva = () => {
    scriviConfig(raccogli(carta));
    /* I tasti del popup seguono subito, senza aspettare un altro giro. */
    disegnaProgrammi();
  };
  carta.addEventListener("change", salva);
  carta.addEventListener("click", (evento) => {
    const via = evento.target?.closest?.(".dm-lav-via");
    if (via) {
      via.closest(".dm-lav-riga")?.remove();
      salva();
      return;
    }
    if (evento.target?.closest?.(".dm-lav-aggiungi"))
      righe.append(rigaEditor({ icon: "🧺", name: "", entity: "" }));
  });
  return carta;
}

/* La personalizzazione sta nelle Azioni rapide, non nel popup.
 *
 * «Manca la possibilita' di personalizzare il popup azione rapida lavatrice»
 * e poi, precisato: «il config non lo devi mettere nel popup ma nella sezione
 * azioni rapide — quando si sceglie popup lavatrice esce la configurazione
 * completa». Quando il menu dell'azione (editor o procedura guidata) sta su
 * «🧺 Popup Lavatrice», sotto compare la carta intera dei programmi — nome,
 * entita', icona, quanti ne vuoi — col salvataggio a ogni modifica; scelta
 * un'altra azione, la carta si ritira. */
export function montaNelleAzioni() {
  let montata = false;
  for (const id of ["ed-qa-type", "wz-qa-type"]) {
    const select = doc?.getElementById?.(id);
    if (!select) continue;
    if (!select.__dmLavAscolta) {
      select.__dmLavAscolta = true;
      select.addEventListener("change", () => montaNelleAzioni());
    }
    const contenitore = select.closest(".ed-form") || select.parentElement?.parentElement;
    if (!contenitore) continue;
    const esistente = contenitore.querySelector("[data-dm-lav-programmi]");
    const vuole = clean(select.value) === "builtin_lavatrice";
    if (vuole && !esistente) contenitore.append(creaCarta());
    if (!vuole && esistente) esistente.remove();
    montata = montata || vuole;
  }
  return montata;
}

/* La veste: il popup parla la lingua delle altre finestre della plancia. */
const STILE = `
#lavatrice-modal .lav-preset-btn{
  border:1px solid var(--card-border,#e2e8f0);border-radius:14px;background:var(--card-bg,#fff);
  box-shadow:0 1px 3px rgba(15,23,42,.05);cursor:pointer;transition:transform .15s ease,border-color .2s ease}
#lavatrice-modal .lav-preset-btn:hover{transform:translateY(-1px);border-color:#0ea5e9}
#lavatrice-modal .lav-preset-btn .icon-wrap{font-size:20px}
#lavatrice-modal .lav-preset-btn .name{font-size:11px;font-weight:800}
#lavatrice-modal .lav-mon-card{
  border:1px solid var(--card-border,#e2e8f0);border-radius:14px;background:var(--card-bg,#fff)}
#lavatrice-modal .dm-lav-veste{display:grid;place-items:center;min-height:120px}
#lavatrice-modal .dm-lav-veste img{max-width:140px;filter:drop-shadow(0 15px 25px rgba(0,0,0,.15))}
#lavatrice-modal .dm-lav-veste svg{width:170px;height:auto;filter:drop-shadow(0 14px 24px rgba(2,6,23,.20))}
.dm-lav-carta{margin-top:12px}
.dm-lav-righe{display:grid;gap:8px;margin:10px 0}
.dm-lav-riga{display:grid;grid-template-columns:52px minmax(0,1fr) minmax(0,1.4fr) 38px;gap:8px;align-items:center}
.dm-lav-riga .dm-lav-icona{text-align:center;padding-inline:4px}
@media(max-width:560px){.dm-lav-riga{grid-template-columns:44px minmax(0,1fr) 38px}
.dm-lav-riga .dm-lav-entita{grid-column:1/-1}}
`;

export function installPopupLavatrice() {
  if (state.installed) return false;
  if (!doc?.getElementById) return false;
  installStyle("dm-popup-lavatrice-style", STILE);
  disegnaProgrammi();
  vesteImmagine();
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
  ]) {
    root.addEventListener?.(evento, () => {
      disegnaProgrammi();
      vesteImmagine();
      montaNelleAzioni();
    });
  }
  onEditorRedraw("__dmLavProgrammi", () => {
    montaEditor();
    montaNelleAzioni();
  });
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installPopupLavatrice, { once: true });
} else {
  installPopupLavatrice();
}
