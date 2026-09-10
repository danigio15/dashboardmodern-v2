/* Dove si dichiarano gli altri nodi del cluster (#470).
 *
 * «Sarebbe utile poter configurare più di un mini pc in modo da monitorare più
 * nodi, comodo per chi ha, ad esempio, un cluster proxmox.»
 *
 * La scheda sta dentro «🖥️ MiniPC», che è la scheda del server: è lì che uno
 * va a cercare il ferro, ed è lì che ci sono già le macchine e la rete. Il
 * computer su cui gira Home Assistant ha la sua scheda grande e le sue caselle
 * di sempre: questi sono gli ALTRI, e per ognuno si indicano un nome e cinque
 * entità, tutte facoltative.
 *
 * Facoltative sul serio: Proxmox VE pubblica lo stato e tre percentuali,
 * Glances aggiunge i gradi, un ping dà solo il su e giù. Una casella vuota è
 * una barra che non compare, non un errore.
 */
import {
  CAMPI_DEL_NODO,
  CHIAVE_NODI,
  NODI_MASSIMI,
  bindNodoToDevice,
  normalizzaNodi,
} from "../core/nodi-del-cluster.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import { renderNodi } from "./nodi-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_NODI_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

const ANCORA = "dm-nodi-editor";

function elenco() {
  const salvato = readJson(CHIAVE_NODI, []);
  return Array.isArray(salvato) ? salvato : [];
}

function salva(lista) {
  writeJsonIfChanged(CHIAVE_NODI, normalizzaNodi(lista));
  renderNodi();
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
}

/** Se siamo nella scheda del server: è quella che porta le caselle del MiniPC. */
function nellaSchedaServer() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab) === "sez6";
}

function ridisegna() {
  doc?.getElementById?.(ANCORA)?.remove();
  ensureNodiEditor();
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

const ETICHETTE = () => ({
  stato: [t("Stato del nodo", "Node status"), "binary_sensor.pve2_status"],
  cpu: [t("Processore", "CPU"), "sensor.pve2_cpu_used"],
  ram: [t("Memoria", "Memory"), "sensor.pve2_memory_used_percentage"],
  disco: [t("Disco", "Disk"), "sensor.pve2_disk_used_percentage"],
  temperatura: [t("Temperatura", "Temperature"), "sensor.pve2_temperatura"],
});

function campoMarkup(indice, campo, valore) {
  const [etichetta, esempio] = ETICHETTE()[campo];
  const id = `dm-nodo-${indice}-${campo}`;
  return `<label class="ed-slot dm-nodo-ed-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-dm-nodo-campo="${esc(campo)}" value="${esc(valore)}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-nodo-pick="${esc(id)}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

function rigaMarkup(nodo, indice) {
  const aperto = state.aperto === indice;
  const quante = CAMPI_DEL_NODO.filter((campo) => clean(nodo?.[campo])).length;
  return `<article class="ed-row dm-nodo-ed-riga" data-dm-nodo-indice="${indice}" data-open="${aperto}">
    <div class="dm-nodo-ed-head">
      <span class="dm-nodo-ed-ic" aria-hidden="true">🖥️</span>
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(clean(nodo?.nome) || t("Nodo nuovo", "New node"))}</strong>
        <small class="ed-row-old mono">${esc(clean(nodo?.stato) || `${quante}/${CAMPI_DEL_NODO.length}`)}</small>
      </span>
      <button type="button" class="ed-del" data-dm-nodo-apri aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del" data-dm-nodo-togli aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-nodo-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-nodo-ed-campo"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span>
        <span class="ed-form-row"><input class="ed-input" data-dm-nodo-campo="nome" value="${esc(clean(nodo?.nome))}" placeholder="pve2"></span></label>
      ${CAMPI_DEL_NODO.map((campo) => campoMarkup(indice, campo, clean(nodo?.[campo]))).join("")}
      <button type="button" class="ed-save-btn" data-dm-nodo-salva>💾 ${esc(t("Salva nodo", "Save node"))}</button>
    </div>
  </article>`;
}

function schedaMarkup() {
  const lista = elenco();
  return `<div class="ed-sec-title">🖧 ${esc(t("Altri nodi del cluster", "Other cluster nodes"))}</div>
    <div class="ed-intro">${esc(
      t(
        "La scheda grande in cima alla pagina Server è il computer su cui gira Home Assistant. Questi sono gli altri nodi: uno per riga, con il nome che gli dai e le entità che vuoi vedere. Le caselle sono tutte facoltative — Proxmox VE pubblica lo stato e le tre percentuali, Glances aggiunge i gradi, un ping dà solo il su e giù — e una casella vuota è una barra che non compare.",
        "The big card at the top of the Server page is the computer Home Assistant runs on. These are the other nodes: one per row, with the name you give it and the entities you want to see. Every field is optional — Proxmox VE publishes the status and the three percentages, Glances adds the degrees, a ping gives only up and down — and an empty field is a bar that does not show up.",
      ),
    )}</div>
    <div class="ed-list dm-nodi-ed-list">${
      lista.length
        ? lista.map((nodo, indice) => rigaMarkup(nodo, indice)).join("")
        : `<div class="ed-empty">${esc(t("Nessun altro nodo", "No other node"))}</div>`
    }</div>
    <div class="dm-nodi-ed-invito">
      <button type="button" class="ed-btn-add dm-nodi-ed-integ" data-dm-nodo-integ>🔗 ${esc(
        t("Aggiungi da un'integrazione", "Add from an integration"),
      )}</button>
      <small>${esc(
        t(
          "Proxmox VE, Glances, System Monitor… scegli il dispositivo del nodo e le caselle si compilano da sole: lo stato, il processore, la memoria, il disco e i gradi, quelli che quell'integrazione pubblica.",
          "Proxmox VE, Glances, System Monitor… pick the node's device and the fields fill themselves in: status, CPU, memory, disk and degrees — whichever that integration publishes.",
        ),
      )}</small>
    </div>
    <button type="button" class="ed-btn-add" data-dm-nodo-aggiungi${
      lista.length >= NODI_MASSIMI ? " disabled" : ""
    }>＋ ${esc(t("Aggiungi nodo", "Add node"))}</button>`;
}

export function ensureNodiEditor() {
  const body = doc?.getElementById?.("ed-body");
  if (!body || !nellaSchedaServer()) {
    doc?.getElementById?.(ANCORA)?.remove();
    return false;
  }
  if (doc.getElementById(ANCORA)) return false;
  const casella = doc.createElement("div");
  casella.id = ANCORA;
  casella.innerHTML = schedaMarkup();
  body.append(casella);
  return true;
}

/* ── i gesti ─────────────────────────────────────────────────────────────── */

function leggiLaRiga(riga, nodo) {
  const letto = { ...(nodo || {}) };
  for (const campo of riga.querySelectorAll("[data-dm-nodo-campo]"))
    letto[clean(campo.dataset.dmNodoCampo)] = clean(campo.value);
  return letto;
}

/* Cosa il dispositivo ha lasciato capire, prima di confermare. */
function anteprimaNodo({ device, entities }) {
  const nato = bindNodoToDevice({ device, entities, states: allStates() });
  const etichette = ETICHETTE();
  const casella = (campo) =>
    `<div class="dm-integ-casella"><span>${esc(etichette[campo][0])}</span><b class="mono">${esc(nato[campo]) || "—"}</b></div>`;
  return {
    etichetta: t("Nodo", "Node"),
    corpo: `<div class="dm-integ-caselle">${CAMPI_DEL_NODO.map(casella).join("")}</div>`,
  };
}

function creaDaDispositivo({ device, entities, integration }) {
  const lista = elenco();
  if (lista.length >= NODI_MASSIMI) {
    /* Il numero sta nella frase per esteso, non interpolato: una chiave
     * costruita con un valore dentro cambia col valore, e nessuna di quelle
     * chiavi sta nei tredici cataloghi. */
    root.alert?.(
      t(
        "La pagina tiene otto nodi, e ci sono tutti: togline uno per farci stare questo.",
        "The page holds eight nodes and they are all taken: remove one to make room.",
      ),
    );
    return;
  }
  const nato = bindNodoToDevice({
    device,
    entities,
    states: allStates(),
    indice: lista.length,
  });
  /* Un dispositivo che non porta nessuna delle cinque non è un nodo: la
   * finestra mostra TUTTI i dispositivi, e da lì può arrivare una lampadina. */
  if (!CAMPI_DEL_NODO.some((campo) => clean(nato[campo]))) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce nessun nodo: servono almeno uno stato o una percentuale di carico.",
        "No node can be recognised from this device: at least a status or a load percentage is needed.",
      ),
    );
    return;
  }
  state.aperto = lista.length;
  salva([...lista, nato]);
  ridisegna();
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${nato.nome || device.name} — ${t("aggiunto da", "added from")} ${daChi}`);
}

function onClick(event) {
  const dentro = event.target?.closest?.(`#${ANCORA}`);
  if (!dentro) return;
  const lista = elenco();

  if (event.target.closest("[data-dm-nodo-integ]")) {
    event.preventDefault();
    apriMenuIntegrazioni({
      titolo: t("Aggiungi un nodo da un'integrazione", "Add a node from an integration"),
      intro: t(
        "Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli il nodo: lo stato, il processore, la memoria, il disco e i gradi entrano da soli.",
        "Home Assistant integrations, official or from HACS, with the devices they bring. Pick the node: status, CPU, memory, disk and degrees come along by themselves.",
      ),
      anteprima: anteprimaNodo,
      onScelto: (scelta) => creaDaDispositivo(scelta),
    });
    return;
  }

  if (event.target.closest("[data-dm-nodo-aggiungi]")) {
    event.preventDefault();
    if (lista.length >= NODI_MASSIMI) return;
    state.aperto = lista.length;
    salva([...lista, { id: `nodo-${Date.now().toString(36)}`, nome: "" }]);
    ridisegna();
    return;
  }

  const lente = event.target.closest("[data-dm-nodo-pick]");
  if (lente) {
    event.preventDefault();
    const campo = doc.getElementById(clean(lente.dataset.dmNodoPick));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  const riga = event.target.closest("[data-dm-nodo-indice]");
  if (!riga) return;
  const indice = Number(riga.dataset.dmNodoIndice);
  if (!Number.isFinite(indice) || !lista[indice]) return;

  if (event.target.closest("[data-dm-nodo-apri]")) {
    event.preventDefault();
    /* Quello che è nelle caselle si mette al sicuro prima di ridisegnare: la
     * matita di un'altra riga rifà l'elenco, e senza questo il nome appena
     * battuto se ne andrebbe in silenzio (#439). */
    const prossima = lista.slice();
    prossima[indice] = leggiLaRiga(riga, lista[indice]);
    state.aperto = state.aperto === indice ? -1 : indice;
    salva(prossima);
    ridisegna();
    return;
  }

  if (event.target.closest("[data-dm-nodo-togli]")) {
    event.preventDefault();
    state.aperto = -1;
    salva(lista.filter((_nodo, posizione) => posizione !== indice));
    ridisegna();
    return;
  }

  if (event.target.closest("[data-dm-nodo-salva]")) {
    event.preventDefault();
    const prossima = lista.slice();
    prossima[indice] = leggiLaRiga(riga, lista[indice]);
    salva(prossima);
    ridisegna();
    root.edToast?.(t("💾 Nodo salvato", "💾 Node saved"));
  }
}

function installaStile() {
  installStyle(
    "dm-nodi-editor-style",
    `
      #${ANCORA} .dm-nodi-ed-list{display:grid;gap:8px;margin-bottom:10px}
      #${ANCORA} .dm-nodo-ed-riga{display:block!important;padding:0!important;overflow:hidden}
      #${ANCORA} .dm-nodo-ed-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      #${ANCORA} .dm-nodo-ed-ic{font-size:18px}
      #${ANCORA} .dm-nodo-ed-body{display:grid;gap:8px;padding:0 12px 12px}
      #${ANCORA} .dm-nodo-ed-body[hidden]{display:none!important}
      #${ANCORA} .dm-nodo-ed-campo{display:grid;gap:4px;margin:0}
      #${ANCORA} .dm-nodo-ed-campo .ed-form-row{display:flex;gap:8px;min-width:0}
      #${ANCORA} .dm-nodo-ed-campo .ed-form-row>input{flex:1 1 auto;min-width:0}
      #${ANCORA} .dm-nodi-ed-invito{
        display:grid;gap:6px;margin:0 0 12px;padding:12px;border-radius:14px;
        border:1px dashed color-mix(in srgb,#0ea5e9 45%,transparent);
        background:color-mix(in srgb,#0ea5e9 7%,transparent)}
      #${ANCORA} .dm-nodi-ed-invito .dm-nodi-ed-integ{
        margin:0!important;background:linear-gradient(135deg,#0369a1,#075985)!important;color:#fff!important}
      #${ANCORA} .dm-nodi-ed-invito small{
        font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
    `,
  );
}

export function installNodiEditor() {
  if (!doc || state.installed) return;
  state.installed = true;
  installaStile();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmNodiEditor", () => root.queueMicrotask?.(ensureNodiEditor));
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureNodiEditor));
  ensureNodiEditor();
}
