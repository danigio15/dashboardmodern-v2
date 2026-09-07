/* Dove si correggono le macchine e la rete (#382).
 *
 * La scheda sta dentro «🖥️ MiniPC», che è la scheda del server: è lì che uno
 * cerca il computer di casa, e i container di Proxmox girano su quello.
 * Aprirne una tutta sua avrebbe voluto dire chiedere a chi configura di
 * ricordarsi in quale delle due sta la cosa che cerca.
 *
 * Non c'è niente da compilare per cominciare: le macchine sono i
 * `binary_sensor` con `device_class: running` che mette l'integrazione Proxmox,
 * la rete sono quelli con `device_class: connectivity` che mette il FritzBox.
 * Qui si toglie quello che non c'entra, si aggiunge quello che nessuno ha
 * etichettato, e si dà un nome leggibile a «pve_qemu_103».
 */
import {
  CHIAVE_MACCHINE,
  FAMIGLIE,
  macchineERete,
  normalizzaMacchine,
} from "../core/macchine-e-rete.js";
import { renderMacchine } from "./macchine-e-rete-section.js";
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
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_MACCHINE_EDITOR__";
const state = (root[KEY] ||= { installed: false });

const ANCORA = "dm-macchine-ed";

function configurazione() {
  return normalizzaMacchine(readJson(CHIAVE_MACCHINE, {}));
}

function salva(prossima) {
  writeJsonIfChanged(CHIAVE_MACCHINE, prossima);
  renderMacchine();
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
  ridisegna();
}

/** Se siamo nella scheda del server: è quella che porta le caselle del MiniPC. */
function nellaSchedaServer() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab) === "sez6";
}

function ridisegna() {
  doc?.getElementById?.(ANCORA)?.remove();
  ensureMacchineEditor();
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function nomeDellaFamiglia(famiglia) {
  return famiglia === "rete"
    ? t("Rete", "Network")
    : t("Macchine e container", "Machines and containers");
}

function rigaMarkup(riga, scelte) {
  const aggiunta = Boolean(scelte.aggiunte[riga.entity]);
  return `<article class="ed-row dm-macchina-ed-riga" data-stato="${esc(riga.stato || "muto")}">
    <span class="dm-macchina-ed-ic" aria-hidden="true">${esc(riga.glifo)}</span>
    <div class="ed-row-main dm-macchina-ed-testo">
      <input class="ed-input dm-macchina-ed-nome" value="${esc(riga.name)}"
        data-dm-macchina-nome="${esc(riga.entity)}" aria-label="${esc(t("Nome", "Name"))}">
      <small class="ed-row-old mono">${esc(riga.entity)}${aggiunta ? ` · ${esc(t("aggiunto a mano", "added by hand"))}` : ""}${
        riga.comandi ? ` · ${esc(t("si comanda", "can be controlled"))}` : ""
      }</small>
    </div>
    <button type="button" class="ed-del" data-dm-macchina-escludi="${esc(riga.entity)}"
      title="${esc(t("Togli dall'elenco", "Drop from the list"))}"
      aria-label="${esc(t("Togli dall'elenco", "Drop from the list"))}">🚫</button>
  </article>`;
}

function elencoMarkup(famiglia, righe, scelte) {
  return `<div class="dm-macchina-ed-fascia">
    <span class="dm-macchina-ed-fascia-lbl">${esc(nomeDellaFamiglia(famiglia))}</span>
    ${
      righe.length
        ? righe.map((riga) => rigaMarkup(riga, scelte)).join("")
        : `<div class="ed-empty">${esc(t("Niente trovato", "Nothing found"))}</div>`
    }
  </div>`;
}

function schedaMarkup() {
  const scelte = configurazione();
  const states = allStates();
  const elenchi = macchineERete(states, { ...scelte, escluse: [] }, (entity) =>
    nomeDaHomeAssistant(entity, states),
  );
  const senzaEscluse = (righe) => righe.filter((riga) => !scelte.escluse.includes(riga.entity));
  return `<div class="ed-slot-lbl dm-macchina-ed-titolo">${esc(t("Macchine e rete", "Machines and network"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Le macchine del server e i pezzi della rete li dichiara Home Assistant da sé: le VM e i container di Proxmox sono i sensori «running», il router e i suoi ripetitori quelli «connectivity». Compaiono nella pagina Server senza configurare niente, e da qui si corregge: si toglie quello che non c'entra, si aggiunge quello che nessuno ha etichettato, e si dà un nome a «pve_qemu_103».",
      "Home Assistant declares the server's machines and the network's pieces itself: Proxmox VMs and containers are the “running” sensors, the router and its repeaters the “connectivity” ones. They appear on the Server page with nothing to configure, and here you correct that: drop what does not belong, add what nobody labelled, and give a name to “pve_qemu_103”.",
    ),
  )}</div>
  <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Aggiungi quello che non viene trovato", "Add what is not found"))}</span>
    <span class="ed-form-row"><input id="dm-macchina-aggiungi" class="ed-input mono" placeholder="binary_sensor.pve_lxc_101_status"
      autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
      data-dm-macchina-pick="dm-macchina-aggiungi" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    <span class="ed-form-row"><select id="dm-macchina-famiglia" class="ed-input">${Object.keys(FAMIGLIE)
      .map(
        (famiglia) =>
          `<option value="${esc(famiglia)}">${esc(FAMIGLIE[famiglia].glifo)} ${esc(nomeDellaFamiglia(famiglia))}</option>`,
      )
      .join("")}</select>
      <button type="button" class="ed-btn-add" data-dm-macchina-aggiungi>${esc(t("Aggiungi", "Add"))}</button></span>
  </label>
  ${elencoMarkup("macchine", senzaEscluse(elenchi.macchine), scelte)}
  ${elencoMarkup("rete", senzaEscluse(elenchi.rete), scelte)}
  ${
    scelte.escluse.length
      ? `<div class="dm-macchina-ed-fuori">${scelte.escluse
          .map(
            (entity) =>
              `<span class="dm-macchina-ed-tolta">${esc(entity)}<button type="button" class="ed-del" data-dm-macchina-riprendi="${esc(entity)}" aria-label="${esc(t("Rimetti", "Put back"))}">✕</button></span>`,
          )
          .join("")}</div>`
      : ""
  }`;
}

export function ensureMacchineEditor() {
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

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(event) {
  const dentro = event.target?.closest?.(`#${ANCORA}`);
  if (!dentro) return;
  const scelte = configurazione();

  const lente = event.target.closest("[data-dm-macchina-pick]");
  if (lente) {
    event.preventDefault();
    const campo = doc.getElementById(clean(lente.dataset.dmMacchinaPick));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  if (event.target.closest("[data-dm-macchina-aggiungi]")) {
    event.preventDefault();
    const entity = clean(doc.getElementById("dm-macchina-aggiungi")?.value);
    const famiglia = clean(doc.getElementById("dm-macchina-famiglia")?.value) || "macchine";
    if (!entity.includes(".") || !FAMIGLIE[famiglia]) return;
    salva({
      ...scelte,
      aggiunte: { ...scelte.aggiunte, [entity]: famiglia },
      escluse: scelte.escluse.filter((voce) => voce !== entity),
    });
    root.edToast?.(t("🖥️ Aggiunta all'elenco", "🖥️ Added to the list"));
    return;
  }

  const togli = event.target.closest("[data-dm-macchina-escludi]");
  if (togli) {
    event.preventDefault();
    const entity = clean(togli.dataset.dmMacchinaEscludi);
    const aggiunte = { ...scelte.aggiunte };
    delete aggiunte[entity];
    salva({ ...scelte, aggiunte, escluse: [...new Set([...scelte.escluse, entity])] });
    return;
  }

  const rimetti = event.target.closest("[data-dm-macchina-riprendi]");
  if (rimetti) {
    event.preventDefault();
    const entity = clean(rimetti.dataset.dmMacchinaRiprendi);
    salva({ ...scelte, escluse: scelte.escluse.filter((voce) => voce !== entity) });
  }
}

/* Il nome si salva mentre lo si scrive, e la scheda NON si ridisegna: un
 * ridisegno a ogni lettera porterebbe via il cursore dalla casella. */
function onInput(event) {
  const campo = event.target?.closest?.("[data-dm-macchina-nome]");
  if (!campo) return;
  const entity = clean(campo.dataset.dmMacchinaNome);
  if (!entity) return;
  const scelte = configurazione();
  const nomi = { ...scelte.nomi };
  const scritto = clean(campo.value);
  if (scritto) nomi[entity] = scritto;
  else delete nomi[entity];
  writeJsonIfChanged(CHIAVE_MACCHINE, { ...scelte, nomi });
  renderMacchine();
}

export function installMacchineEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(
    "dm-macchine-editor-style",
    `
    #ed-body #${ANCORA}{display:grid;gap:10px;margin-top:14px}
    #ed-body .dm-macchina-ed-fascia{display:grid;gap:8px;padding:10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:14px}
    #ed-body .dm-macchina-ed-fascia-lbl{font-size:10.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #ed-body .dm-macchina-ed-riga{display:grid!important;grid-template-columns:36px minmax(0,1fr) 36px!important;align-items:center!important;gap:10px!important;border-left:4px solid var(--dm-macchina,#94a3b8)!important}
    #ed-body .dm-macchina-ed-riga[data-stato="su"]{--dm-macchina:#16a34a}
    #ed-body .dm-macchina-ed-riga[data-stato="giu"]{--dm-macchina:#dc2626}
    #ed-body .dm-macchina-ed-riga[data-stato="muto"]{--dm-macchina:#94a3b8}
    #ed-body .dm-macchina-ed-ic{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;font-size:16px;background:color-mix(in srgb,var(--dm-macchina,#94a3b8) 20%,transparent)}
    #ed-body .dm-macchina-ed-testo{display:grid;gap:4px;min-width:0}
    #ed-body .dm-macchina-ed-nome{width:100%;min-width:0}
    #ed-body .dm-macchina-ed-fuori{display:flex;flex-wrap:wrap;gap:8px}
    #ed-body .dm-macchina-ed-tolta{display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 12px;border-radius:999px;font-size:11.5px;font-weight:800;font-family:ui-monospace,monospace;background:var(--secondary-background-color,#eef2f7);color:var(--text,#0f172a)}
    `,
  );
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  onEditorRedraw("__dmMacchineEditor", () => root.queueMicrotask?.(ensureMacchineEditor));
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureMacchineEditor));
  ensureMacchineEditor();
  return true;
}

installMacchineEditor();
