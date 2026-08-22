/* Gli allagamenti, accanto agli altri avvisi.
 *
 * Il Quadro Avvisi sorveglia cinque liste — Aperture, Batterie, Luci, Clima e
 * Riscaldamento — e chi ha un sensore di allagamento sotto il lavello o in
 * lavanderia non aveva dove metterlo: restava un avviso «personalizzato», con
 * la sua icona da scegliere a mano e fuori dal conteggio delle altre. Ma una
 * perdita d'acqua non e' un caso particolare di qualcun altro: e' una delle
 * cose per cui si guarda il Quadro Avvisi.
 *
 * Qui l'allagamento diventa una lista come le altre: la sua card nel quadro
 * col suo contatore, il suo popup con l'elenco di cosa sta bagnato, la sua
 * voce nella configurazione. Le liste del runtime sono un oggetto con una
 * chiave per gruppo, e le pagine che le leggono — il conteggio, il popup, la
 * configurazione — la chiedono per nome: aggiungere una chiave basta a farsi
 * leggere da tutte e tre, e non c'e' nessun elenco fisso da inseguire.
 *
 * Il primo avvio si serve da solo: un `binary_sensor` che Home Assistant
 * dichiara `device_class: moisture` e' un sensore di allagamento, e chiederlo
 * a mano quando lo si sa gia' sarebbe solo lavoro in piu'. Chi non li vuole li
 * toglie, e la rimozione resta — e' la stessa regola delle altre liste.
 */
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_FLOOD_ALERTS__";
const state = (root[KEY] ||= { installed: false, frame: 0, deleteBound: false });

/** La chiave del gruppo: la stessa nel quadro, nel popup e nella configurazione. */
export const FLOOD_GROUP = "allag";
export const FLOOD_ICON = "💧";

/* L'azzurro dell'acqua, nella forma in cui le card del quadro vogliono il
 * colore: tre numeri, che la card impasta da sola con le sue trasparenze. */
const FLOOD_RGB = "14,165,233";

const floodName = () => t("Allagamenti", "Floods");

/** Un sensore di allagamento, come lo dichiara Home Assistant. */
export function isFloodSensor(entityId, stato) {
  if (!clean(entityId).startsWith("binary_sensor.")) return false;
  return clean(stato?.attributes?.device_class).toLowerCase() === "moisture";
}

/** Bagnato o asciutto: `on` e' bagnato, come per ogni binary_sensor. */
export const floodIsWet = (stato) => clean(stato?.state).toLowerCase() === "on";

/**
 * Le entita' del gruppo, dalle stesse due caselle che usano le altre liste:
 * quelle aggiunte e quelle tolte. Il primo avvio, e solo quello, si riempie da
 * se' con i sensori che Home Assistant dichiara di allagamento.
 */
/* Il primo giro si ricorda per conto suo.
 *
 * «La lista non c'e' ancora» sembrava il modo naturale di dire «non ho ancora
 * guardato», ma togliendo l'ultimo sensore la lista sparisce — e' cosi' che il
 * runtime cancella — e al ricaricamento successivo il rilevamento sarebbe
 * ripartito, rimettendo dentro proprio quello che era stato tolto. Il segno
 * sta da un'altra parte, e una lista vuota resta vuota. */
export const FLOOD_SEEN_KEY = "cd_allag_rilevato";

export function floodEntities(extras = {}, removed = {}, states = {}, gia = false) {
  const tolte = new Set((removed[FLOOD_GROUP] || []).map(clean).filter(Boolean));
  const dichiarate = extras[FLOOD_GROUP];
  const elenco = Array.isArray(dichiarate)
    ? dichiarate
    : gia
      ? []
      : Object.entries(states)
          .filter(([id, stato]) => isFloodSensor(id, stato))
          .map(([id]) => id);
  const viste = new Set();
  const uscita = [];
  for (const voce of elenco) {
    const id = clean(voce);
    if (!id || tolte.has(id) || viste.has(id)) continue;
    viste.add(id);
    uscita.push(id);
  }
  return { entities: uscita, primoAvvio: !Array.isArray(dichiarate) && !gia };
}

/* Le liste sorvegliate del runtime. Sono una `const` in cima al suo script, e
 * una `const` in cima a uno script classico sta nell'ambiente lessicale della
 * pagina: si legge per nome, non da `globalThis`. E' la stessa strada che usa
 * gia' chi legge il registro degli stati. */
function watchedGroups() {
  const groups = lexicalGlobal("GRUPPI_MONITORAGGIO");
  return groups && typeof groups === "object" ? groups : null;
}

/** Allinea la lista del runtime a quello che dice la configurazione. */
export function syncFloodGroup() {
  const groups = watchedGroups();
  if (!groups) return null;
  const extras = readJson("cd_gruppi_extra", {}) || {};
  const removed = readJson("cd_gruppi_removed", {}) || {};
  const gia = Boolean(readJson(FLOOD_SEEN_KEY, false));
  const { entities, primoAvvio } = floodEntities(extras, removed, allStates(), gia);
  /* Il primo avvio scrive quello che ha trovato e si segna di averlo fatto: da
   * li' in poi la lista e' dell'utente, e chi la svuota la ritrova vuota
   * invece di vedersela ripopolare a ogni ricaricamento. */
  if (primoAvvio) {
    if (entities.length) {
      writeJsonIfChanged("cd_gruppi_extra", { ...extras, [FLOOD_GROUP]: entities }, { sync: false });
    }
    writeJsonIfChanged(FLOOD_SEEN_KEY, true, { sync: false });
  }
  groups[FLOOD_GROUP] = entities;
  return entities;
}

/* La card nel quadro, uguale alle altre.
 *
 * Non si copia il foglio di stile: si copia la struttura, e le classi che il
 * quadro ha gia' fanno il resto — cosi' se un giorno cambia l'aspetto delle
 * card cambia anche questa, senza che nessuno se ne debba ricordare. */
function ensureFloodCard() {
  const grid = doc?.getElementById("glance-grid");
  if (!grid) return null;
  let card = doc.getElementById("glance-" + FLOOD_GROUP);
  if (!card) {
    card = doc.createElement("div");
    card.className = "glance-card";
    card.id = "glance-" + FLOOD_GROUP;
    card.style.setProperty("--g-rgb", FLOOD_RGB);
    card.style.display = "none";
    card.dataset.dmFloodCard = "true";
    card.addEventListener("click", (event) => {
      root.apriDettagli?.(event, FLOOD_GROUP);
    });
    grid.append(card);
  }
  const nome = floodName();
  if (clean(card.dataset.dmFloodLabel) !== nome) {
    card.dataset.dmFloodLabel = nome;
    card.innerHTML =
      `<div class="g-info"><span class="g-name">${esc(nome)}</span>` +
      `<span class="g-val" id="g-val-${FLOOD_GROUP}">0</span></div>` +
      `<div class="g-icon-wrap anim-ping" style="color: var(--load);">${FLOOD_ICON}</div>`;
  }
  return card;
}

/** Quante ne sono bagnate adesso. */
export function countWet(entities = [], states = {}) {
  return entities.reduce((numero, id) => numero + (floodIsWet(states[id]) ? 1 : 0), 0);
}

/* Il quadro mostra una card solo quando ha qualcosa da dire: zero allagamenti
 * e' una buona notizia, non una riga da leggere. E' la regola delle altre
 * cinque, e vale anche per questa. */
function paintFloodCard() {
  const entities = syncFloodGroup();
  if (entities === null) return false;
  const card = ensureFloodCard();
  if (!card) return false;
  const quante = countWet(entities, allStates());
  const valore = doc.getElementById("g-val-" + FLOOD_GROUP);
  if (valore) valore.textContent = String(quante);
  card.style.display = quante > 0 ? "flex" : "none";
  return true;
}

/* Il popup del quadro conosce cinque tipi e per il sesto uscirebbe vuoto.
 * Gli si lascia fare il suo giro — apre la finestra, ci mette dentro il suo
 * «Nessun elemento attivo» — e poi si scrive il titolo e l'elenco che gli
 * mancano, con le stesse classi delle altre righe. */
function floodDetailsMarkup(entities, states) {
  const bagnate = entities.filter((id) => floodIsWet(states[id]));
  if (!bagnate.length) return "";
  return bagnate
    .map((id) => {
      const stato = states[id];
      const nome =
        clean(readJson("cd_avvisi_names_extra", {})?.[id]) ||
        clean(stato?.attributes?.friendly_name) ||
        id;
      return (
        '<div class="detail-row"><div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow:hidden;">' +
        `<div class="d-icon" style="flex-shrink:0;background:#e0f2fe;">${FLOOD_ICON}</div>` +
        '<div class="d-info" style="min-width:0;flex:1;overflow:hidden;">' +
        `<div class="d-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;">${esc(nome)}</div>` +
        `<div class="d-state"><span style="color:#dc2626; font-weight:900;">${esc(t("ALLAGAMENTO", "FLOOD"))}</span></div>` +
        "</div></div></div>"
      );
    })
    .join("");
}

function installDetailsWrapper() {
  const previous = root.apriDettagli;
  if (typeof previous !== "function" || previous.__dmFloodAlerts) return false;
  function apriDettagli(event, tipo, ...rest) {
    const risultato = previous.call(this, event, tipo, ...rest);
    if (clean(tipo) !== FLOOD_GROUP) return risultato;
    const titolo = doc?.getElementById("details-title");
    if (titolo) titolo.innerHTML = `${FLOOD_ICON} ${esc(floodName().toUpperCase())}`;
    const lista = doc?.getElementById("details-list");
    const righe = floodDetailsMarkup(syncFloodGroup() || [], allStates());
    if (lista && righe) lista.innerHTML = righe;
    return risultato;
  }
  Object.assign(apriDettagli, previous);
  apriDettagli.__dmFloodAlerts = true;
  apriDettagli.__dmPrevious = previous;
  root.apriDettagli = apriDettagli;
  return true;
}

/* La voce nella configurazione.
 *
 * I due elenchi a tendina che scelgono il gruppo di un avviso — quello della
 * procedura guidata e quello dell'editor — sono stampati dal runtime con le
 * loro cinque voci. Chi salva, pero', non guarda un elenco di gruppi ammessi:
 * scrive nella casella del gruppo che gli arriva. Basta quindi aggiungere la
 * voce perche' l'allagamento si possa configurare come tutti gli altri. */
function ensureGroupOption(select) {
  if (!select || select.querySelector(`option[value="${FLOOD_GROUP}"]`)) return false;
  const option = doc.createElement("option");
  option.value = FLOOD_GROUP;
  option.textContent = `${FLOOD_ICON} ${floodName()}`;
  const custom = select.querySelector('option[value="custom"]');
  if (custom) custom.before(option);
  else select.append(option);
  return true;
}

function ensureGroupOptions() {
  let aggiunte = 0;
  for (const id of ["wz-av-grp", "ed-avv-grp"]) {
    if (ensureGroupOption(doc?.getElementById(id))) aggiunte += 1;
  }
  return aggiunte;
}

/* Le righe nella configurazione.
 *
 * L'elenco degli avvisi lo stampa il runtime, e lo stampa da una mappa di
 * gruppi scritta a mano che si ferma ai suoi cinque. Un allagamento salvato
 * finiva quindi nella lista sorvegliata — contava, compariva nel quadro, si
 * apriva nel popup — ma dalla configurazione spariva: non si poteva piu'
 * rinominare, e soprattutto non si poteva piu' togliere. Una voce che entra e
 * non esce non e' configurabile, e' una trappola.
 *
 * Qui la sua fisarmonica si aggiunge dopo le altre, con le stesse classi e lo
 * stesso cestino — che e' quello del runtime, `edDelAvviso`, perche' sa gia'
 * distinguere una voce aggiunta da una tolta. */
function ensureFloodEditorRows() {
  const body = doc?.getElementById("ed-body");
  // La scheda degli avvisi si riconosce dal suo elenco a tendina dei gruppi.
  if (!body || !doc.getElementById("ed-avv-grp")) return false;
  const entities = syncFloodGroup() || [];
  const esistente = body.querySelector("[data-dm-flood-acc]");
  if (!entities.length) {
    esistente?.remove();
    return false;
  }
  const nomi = readJson("cd_avvisi_names_extra", {}) || {};
  const states = allStates();
  const acc = esistente || doc.createElement("details");
  if (!esistente) {
    acc.className = "ed-acc";
    acc.dataset.dmFloodAcc = "true";
    /* Dopo l'ultima fisarmonica dei gruppi, prima di quella degli avvisi
     * personalizzati: e' il posto che le spetta nell'ordine che c'e' gia'. */
    const gruppi = [...body.querySelectorAll("details.ed-acc")].filter(
      (nodo) => !nodo.dataset.dmFloodAcc,
    );
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo) ultimo.after(acc);
    else body.append(acc);
  }
  const righe = entities
    .map((id) => {
      const nome =
        clean(nomi[id]) || clean(states[id]?.attributes?.friendly_name) || id;
      return (
        `<div class="ed-row" data-dm-flood-row="${esc(id)}">` +
        `<div class="ed-row-main"><div class="ed-row-new">${esc(nome)}</div>` +
        `<div class="ed-row-old mono">${esc(id)}</div></div>` +
        `<div class="ed-del" data-dm-flood-del="${esc(id)}">🗑️</div></div>`
      );
    })
    .join("");
  const markup =
    `<summary class="ed-acc-head">${FLOOD_ICON} ${esc(floodName())} ` +
    `<span class="ed-acc-n">${entities.length}</span></summary>` +
    `<div class="ed-acc-body"><div class="ed-list">${righe}</div></div>`;
  if (acc.innerHTML !== markup) acc.innerHTML = markup;
  return true;
}

/* Il cestino e' quello del runtime: sa gia' distinguere una voce aggiunta
 * dall'utente — che si toglie — da una arrivata da sola, che si segna come
 * tolta perche' non torni al giro dopo. */
function installFloodDeleteHandler() {
  if (state.deleteBound) return false;
  state.deleteBound = true;
  doc?.addEventListener("click", (event) => {
    const cestino = event.target?.closest?.("[data-dm-flood-del]");
    if (!cestino) return;
    event.preventDefault();
    event.stopPropagation();
    const id = clean(cestino.dataset.dmFloodDel);
    if (!id) return;
    root.edDelAvviso?.(FLOOD_GROUP, id);
    syncFloodGroup();
    root.editorSwitch?.("avvisi");
    root.setTimeout?.(() => {
      ensureFloodEditorRows();
      paintFloodCard();
    }, 0);
  });
  return true;
}

export function refreshFloodAlerts() {
  installDetailsWrapper();
  installFloodDeleteHandler();
  ensureGroupOptions();
  ensureFloodEditorRows();
  return paintFloodCard();
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    refreshFloodAlerts();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle(
    "dm-flood-alerts-style",
    `
    /* La card nasce dopo le altre e il quadro la impagina come le sue: qui si
       dice solo come si dispone quando c'e', perche' l'attributo di stile in
       linea che la nasconde lo scrive il conteggio, non il foglio. */
    #glance-grid #glance-${FLOOD_GROUP}[style*="flex"]{display:flex!important}
  `,
  );
}

export function installFloodAlertsSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  refreshFloodAlerts();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, schedule);
  }
  /* Aprire la configurazione ridisegna le tendine: la voce va rimessa, o
   * sparisce appena si cambia scheda. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".ed-tab,.ed-acc-head,[data-tab],[data-page]")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installFloodAlertsSection, { once: true });
else installFloodAlertsSection();
