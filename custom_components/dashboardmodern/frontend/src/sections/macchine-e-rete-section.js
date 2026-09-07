/* Le macchine del server e la rete di casa, nella pagina Server (#382).
 *
 * «Volevo chiedere se si può aggiungere i controlli del server proxmox dove
 * gira HA con tutti i suoi container e controllare lo stato del fritbox e i
 * suoi ripeter.»
 *
 * Non è una pagina nuova: è la pagina che c'è già. Il MiniPC Server racconta la
 * macchina su cui gira Home Assistant — CPU, RAM, disco — e i container di
 * Proxmox sono quello che ci gira dentro; il router e i suoi ripetitori sono il
 * filo che tiene su tutto il resto. Inventare due pagine avrebbe voluto dire
 * chiedere a chi guarda di ricordarsi in quale delle tre sta la cosa che
 * cerca.
 *
 * Due fasce, sotto le caselle del MiniPC: le macchine e la rete. Ogni riga dice
 * come sta — verde su, rossa giù, smorta quella che non risponde — e le
 * macchine che Home Assistant sa accendere e spegnere portano il loro tasto. Il
 * tasto c'è solo dove c'è davvero qualcosa da premere: il modello lo dice
 * guardando gli stati, non indovinando.
 */
import {
  CHIAVE_MACCHINE,
  contoDelleMacchine,
  macchineConfigurate,
  macchineERete,
} from "../core/macchine-e-rete.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_MACCHINE__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const SERVER_PAGE_ID = "page-server";
const FASCE_ID = "dm-macchine-fasce";

function configurazione() {
  return readJson(CHIAVE_MACCHINE, {});
}

/** I due elenchi, letti adesso. */
export function macchineInPlancia() {
  const states = allStates();
  return macchineERete(states, configurazione(), (entity) =>
    nomeDaHomeAssistant(entity, states),
  );
}

/** Se c'è qualcosa da mostrare. */
export function ciSonoMacchine() {
  return macchineConfigurate(allStates(), configurazione());
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function parolaDelloStato(riga) {
  if (riga.stato === "su") return riga.famiglia === "rete" ? t("Connesso", "Connected") : t("Acceso", "Running");
  if (riga.stato === "giu") return riga.famiglia === "rete" ? t("Assente", "Down") : t("Fermo", "Stopped");
  return t("Non risponde", "Not answering");
}

/* I tasti di una macchina, quando Home Assistant offre di che premerli. Un
 * interruttore ne vuole uno solo, che accende o spegne secondo com'è adesso;
 * due pulsanti restano due, perché avviare e fermare sono due gesti. */
function comandiMarkup(riga) {
  const comandi = riga.comandi;
  if (!comandi) return "";
  if (comandi.tipo === "switch") {
    const spegni = riga.stato === "su";
    return `<button type="button" class="dm-macchina-tasto" data-dm-macchina-switch="${esc(comandi.entity)}"
      data-dm-macchina-verso="${spegni ? "off" : "on"}">${esc(spegni ? t("Ferma", "Stop") : t("Avvia", "Start"))}</button>`;
  }
  return `<span class="dm-macchina-tasti">
    <button type="button" class="dm-macchina-tasto" data-dm-macchina-premi="${esc(comandi.avvia)}">${esc(t("Avvia", "Start"))}</button>
    <button type="button" class="dm-macchina-tasto dm-macchina-tasto-ferma" data-dm-macchina-premi="${esc(comandi.ferma)}">${esc(t("Ferma", "Stop"))}</button>
  </span>`;
}

function rigaMarkup(riga) {
  return `<article class="dm-macchina" data-stato="${esc(riga.stato || "muto")}">
    <span class="dm-macchina-ic" aria-hidden="true">${esc(riga.glifo)}</span>
    <div class="dm-macchina-testo">
      <strong>${esc(riga.name)}</strong>
      <small class="mono">${esc(riga.entity)}</small>
    </div>
    <b class="dm-macchina-stato">${esc(parolaDelloStato(riga))}</b>
    ${comandiMarkup(riga)}
  </article>`;
}

function fasciaMarkup(titolo, righe) {
  if (!righe.length) return "";
  const conto = contoDelleMacchine(righe);
  const sotto = conto.giu
    ? conto.fermi.join(" · ")
    : t(`Tutte in piedi · ${conto.su}`, `All up · ${conto.su}`);
  return `<section class="dm-macchine-fascia" data-giu="${conto.giu > 0}">
    <header class="dm-macchine-testa">
      <strong>${esc(titolo)}</strong>
      <span>${esc(sotto)}</span>
    </header>
    <div class="dm-macchine-elenco">${righe.map(rigaMarkup).join("")}</div>
  </section>`;
}

function ensureFasce() {
  const pagina = doc?.getElementById(SERVER_PAGE_ID);
  if (!pagina) return null;
  let dove = pagina.querySelector(`#${FASCE_ID}`);
  if (dove) return dove;
  dove = doc.createElement("div");
  dove.id = FASCE_ID;
  dove.className = "dm-macchine-wrap";
  pagina.append(dove);
  return dove;
}

function dipingi() {
  const dove = ensureFasce();
  if (!dove) return;
  if (!paginaVisibile(SERVER_PAGE_ID)) return;
  const elenchi = macchineInPlancia();
  const firma = JSON.stringify([elenchi, t("Acceso", "Running")]);
  if (state.firma === firma) return;
  state.firma = firma;
  dove.innerHTML = `${fasciaMarkup(t("Macchine e container", "Machines and containers"), elenchi.macchine)}
    ${fasciaMarkup(t("Rete", "Network"), elenchi.rete)}`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] macchine", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderMacchine() {
  state.firma = "";
  schedule();
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function chiama(dominio, servizio, dati) {
  try {
    if (typeof root.dmCallHaService === "function") return root.dmCallHaService(dominio, servizio, dati);
    if (typeof root.cdCallServiceJson === "function")
      return root.cdCallServiceJson(dominio, servizio, dati);
  } catch (error) {
    root.console?.warn?.("[DashboardModern] macchine", error);
  }
  return null;
}

function onClick(event) {
  const interruttore = event.target?.closest?.("[data-dm-macchina-switch]");
  if (interruttore) {
    event.preventDefault();
    const entity = clean(interruttore.dataset.dmMacchinaSwitch);
    const verso = clean(interruttore.dataset.dmMacchinaVerso) === "off" ? "turn_off" : "turn_on";
    chiama("switch", verso, { entity_id: entity });
    root.setTimeout?.(renderMacchine, 800);
    return;
  }
  const pulsante = event.target?.closest?.("[data-dm-macchina-premi]");
  if (pulsante) {
    event.preventDefault();
    chiama("button", "press", { entity_id: clean(pulsante.dataset.dmMacchinaPremi) });
    root.setTimeout?.(renderMacchine, 800);
  }
}

function installStyles() {
  const P = `#${SERVER_PAGE_ID}`;
  installStyle(
    "dm-macchine-section-style",
    `
    ${P} .dm-macchine-wrap{display:grid;gap:14px;padding:14px 0 24px}
    ${P} .dm-macchine-fascia{display:grid;gap:10px}
    ${P} .dm-macchine-testa{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}
    ${P} .dm-macchine-testa strong{font-size:14px;font-weight:900;letter-spacing:.04em;
      text-transform:uppercase;color:var(--text,#0f172a)}
    ${P} .dm-macchine-testa span{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    ${P} .dm-macchine-fascia[data-giu="true"] .dm-macchine-testa span{color:#dc2626}
    ${P} .dm-macchine-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}

    ${P} .dm-macchina{
      display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:10px;
      padding:12px 14px;border-radius:16px;
      border:1px solid color-mix(in srgb,var(--dm-macchina,#94a3b8) 40%,transparent);
      background:color-mix(in srgb,var(--dm-macchina,#94a3b8) 9%,var(--card-bg,#fff))}
    ${P} .dm-macchina[data-stato="su"]{--dm-macchina:#16a34a}
    ${P} .dm-macchina[data-stato="giu"]{--dm-macchina:#dc2626}
    ${P} .dm-macchina[data-stato="muto"]{--dm-macchina:#94a3b8}
    ${P} .dm-macchina-ic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;
      font-size:18px;background:color-mix(in srgb,var(--dm-macchina,#94a3b8) 20%,transparent)}
    ${P} .dm-macchina-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-macchina-testo strong{font-size:13.5px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-macchina-testo small{font-size:10px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-macchina-stato{font-size:10.5px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      color:color-mix(in srgb,var(--dm-macchina,#94a3b8) 78%,var(--text,#0f172a))}
    /* I tasti vanno a capo e a destra, uno o due che siano: in riga con lo
       stato spingerebbero fuori il nome, e su un telefono il nome e' la sola
       cosa che serve leggere per intero. */
    ${P} .dm-macchina-tasti,${P} .dm-macchina>.dm-macchina-tasto{
      grid-column:1/-1;justify-self:end}
    ${P} .dm-macchina-tasti{display:inline-flex;gap:6px}
    ${P} .dm-macchina-tasto{
      padding:6px 14px;border-radius:999px;border:1px solid var(--card-border,#e2e8f0);
      background:var(--card-bg,#fff);color:var(--text,#0f172a);
      font:inherit;font-size:11.5px;font-weight:900;cursor:pointer}
    ${P} .dm-macchina-tasto:hover{border-color:var(--primary-color,#0ea5e9)}
    ${P} .dm-macchina-tasto-ferma:hover{border-color:#dc2626;color:#dc2626}
    @media(max-width:520px){${P} .dm-macchine-elenco{grid-template-columns:1fr}}
    `,
  );
}

export function installMacchine() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmMacchine) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmMacchine = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

installMacchine();
