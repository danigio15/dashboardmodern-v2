/* Gli altri nodi del cluster, sulla pagina del Server (#470).
 *
 * «Sarebbe utile poter configurare più di un mini pc in modo da monitorare più
 * nodi, comodo per chi ha, ad esempio, un cluster proxmox.»
 *
 * La scheda grande in cima resta quella del computer su cui gira Home
 * Assistant. Questi sono gli altri: una scheda per nodo, con le stesse tre
 * barre e i gradi, sopra le fasce delle macchine e della rete — prima il ferro,
 * poi quello che ci gira sopra.
 *
 * La fascia non esiste finché nessuno ha configurato un nodo: una pagina non
 * spiega come si configura la pagina, e chi non ha un cluster non deve vedere
 * il posto vuoto dove starebbe.
 */
import {
  CAMPI_DEL_NODO,
  CHIAVE_NODI,
  lettureDeiNodi,
  riassuntoDeiNodi,
} from "../core/nodi-del-cluster.js";
import { SERVER_PAGE_ID } from "./macchine-e-rete-section.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_NODI__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

const FASCIA_ID = "dm-nodi-fascia";
const STYLE_ID = "dm-nodi-style";

/** I nodi configurati, grezzi: la lettura li ripulisce. */
export function nodiConfigurati() {
  const salvato = readJson(CHIAVE_NODI, []);
  return Array.isArray(salvato) ? salvato : [];
}

/** Come stanno adesso. */
export function lettureDeiNodiOra(states = allStates()) {
  return lettureDeiNodi(nodiConfigurati(), states);
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

/* Una barra: il numero grosso e sotto la parolina, come su tutte le altre
 * schede della plancia. Il livello lo decide il modello — normale, alto,
 * critico — e il foglio di stile lo colora. */
function barraMarkup(etichetta, misura) {
  if (!misura) return "";
  const quota = Math.max(0, Math.min(100, misura.valore));
  const unita = misura.unita || "%";
  return `<div class="dm-nodo-barra" data-livello="${esc(misura.livello)}">
    <span class="dm-nodo-barra-lbl">${esc(etichetta)}</span>
    <span class="dm-nodo-barra-guscio"><b style="width:${unita === "%" ? quota.toFixed(0) : 100}%"></b></span>
    <span class="dm-nodo-barra-num">${esc(misura.valore.toFixed(unita === "%" ? 0 : 1))}${esc(unita === "%" ? "%" : ` ${unita}`)}</span>
  </div>`;
}

function statoMarkup(lettura) {
  /* Tre esiti, tre parole: un nodo di cui nessuno ha indicato lo stato non è
   * un nodo spento, ed è per questo che la pastiglia non c'è invece di essere
   * grigia con scritto «—». */
  if (lettura.muto)
    return `<span class="dm-nodo-stato" data-stato="muto">${esc(t("non risponde", "not answering"))}</span>`;
  if (lettura.acceso === true)
    return `<span class="dm-nodo-stato" data-stato="acceso">${esc(t("acceso", "up"))}</span>`;
  if (lettura.acceso === false)
    return `<span class="dm-nodo-stato" data-stato="spento">${esc(t("spento", "down"))}</span>`;
  return "";
}

function nodoMarkup(lettura) {
  return `<article class="dm-nodo" data-dm-nodo="${esc(lettura.id)}">
    <header class="dm-nodo-testa">
      <span class="dm-nodo-nome">${esc(lettura.nome)}</span>
      ${statoMarkup(lettura)}
    </header>
    ${barraMarkup(t("Processore", "CPU"), lettura.cpu)}
    ${barraMarkup(t("Memoria", "Memory"), lettura.ram)}
    ${barraMarkup(t("Disco", "Disk"), lettura.disco)}
    ${barraMarkup(t("Gradi", "Degrees"), lettura.temperatura)}
  </article>`;
}

function fasciaMarkup(letture) {
  const riassunto = riassuntoDeiNodi(letture);
  /* Il sottotitolo dice come sta il cluster in tre parole: quanti nodi ci
   * sono, e se qualcuno è giù. Un cluster sta come sta il suo nodo messo
   * peggio. */
  const sotto = [
    `${riassunto.quanti} ${riassunto.quanti === 1 ? t("nodo", "node") : t("nodi", "nodes")}`,
    riassunto.spenti ? `${riassunto.spenti} ${t("giù", "down")}` : "",
    riassunto.muti ? `${riassunto.muti} ${t("senza risposta", "not answering")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<section class="dm-nodi-sezione">
    <header class="dm-nodi-testa">
      <strong>${esc(t("Altri nodi", "Other nodes"))}</strong>
      <span>${esc(sotto)}</span>
    </header>
    <div class="dm-nodi-griglia">${letture.map(nodoMarkup).join("")}</div>
  </section>`;
}

/* La fascia sta sopra quelle delle macchine: prima il ferro, poi quello che ci
 * gira sopra. Se le macchine non ci sono ancora, si accoda e basta. */
function ospite() {
  const pagina = doc?.getElementById?.(SERVER_PAGE_ID);
  if (!pagina) return null;
  const gia = pagina.querySelector(`#${FASCIA_ID}`);
  if (gia) return gia;
  const dove = doc.createElement("div");
  dove.id = FASCIA_ID;
  dove.className = "dm-nodi-wrap";
  const macchine = pagina.querySelector("#dm-macchine-fasce");
  if (macchine) pagina.insertBefore(dove, macchine);
  else pagina.append(dove);
  return dove;
}

function dipingi() {
  const letture = lettureDeiNodiOra();
  const pagina = doc?.getElementById?.(SERVER_PAGE_ID);
  if (!pagina) return;
  if (!letture.length) {
    /* Nessun nodo configurato: la fascia non c'è. Non è un errore, è una casa
     * senza cluster. */
    pagina.querySelector(`#${FASCIA_ID}`)?.remove();
    state.firma = "";
    return;
  }
  if (!pagina.classList.contains("active")) return;
  const dove = ospite();
  if (!dove) return;
  const firma = JSON.stringify([letture, t("Altri nodi", "Other nodes")]);
  if (state.firma === firma) return;
  state.firma = firma;
  dove.innerHTML = fasciaMarkup(letture);
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] nodi", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderNodi() {
  state.firma = "";
  schedule();
}

function installaStile() {
  installStyle(
    STYLE_ID,
    `
      #${FASCIA_ID}{display:block;margin:14px 0 0}
      #${FASCIA_ID} .dm-nodi-testa{display:flex;align-items:baseline;gap:10px;margin:0 0 9px;padding:0 2px}
      #${FASCIA_ID} .dm-nodi-testa strong{
        font-family:'Oswald',system-ui,sans-serif;font-size:15px;letter-spacing:1.3px;
        text-transform:uppercase;color:var(--text,#0f172a)}
      #${FASCIA_ID} .dm-nodi-testa span{font-size:11.5px;font-weight:800;color:var(--text-dim,#94a3b8)}
      #${FASCIA_ID} .dm-nodi-griglia{
        display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,232px),1fr))}
      #${FASCIA_ID} .dm-nodo{
        display:grid;gap:7px;padding:12px 13px;border-radius:16px;
        border:1px solid var(--card-border,#e8edf3);background:var(--card-bg,#fff)}
      #${FASCIA_ID} .dm-nodo-testa{display:flex;align-items:center;gap:8px;justify-content:space-between}
      #${FASCIA_ID} .dm-nodo-nome{
        min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        font-size:13px;font-weight:900;color:var(--text,#0f172a)}
      #${FASCIA_ID} .dm-nodo-stato{
        flex:0 0 auto;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:900;
        letter-spacing:.06em;text-transform:uppercase}
      #${FASCIA_ID} .dm-nodo-stato[data-stato="acceso"]{background:rgba(16,185,129,.16);color:#047857}
      #${FASCIA_ID} .dm-nodo-stato[data-stato="spento"]{background:rgba(220,38,38,.14);color:#b91c1c}
      #${FASCIA_ID} .dm-nodo-stato[data-stato="muto"]{background:rgba(148,163,184,.2);color:#475569}
      #${FASCIA_ID} .dm-nodo-barra{display:grid;grid-template-columns:64px minmax(0,1fr) 46px;align-items:center;gap:8px}
      #${FASCIA_ID} .dm-nodo-barra-lbl{
        font-size:9.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;
        color:var(--text-dim,#94a3b8)}
      #${FASCIA_ID} .dm-nodo-barra-guscio{
        height:7px;border-radius:999px;background:var(--surface-2,#eef2f7);overflow:hidden}
      #${FASCIA_ID} .dm-nodo-barra-guscio>b{display:block;height:100%;border-radius:999px;background:#10b981;transition:width .4s ease}
      #${FASCIA_ID} .dm-nodo-barra[data-livello="alto"] .dm-nodo-barra-guscio>b{background:#f59e0b}
      #${FASCIA_ID} .dm-nodo-barra[data-livello="critico"] .dm-nodo-barra-guscio>b{background:#dc2626}
      #${FASCIA_ID} .dm-nodo-barra-num{
        font-size:11.5px;font-weight:900;text-align:right;font-variant-numeric:tabular-nums;
        color:var(--text,#0f172a)}
    `,
  );
}

export function installNodiSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installaStile();
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:section-changed",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
}

/** Quante entità la fascia sta guardando: serve alle prove. */
export function quanteEntitaGuardano() {
  return nodiConfigurati().reduce(
    (conto, nodo) => conto + CAMPI_DEL_NODO.filter((campo) => clean(nodo?.[campo])).length,
    0,
  );
}
