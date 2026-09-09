/* Dove si correggono le macchine e la rete (#382).
 *
 * La scheda sta dentro «🖥️ MiniPC», che è la scheda del server: è lì che uno
 * cerca il computer di casa, e i container di Proxmox girano su quello.
 * Aprirne una tutta sua avrebbe voluto dire chiedere a chi configura di
 * ricordarsi in quale delle due sta la cosa che cerca.
 *
 * Si comincia da una spunta sola. Le classi che Home Assistant usa — «running»
 * per i container di Proxmox, «connectivity» per il router — ce l'hanno anche
 * la lavatrice, la stampante e ogni telefono di casa, e prendere tutto voleva
 * dire una sezione piena di roba d'altri da togliere una per una: «porta in
 * automatico tutte queste entità sotto che non si eliminano e che non c'entrano
 * nulla con quella sezione». Qui si dice invece da QUALI INTEGRAZIONI prenderle
 * — Proxmox VE, FritzBox — e da quel momento un container nuovo entra da solo
 * mentre una lavatrice nuova resta fuori da sola.
 *
 * Il resto serve a correggere: togliere quello che non c'entra anche dentro
 * un'integrazione scelta, aggiungere a mano quello che nessuno ha etichettato,
 * e dare un nome leggibile a «pve_qemu_103».
 */
import {
  CHIAVE_MACCHINE,
  FAMIGLIE,
  candidateDaChiedere,
  integrazioniDaScegliere,
  macchineERete,
  normalizzaMacchine,
} from "../core/macchine-e-rete.js";
import {
  EVENTO_PIATTAFORME,
  piattaformeConosciute,
  scopriLePiattaforme,
} from "./di-chi-e-unentita-section.js";
import {
  EVENTO_CATALOGO,
  caricaCatalogo,
  nomiDelleIntegrazioni,
} from "./appliance-integration-section.js";
import {
  dispositiviDeiServerDichiarati,
  renderMacchine,
  serverPerDispositivo,
} from "./macchine-e-rete-section.js";
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
import { MARCHIO_TESSERA } from "../core/fuori-dai-widget.js";

const KEY = "__DASHBOARDMODERN_MACCHINE_EDITOR__";
const state = (root[KEY] ||= { installed: false, catalogoChiesto: false });

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
      aria-label="${esc(t("Togli dall'elenco", "Drop from the list"))}">🗑️</button>
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

/* Il menù delle integrazioni: una spunta per ognuna, con quanto porterebbe.
 *
 * Il conto sta scritto accanto al nome perché è quello che fa scegliere: fra
 * «Proxmox VE · 12 macchine» e «Shelly · 9 di rete» si capisce al volo quale
 * delle due è il server e quale sono le prese di casa. */
function integrazioniMarkup(states, scelte) {
  const piattaforme = piattaformeConosciute();
  const righe = integrazioniDaScegliere(
    states,
    piattaforme,
    scelte,
    nomiDelleIntegrazioni(),
    dispositiviDeiServerDichiarati(),
  );
  const candidate = candidateDaChiedere(states);
  if (!righe.length)
    return `<div class="dm-macchina-ed-fascia">
      <span class="dm-macchina-ed-fascia-lbl">${esc(t("Da quali integrazioni", "Which integrations"))}</span>
      <div class="ed-empty">${esc(
        candidate.length
          ? t(
              "Sto chiedendo a Home Assistant di chi sono queste entità.",
              "Asking Home Assistant which integration these entities come from.",
            )
          : t(
              "Home Assistant non dichiara nessuna macchina né pezzo di rete.",
              "Home Assistant declares no machine and no network piece.",
            ),
      )}</div>
    </div>`;
  return `<div class="dm-macchina-ed-fascia">
    <span class="dm-macchina-ed-fascia-lbl">${esc(t("Da quali integrazioni", "Which integrations"))}</span>
    ${righe
      .map(
        (riga) => `<label class="dm-macchina-ed-int">
      <input type="checkbox" data-dm-macchina-integrazione="${esc(riga.dominio)}"${riga.scelta ? " checked" : ""}>
      <span class="dm-macchina-ed-int-nome">${esc(riga.nome)}<small class="mono">${esc(riga.dominio)}</small></span>
      <span class="dm-macchina-ed-int-conto">${riga.macchine ? `${esc(FAMIGLIE.macchine.glifo)} ${riga.macchine}` : ""}${
        riga.macchine && riga.rete ? " · " : ""
      }${riga.rete ? `${esc(FAMIGLIE.rete.glifo)} ${riga.rete}` : ""}</span>
    </label>`,
      )
      .join("")}
  </div>`;
}

function schedaMarkup() {
  const scelte = configurazione();
  const states = allStates();
  const elenchi = macchineERete(
    states,
    { ...scelte, escluse: [] },
    (entity) => nomeDaHomeAssistant(entity, states),
    piattaformeConosciute(),
    serverPerDispositivo(states, scelte),
  );
  const senzaEscluse = (righe) => righe.filter((riga) => !scelte.escluse.includes(riga.entity));
  return `<div class="ed-slot-lbl dm-macchina-ed-titolo">${esc(t("Macchine e rete", "Machines and network"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Le VM e i container di Proxmox sono i sensori «running», il router e i suoi ripetitori quelli «connectivity» — ma le stesse etichette ce l'hanno anche la lavatrice, la stampante e ogni telefono di casa. Perciò si sceglie da quali integrazioni prenderle: spuntata quella giusta, un container nuovo entra da solo e una lavatrice nuova resta fuori da sola. Poi da qui si corregge: si toglie quello che non c'entra, si aggiunge quello che nessuno ha etichettato, e si dà un nome a «pve_qemu_103».",
      "Proxmox VMs and containers are the “running” sensors, the router and its repeaters the “connectivity” ones — but the washing machine, the printer and every phone in the house carry the same labels. So you choose which integrations they come from: with the right one ticked, a new container joins by itself and a new washing machine stays out by itself. Then you correct here: drop what does not belong, add what nobody labelled, and give a name to “pve_qemu_103”.",
    ),
  )}</div>
  ${integrazioniMarkup(states, scelte)}
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
      ? `<details class="dm-macchina-ed-piega">
          <summary>${esc(t("Tolte a mano", "Dropped by hand"))} · ${esc(String(scelte.escluse.length))}</summary>
          <div class="dm-macchina-ed-fuori">${scelte.escluse
            .map(
              (entity) =>
                `<span class="dm-macchina-ed-tolta">${esc(entity)}<button type="button" class="ed-del" data-dm-macchina-riprendi="${esc(entity)}" title="${esc(t("Rimetti nell'elenco", "Put back in the list"))}" aria-label="${esc(t("Rimetti nell'elenco", "Put back in the list"))}">↩</button></span>`,
            )
            .join("")}</div>
        </details>`
      : ""
  }`;
}

/* Aprendo la scheda si chiedono le due cose che servono a disegnarla e che non
 * stanno negli stati: di chi sono i candidati, e come si chiamano le
 * integrazioni. Nessuna delle due si aspetta — arrivando si annunciano, e la
 * scheda si ridisegna da sé.
 *
 * Il catalogo si chiede una volta per sessione e non a ogni ridisegno: chi
 * risponde vuoto — una casa senza integrazioni, un socket chiuso — farebbe
 * ridisegnare, e il ridisegno richiederebbe, e si girerebbe a vuoto per
 * sempre. Il nome dell'integrazione è un lusso: senza, si legge il dominio. */
function chiediQuelloCheManca() {
  const candidate = candidateDaChiedere(allStates());
  if (candidate.length) scopriLePiattaforme(candidate);
  if (state.catalogoChiesto) return;
  state.catalogoChiesto = true;
  caricaCatalogo().catch(() => {});
}

export function ensureMacchineEditor() {
  const body = doc?.getElementById?.("ed-body");
  if (!body || !nellaSchedaServer()) {
    doc?.getElementById?.(ANCORA)?.remove();
    return false;
  }
  if (doc.getElementById(ANCORA)) return false;
  chiediQuelloCheManca();
  const casella = doc.createElement("div");
  casella.id = ANCORA;
  /* La scheda sta dentro il MiniPC e la tessera in Home e' quella delle
   * macchine: chi mette un'entita' fuori dai widget da qui parla di questa,
   * non del MiniPC. */
  casella.setAttribute(MARCHIO_TESSERA, "macchine");
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

  const integrazione = event.target.closest("[data-dm-macchina-integrazione]");
  if (integrazione) {
    const dominio = clean(integrazione.dataset.dmMacchinaIntegrazione);
    if (!dominio) return;
    const prese = new Set(scelte.integrazioni);
    if (integrazione.checked) prese.add(dominio);
    else prese.delete(dominio);
    salva({ ...scelte, integrazioni: [...prese] });
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
    #ed-body .dm-macchina-ed-int{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;
      gap:10px;padding:8px 10px;border-radius:12px;cursor:pointer;
      background:var(--secondary-background-color,#f1f5f9)}
    #ed-body .dm-macchina-ed-int input{width:18px;height:18px;margin:0}
    #ed-body .dm-macchina-ed-int-nome{display:grid;gap:1px;min-width:0;font-size:13px;font-weight:800}
    #ed-body .dm-macchina-ed-int-nome small{font-size:10px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #ed-body .dm-macchina-ed-int-conto{font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b);white-space:nowrap}
    #ed-body .dm-macchina-ed-piega summary{font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b);cursor:pointer}
    #ed-body .dm-macchina-ed-piega .dm-macchina-ed-fuori{margin-top:8px}
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
  /* Il registro ha detto di chi sono, o il catalogo come si chiamano: in tutti
   * e due i casi il menù delle integrazioni ha qualcosa in più da scrivere. */
  for (const evento of [EVENTO_PIATTAFORME, EVENTO_CATALOGO])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ridisegna));
  ensureMacchineEditor();
  return true;
}

installMacchineEditor();
