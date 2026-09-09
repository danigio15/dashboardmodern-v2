/* Il flusso dell'energia in Home (#415, #416).
 *
 * «Sarebbe veramente perfetta se sulla home, accanto magari alle card delle
 * persone, potessimo mettere un'immagine con il flusso dal fotovoltaico alla
 * casa, dalla casa alle batterie, dalla casa all'auto ecc ecc.»
 *
 * La sezione Energia una mappa ce l'ha, ma vive attaccata al documento storico
 * — le bolle, le linee e i tre periodi sono nodi di quello — e da li' non esce.
 * Quello che esce e' il CONTO, che e' puro: `core/energy-flow-truth.js` dice
 * come si spartisce l'energia fra le sorgenti, e `core/flusso-di-casa.js` ci
 * mette sopra l'unico arco che manca, la casa che carica l'auto. Le due mappe
 * quindi raccontano la stessa casa perche' fanno lo stesso conto, non perche'
 * qualcuno le ha allineate a mano.
 *
 * Il blocco e' un blocco della Home come le persone e le tessere: si mette
 * dove si vuole nell'ordine, e si spegne dalla scheda Energia. Sparisce da solo
 * quando non c'e' abbastanza da raccontare — un riquadro vuoto in una mappa dei
 * flussi non dice «zero», dice «non lo so».
 *
 * Non si disegna quando la Home non si guarda: e' la regola del resto della
 * plancia, e qui vale doppio perche' il disegno cambia a ogni stato che arriva.
 */
import { arcoPiuGrande, flussoDiCasa, forzaDellArco } from "../core/flusso-di-casa.js";
import { wattsFromState } from "../core/signed-energy.js";
import { lettureDiCasa } from "./home-widgets-section.js";
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

const KEY = "__DASHBOARDMODERN_FLUSSO_CASA__";
const STYLE_ID = "dm-flusso-style";
const BLOCCO_ID = "dm-flusso";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

/** Dove si dice se il flusso in Home si vuole. */
export const CHIAVE_FLUSSO_HOME = "cd_flusso_home";

/* La potenza che la colonnina sta erogando: e' la mappatura di casa, la stessa
 * che legge la sezione Auto. Non e' una sorgente — quello che eroga e' gia'
 * dentro il consumo di casa — ma e' il ramo che la segnalazione chiede per
 * nome, «dalla casa all'auto». */
const POTENZA_WALLBOX = "dm.ev_potenza_wallbox";

/* I nodi, con il posto che occupano nel disegno e la loro tinta.
 *
 * Sono targhette, non bolle: il nome e il numero stanno DENTRO, e fuori non
 * c'e' nessuna scritta che una linea possa tagliare. La prima stesura le
 * metteva sotto ai cerchi, e la linea del fotovoltaico verso casa passava
 * dritta sopra la parola «Fotovoltaico»; il numero, per giunta, finiva addosso
 * al simbolo. Dentro non succede.
 *
 * Le sorgenti in alto, la casa in mezzo, l'auto sotto: si legge dall'alto in
 * basso come scende la corrente. */
const LARGHEZZA = 104;
const ALTEZZA = 44;

const POSTI = Object.freeze({
  solare: Object.freeze({ x: 190, y: 44, glifo: "\u2600\uFE0F", tinta: "#f59e0b" }),
  rete: Object.freeze({ x: 56, y: 150, glifo: "\u{1F50C}", tinta: "#2563eb" }),
  casa: Object.freeze({ x: 190, y: 150, glifo: "\u{1F3E0}", tinta: "#2563eb" }),
  batteria: Object.freeze({ x: 324, y: 150, glifo: "\u{1F50B}", tinta: "#14b8a6" }),
  auto: Object.freeze({ x: 190, y: 258, glifo: "\u{1F697}", tinta: "#8b5cf6" }),
});

/* La strada di ogni coppia, disegnata una volta sola: fra due nodi la corrente
 * va in un verso o nell'altro, mai in tutti e due insieme, quindi la linea e'
 * la stessa e cambia solo da che parte scorre il tratteggio.
 *
 * `rete` e `batteria` si parlano scavalcando tutto dall'alto: passare in mezzo
 * vorrebbe dire tagliare la casa a meta', e una linea che attraversa una
 * targhetta sembra entrarci. */
const STRADE = Object.freeze({
  "solare|casa": "M190,66 L190,128",
  "rete|casa": "M108,150 L138,150",
  "batteria|casa": "M272,150 L242,150",
  "casa|auto": "M190,172 L190,236",
  "solare|rete": "M138,58 L98,128",
  "solare|batteria": "M242,58 L282,128",
  "rete|batteria": "M40,128 C40,-30 340,-30 340,128",
});

const stradaDi = (da, a) => STRADE[`${da}|${a}`] || STRADE[`${a}|${da}`] || "";
/* Se la linea e' disegnata al contrario di come scorre la corrente, il
 * tratteggio si anima all'indietro invece di riscrivere il percorso. */
const alContrario = (da, a) => !STRADE[`${da}|${a}`] && Boolean(STRADE[`${a}|${da}`]);

/** Se il blocco si vuole in Home. Di serie sì: è quello che è stato chiesto. */
export function flussoInHome() {
  return readJson(CHIAVE_FLUSSO_HOME, true) !== false;
}

function laHome() {
  const pagina = doc?.getElementById?.("page-home");
  return pagina?.classList?.contains("active") ? pagina : null;
}

/* Quanto eroga la colonnina adesso, in watt, qualunque unità dichiari. */
function potenzaDellAuto(states) {
  const id = POTENZA_WALLBOX;
  let risolto = id;
  try {
    risolto = clean(root.resolveEntity?.(id)) || id;
  } catch (_error) {}
  return wattsFromState(states[risolto] || states[id] || null);
}

function nomeDelNodo(chiave) {
  if (chiave === "solare") return t("Fotovoltaico", "Solar");
  if (chiave === "rete") return t("Rete", "Grid");
  if (chiave === "batteria") return t("Batteria", "Battery");
  if (chiave === "auto") return t("Auto", "Car");
  return t("Casa", "House");
}

/* I watt come si leggono: sotto il migliaio in watt interi, sopra in kW con un
 * decimale — «3400 W» su una bolla piccola non si legge, «3,4 kW» sì. */
function scritta(watt) {
  if (watt == null) return "";
  const valore = Math.abs(watt);
  if (valore < 1000) return `${Math.round(valore)} W`;
  const kw = valore / 1000;
  return `${kw.toFixed(1).replace(".", t(",", "."))} kW`;
}

function nodoMarkup(nodo) {
  const posto = POSTI[nodo.chiave];
  if (!posto) return "";
  const freccia = nodo.verso === "dentro" ? "\u25BC " : nodo.verso === "fuori" ? "\u25B2 " : "";
  /* La carica della batteria sta sulla riga del nome, non su quella del
   * numero: «▼ 800 W · 62%» usciva dai bordi della targhetta, e una scritta
   * che scavalca il suo riquadro sembra appartenere a quello accanto. */
  const carica = nodo.chiave === "batteria" && nodo.soc != null ? ` ${Math.round(nodo.soc)}%` : "";
  const sinistra = posto.x - LARGHEZZA / 2;
  const alto = posto.y - ALTEZZA / 2;
  return `<g class="dm-flusso-nodo" data-nodo="${esc(nodo.chiave)}" style="--dm-flusso-tinta:${posto.tinta}">
      <rect x="${sinistra}" y="${alto}" width="${LARGHEZZA}" height="${ALTEZZA}" rx="13"></rect>
      <text class="dm-flusso-nome" x="${posto.x}" y="${posto.y - 5}">${posto.glifo} ${esc(nomeDelNodo(nodo.chiave) + carica)}</text>
      <text class="dm-flusso-watt" x="${posto.x}" y="${posto.y + 13}">${esc(freccia + scritta(nodo.watt))}</text>
    </g>`;
}

function arcoMarkup(arco, massimo) {
  const strada = stradaDi(arco.da, arco.a);
  if (!strada) return "";
  const forza = forzaDellArco(arco.watt, massimo);
  const spessore = (2 + forza * 4).toFixed(1);
  /* Più corrente, più svelto il tratteggio: è il modo in cui una mappa dice
   * «di qui ne passa tanta» senza scriverci sopra un altro numero. */
  const durata = (2.4 - forza * 1.6).toFixed(2);
  const verso = alContrario(arco.da, arco.a) ? "reverse" : "normal";
  return `<path class="dm-flusso-arco" d="${strada}" data-da="${esc(arco.da)}" data-a="${esc(arco.a)}"
      style="--dm-flusso-tinta:${POSTI[arco.da]?.tinta || "#64748b"};stroke-width:${spessore};animation-duration:${durata}s;animation-direction:${verso}"></path>`;
}

/** Il disegno del flusso, dal modello: serve anche alle prove. */
export function flussoMarkup(modello) {
  const massimo = arcoPiuGrande(modello.archi);
  const archi = modello.archi.map((arco) => arcoMarkup(arco, massimo)).join("");
  const nodi = modello.presenti.map((chiave) => nodoMarkup(modello.nodi[chiave])).join("");
  return `<h3 class="section-title dm-flusso-titolo">${esc(t("Il flusso dell'energia", "The energy flow"))}</h3>
  <div class="dm-flusso-tela">
    <svg viewBox="0 -20 380 312" role="img" aria-label="${esc(t("Il flusso dell'energia di casa", "The home energy flow"))}">
      <g class="dm-flusso-archi">${archi}</g>
      <g class="dm-flusso-nodi">${nodi}</g>
    </svg>
  </div>`;
}

/** Il modello adesso, dalle stesse letture della tessera dell'energia. */
export function flussoAdesso(states = allStates()) {
  const letture = lettureDiCasa(states);
  return flussoDiCasa({ ...letture, auto: potenzaDellAuto(states) });
}

function firmaDel(modello) {
  return [
    modello.presenti.join(","),
    modello.presenti
      .map((chiave) => `${chiave}:${modello.nodi[chiave].watt}:${modello.nodi[chiave].verso}`)
      .join("|"),
    modello.archi.map((arco) => `${arco.da}>${arco.a}:${Math.round(arco.watt)}`).join("|"),
    modello.nodi.batteria.soc,
  ].join("§");
}

export function renderFlusso() {
  const pagina = laHome();
  let blocco = doc?.getElementById?.(BLOCCO_ID);
  if (!pagina || !flussoInHome()) {
    blocco?.remove();
    return false;
  }
  const modello = flussoAdesso();
  if (!modello.disegnabile) {
    blocco?.remove();
    state.firma = "";
    return false;
  }
  if (!blocco || blocco.parentElement !== pagina) {
    blocco?.remove();
    blocco = doc.createElement("section");
    blocco.id = BLOCCO_ID;
    blocco.className = "dm-flusso";
    /* Sotto le persone, che è dove è stato chiesto. Da lì l'ordine dei blocchi
     * lo può spostare dove si vuole, come tutti gli altri. */
    const persone = doc.getElementById("dm-people");
    if (persone?.parentElement === pagina) persone.after(blocco);
    else pagina.prepend(blocco);
    state.firma = "";
  }
  const firma = firmaDel(modello);
  if (state.firma === firma) return false;
  state.firma = firma;
  blocco.innerHTML = flussoMarkup(modello);
  return true;
}

function schedule() {
  if (state.frame || !paginaVisibile("page-home")) return;
  state.frame = root.requestAnimationFrame?.(() => {
    state.frame = 0;
    try {
      renderFlusso();
    } catch (_error) {}
  });
  if (!state.frame) {
    try {
      renderFlusso();
    } catch (_error) {}
  }
}

function css() {
  return `
  #${BLOCCO_ID}{display:block;margin:14px 0 0}
  #${BLOCCO_ID} .dm-flusso-titolo{margin:0 0 6px}
  #${BLOCCO_ID} .dm-flusso-tela{
    background:var(--dm-card-bg,rgba(255,255,255,.06));
    border:1px solid var(--dm-card-border,rgba(148,163,184,.22));
    border-radius:18px;padding:8px 6px 4px}
  #${BLOCCO_ID} svg{display:block;width:100%;height:auto;max-height:340px}
  #${BLOCCO_ID} .dm-flusso-nodo rect{
    fill:color-mix(in srgb,var(--dm-flusso-tinta) 15%,transparent);
    stroke:var(--dm-flusso-tinta);stroke-width:1.6}
  #${BLOCCO_ID} .dm-flusso-nome{
    font-size:10px;text-anchor:middle;fill:var(--secondary-text-color,#94a3b8)}
  #${BLOCCO_ID} .dm-flusso-watt{
    font-size:13px;font-weight:800;text-anchor:middle;
    fill:var(--primary-text-color,#e2e8f0);font-variant-numeric:tabular-nums}
  #${BLOCCO_ID} .dm-flusso-arco{
    fill:none;stroke:var(--dm-flusso-tinta);stroke-linecap:round;
    stroke-dasharray:5 9;opacity:.85;
    animation-name:dm-flusso-scorre;animation-timing-function:linear;
    animation-iteration-count:infinite}
  @keyframes dm-flusso-scorre{to{stroke-dashoffset:-28}}
  @media (prefers-reduced-motion:reduce){
    #${BLOCCO_ID} .dm-flusso-arco{animation:none;stroke-dasharray:none}}
  `;
}

export function installFlussoDiCasaSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  quandoSiCambiaPagina(schedule);
  state.installed = true;
  schedule();
  return true;
}
