/* Le altre piscine, nella configurazione.
 *
 * La scheda Piscina chiede i sensori di una vasca sola, perche' una sola ne
 * conosceva la plancia. Chi ne ha due non aveva dove scrivere la seconda.
 *
 * La maschera di sopra resta quella che c'e' sempre stata e continua a
 * configurare la prima vasca: e' il runtime a leggerla da li', ed e' l'unico
 * posto in cui quei campi sono scritti. Qui sotto si aggiungono le altre, che
 * vivono in un elenco accanto alla prima e non le tolgono niente.
 */
import { POOL_DEFAULTS, poolList, storedPools } from "../core/pool-model.js";
import { clean, doc, esc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_POOL_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperta: -1 });

const CAMPI = Object.freeze([
  ["tempEnt", "Temperatura acqua", "Water temperature", "sensor.piscina_temperatura", "entity"],
  ["pumpEnt", "Pompa di filtrazione", "Filtration pump", "switch.pompa_piscina", "entity"],
  ["heatEnt", "Riscaldamento", "Heating", "switch.riscaldamento_piscina", "entity"],
  ["lightEnt", "Luce", "Light", "light.piscina", "entity"],
  ["phEnt", "Sonda pH", "pH probe", "sensor.piscina_ph", "entity"],
  ["clEnt", "Sonda cloro / redox", "Chlorine / redox probe", "sensor.piscina_cloro", "entity"],
  ["phMin", "pH minimo", "Minimum pH", "7.0", "number"],
  ["phMax", "pH massimo", "Maximum pH", "7.6", "number"],
  ["clMin", "Cloro minimo", "Minimum chlorine", "", "number"],
  ["clMax", "Cloro massimo", "Maximum chlorine", "", "number"],
  ["filterHours", "Ore di filtrazione", "Filtration hours", "8", "number"],
  ["filterStart", "Avvio programmato", "Scheduled start", "09:00", "time"],
]);

function poolsStored() {
  try {
    return root.getPool?.() || {};
  } catch (_error) {
    return {};
  }
}

function elenco() {
  return poolList(poolsStored());
}

function salva(list) {
  const previous = poolsStored();
  try {
    // Lo stesso salvataggio che usa la maschera di sopra: due strade per
    // scrivere la stessa chiave vorrebbero dire due padroni.
    root.savePool?.(storedPools(list, previous));
  } catch (_error) {}
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(pool, index) {
  return clean(pool.name) || `${t("Piscina", "Pool")} ${index + 1}`;
}

function campoMarkup(pool, index, [field, italiano, inglese, esempio, kind]) {
  const label = t(italiano, inglese);
  const id = `dm-pool-${index}-${field}`;
  const value = pool[field] === undefined || pool[field] === null ? "" : String(pool[field]);
  const input = `<input id="${id}" class="ed-input mono" data-pool-field="${esc(field)}" type="${kind === "entity" ? "text" : kind}" value="${esc(value)}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false">`;
  const lente =
    kind === "entity"
      ? `<button type="button" class="dm-pool-pick" data-pool-pick="${esc(id)}" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button>`
      : "";
  return `<label class="ed-slot dm-pool-field"><span class="ed-slot-lbl">${esc(label)}</span><span class="ed-form-row">${input}${lente}</span></label>`;
}

function schedaMarkup(pool, index) {
  const aperta = state.aperta === index;
  return `<article class="ed-row dm-pool-row" data-pool-index="${index}" data-open="${aperta}">
    <header class="dm-pool-row-head">
      <span class="dm-pool-row-icon" aria-hidden="true">🏊</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDi(pool, index))}</strong><small class="ed-row-old mono">${esc(clean(pool.pumpEnt) || clean(pool.tempEnt) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-pool-edit" data-pool-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-pool-del" data-pool-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </header>
    <div class="dm-pool-row-body"${aperta ? "" : " hidden"}>
      <label class="ed-slot dm-pool-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-pool-${index}-name" class="ed-input" data-pool-field="name" value="${esc(clean(pool.name))}" placeholder="${t("Piscina piccola", "Small pool")}"></span></label>
      ${CAMPI.map((campo) => campoMarkup(pool, index, campo)).join("")}
      <label class="ed-slot dm-pool-field dm-pool-switch"><input type="checkbox" data-pool-field="autoHours" ${pool.autoHours ? "checked" : ""}><span>${t("Ore automatiche (temperatura / 2)", "Automatic hours (temperature / 2)")}</span></label>
      <label class="ed-slot dm-pool-field dm-pool-switch"><input type="checkbox" data-pool-field="enabled" ${pool.enabled ? "checked" : ""}><span>${t("Avvia la filtrazione all'ora programmata", "Start filtration at the scheduled time")}</span></label>
      <button type="button" class="ed-save-btn" data-pool-save>💾 ${t("Salva piscina", "Save pool")}</button>
    </div>
  </article>`;
}

function panelMarkup(pools) {
  const altre = pools.slice(1);
  return `<div class="ed-sec-title">🏊 ${t("Altre piscine", "Other pools")}</div>
    <div class="ed-intro">${t(
      "La maschera qui sopra configura la prima vasca. Se ne hai piu' di una, aggiungi qui le altre: ognuna ha i suoi sensori, i suoi comandi e la sua filtrazione.",
      "The form above configures the first basin. If you have more than one, add the others here: each one has its own sensors, controls and filtration.",
    )}</div>
    <div class="ed-list dm-pool-list">${
      altre.length
        ? altre.map((pool, index) => schedaMarkup(pool, index + 1)).join("")
        : `<div class="ed-empty">${t("Nessuna altra piscina", "No other pool")}</div>`
    }</div>
    <button type="button" class="ed-btn-add" data-pool-add>＋ ${t("Aggiungi piscina", "Add pool")}</button>`;
}

function leggiScheda(riga, pool) {
  const next = { ...pool };
  for (const input of riga.querySelectorAll("[data-pool-field]")) {
    const field = clean(input.dataset.poolField);
    if (!field) continue;
    if (input.type === "checkbox") next[field] = input.checked;
    else if (input.type === "number") {
      const value = Number.parseFloat(input.value);
      next[field] = Number.isFinite(value) ? value : POOL_DEFAULTS[field];
    } else next[field] = clean(input.value);
  }
  return next;
}

/* Cosa rende diverso un pannello da quello di prima.
 *
 * Ridisegnarlo a ogni occasione vuol dire cancellare il campo che si sta
 * compilando mentre lo si compila: la scheda si ridisegna da sola ogni volta
 * che la configurazione cambia, e chi stava scrivendo l'entita' della pompa se
 * la vedeva sparire. Si ridisegna quando cambia cio' che si vede — quante
 * vasche ci sono, come si chiamano, quale e' aperta — e mai mentre si scrive. */
function firma(pools) {
  return [pools.length, state.aperta, ...pools.map((pool) => `${pool.id}~${clean(pool.name)}`)].join(
    "|",
  );
}

export function ensurePoolEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "pool") return false;
  let panel = body.querySelector("[data-dm-pool-editor]");
  if (!panel) {
    panel = doc.createElement("section");
    panel.className = "ed-form dm-pool-editor";
    panel.dataset.dmPoolEditor = "true";
    body.append(panel);
    panel.addEventListener("click", (event) => onClick(event, panel));
    state.firma = "";
  }
  const pools = elenco();
  const attuale = firma(pools);
  if (panel.dataset.firma !== attuale || !panel.firstElementChild) {
    panel.dataset.firma = attuale;
    panel.innerHTML = panelMarkup(pools);
  }
  return true;
}

/* Il corpo della scheda puo' non esserci ancora quando la scheda viene aperta.
 *
 * Su un telefono appena acceso la configurazione ci mette il suo: la finestra
 * si apre, la scheda si riempie qualche istante dopo, e chi ci ha provato una
 * volta sola resta fuori. Si riprova con calma per qualche secondo, e poi si
 * smette: se dopo quattro secondi la scheda non c'e', non e' un ritardo. */
function schedulePoolEditor() {
  if (ensurePoolEditor()) return;
  for (const delay of [60, 200, 600, 1200, 2400, 4000]) root.setTimeout?.(ensurePoolEditor, delay);
}

/** Ridisegna adesso: e' stato un gesto a cambiare le cose, non un giro a vuoto. */
function ridisegna(panel) {
  panel.dataset.firma = "";
  ensurePoolEditor();
}

function onClick(event, panel) {
  const pools = elenco();
  const add = event.target?.closest?.("[data-pool-add]");
  if (add) {
    event.preventDefault();
    state.aperta = pools.length;
    salva([...pools, { name: "", ...POOL_DEFAULTS }]);
    ridisegna(panel);
    return;
  }
  const pick = event.target?.closest?.("[data-pool-pick]");
  if (pick) {
    event.preventDefault();
    const input = panel.querySelector(`#${CSS.escape(clean(pick.dataset.poolPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const riga = event.target?.closest?.("[data-pool-index]");
  if (!riga) return;
  const index = Number(riga.dataset.poolIndex);
  if (!Number.isFinite(index) || !pools[index]) return;

  if (event.target.closest("[data-pool-edit]")) {
    event.preventDefault();
    state.aperta = state.aperta === index ? -1 : index;
    ridisegna(panel);
    return;
  }
  if (event.target.closest("[data-pool-del]")) {
    event.preventDefault();
    const domanda = t(
      `Elimino "${nomeDi(pools[index], index)}"?`,
      `Remove "${nomeDi(pools[index], index)}"?`,
    );
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperta = -1;
    salva(pools.filter((_pool, position) => position !== index));
    ridisegna(panel);
    return;
  }
  if (event.target.closest("[data-pool-save]")) {
    event.preventDefault();
    const next = pools.slice();
    next[index] = leggiScheda(riga, pools[index]);
    salva(next);
    ridisegna(panel);
    root.edToast?.(t("💾 Piscina salvata", "💾 Pool saved"));
  }
}

function installStyles() {
  installStyle(
    "dm-pool-editor-style",
    `
      .dm-pool-editor{margin-top:16px}
      .dm-pool-editor .dm-pool-list{display:grid;gap:8px;margin-bottom:10px}
      .dm-pool-row{display:block!important;padding:0!important;overflow:hidden}
      .dm-pool-row-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      .dm-pool-row-icon{font-size:18px}
      .dm-pool-row-body{display:grid;gap:8px;padding:0 12px 12px}
      .dm-pool-row-body[hidden]{display:none!important}
      .dm-pool-field{display:grid;gap:4px;margin:0}
      .dm-pool-field .ed-form-row{display:flex;gap:8px;min-width:0}
      .dm-pool-field .ed-form-row>input{flex:1 1 auto;min-width:0}
      .dm-pool-switch{display:flex!important;flex-direction:row;align-items:center;gap:9px}
      .dm-pool-switch input{width:17px;height:17px;flex:0 0 auto}
      .dm-pool-pick{flex:0 0 38px;height:38px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}
    `,
  );
}

export function installPoolEditorSection() {
  if (state.installed || !doc) return;
  state.installed = true;
  installStyles();
  wrapFunction("editorSwitch", "__dmPoolEditor", () => {
    root.queueMicrotask?.(schedulePoolEditor);
  });
  /* La scheda si ridisegna anche da sola — salvare una vasca cambia la
   * configurazione, e chi tiene l'editor allineato al modello rifa' il corpo
   * della scheda: il pannello se ne andava con lui. */
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(schedulePoolEditor);
    });
  /* La scheda puo' essere gia' aperta quando questo modulo si installa: su un
   * telefono lento la configurazione arriva prima di lui, e chi aspetta solo
   * il prossimo cambio di scheda resta fuori per sempre. */
  schedulePoolEditor();
}
