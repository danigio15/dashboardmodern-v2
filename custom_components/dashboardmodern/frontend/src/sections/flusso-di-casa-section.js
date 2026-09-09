/* Il flusso dell'energia in Home (#415, #416).
 *
 * «Sarebbe veramente perfetta se sulla home, accanto magari alle card delle
 * persone, potessimo mettere un'immagine con il flusso dal fotovoltaico alla
 * casa, dalla casa alle batterie, dalla casa all'auto ecc ecc.»
 *
 * ── Dov'e' ────────────────────────────────────────────────────────────────
 *
 * «Accanto alle card delle persone» era scritto nella segnalazione e non era
 * stato fatto: la prima stesura ne aveva fatto un blocco intero della Home,
 * largo quanto la pagina e SOTTO le persone. Un riquadro vuoto largo cosi',
 * con dentro cinque targhette piccole, e' brutto in un modo che si vede da
 * lontano — c'e' piu' cornice che disegno.
 *
 * Adesso e' una card stretta accanto alla griglia delle persone: la stessa
 * cornice, lo stesso raggio, lo stesso alone colorato — la sua corsia e non
 * tutta la pagina. Accanto alla griglia e non DENTRO, e la differenza l'ho
 * imparata mettendocela dentro: una card piu' alta di una persona alza tutta
 * la riga della griglia, e le persone accanto si stirano vuote per seguirla.
 * Chi non ha nessuna persona configurata quella fila non ce l'ha: allora la
 * card tiene il posto che sarebbe stato delle persone, con la stessa misura.
 *
 * Stando dentro il blocco delle persone, viaggia con loro quando si riordina
 * la Home: non e' piu' una voce dell'ordine dei blocchi, ed e' per questo che
 * da quell'elenco e' sparita. Accenderla e spegnerla si fa dove si faceva.
 *
 * ── Cosa disegna ──────────────────────────────────────────────────────────
 *
 * La sezione Energia una mappa ce l'ha, ma vive attaccata al documento storico
 * — le bolle, le linee e i tre periodi sono nodi di quello — e da li' non esce.
 * Quello che esce e' il CONTO, che e' puro: `core/energy-flow-truth.js` dice
 * come si spartisce l'energia fra le sorgenti, e `core/flusso-di-casa.js` ci
 * mette sopra l'unico arco che manca, la casa che carica l'auto. Le due mappe
 * quindi raccontano la stessa casa perche' fanno lo stesso conto, non perche'
 * qualcuno le ha allineate a mano.
 *
 * Sparisce da sola quando non c'e' abbastanza da raccontare — un riquadro
 * vuoto in una mappa dei flussi non dice «zero», dice «non lo so».
 *
 * Non si disegna quando la Home non si guarda: e' la regola del resto della
 * plancia, e qui vale doppio perche' il disegno cambia a ogni stato che arriva.
 */
import {
  arcoPiuGrande,
  flussoDiCasa,
  forzaDellArco,
  sorgenteDiCasa,
} from "../core/flusso-di-casa.js";
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
const CARD_ID = "dm-flusso-card";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

/** Dove si dice se il flusso in Home si vuole. */
export const CHIAVE_FLUSSO_HOME = "cd_flusso_home";

/* La potenza che la colonnina sta erogando: e' la mappatura di casa, la stessa
 * che legge la sezione Auto. Non e' una sorgente — quello che eroga e' gia'
 * dentro il consumo di casa — ma e' il ramo che la segnalazione chiede per
 * nome, «dalla casa all'auto». */
const POTENZA_WALLBOX = "dm.ev_potenza_wallbox";

/* ── La geometria ──────────────────────────────────────────────────────────
 *
 * La casa in mezzo e le sorgenti attorno, non una scala dall'alto in basso: su
 * una card stretta e' l'unica figura che ci sta senza rimpicciolire le
 * scritte, e dice da sola quello che deve dire — tutto converge in casa.
 *
 * Le scritte stanno DENTRO i cerchi, e fuori non c'e' nessuna parola che una
 * linea possa tagliare. Il nome non c'e': lo dice il simbolo, e su una card di
 * questa misura scriverlo vorrebbe dire togliere il numero. Chi vuole il nome
 * lo trova nel `<title>` del nodo, che e' quello che leggono le lenti e i
 * lettori di schermo.
 *
 * Nemmeno la freccia c'e' piu', e non e' una perdita: «▼» diceva che la
 * batteria si carica, ma lo dice gia' l'arco che ci arriva. Due modi di dire
 * la stessa cosa nello stesso disegno sono uno di troppo, e quello era quello
 * che rubava lo spazio al numero. */
const CASA = Object.freeze({ x: 80, y: 90, r: 25 });
const SATELLITE = 18;
/* Il cerchio della carica attorno alla batteria: gli archi che arrivano alla
 * batteria si fermano su di lui, non sul suo corpo. */
const ANELLO = 22.5;
const GIRO_ANELLO = 2 * Math.PI * ANELLO;

const POSTI = Object.freeze({
  solare: Object.freeze({ x: 80, y: 36, glifo: "☀️", tinta: "245,158,11" }),
  rete: Object.freeze({ x: 24, y: 90, glifo: "\u{1F50C}", tinta: "37,99,235" }),
  casa: Object.freeze({ x: 80, y: 90, glifo: "\u{1F3E0}", tinta: "100,116,139" }),
  batteria: Object.freeze({ x: 136, y: 90, glifo: "\u{1F50B}", tinta: "20,184,166" }),
  auto: Object.freeze({ x: 80, y: 146, glifo: "\u{1F697}", tinta: "139,92,246" }),
});

/* La strada di ogni coppia, disegnata una volta sola: fra due nodi la corrente
 * va in un verso o nell'altro, mai in tutti e due insieme, quindi la linea e'
 * la stessa e cambia solo da che parte scorre il tratteggio.
 *
 * Ogni tratto parte e finisce sul bordo dei due cerchi, cosi' le linee non
 * entrano mai dentro un nodo. `rete` e `batteria` sono l'unica coppia che si
 * parla stando dai lati opposti: si scavalca dall'alto, sopra il sole, perche'
 * passare in mezzo vorrebbe dire tagliare la casa a meta'. */
const STRADE = Object.freeze({
  "solare|casa": "M80,54 L80,65",
  "rete|casa": "M42,90 L55,90",
  "batteria|casa": "M113.5,90 L105,90",
  "casa|auto": "M80,115 L80,128",
  "solare|rete": "M67,48.5 L37,77.5",
  "solare|batteria": "M93,48.5 L119.8,74.4",
  "rete|batteria": "M24,67.5 C24,-13 136,-13 136,67.5",
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
 * decimale — «3400 W» su una bolla piccola non si legge, «3,4 kW» sì.
 *
 * Dai dieci kilowatt in su il decimo si toglie, e non per gusto: la scritta sta
 * DENTRO il cerchio, e «10,2 kW» era l'unico numero che non ci entrava. È anche
 * la cosa giusta da leggere — a dieci kilowatt il decimo non lo guarda
 * nessuno. */
function scritta(watt) {
  if (watt == null) return "";
  const valore = Math.abs(watt);
  if (valore < 1000) return `${Math.round(valore)} W`;
  const kw = valore / 1000;
  if (kw >= 10) return `${Math.round(kw)} kW`;
  return `${kw.toFixed(1).replace(".", t(",", "."))} kW`;
}

/* La carica della batteria e' un anello attorno al suo cerchio, non una scritta
 * in piu': «62%» accanto ai watt non ci sta, e un anello pieno per due terzi
 * si legge senza leggerlo. Parte dall'alto, da cui la rotazione. */
function anelloDellaCarica(posto, soc) {
  if (soc == null) return "";
  const quota = (Math.max(0, Math.min(100, soc)) / 100) * GIRO_ANELLO;
  return `<circle class="dm-flusso-pista" cx="${posto.x}" cy="${posto.y}" r="${ANELLO}"></circle>
      <circle class="dm-flusso-carica" cx="${posto.x}" cy="${posto.y}" r="${ANELLO}"
        transform="rotate(-90 ${posto.x} ${posto.y})"
        style="stroke-dasharray:${quota.toFixed(1)} ${GIRO_ANELLO.toFixed(1)}"></circle>`;
}

/* Un nodo a zero che nessun arco tocca non e' una notizia allegra da guardare:
 * «🚗 0 W» da solo in fondo, senza nessuna linea, sembra un pezzo di disegno
 * rotto. Non si toglie — dire che la colonnina non sta erogando e' comunque
 * dire qualcosa — ma si spegne: resta leggibile, e non pesa come chi sta
 * lavorando. */
function nodoMarkup(nodo, attaccati) {
  const posto = POSTI[nodo.chiave];
  if (!posto) return "";
  const eLaCasa = nodo.chiave === "casa";
  const raggio = eLaCasa ? CASA.r : SATELLITE;
  const muto = !eLaCasa && !nodo.watt && !attaccati.has(nodo.chiave);
  const carica =
    nodo.chiave === "batteria" && nodo.soc != null ? ` — ${Math.round(nodo.soc)}%` : "";
  return `<g class="dm-flusso-nodo" data-nodo="${esc(nodo.chiave)}"${muto ? ' data-muto="true"' : ""} style="--dm-flusso-tinta:${posto.tinta}">
      <title>${esc(nomeDelNodo(nodo.chiave) + carica)}</title>
      ${nodo.chiave === "batteria" ? anelloDellaCarica(posto, nodo.soc) : ""}
      <circle class="dm-flusso-corpo" cx="${posto.x}" cy="${posto.y}" r="${raggio}"></circle>
      <text class="dm-flusso-glifo" x="${posto.x}" y="${posto.y - (eLaCasa ? 6 : 2.5)}">${posto.glifo}</text>
      <text class="dm-flusso-watt" x="${posto.x}" y="${posto.y + (eLaCasa ? 12 : 10)}">${esc(scritta(nodo.watt))}</text>
    </g>`;
}

function arcoMarkup(arco, massimo) {
  const strada = stradaDi(arco.da, arco.a);
  if (!strada) return "";
  const forza = forzaDellArco(arco.watt, massimo);
  const spessore = (1.4 + forza * 2).toFixed(1);
  /* Più corrente, più svelto il tratteggio: è il modo in cui una mappa dice
   * «di qui ne passa tanta» senza scriverci sopra un altro numero. */
  const durata = (2.4 - forza * 1.6).toFixed(2);
  const verso = alContrario(arco.da, arco.a) ? "reverse" : "normal";
  return `<path class="dm-flusso-arco" d="${strada}" data-da="${esc(arco.da)}" data-a="${esc(arco.a)}"
      style="--dm-flusso-tinta:${POSTI[arco.da]?.tinta || "100,116,139"};stroke-width:${spessore};animation-duration:${durata}s;animation-direction:${verso}"></path>`;
}

/** Il disegno del flusso, dal modello: serve anche alle prove. */
export function flussoMarkup(modello) {
  const massimo = arcoPiuGrande(modello.archi);
  const archi = modello.archi.map((arco) => arcoMarkup(arco, massimo)).join("");
  const attaccati = new Set(modello.archi.flatMap((arco) => [arco.da, arco.a]));
  const nodi = modello.presenti
    .map((chiave) => nodoMarkup(modello.nodi[chiave], attaccati))
    .join("");
  /* Da dove arriva adesso quello che la casa usa: e' il titolo della mappa, e
   * la sua tinta veste la card come il colore di presenza veste quelle delle
   * persone — l'alone dietro, il bordo quando ci si passa sopra, la pastiglia.
   * Cosi' da lontano, senza leggere niente, si vede se la casa sta andando a
   * sole o a rete. */
  const fonte = sorgenteDiCasa(modello.archi);
  const tinta = POSTI[fonte]?.tinta || POSTI.casa.tinta;
  const pastiglia = fonte
    ? `<span class="dm-flusso-fonte">${POSTI[fonte].glifo} ${esc(nomeDelNodo(fonte))}</span>`
    : "";
  /* Il nome sopra e la pastiglia sotto, in colonna: e' come stanno il nome e la
   * zona di una persona, ed e' anche l'unico modo perche' non si taglino a
   * vicenda — su una card di questa larghezza «Flusso energia» e «☀️
   * Fotovoltaico» sulla stessa riga non ci stanno, e il titolo diventava
   * «Flusso ene...». */
  return `<article class="dm-flusso-card" style="--dm-flusso-fonte:${tinta}">
    <div class="dm-flusso-testa">
      <strong class="dm-flusso-nome">${esc(t("Flusso energia", "Energy flow"))}</strong>
      ${pastiglia}
    </div>
    <div class="dm-flusso-tela">
      <svg viewBox="0 4 160 162" role="img" aria-label="${esc(t("Il flusso dell'energia di casa", "The home energy flow"))}">
        <g class="dm-flusso-archi">${archi}</g>
        <g class="dm-flusso-nodi">${nodi}</g>
      </svg>
    </div>
  </article>`;
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

/* La fila delle persone, se in questa casa ce ne sono. E' li' che la card va a
 * stare: accanto alla loro griglia, non dentro.
 *
 * Dentro ci e' stata, ed era sbagliato: una card piu' alta di una persona
 * alzava tutta la riga della griglia, e le persone accanto si stiravano vuote
 * per starle dietro. Accanto alla griglia ognuno tiene la sua altezza — e in
 * piu' la card e' al riparo dal ridisegno, perche' chi disegna le persone
 * riscrive la griglia, non la fila. */
function laFila(pagina) {
  const persone = doc?.getElementById?.("dm-people");
  if (!persone || persone.parentElement !== pagina) return null;
  return persone.querySelector(".dm-people-fila");
}

/* Senza persone la card tiene il loro posto, con la loro misura: un blocco
 * suo, subito sotto le pastiglie di stato, che e' dove le persone sarebbero
 * andate. */
function bloccoDiPagina(pagina) {
  let blocco = doc.getElementById(BLOCCO_ID);
  if (blocco && blocco.parentElement === pagina) return blocco;
  blocco?.remove();
  blocco = doc.createElement("section");
  blocco.id = BLOCCO_ID;
  blocco.className = "dm-flusso";
  const pastiglie = doc.getElementById("dashboard-pills-row");
  if (pastiglie?.parentElement === pagina) pastiglie.after(blocco);
  else pagina.prepend(blocco);
  return blocco;
}

/* Alla fila si dice che qualcuno c'e': e' cosi' che lei sa di non dover tenere
 * le corsie vuote che nessuna persona sta usando. Si dice anche quando si va
 * via, sennò la griglia resta stretta attorno a un compagno che non c'e' piu'. */
function diAllaFila(fila, accanto) {
  if (!fila) return;
  if (accanto) fila.dataset.accanto = "true";
  else delete fila.dataset.accanto;
}

function viaTutto() {
  doc?.getElementById?.(CARD_ID)?.remove();
  doc?.getElementById?.(BLOCCO_ID)?.remove();
  diAllaFila(doc?.getElementById?.("dm-people")?.querySelector?.(".dm-people-fila"), false);
  state.firma = "";
}

export function renderFlusso() {
  const pagina = laHome();
  if (!pagina || !flussoInHome()) {
    viaTutto();
    return false;
  }
  const modello = flussoAdesso();
  if (!modello.disegnabile) {
    viaTutto();
    return false;
  }
  const fila = laFila(pagina);
  /* Con le persone la card sta nella loro fila, e allora il blocco a se' non
   * serve piu': ne resterebbe una cornice vuota sotto la Home. */
  if (fila) doc.getElementById(BLOCCO_ID)?.remove();
  diAllaFila(fila, true);
  const ospite = fila || bloccoDiPagina(pagina);
  if (!ospite) return false;

  const vecchia = doc.getElementById(CARD_ID);
  const firma = firmaDel(modello);
  if (vecchia && vecchia.parentElement === ospite && state.firma === firma) return false;
  const guscio = doc.createElement("div");
  guscio.innerHTML = flussoMarkup(modello);
  const card = guscio.firstElementChild;
  if (!card) return false;
  card.id = CARD_ID;
  if (vecchia) vecchia.replaceWith(card);
  if (card.parentElement !== ospite) ospite.appendChild(card);
  state.firma = firma;
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

/* La card e' vestita come una card delle persone, e non per somiglianza: sta
 * accanto a loro, e una card che nella stessa fila ha un'altra cornice o un
 * altro raggio si vede subito che e' stata appiccicata li'. Le misure sono
 * quelle di `people-section.js`, compresa la soglia del telefono. */
function css() {
  return `
  #${BLOCCO_ID}{display:block;margin:14px 0 0}
  .dm-flusso-card{
    --dm-flusso-fonte:100,116,139;flex:0 0 224px;width:224px;max-width:100%;
    position:relative;display:flex;flex-direction:column;gap:10px;
    padding:14px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);
    border-radius:22px;box-shadow:var(--shadow-sculpted,0 4px 14px rgba(15,23,42,.08));
    transition:var(--transition,.3s);overflow:hidden}
  /* L'alone della sorgente, morbido dietro: e' lui a dire da lontano se la
     casa sta andando a sole o a rete, prima ancora di leggere. */
  .dm-flusso-card::before{content:"";position:absolute;top:-56px;left:-40px;width:190px;height:160px;
    background:radial-gradient(closest-side,rgba(var(--dm-flusso-fonte),.22),transparent 72%);
    pointer-events:none}
  .dm-flusso-card:hover{box-shadow:var(--shadow-hover,0 10px 25px rgba(15,23,42,.14));
    border-color:rgba(var(--dm-flusso-fonte),.35)}
  .dm-flusso-testa{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0;max-width:100%}
  .dm-flusso-nome{font-size:14px;font-weight:900;letter-spacing:-.3px;color:var(--text,#0f172a);
    max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dm-flusso-fonte{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:10px;font-weight:900;letter-spacing:.3px;color:#fff;
    background:linear-gradient(135deg,rgb(var(--dm-flusso-fonte)),color-mix(in srgb,rgb(var(--dm-flusso-fonte)) 72%,#0f172a));
    border-radius:999px;padding:3px 10px;white-space:nowrap;
    box-shadow:0 5px 12px -5px rgba(var(--dm-flusso-fonte),.7)}
  .dm-flusso-tela{position:relative}
  .dm-flusso-card svg{display:block;width:100%;height:auto}
  /* Il riquadro dell'intestazione l'ha gia' la fila: qui la card e' sempre
     larga uguale, e il disegno la riempie. */
  .dm-flusso-corpo{
    fill:color-mix(in srgb,rgb(var(--dm-flusso-tinta)) 13%,var(--card-bg,#fff));
    stroke:rgba(var(--dm-flusso-tinta),.55);stroke-width:1.4}
  /* La casa e' il centro tranquillo: il fondo della card, non una tinta, cosi'
     le sorgenti attorno si vedono per quello che sono. */
  .dm-flusso-nodo[data-nodo="casa"] .dm-flusso-corpo{
    fill:var(--card-bg,#fff);stroke:rgba(var(--dm-flusso-tinta),.42);stroke-width:1.6}
  .dm-flusso-glifo{font-size:11px;text-anchor:middle}
  .dm-flusso-nodo[data-nodo="casa"] .dm-flusso-glifo{font-size:13px}
  .dm-flusso-watt{font-size:7.8px;font-weight:900;text-anchor:middle;
    fill:var(--text,#0f172a);font-variant-numeric:tabular-nums}
  .dm-flusso-nodo[data-nodo="casa"] .dm-flusso-watt{font-size:11px}
  /* Il nodo spento: si legge ancora, e non pesa come chi sta lavorando. */
  .dm-flusso-nodo[data-muto="true"]{opacity:.42}
  .dm-flusso-pista{fill:none;stroke:rgba(var(--dm-flusso-tinta),.15);stroke-width:2.2}
  .dm-flusso-carica{fill:none;stroke:rgb(var(--dm-flusso-tinta));stroke-width:2.2;stroke-linecap:round}
  .dm-flusso-arco{
    fill:none;stroke:rgb(var(--dm-flusso-tinta));stroke-linecap:round;
    stroke-dasharray:3 5.5;opacity:.9;
    animation-name:dm-flusso-scorre;animation-timing-function:linear;
    animation-iteration-count:infinite}
  @keyframes dm-flusso-scorre{to{stroke-dashoffset:-17}}
  @media (prefers-reduced-motion:reduce){
    .dm-flusso-arco{animation:none;stroke-dasharray:none}}
  @media(max-width:520px){
    /* Su un telefono «accanto» non esiste: la card va a capo sotto la griglia
       e allora prende la riga tutta, come tutto il resto. */
    .dm-flusso-card{flex-basis:100%;width:100%;padding:11px;gap:8px}
    .dm-flusso-card svg{max-height:220px}
    .dm-flusso-nome{font-size:12px}
    .dm-flusso-fonte{font-size:9px;padding:2px 8px}
  }
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
