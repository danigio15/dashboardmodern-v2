/* Le linguette degli impianti, sulla pagina e nella scheda.
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
 * di consumo nei due appartamenti e ogni appartamento ha i rispettivi carichi.»
 *
 * Il modello sta in core/energy-plants.js e la regola l'ha gia' scritta li':
 * l'impianto che c'era resta al primo livello, gli altri in un elenco accanto,
 * e l'id non e' il nome. Qui c'e' solo il modo di sceglierne uno.
 *
 * La pagina Energia non cambia di una virgola: stessa mappa dei flussi, stessa
 * barra Report/Istantanea/Giornaliera/Mensile/Temperature, stessi carichi. Si
 * aggiunge una riga di pillole sopra, e cambiando pillola cambiano i sensori
 * che tutto quanto legge — perche' `energyModel()` sceglie l'impianto una volta
 * sola, e da li' in giu' nessuno sa che ce n'e' piu' d'uno.
 *
 * Con un impianto solo la riga non compare affatto: chi non ha chiesto due
 * misuratori non deve vedere una linguetta che non serve a niente.
 */
import {
  PRIMO_IMPIANTO,
  configuredPlants,
  dropPlantLoads,
  nuovoImpianto,
  pickPlant,
  plantLabel,
  plantList,
  storedPlants,
} from "../core/energy-plants.js";
import { IMPIANTO_SCELTO_KEY, impiantoScelto } from "./energy-section.js";
import {
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  root,
  section,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_PLANTS__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const NOME = () => t("Impianto", "Plant");

/** Gli impianti salvati, comunque sia scritta la configurazione. */
export function impianti() {
  return plantList(section("energy", {}) || {});
}

function scegli(id) {
  try {
    root.localStorage?.setItem(IMPIANTO_SCELTO_KEY, clean(id));
  } catch (_error) {}
  root.navigator?.vibrate?.(8);
  /* Le caselle da cui il disegno legge i misuratori si rifanno adesso.
   *
   * Sono una proiezione: rispondono a «quale sensore leggo», e la risposta e'
   * appena cambiata. Si ricalcolano al salvataggio, e questo non e' un
   * salvataggio — quindi lo si chiede: senza, le linguette cambiavano i
   * carichi sotto Casa e lasciavano rete, solare e batteria sui sensori
   * dell'altra casa. */
  try {
    const magazzino = dashboardStore();
    magazzino?.persist?.();
    /* E la si consegna a chi disegna.
     *
     * Il runtime storico tiene la mappa delle caselle in una variabile presa
     * all'avvio: ricalcolarla e scriverla non basta, va passata. Senza questa
     * riga la proiezione nuova restava su disco e i cerchi continuavano a
     * leggere i contatori della casa di prima. */
    root.cdApplyCanonicalOverrides?.(magazzino?.getSection?.("entityOverrides") || {});
  } catch (_error) {}
  /* Cambiare impianto cambia cosa leggono tutti: il modo piu' onesto di dirlo
   * a diciassette moduli e' l'evento che gia' ascoltano quando la
   * configurazione cambia. */
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:state-changed"));
  root.render?.();
  schedule();
}

/* ─────────────────────────────── il markup ──────────────────────────────── */

export function tabsMarkup(lista, scelto, { conAggiunta = false } = {}) {
  const pillole = lista
    .map((impianto, index) => {
      const attivo = impianto.id === scelto;
      return `<button type="button" class="sub-tab-btn dm-imp-tab${attivo ? " active" : ""}" data-dm-impianto="${esc(impianto.id)}" aria-selected="${attivo}">
        <span class="dm-imp-tab-icon">🏠</span><span>${esc(plantLabel(impianto, index, NOME()))}</span>
      </button>`;
    })
    .join("");
  const aggiunta = conAggiunta
    ? `<button type="button" class="sub-tab-btn dm-imp-tab dm-imp-add" data-dm-impianto-nuovo>+ ${esc(t("Aggiungi impianto", "Add plant"))}</button>`
    : "";
  return `${pillole}${aggiunta}`;
}

/* ───────────────────────────── la riga in pagina ────────────────────────── */

function ensurePageTabs() {
  const pagina = doc?.getElementById?.("page-energy");
  const barra = pagina?.querySelector?.(".sub-tabs-container");
  if (!barra) return;
  const lista = impianti();
  let riga = doc.getElementById("dm-impianti-tabs");
  /* Con una casa sola la riga non c'e': una linguetta che non offre scelta e'
   * un ingombro e basta. */
  if (lista.length < 2) {
    riga?.remove();
    return;
  }
  if (!riga) {
    riga = doc.createElement("nav");
    riga.id = "dm-impianti-tabs";
    riga.className = "dm-imp-tabs";
    riga.setAttribute("aria-label", t("Impianti", "Plants"));
    barra.before(riga);
  }
  const scelto = pickPlant(lista, impiantoScelto())?.id || "";
  const firma = `${lista.map((voce, index) => `${voce.id}:${plantLabel(voce, index, NOME())}`).join("|")}§${scelto}`;
  if (riga.dataset.firma === firma) return;
  riga.dataset.firma = firma;
  riga.innerHTML = tabsMarkup(lista, scelto);
}

/* ───────────────────────── la riga nella scheda ─────────────────────────── */

function ensureConfigTabs() {
  const editor = doc?.querySelector?.('[data-editor="energy"]');
  const interne = editor?.querySelector?.(".ed-inner-tabs");
  if (!interne) return;
  const lista = impianti();
  const scelto = pickPlant(lista, impiantoScelto())?.id || "";
  let riga = editor.querySelector("#dm-impianti-cfg");
  if (!riga) {
    riga = doc.createElement("section");
    riga.id = "dm-impianti-cfg";
    riga.className = "dm-imp-cfg";
    interne.before(riga);
  }
  const corrente = pickPlant(lista, scelto);
  const indice = lista.findIndex((voce) => voce.id === scelto);
  const firma = `${lista.map((voce, index) => `${voce.id}:${plantLabel(voce, index, NOME())}`).join("|")}§${scelto}`;
  if (riga.dataset.firma === firma) return;
  riga.dataset.firma = firma;
  const primo = !corrente || corrente.id === PRIMO_IMPIANTO;
  riga.innerHTML = `
    <div class="dm-imp-cfg-tabs">${tabsMarkup(lista, scelto, { conAggiunta: true })}</div>
    <p class="ed-intro dm-imp-cfg-intro">${esc(
      t(
        "Ogni impianto ha il suo misuratore, il suo fotovoltaico, la sua batteria e i suoi carichi. Le caselle qui sotto sono quelle dell'impianto scelto: aggiungerne uno riparte da zero e non tocca quello che hai già configurato.",
        "Every plant has its own meter, its own solar, its own battery and its own loads. The fields below belong to the selected plant: adding one starts from scratch and leaves what you already configured alone.",
      ),
    )}</p>
    <label class="ed-slot dm-imp-cfg-nome">
      <span class="ed-slot-lbl">${esc(t("Nome impianto", "Plant name"))}</span>
      <input class="ed-input" id="dm-imp-nome" autocomplete="off"
        placeholder="${esc(plantLabel({}, Math.max(0, indice), NOME()))}"
        value="${esc(clean(corrente?.name))}">
    </label>
    ${
      primo
        ? `<p class="dm-imp-cfg-nota">${esc(
            t(
              "Questo è l'impianto principale e non si può eliminare: è quello che la plancia ha sempre letto.",
              "This is the main plant and cannot be removed: it is the one the dashboard has always read.",
            ),
          )}</p>`
        : `<button type="button" class="dm-imp-cfg-del" data-dm-impianto-elimina="${esc(corrente.id)}">🗑 ${esc(
            t("Elimina questo impianto", "Delete this plant"),
          )}</button>`
    }`;
}

/* ───────────────────────────── scrivere e togliere ──────────────────────── */

async function salvaLista(lista) {
  const store = dashboardStore();
  if (!store?.getSection || !store?.replaceSection) return;
  const salvato = store.getSection("energy") || {};
  await store.replaceSection("energy", storedPlants(lista, salvato));
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
}

async function aggiungi() {
  const lista = impianti();
  const salvato = section("energy", {}) || {};
  const nato = nuovoImpianto(lista, "", salvato.metadata);
  await salvaLista([...lista, nato]);
  scegli(nato.id);
}

async function elimina(id) {
  const lista = impianti();
  if (clean(id) === PRIMO_IMPIANTO) return;
  await salvaLista(lista.filter((voce) => voce.id !== clean(id)));
  /* Un impianto se ne va con tutto quello che era suo.
   *
   * I carichi non stanno dentro all'impianto — stanno nella sezione `loads`,
   * col nome dell'impianto scritto sopra — e cancellando la casa restavano
   * li': orfani, invisibili in ogni flusso perche' il loro impianto non
   * esisteva piu', e pronti a riapparire tutti insieme il giorno in cui un
   * impianto nuovo avesse ripreso quell'id. Per questo gli id non si
   * riutilizzano, e per questo qui si cancella davvero. */
  const store = dashboardStore();
  const carichi = section("loads", []);
  if (Array.isArray(carichi) && store?.replaceSection) {
    const restano = dropPlantLoads(carichi, id);
    if (restano.length !== carichi.length) await store.replaceSection("loads", restano);
  }
  scegli(PRIMO_IMPIANTO);
}

async function rinomina(nome) {
  const scelto = pickPlant(impianti(), impiantoScelto())?.id;
  if (!scelto) return;
  /* Rinominare non tocca l'id: e' l'intera ragione per cui l'id non si ricava
   * dal nome. Quello che a quell'impianto e' appeso resta appeso. */
  await salvaLista(
    impianti().map((voce) => (voce.id === scelto ? { ...voce, name: clean(nome) } : voce)),
  );
  schedule();
}

/* ─────────────────────────────────── giro ───────────────────────────────── */

function repaint() {
  state.frame = 0;
  ensurePageTabs();
  ensureConfigTabs();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(repaint) || root.setTimeout?.(repaint, 0) || 0;
}

export function installEnergyPlantsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", (event) => {
    const pillola = event.target?.closest?.("[data-dm-impianto]");
    if (pillola) {
      scegli(pillola.getAttribute("data-dm-impianto"));
      return;
    }
    if (event.target?.closest?.("[data-dm-impianto-nuovo]")) {
      aggiungi();
      return;
    }
    const via = event.target?.closest?.("[data-dm-impianto-elimina]");
    if (via) elimina(via.getAttribute("data-dm-impianto-elimina"));
  });
  doc.addEventListener("change", (event) => {
    if (event.target?.id === "dm-imp-nome") rinomina(event.target.value);
  });
  /* La scheda si ridisegna da capo a ogni giro — `replaceChildren()` — e la
   * riga se ne andava con lei. Chi la ridisegna lo dice: si ascolta li'. */
  onEditorRedraw("__dmEnergyPlantsSection", schedule);
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
}

function installStyles() {
  installStyle(
    "dm-energy-plants-style",
    `
      /* Le pillole sono quelle di tutta la plancia: stessa forma, stesso font.
       * Un <button> il font non lo eredita da solo. */
      #page-energy .dm-imp-tabs{display:flex;align-items:center;gap:10px;width:100%;margin:10px 0 0;padding:0 4px;overflow-x:auto;scrollbar-width:none}
      #page-energy .dm-imp-tabs::-webkit-scrollbar{display:none}
      .dm-imp-tab{font-family:inherit;display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;min-height:40px;padding:8px 15px;border:1.5px solid var(--divider-color,#dbe4ee);border-radius:100px;background:var(--card-bg,#fff);color:var(--text-dim,#64748b);font-size:11.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 20px -12px rgba(15,23,42,.28)}
      .dm-imp-tab.active{border-color:rgba(22,163,74,.46);background:color-mix(in srgb,#16a34a 11%,var(--card-bg,#fff));color:#15803d}
      .dm-imp-tab-icon{font-size:17px;line-height:1}
      .dm-imp-add{border-style:dashed;color:var(--primary-color,#0284c7);border-color:color-mix(in srgb,var(--primary-color,#0ea5e9) 50%,transparent)}

      .dm-imp-cfg{display:grid;gap:10px;margin:0 0 14px}
      .dm-imp-cfg-tabs{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .dm-imp-cfg-intro{margin:0!important}
      .dm-imp-cfg-nome{display:grid;gap:5px}
      .dm-imp-cfg-nota{margin:0;color:var(--secondary-text-color,#94a3b8);font-size:11px;font-weight:700;line-height:1.4}
      .dm-imp-cfg-del{justify-self:start;padding:8px 14px;border:1px solid rgba(185,28,28,.35);border-radius:999px;background:transparent;color:#b91c1c;font:inherit;font-size:11px;font-weight:800;letter-spacing:.6px;cursor:pointer}
      .dm-imp-cfg-del:hover{background:rgba(185,28,28,.08)}
    `,
  );
}
