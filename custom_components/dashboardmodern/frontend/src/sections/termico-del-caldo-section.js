/* Le voci termiche della scheda Caldo, configurabili — e senza voci, niente.
 *
 * Il pannello sotto le stanze del popup Caldo era scritto nel guscio: tre
 * righe fisse — Caldaia su `switch.caldaia` (l'entita' dell'impianto di
 * qualcuno, cablata per tutti), Pompa termocamino e Aspiratore canna fumaria
 * su due slot opachi — che per chiunque altro dicevano solo «N/D». Dal campo:
 * «nella sezione clima non e' presente alcun campo per impostarlo, e il campo
 * deve essere libero: se qualcuno vuole inserire altre cose deve poterlo
 * fare, e se non viene inserito nulla deve scomparire».
 *
 * Le voci ora abitano in `cd_termico_caldo` — nome, entita', icona a scelta —
 * si modificano dalla scheda Clima della configurazione, e il pannello
 * disegna quelle: nessuna voce, nessun pannello. Chi aveva davvero le tre
 * storiche mappate se le ritrova seminate nella configurazione, una volta.
 */
import { clean, doc, esc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TERMICO_CALDO__";
const STYLE_ID = "dm-termico-caldo-style";
const state = (root[KEY] ||= { installed: false });

const CHIAVE = "cd_termico_caldo";

/* Le tre voci che il guscio teneva cablate: si seminano SOLO se la loro
 * entita' esiste davvero in questa casa — la caldaia come switch diretto, le
 * altre due dietro i vecchi slot opachi. */
const STORICHE = Object.freeze([
  { name: "Caldaia", entity: "switch.caldaia", icon: "🔥", diretta: true },
  { name: "Pompa termocamino", entity: "dm.core_053", icon: "♨️", diretta: false },
  { name: "Aspiratore canna fumaria", entity: "dm.core_047", icon: "💨", diretta: false },
]);

function normalizza(voce) {
  const name = clean(voce?.name);
  const entity = clean(voce?.entity);
  if (!name || !entity.includes(".")) return null;
  return { name, entity, icon: clean(voce?.icon) || "🔥" };
}

/** La lista delle voci, pura: dalla config se scritta, altrimenti la semina
 * storica per chi ha quelle entita' davvero. `config === null` = mai scritta;
 * `[]` = svuotata apposta, e resta vuota. */
export function vociTermiche(config, states = {}, overrides = {}) {
  if (Array.isArray(config)) return config.map(normalizza).filter(Boolean);
  return STORICHE.filter((voce) =>
    voce.diretta ? Boolean(states[voce.entity]) : Boolean(clean(overrides[voce.entity])),
  ).map((voce) => ({ name: voce.name, entity: voce.entity, icon: voce.icon }));
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
  disegnaPannello();
}

function statoDi(entity) {
  try {
    return clean(root.STATES?.[entity]?.state).toLowerCase();
  } catch (_errore) {
    return "";
  }
}

function commutabile(entity) {
  const dominio = clean(entity).split(".")[0];
  /* Anche gli slot opachi storici: dietro c'e' uno switch. */
  return ["switch", "input_boolean", "light", "dm"].includes(dominio);
}

function riga(voce) {
  const stato = statoDi(voce.entity);
  const acceso = stato === "on";
  const noto = Boolean(stato) && !["unavailable", "unknown"].includes(stato);
  const nodo = doc.createElement("div");
  nodo.className = `ns-thermal-row${commutabile(voce.entity) ? " is-clickable" : ""}`;
  nodo.dataset.dmTermico = voce.entity;
  nodo.innerHTML =
    `<span class="ns-thermal-icon">${esc(voce.icon)}</span>` +
    `<span class="ns-thermal-label">${esc(voce.name)}</span>` +
    `<span class="ns-thermal-state ${acceso ? "on" : "off"}"><span class="ns-thermal-dot"></span>` +
    `<span>${noto ? (acceso ? "ON" : "OFF") : "N/D"}</span></span>`;
  if (commutabile(voce.entity)) {
    nodo.addEventListener("click", () => {
      root.navigator?.vibrate?.(15);
      root.toggle?.(voce.entity);
      root.setTimeout?.(disegnaPannello, 400);
    });
  }
  return nodo;
}

export function disegnaPannello() {
  const pannello = doc?.getElementById?.("ns-thermal-panel");
  if (!pannello) return false;
  const voci = vociTermiche(
    leggiConfig(),
    root.STATES || {},
    root.cdCfg?.("cd_entity_overrides") || {},
  );
  pannello.replaceChildren(...voci.map(riga));
  /* Senza voci il pannello scompare: N/D per sempre non e' un'informazione. */
  pannello.style.display = voci.length ? "" : "none";
  return true;
}

/* ── La scheda in configurazione ─────────────────────────────────────── */

function rigaEditor(voce, indice) {
  const nodo = doc.createElement("div");
  nodo.className = "dm-termico-riga";
  nodo.innerHTML =
    `<input class="ed-input dm-termico-icona" maxlength="4" value="${esc(voce.icon || "")}" placeholder="🔥" aria-label="${t("Icona", "Icon")}">` +
    `<input class="ed-input dm-termico-nome" value="${esc(voce.name || "")}" placeholder="${t("Nome (es. Caldaia)", "Name (e.g. Boiler)")}">` +
    `<span class="ed-form-row dm-termico-presa"><input class="ed-input ed-slot-in mono dm-termico-entita" value="${esc(voce.entity || "")}" placeholder="switch.caldaia">` +
    `<button type="button" class="dm-entity-picker" aria-label="${t("Seleziona", "Select")}">🔍</button></span>` +
    `<button type="button" class="ed-del dm-termico-via" aria-label="${t("Elimina", "Delete")}">🗑️</button>`;
  nodo.dataset.indice = String(indice);
  return nodo;
}

function raccogli(carta) {
  return [...carta.querySelectorAll(".dm-termico-riga")]
    .map((nodo) => ({
      icon: clean(nodo.querySelector(".dm-termico-icona")?.value),
      name: clean(nodo.querySelector(".dm-termico-nome")?.value),
      entity: clean(nodo.querySelector(".dm-termico-entita")?.value),
    }))
    .filter((voce) => voce.name || voce.entity);
}

function montaEditor() {
  const corpo = doc?.getElementById?.("ed-body");
  /* La scheda Clima si riconosce dal suo campo stanza. */
  if (!corpo || !corpo.querySelector("#ed-cl-room")) return false;
  if (corpo.querySelector("[data-dm-termico-caldo]")) return true;
  const carta = doc.createElement("div");
  carta.className = "ed-form dm-termico-carta";
  carta.dataset.dmTermicoCaldo = "";
  const voci = vociTermiche(
    leggiConfig(),
    root.STATES || {},
    root.cdCfg?.("cd_entity_overrides") || {},
  );
  carta.innerHTML =
    `<div class="ed-sec-title">🔥 ${t("Stato termico (Caldo)", "Thermal status (Heat)")}</div>` +
    `<div class="ed-hint">${t(
      "Le voci sotto le stanze del popup Caldo: caldaia, pompe, aspiratori — quello che vuoi. Ogni voce si salva appena cambia; senza voci il pannello sparisce.",
      "The rows under the rooms of the Heat popup: boiler, pumps, fans — whatever you need. Every row saves as it changes; with no rows the panel disappears.",
    )}</div>` +
    `<div class="dm-termico-righe"></div>` +
    `<button type="button" class="ed-btn-add dm-termico-aggiungi">＋ ${t("Aggiungi voce", "Add row")}</button>`;
  const righe = carta.querySelector(".dm-termico-righe");
  voci.forEach((voce, indice) => righe.append(rigaEditor(voce, indice)));

  const salva = () => scriviConfig(raccogli(carta));
  carta.addEventListener("change", salva);
  carta.addEventListener("click", (evento) => {
    const via = evento.target?.closest?.(".dm-termico-via");
    if (via) {
      via.closest(".dm-termico-riga")?.remove();
      salva();
      return;
    }
    if (evento.target?.closest?.(".dm-termico-aggiungi")) {
      righe.append(rigaEditor({ icon: "🔥", name: "", entity: "" }, righe.children.length));
      return;
    }
    const lente = evento.target?.closest?.(".dm-entity-picker");
    if (lente) {
      const campo = lente.parentElement?.querySelector(".dm-termico-entita");
      if (campo) root.wzPickEntity?.(campo);
    }
  });
  corpo.append(carta);
  return true;
}

const STILE = `
.dm-termico-carta{margin-top:14px}
.dm-termico-righe{display:grid;gap:8px;margin:10px 0}
.dm-termico-riga{display:grid;grid-template-columns:52px minmax(0,1fr) minmax(0,1.4fr) 38px;gap:8px;align-items:center}
.dm-termico-riga .dm-termico-icona{text-align:center;padding-inline:4px}
.dm-termico-riga .dm-termico-presa{display:flex;gap:6px}
.dm-termico-riga .dm-termico-presa .dm-termico-entita{flex:1;min-width:0}
@media(max-width:560px){.dm-termico-riga{grid-template-columns:44px minmax(0,1fr) 38px}
.dm-termico-riga .dm-termico-presa{grid-column:1/-1}}
`;

export function installTermicoDelCaldo() {
  if (state.installed) return false;
  if (!doc?.getElementById) return false;
  installStyle(STYLE_ID, STILE);
  /* Il pannello e' nostro: il disegno del guscio viene rifatto subito dopo. */
  wrapFunction("renderThermalPanel", "__dmTermicoCaldo", () => disegnaPannello());
  disegnaPannello();
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
  ]) {
    root.addEventListener?.(evento, () => {
      disegnaPannello();
      montaEditor();
    });
  }
  doc.addEventListener(
    "click",
    (evento) => {
      if (evento.target?.closest?.('.ed-tab[data-tab], [data-tab="clima"]'))
        root.setTimeout?.(montaEditor, 0);
    },
    true,
  );
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installTermicoDelCaldo, { once: true });
} else {
  installTermicoDelCaldo();
}
