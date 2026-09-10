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
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
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
/* ── il disegno ──────────────────────────────────────────────────────────── */

/* Dove sta ognuno, in centesimi della scena: i nodi sono HTML e le linee sono
 * un SVG dietro di loro, e sono le stesse coordinate per tutti e due.
 *
 * Perché HTML e non un disegno solo: le icone. Il disegno di prima metteva
 * un'emoji dentro ogni cerchio — ☀️ 🔌 🔋 🚗 — cioè le icone del telefono, che
 * su Android e su iPhone sono due disegni diversi e su nessuno dei due sono i
 * nostri. È la stessa cosa segnalata per la tendina del Report, «una non è
 * nostra», e valeva anche qui. Il catalogo di casa li disegna tutti e cinque,
 * ma restituisce HTML, quindi i nodi sono HTML e dentro un SVG non ci stanno.
 *
 * Le linee vanno da centro a centro e passano SOTTO i nodi, che sono opachi:
 * così non c'è nessun raccordo da ricalcolare quando la card cambia larghezza
 * — e cambia, perché sul telefono è una corsia stretta e sul desktop una
 * larga. Prima le strade erano scritte a mano fino al bordo di ogni cerchio,
 * in unità di un disegno di misura fissa. */
const POSTI = Object.freeze({
  rete: Object.freeze({ x: 19, y: 17, disegno: "presa", tinta: "37,99,235" }),
  solare: Object.freeze({ x: 50, y: 17, disegno: "solare", tinta: "245,158,11" }),
  batteria: Object.freeze({ x: 81, y: 17, disegno: "batteria", tinta: "20,184,166" }),
  casa: Object.freeze({ x: 50, y: 53, disegno: "casa", tinta: "100,116,139" }),
  auto: Object.freeze({ x: 50, y: 86, disegno: "auto", tinta: "139,92,246" }),
});

/* Fra due nodi la corrente va in un verso o nell'altro, mai in tutti e due
 * insieme: la linea e' la stessa e cambia solo da che parte scorre il
 * tratteggio.
 *
 * Rete e batteria stanno ai due capi della fila delle sorgenti e il sole in
 * mezzo: quando si parlano fra loro si scavalca dall'alto, perche' passare in
 * mezzo vorrebbe dire tagliare il sole a meta'. */
const STRADE = Object.freeze({
  "solare|casa": "M50,17 L50,53",
  "rete|casa": "M19,17 L50,53",
  "batteria|casa": "M81,17 L50,53",
  "casa|auto": "M50,53 L50,86",
  "solare|rete": "M50,17 L19,17",
  "solare|batteria": "M50,17 L81,17",
  "rete|batteria": "M19,17 C19,-7 81,-7 81,17",
});

const stradaDi = (da, a) => STRADE[`${da}|${a}`] || STRADE[`${a}|${da}`] || "";
/* Se la linea è disegnata al contrario di come scorre la corrente, il
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
 * Il numero adesso sta FUORI dal cerchio, sotto di lui, e non più dentro: in
 * un cerchio piccolo ci stava per un pelo, e sopra i dieci kilowatt non ci
 * stava affatto. Fuori si legge, e il cerchio resta il disegno. */
function scritta(watt) {
  if (watt == null) return "";
  const valore = Math.abs(watt);
  if (valore < 1000) return `${Math.round(valore)} W`;
  const kw = valore / 1000;
  if (kw >= 10) return `${kw.toFixed(1).replace(".", t(",", "."))} kW`;
  return `${kw.toFixed(1).replace(".", t(",", "."))} kW`;
}

const GIRO_CARICA = 2 * Math.PI * 18;

/* La carica della batteria è un anello attorno al suo cerchio, non un secondo
 * numero: «64%» accanto ai watt sarebbe una riga da leggere, un anello pieno
 * per due terzi si legge senza leggerlo. Parte dall'alto, da cui la rotazione. */
function anelloDellaCarica(nodo) {
  if (nodo.chiave !== "batteria" || nodo.soc == null) return "";
  const quota = (Math.max(0, Math.min(100, nodo.soc)) / 100) * GIRO_CARICA;
  return `<svg class="dm-flusso-carica" viewBox="0 0 40 40" aria-hidden="true">
      <circle class="dm-flusso-pista" cx="20" cy="20" r="18"></circle>
      <circle class="dm-flusso-quota" cx="20" cy="20" r="18" transform="rotate(-90 20 20)"
        style="stroke-dasharray:${quota.toFixed(1)} ${GIRO_CARICA.toFixed(1)}"></circle>
    </svg>`;
}

/* La percentuale della carica, scritta.
 *
 * L'anello dice a colpo d'occhio quanto è piena, ed è la lettura giusta di
 * sfuggita; ma QUANTO esattamente non lo dice, e il numero stava solo nel
 * titolo — cioè nel suggerimento del mouse, che su un telefono non esiste.
 * «Sarebbe possibile visualizzare la percentuale della batteria e non solo la
 * potenza?» (#459), chiesto da un iPhone: da lì non c'era nessun modo di
 * saperlo, e l'anello da solo distingue male un 55% da un 65%.
 *
 * Sta sotto i watt e non accanto: due numeri sulla stessa riga si leggono come
 * un numero solo lungo, e uno dei due parla di potenza mentre l'altro parla di
 * quanto è piena — due cose diverse, due righe. Piccola e nel colore della
 * batteria, perché la riga grossa resta quella dei watt. */
function caricaScritta(nodo) {
  if (nodo.chiave !== "batteria" || nodo.soc == null) return "";
  const quanto = Math.round(Math.max(0, Math.min(100, nodo.soc)));
  return `<span class="dm-flusso-soc">${esc(`${quanto}%`)}</span>`;
}

/* Un nodo a zero che nessun arco tocca non è una notizia allegra da guardare:
 * «Auto 0 W» da solo in fondo, senza nessuna linea, sembra un pezzo di disegno
 * rotto. Non si toglie — dire che la colonnina non sta erogando è comunque dire
 * qualcosa — ma si spegne: resta leggibile, e non pesa come chi sta lavorando. */
function nodoMarkup(nodo, attaccati) {
  const posto = POSTI[nodo.chiave];
  if (!posto) return "";
  const eLaCasa = nodo.chiave === "casa";
  const muto = !eLaCasa && !nodo.watt && !attaccati.has(nodo.chiave);
  const carica =
    nodo.chiave === "batteria" && nodo.soc != null ? ` — ${Math.round(nodo.soc)}%` : "";
  const valore = esc(scritta(nodo.watt));
  return `<div class="dm-flusso-nodo" data-nodo="${esc(nodo.chiave)}"${
    muto ? ' data-muto="true"' : ""
  } style="--dm-flusso-tinta:${posto.tinta};--dm-flusso-x:${posto.x}%;--dm-flusso-y:${posto.y}%"
      title="${esc(nomeDelNodo(nodo.chiave) + carica)}">
      <span class="dm-flusso-disco">
        ${anelloDellaCarica(nodo)}
        <span class="dm-flusso-glifo">${disegnoDelCatalogo(posto.disegno, eLaCasa ? 26 : 18)}</span>
      </span>
      <span class="dm-flusso-valore">${eLaCasa ? "" : valore}</span>
      ${caricaScritta(nodo)}
      ${eLaCasa ? `<strong class="dm-flusso-usa">${valore || "—"}</strong>` : ""}
    </div>`;
}

function arcoMarkup(arco, massimo) {
  const strada = stradaDi(arco.da, arco.a);
  if (!strada) return "";
  const forza = forzaDellArco(arco.watt, massimo);
  const spessore = (1.5 + forza * 1.9).toFixed(2);
  /* Più corrente, più svelto il tratteggio: è il modo in cui una mappa dice
   * «di qui ne passa tanta» senza scriverci sopra un altro numero. */
  const durata = (2.4 - forza * 1.6).toFixed(2);
  const verso = alContrario(arco.da, arco.a) ? "reverse" : "normal";
  return `<path class="dm-flusso-arco" d="${strada}" data-da="${esc(arco.da)}" data-a="${esc(arco.a)}"
      style="--dm-flusso-tinta:${POSTI[arco.da]?.tinta || POSTI.casa.tinta};stroke-width:${spessore};animation-duration:${durata}s;animation-direction:${verso}"></path>`;
}

/** Il disegno del flusso, dal modello: serve anche alle prove. */
export function flussoMarkup(modello) {
  const massimo = arcoPiuGrande(modello.archi);
  const archi = modello.archi.map((arco) => arcoMarkup(arco, massimo)).join("");
  const attaccati = new Set(modello.archi.flatMap((arco) => [arco.da, arco.a]));
  const nodi = modello.presenti
    .map((chiave) => nodoMarkup(modello.nodi[chiave], attaccati))
    .join("");
  /* Da dove arriva adesso quello che la casa usa: è il titolo della mappa, e la
   * sua tinta veste la card come il colore di presenza veste quelle delle
   * persone — l'alone dietro, l'anello della casa, il bordo quando ci si passa
   * sopra. Così da lontano, senza leggere niente, si vede se la casa sta
   * andando a sole o a rete. */
  const fonte = sorgenteDiCasa(modello.archi);
  const tinta = POSTI[fonte]?.tinta || POSTI.casa.tinta;
  return `<article class="dm-flusso-card" style="--dm-flusso-fonte:${tinta}">
    <strong class="dm-flusso-nome">${esc(t("Flusso energia", "Energy flow"))}${
      fonte ? `<span class="dm-flusso-fonte">${esc(nomeDelNodo(fonte))}</span>` : ""
    }</strong>
    <div class="dm-flusso-scena">
      <svg class="dm-flusso-linee" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="${esc(t("Il flusso dell'energia di casa", "The home energy flow"))}" role="img">
        ${archi}
      </svg>
      ${nodi}
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
  #${BLOCCO_ID}{display:block;margin:14px 0 0;max-width:320px}

  /* La card sta in una corsia della fila delle persone — la stessa dei widget —
     e ne prende una, non una larghezza a caso. */
  .dm-flusso-card{
    --dm-flusso-fonte:100,116,139;
    width:100%;max-width:100%;grid-column:-2/-1;
    position:relative;display:flex;flex-direction:column;gap:6px;
    padding:13px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);
    border-radius:22px;box-shadow:var(--shadow-sculpted,0 4px 14px rgba(15,23,42,.08));
    transition:var(--transition,.3s);overflow:hidden}
  /* L'alone della sorgente, morbido dietro il disegno: è lui a dire da lontano
     se la casa sta andando a sole o a rete, prima di leggere qualsiasi cosa. */
  .dm-flusso-card::before{
    content:"";position:absolute;left:50%;top:34px;translate:-50% 0;
    width:150%;aspect-ratio:1;
    background:radial-gradient(closest-side,rgba(var(--dm-flusso-fonte),.17),transparent 70%);
    pointer-events:none}
  .dm-flusso-card:hover{box-shadow:var(--shadow-hover,0 10px 25px rgba(15,23,42,.14));
    border-color:rgba(var(--dm-flusso-fonte),.35)}

  /* L'intestazione: il nome piccolo e sotto la sorgente nella sua tinta. In
     colonna e non in fila, perché «Flusso energia» e «Fotovoltaico» sulla
     stessa riga, in una corsia stretta, si tagliavano a vicenda. */
  .dm-flusso-nome{position:relative;display:flex;flex-direction:column;gap:1px;min-width:0;
    font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;
    color:var(--text-dim,#94a3b8)}
  /* La sorgente senza spaziatura: con le lettere allargate «FOTOVOLTAICO» si
     legge «FOTO VOLTAICO», cioe' come due parole che non sono. */
  .dm-flusso-fonte{font-size:11px;letter-spacing:0;color:rgb(var(--dm-flusso-fonte));
    max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* ── la scena ────────────────────────────────────────────────────────────
     Quadrata, e tutto dentro è in centesimi: i nodi si posano con le stesse
     coordinate delle linee, quindi non c'è nessun raccordo da rifare quando la
     card cambia larghezza. */
  /* La scena e' VERTICALE, non quadrata, e non e' un dettaglio.
     Quadrata, in una corsia da 177px, veniva 153x153: dischi da 31px e numeri
     da 9px, cioe' un disegno che su un telefono non si legge — «non entra, non
     si vede nulla», ed era vero anche se niente era ritagliato. Il quadrato
     sprecava i quattro angoli e strozzava tutto il resto.
     In verticale la forma segue la corsia: le tre sorgenti in fila in cima, la
     casa in mezzo, l'auto in fondo. Si legge dall'alto in basso — da dove
     arriva, dove passa, dove va — e ci sta il doppio di disegno. */
  .dm-flusso-scena{position:relative;width:100%;aspect-ratio:100/145;
    --dm-flusso-disco:42px;--dm-flusso-casa:62px}
  /* Le linee stanno SOTTO i nodi, che sono opachi: vanno da centro a centro e
     spariscono sotto i cerchi.
     Il disegno si stira insieme alla scena — preserveAspectRatio none —
     perche' le sue coordinate sono le STESSE percentuali con cui si posano i
     nodi: cento in larghezza e cento in altezza, qualunque forma abbia la
     scena. Con il rapporto conservato le linee finivano schiacciate in un
     quadrato centrato mentre i nodi usavano l'altezza intera, e i tratteggi
     non arrivavano piu' ai cerchi. Lo spessore non si stira comunque, ci
     pensa non-scaling-stroke. */
  .dm-flusso-linee{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .dm-flusso-arco{
    fill:none;stroke:rgb(var(--dm-flusso-tinta));stroke-linecap:round;
    stroke-dasharray:2.4 4.2;
    animation-name:dm-flusso-scorre;animation-timing-function:linear;
    animation-iteration-count:infinite;
    vector-effect:non-scaling-stroke}
  @keyframes dm-flusso-scorre{to{stroke-dashoffset:-13.2}}
  @media (prefers-reduced-motion:reduce){
    .dm-flusso-arco{animation:none;stroke-dasharray:none;opacity:.75}}

  /* ── i nodi ──────────────────────────────────────────────────────────────
     Un cerchio con la NOSTRA icona dentro, e il numero sotto. Non un disco
     pieno di tinta con l'emoji del telefono sopra: un fondo appena velato, un
     anello netto e l'icona nel colore si leggono a quaranta pixel e stanno
     nella stessa famiglia del resto della plancia. */
  .dm-flusso-nodo{
    position:absolute;left:var(--dm-flusso-x);top:var(--dm-flusso-y);
    translate:-50% -50%;
    display:flex;flex-direction:column;align-items:center;gap:3px;
    transition:opacity .3s ease}
  .dm-flusso-disco{
    position:relative;display:grid;place-items:center;
    width:var(--dm-flusso-disco);height:var(--dm-flusso-disco);border-radius:50%;
    background:
      linear-gradient(155deg,rgba(var(--dm-flusso-tinta),.17),rgba(var(--dm-flusso-tinta),.05)),
      var(--card-bg,#fff);
    border:1.5px solid rgba(var(--dm-flusso-tinta),.42);
    box-shadow:0 4px 11px -7px rgba(var(--dm-flusso-tinta),.8),
      inset 0 1px 0 rgba(255,255,255,.75)}
  .dm-flusso-glifo{display:grid;place-items:center;line-height:0;
    color:rgb(var(--dm-flusso-tinta))}
  .dm-flusso-glifo svg{display:block;width:100%;height:100%}
  .dm-flusso-glifo .dm-appliance-art,.dm-flusso-glifo .dm-catalogo-art{display:grid;place-items:center}
  /* Il numero sotto il cerchio, non dentro: dentro ci stava per un pelo, e
     sopra i dieci kilowatt non ci stava.
     Su una pastiglia del colore della card, perche' le linee del flusso gli
     passano dietro: senza, «4,2 kW» finiva scritto sopra due tratteggi e non
     si leggeva piu' ne' il numero ne' la linea. */
  .dm-flusso-valore{font-size:11px;font-weight:900;line-height:1;white-space:nowrap;
    color:var(--text,#0f172a);font-variant-numeric:tabular-nums;
    padding:2px 5px;border-radius:999px;background:var(--card-bg,#fff)}
  .dm-flusso-valore:empty{display:none;padding:0}
  /* Le tre sorgenti stanno in fila e i loro numeri no: sfalsati.
     Coi numeri lunghi — «12,4 kW», cinque caratteri — tre pastiglie sulla
     stessa riga non ci stanno in una corsia da 153px e si sovrappongono. Il
     numero del sole va sopra il suo cerchio, gli altri due sotto i loro: la
     riga non e' mai una sola. */
  .dm-flusso-nodo[data-nodo="solare"]{flex-direction:column-reverse}
  /* Il numero dell'auto sta di FIANCO, non sotto: sotto e' il fondo della
     scena, e una pastiglia li' ci finisce fuori. Di fianco lo spazio c'e'. */
  .dm-flusso-nodo[data-nodo="auto"]{flex-direction:row;gap:6px}
  /* Il nodo spento: si legge ancora, e non pesa come chi sta lavorando. */
  .dm-flusso-nodo[data-muto="true"]{opacity:.38}
  .dm-flusso-nodo[data-muto="true"] .dm-flusso-disco{box-shadow:none}

  /* La casa è l'eroe: più grande, bianca, con l'anello della sorgente attorno
     e il numero grosso sotto l'icona. Le sorgenti sono i colori, lei è il
     posto dove arrivano. */
  .dm-flusso-nodo[data-nodo="casa"]{gap:1px;z-index:2}
  .dm-flusso-nodo[data-nodo="casa"] .dm-flusso-disco{
    width:var(--dm-flusso-casa);height:var(--dm-flusso-casa);
    background:var(--card-bg,#fff);
    border:2.5px solid rgb(var(--dm-flusso-fonte));
    box-shadow:0 6px 18px -9px rgba(var(--dm-flusso-fonte),.85),
      0 0 0 5px rgba(var(--dm-flusso-fonte),.08)}
  .dm-flusso-nodo[data-nodo="casa"] .dm-flusso-glifo{color:rgb(var(--dm-flusso-fonte))}
  .dm-flusso-usa{font-size:17px;font-weight:900;letter-spacing:-.03em;line-height:1.15;
    color:var(--text,#0f172a);font-variant-numeric:tabular-nums;white-space:nowrap;
    padding:1px 6px;border-radius:999px;
    background:var(--card-bg,#fff);
    box-shadow:0 1px 6px -3px rgba(15,23,42,.3)}

  /* La percentuale della carica, sotto i watt della batteria: la lettura
     precisa, piccola, sotto quella veloce. */
  .dm-flusso-soc{font-size:9.5px;font-weight:900;line-height:1;letter-spacing:-.02em;
    white-space:nowrap;font-variant-numeric:tabular-nums;
    padding:1.5px 5px;border-radius:999px;
    color:rgb(var(--dm-flusso-tinta));
    background:rgba(var(--dm-flusso-tinta),.13)}

  /* L'anello della carica, attorno al cerchio della batteria. */
  .dm-flusso-carica{position:absolute;inset:-4px;width:auto;height:auto;overflow:visible}
  .dm-flusso-pista{fill:none;stroke:rgba(var(--dm-flusso-tinta),.18);stroke-width:3}
  .dm-flusso-quota{fill:none;stroke:rgb(var(--dm-flusso-tinta));stroke-width:3;stroke-linecap:round}

  html[data-theme="dark"] .dm-flusso-card{
    background:var(--card-bg,#111827);border-color:var(--card-border,#1f2937)}
  html[data-theme="dark"] .dm-flusso-disco{box-shadow:0 4px 11px -7px rgba(var(--dm-flusso-tinta),.9)}

  /* Sul telefono resta accanto — è quello che era stato chiesto — e la scena si
     stringe con la corsia: i nodi rimpiccioliscono, le coordinate no. */
  @media(max-width:760px){
    #${BLOCCO_ID}{max-width:none}
    .dm-flusso-card{padding:11px;gap:5px}
    .dm-flusso-scena{--dm-flusso-disco:38px;--dm-flusso-casa:56px}
    .dm-flusso-usa{font-size:15px}
    .dm-flusso-valore{font-size:10.5px}
    .dm-flusso-soc{font-size:9px;padding:1px 4px}
  }
  /* Più stretto di un telefono no: sotto i 360px due corsie non tengono né una
     persona né un disegno, e la card scende sotto e prende la riga. */
  @media(max-width:360px){
    .dm-flusso-card{grid-column:1/-1}
    .dm-flusso-scena{max-width:280px;margin:0 auto;--dm-flusso-disco:44px;--dm-flusso-casa:66px}
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
