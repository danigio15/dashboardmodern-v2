/* I blocchi della Home si mettono nell'ordine che si vuole.
 *
 * «Riordinare a piacere la Home.» Le tessere si riordinavano, le persone si
 * riordinavano, le azioni rapide si riordinavano — ma sempre dentro il loro
 * blocco. L'ordine dei blocchi FRA LORO era scritto nel codice, e ognuno lo
 * decideva per conto suo: le persone si attaccano sotto le pastiglie, i widget
 * si attaccano sotto le persone, le azioni rapide stanno dove le ha messe il
 * documento. Chi rientra in casa e vuole i tasti per primi non poteva averli.
 *
 * Qui non si disegna niente: i blocchi li fanno gli altri, questo li mette in
 * fila. E li mette in fila DOPO che sono nati, perche' un blocco puo' comparire
 * a meta' giro — le persone appena si configurano, i dispositivi appena ce n'e'
 * uno — e un ordine applicato una volta sola durerebbe fino al primo che nasce.
 *
 * Non si tocca la pagina quando non la guarda nessuno: e' la stessa regola del
 * resto della plancia, e qui vale doppio perche' spostare nodi costa
 * impaginazione.
 */
import { spostaNellElenco } from "../core/ordine-a-mano.js";
import { CHIAVE_FLUSSO_HOME, flussoInHome, renderFlusso } from "./flusso-di-casa-section.js";
import { BLOCCHI_DELLA_HOME, ordineDeiBlocchi } from "../core/ordine-dei-blocchi.js";
import {
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

const KEY = "__DASHBOARDMODERN_HOME_BLOCCHI__";
const state = (root[KEY] ||= { installed: false, inCoda: false });

export const CHIAVE_ORDINE_BLOCCHI = "cd_home_blocchi";

/** L'ordine salvato, ripulito. */
export function ordineSalvato() {
  return ordineDeiBlocchi(readJson(CHIAVE_ORDINE_BLOCCHI, null));
}

/* I nodi di un blocco, nell'ordine in cui stanno nella pagina.
 *
 * Un blocco puo' essere un nodo solo — le persone e i widget si portano dentro
 * il loro titolo — oppure due, perche' il documento vendorizzato stampa il
 * titolo e la griglia come fratelli. Spostare la griglia e lasciare indietro il
 * titolo e' il modo di ottenere una Home con le scritte staccate da quello che
 * annunciano, quindi un blocco e' sempre TUTTI i suoi pezzi. */
function pezziDelBlocco(nome, pagina) {
  const dentro = (nodo) => (nodo && nodo.parentElement === pagina ? nodo : null);
  if (nome === "persone") return [dentro(doc.getElementById("dm-people"))].filter(Boolean);
  if (nome === "flusso") return [dentro(doc.getElementById("dm-flusso"))].filter(Boolean);
  if (nome === "widget") return [dentro(doc.getElementById("dm-widgets"))].filter(Boolean);
  if (nome === "dispositivi")
    return [dentro(doc.getElementById("dev-title")), dentro(doc.getElementById("dev-grid"))].filter(
      Boolean,
    );
  if (nome === "azioni") {
    const griglia = doc.getElementById("qa-grid");
    /* Il ripiano attorno ai tasti lo mette un altro modulo: quando c'e', il
     * blocco e' il ripiano; quando non c'e' ancora, e' la griglia nuda. */
    const vassoio = griglia?.closest?.("[data-dm-vassoio]");
    const corpo = dentro(vassoio) || dentro(griglia);
    if (!corpo) return [];
    const titolo = corpo.previousElementSibling;
    return titolo?.classList?.contains("section-title") && !titolo.id ? [titolo, corpo] : [corpo];
  }
  return [];
}

/* La Home e' quella che si sta guardando? Spostare nodi in una pagina chiusa e'
 * lavoro fatto per nessuno, e costa un'impaginazione per nodo. */
function laHomeSiGuarda() {
  const pagina = doc?.getElementById?.("page-home");
  return pagina?.classList?.contains("active") ? pagina : null;
}

/**
 * Mette i blocchi nell'ordine salvato.
 *
 * Torna `true` se ha spostato qualcosa. Non fa niente quando l'ordine c'e'
 * gia': il paragone costa un giro sui figli, spostare costa un'impaginazione.
 */
export function applicaLOrdineDeiBlocchi(pagina = laHomeSiGuarda()) {
  if (!pagina) return false;
  const fila = ordineSalvato();
  const gruppi = fila.map((nome) => pezziDelBlocco(nome, pagina)).filter((pezzi) => pezzi.length);
  if (gruppi.length < 2) return false;

  /* Si guarda com'e' adesso: se i primi nodi dei gruppi sono gia' in
   * quest'ordine dentro la pagina, non c'e' niente da fare. */
  const figli = [...pagina.children];
  const posizione = (pezzi) => figli.indexOf(pezzi[0]);
  const posizioni = gruppi.map(posizione);
  if (posizioni.every((dove, indice) => indice === 0 || dove > posizioni[indice - 1])) return false;

  /* Il punto da cui si riparte: subito dopo le pastiglie di stato, che restano
   * in cima perche' sono un avviso e non un blocco. Senza pastiglie, subito
   * dopo il primo nodo che non appartiene a nessun blocco — l'intestazione. */
  const miei = new Set(gruppi.flat());
  const pastiglie = doc.getElementById("dashboard-pills-row");
  let dopo =
    pastiglie?.parentElement === pagina
      ? pastiglie
      : figli.filter((nodo) => !miei.has(nodo)).pop() || null;

  for (const pezzi of gruppi)
    for (const nodo of pezzi) {
      if (dopo) dopo.after(nodo);
      else pagina.prepend(nodo);
      dopo = nodo;
    }
  return true;
}

/* Si rimette in fila al giro dopo, una volta sola: i blocchi nascono a momenti
 * diversi e ogni evento che li fa nascere chiamerebbe questa funzione. */
function inCoda() {
  if (state.inCoda) return;
  state.inCoda = true;
  root.queueMicrotask?.(() => {
    state.inCoda = false;
    try {
      applicaLOrdineDeiBlocchi();
    } catch (_error) {}
  });
}

/* ── la scheda dove si riordina: la Home ─────────────────────────────── */

/* «Il riordina dove l'hai messo, che in Home non c'e'.» Stava nella scheda
 * dei Widget, perche' li' si riordinano le tessere: ma le tessere sono UNO dei
 * blocchi, e chi cerca l'ordine della Home lo cerca nella scheda della Home.
 * «Non deve stare nella sezione Widget, ti avevo detto nella sezione Home.»
 *
 * Il guscio disegna la scheda Home (`sez0`) da capo a ogni passaggio: il
 * pannello si rimette in cima ogni volta che la scheda viene rifatta, e solo
 * quando e' cambiato qualcosa. */
const SCHEDA_HOME = "sez0";

/* I nomi delle sezioni della Home. Le tessere hanno una scheda loro dove si
 * scelgono e si ordinano fra loro; le persone e le azioni rapide pure. Qui si
 * mettono in fila i blocchi. */
const NOMI_DEI_BLOCCHI = () => ({
  persone: ["👥", t("Persone", "People")],
  flusso: ["🔀", t("Flusso energia", "Energy flow")],
  widget: ["🧩", t("Widget", "Widgets")],
  azioni: ["⚡", t("Azioni rapide", "Quick actions")],
  dispositivi: ["📟", t("Dispositivi", "Devices")],
});

function schedaAperta() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function pannelloMarkup() {
  const nomi = NOMI_DEI_BLOCCHI();
  const fila = ordineSalvato();
  const righe = fila
    .map((nome, indice) => {
      const [icona, etichetta] = nomi[nome] || ["", nome];
      return `<div class="ed-row dm-blocco-row" data-blocco="${esc(nome)}">
        <span class="dm-blocco-icona" aria-hidden="true">${icona}</span>
        <span class="ed-row-main"><strong class="ed-row-new">${esc(etichetta)}</strong></span>
        <button type="button" class="ed-del dm-blocco-move" data-blocco-su aria-label="${esc(
          t("Più in alto", "Move up"),
        )}"${indice === 0 ? " disabled" : ""}>▲</button>
        <button type="button" class="ed-del dm-blocco-move" data-blocco-giu aria-label="${esc(
          t("Più in basso", "Move down"),
        )}"${indice === fila.length - 1 ? " disabled" : ""}>▼</button>
      </div>`;
    })
    .join("");
  return `<div class="ed-sec-title">🏠 ${esc(t("Ordine dei blocchi della Home", "Order of the Home blocks"))}</div>
    <div class="ed-intro">${esc(
      t(
        "In che ordine si vedono in Home: persone, flusso dell'energia, widget, azioni rapide, dispositivi. Dentro ogni blocco l'ordine si fa dove si configura quel blocco: le persone nella loro scheda, le tessere in Widget, le azioni rapide nella loro.",
        "The order they appear in on Home: people, the energy flow, widgets, quick actions, devices. Inside each block the order is set where that block is configured: people in their own tab, tiles in Widgets, quick actions in theirs.",
      ),
    )}</div>
    <div class="dm-blocco-list">${righe}</div>
    <label class="dm-blocco-flusso">
      <input type="checkbox" data-dm-blocco-flusso${flussoInHome() ? " checked" : ""}>
      <span>
        <b>${esc(t("Mostra il flusso dell'energia", "Show the energy flow"))}</b>
        <small>${esc(
          t(
            "Il disegno con il fotovoltaico, la rete, la batteria, la casa e l'auto: le stesse frecce della sezione Energia. Compare da solo quando c'è abbastanza da raccontare.",
            "The drawing with solar, the grid, the battery, the house and the car: the same arrows as the Energy section. It shows up by itself when there is enough to tell.",
          ),
        )}</small>
      </span>
    </label>`;
}

/** Il pannello in cima alla scheda Home dell'editor, quando e' quella aperta. */
export function ensurePannelloDeiBlocchi(body = doc?.getElementById?.("ed-body")) {
  if (!body) return false;
  let pannello = body.querySelector(":scope > [data-dm-home-blocchi]");
  if (schedaAperta() !== SCHEDA_HOME) {
    pannello?.remove();
    return false;
  }
  const firma = `${ordineSalvato().join(",")}§${flussoInHome()}`;
  if (pannello && pannello.dataset.dmFirma === firma) return true;
  if (!pannello) {
    pannello = doc.createElement("div");
    pannello.className = "dm-home-blocchi";
    pannello.dataset.dmHomeBlocchi = "true";
  }
  pannello.dataset.dmFirma = firma;
  pannello.innerHTML = pannelloMarkup();
  if (body.firstElementChild !== pannello) body.prepend(pannello);
  return true;
}

/* Le frecce: si sposta la voce, la Home si rimette in fila subito, e il
 * pannello si ridisegna con la fila nuova. */
function onClickFreccia(event) {
  const freccia = event.target?.closest?.(
    "[data-dm-home-blocchi] [data-blocco-su],[data-dm-home-blocchi] [data-blocco-giu]",
  );
  if (!freccia) return;
  event.preventDefault();
  const fila = ordineSalvato();
  const indice = fila.indexOf(clean(freccia.closest("[data-blocco]")?.dataset?.blocco));
  if (indice < 0) return;
  const prossima = spostaNellElenco(fila, indice, freccia.hasAttribute("data-blocco-su") ? -1 : 1);
  if (!prossima) return;
  writeJsonIfChanged(CHIAVE_ORDINE_BLOCCHI, prossima);
  try {
    applicaLOrdineDeiBlocchi();
  } catch (_error) {}
  ensurePannelloDeiBlocchi();
}

/* L'interruttore del flusso: si spegne e il blocco sparisce dalla Home subito,
 * non al prossimo stato che arriva. */
function onClickFlusso(event) {
  const casella = event.target?.closest?.("[data-dm-blocco-flusso]");
  if (!casella) return;
  writeJsonIfChanged(CHIAVE_FLUSSO_HOME, Boolean(casella.checked));
  try {
    renderFlusso();
    applicaLOrdineDeiBlocchi();
  } catch (_error) {}
  ensurePannelloDeiBlocchi();
  root.edToast?.(
    casella.checked
      ? t("🔀 Flusso dell'energia in Home", "🔀 Energy flow on Home")
      : t("🔀 Flusso dell'energia nascosto", "🔀 Energy flow hidden"),
  );
}

function stile() {
  return `
    #ed-body .dm-home-blocchi{display:block;margin-bottom:14px}
    #ed-body .dm-blocco-flusso{display:flex;align-items:flex-start;gap:10px;margin:0 0 14px}
    #ed-body .dm-blocco-flusso small{display:block;opacity:.75}
    #ed-body .dm-blocco-list{display:grid;gap:6px;margin-bottom:14px}
    #ed-body .dm-blocco-row{display:flex!important;align-items:center;gap:10px;padding:8px 12px!important}
    #ed-body .dm-blocco-icona{font-size:17px;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:0 0 24px}
    #ed-body .dm-blocco-move[disabled]{opacity:.3;pointer-events:none}
  `;
}

export function installHomeBlocchiSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-home-blocchi", stile());
  onEditorRedraw("__dmHomeBlocchiEditor", () => ensurePannelloDeiBlocchi());
  doc.addEventListener("click", onClickFreccia);
  doc.addEventListener("change", onClickFlusso);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:plancia-dipinta",
  ])
    root.addEventListener?.(evento, inCoda);
  /* E quando si TORNA sulla Home.
   *
   * L'ordine si applica solo a pagina aperta — spostare nodi in una pagina
   * chiusa e' lavoro per nessuno — ma il guscio cambia pagina con un
   * ascoltatore scritto dentro il documento, che accende una classe e non
   * avvisa nessuno. Cosi' chi riordina stando su un'altra pagina, o chi torna
   * sulla Home dopo, la trovava com'era finche' non passava di li' un evento
   * di stato per tutt'altra ragione: funzionava per caso, non per costruzione.
   *
   * Questo ascoltatore sta sul documento e parte dopo il loro, che la classe
   * l'ha gia' accesa: al microtask seguente la Home e' quella attiva. */
  doc.addEventListener("click", (evento) => {
    if (evento.target?.closest?.(".tab,[data-tab]")) inCoda();
  });
  inCoda();
}

/* Quali blocchi esistono, per chi disegna la scheda che li riordina. */
export { BLOCCHI_DELLA_HOME };
