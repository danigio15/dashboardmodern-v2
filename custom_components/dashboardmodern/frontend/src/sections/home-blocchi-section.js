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
import { oggettoWidget } from "../core/oggetti-widget.js";
import { spostaNellElenco } from "../core/ordine-a-mano.js";
import {
  BLOCCHI_DELLA_HOME,
  BLOCCO_DEL_METEO,
  BLOCCO_INTESTAZIONE,
  lIntestazioneStaInCima,
  CHIAVE_ORDINE_BLOCCHI,
  ordineDeiBlocchi,
} from "../core/ordine-dei-blocchi.js";
import { CHIAVE_PASTIGLIE, lePastiglieSiVedono } from "../core/pastiglie-di-stato.js";
import {
  CHIAVE_STANZE_IN_PLANCIA,
  conLaStanza,
  idDellaStanza,
  laStanzaSiVede,
  STANZE_MASSIME,
} from "../core/stanze-in-plancia.js";
import {
  BLOCCO_ID as BLOCCO_STANZE,
  ridisegnaStanzeInPlancia,
  stanzeScelte,
} from "./stanze-in-plancia-section.js";
import {
  attributoSeCambia,
  clean,
  doc,
  esc,
  iconGlyphHtml,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";
import { rigaDellaTestata } from "./weather-in-masthead-section.js";

const KEY = "__DASHBOARDMODERN_HOME_BLOCCHI__";
const state = (root[KEY] ||= { installed: false, inCoda: false });

/* La chiave sta nel modello, che la legge anche chi non disegna le frecce: si
 * riespone da qui perche' e' da questa sezione che la conoscono tutti. */
export { CHIAVE_ORDINE_BLOCCHI };

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
  /* L'intestazione e' un blocco solo quando e' scesa dentro la Home. Finche'
   * sta sopra la pagina non e' figlia sua, quindi qui non c'e' niente da
   * mettere in fila — ed e' giusto: li' sta sopra tutto, per tutte le
   * pagine. */
  if (nome === BLOCCO_INTESTAZIONE) return [dentro(laTestata())].filter(Boolean);
  /* Il riquadro col meteo e l'ora (#492) e' un blocco solo quando e' sceso in
   * pagina. Finche' sta nell'intestazione non e' figlio della Home, quindi qui
   * non c'e' niente da mettere in fila — ed e' giusto: li' sta sopra tutto. */
  if (nome === BLOCCO_DEL_METEO)
    return [dentro(doc.querySelector(".dm-testata-riga"))].filter(Boolean);
  if (nome === "persone") return [dentro(doc.getElementById("dm-people"))].filter(Boolean);
  if (nome === "widget") return [dentro(doc.getElementById("dm-widgets"))].filter(Boolean);
  /* Le stanze (#493) sono un nodo solo: il titolo se lo porta dentro, come le
   * persone e i widget. */
  if (nome === "stanze") return [dentro(doc.getElementById(BLOCCO_STANZE))].filter(Boolean);
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

/* ── l'intestazione, che e' di tutte le pagine ─────────────────────────────
 *
 * «Prevedi di spostare anche intestazione della home, quindi la prima sezione
 * compresa di hamburger.»
 *
 * La striscia col menu non e' un blocco come gli altri: sta FUORI dalla Home —
 * il guscio la stampa sopra la barra delle linguette — e la usano anche
 * l'Energia, il Clima, la Sicurezza. Spostarla dentro la Home e lasciarla li'
 * vorrebbe dire che su ogni altra pagina l'hamburger non c'e' piu': un menu
 * che sparisce non e' un riordino, e' una plancia rotta.
 *
 * Quindi scende dentro la Home solo mentre la Home e' quella aperta, e appena
 * si cambia pagina torna al suo posto. Le due funzioni qui sotto sono quelle
 * due mosse, e sono scritte per essere sicure: chiedono dov'e' adesso e non se
 * lo ricordano, cosi' non c'e' un ricordo che possa restare indietro. */
function laTestata() {
  return doc?.querySelector?.("body > header") || doc?.querySelector?.("header") || null;
}

/* Il suo posto di sempre: subito prima della barra delle linguette. */
function rimettiLaTestata() {
  const testata = laTestata();
  const barra = doc?.querySelector?.("nav.tabs");
  if (!testata || !barra || testata.nextElementSibling === barra) return false;
  barra.before(testata);
  return true;
}

/* La porta dentro la Home, se non c'e' gia': da li' in poi la mette in fila
 * `applicaLOrdineDeiBlocchi`, insieme agli altri. */
function portaLaTestataInPagina(pagina) {
  const testata = laTestata();
  if (!testata || !pagina || testata.parentElement === pagina) return false;
  pagina.prepend(testata);
  return true;
}

/**
 * L'intestazione dove l'ordine dice che stia.
 *
 * Prima nella fila — o Home non aperta — vuol dire sopra la pagina, dov'e'
 * sempre stata. Esportata perche' la chiama anche chi cambia pagina: uscire
 * dalla Home deve rimetterla su, e chi esce non passa da `applica`, che sulla
 * pagina chiusa si ferma subito.
 */
export function sistemaLaTestata(pagina = laHomeSiGuarda()) {
  if (!pagina || lIntestazioneStaInCima(readJson(CHIAVE_ORDINE_BLOCCHI, null)))
    return rimettiLaTestata();
  return portaLaTestataInPagina(pagina);
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
      vestiLePastiglie();
      /* Prima di mettere in fila: il riquadro col meteo (#492) va portato dove
       * l'ordine dice che stia. Chi lo porta e' la sezione che lo possiede, e
       * lo fa da sola a ogni giro di stati — ma non a ogni evento che arriva
       * qui, e un ordine applicato su un riquadro ancora nell'intestazione
       * sarebbe un ordine con un blocco in meno. */
      rigaDellaTestata();
      /* E l'intestazione va dove l'ordine dice, prima di mettere in fila: un
       * ordine applicato su una striscia ancora sopra la pagina sarebbe un
       * ordine con un blocco in meno — e su una pagina che non e' la Home
       * questa riga e' cio' che la rimette al suo posto. */
      sistemaLaTestata();
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
  intestazione: t("Intestazione e menù", "Header and menu"),
  meteo: t("Intestazione col meteo", "Weather header"),
  persone: t("Persone", "People"),
  widget: t("Widget", "Widgets"),
  azioni: t("Azioni rapide", "Quick actions"),
  stanze: t("Stanze", "Rooms"),
  dispositivi: t("Dispositivi", "Devices"),
});

/* Quale disegno di casa porta ogni blocco.
 *
 * Quasi tutti si chiamano gia' come il proprio oggetto — persone, widget,
 * azioni, stanze — e per quelli non c'e' niente da scrivere. Gli altri due
 * sono i soliti due nomi: il riquadro in cima si chiama «meteo» e i
 * dispositivi sono gli elettrodomestici della griglia. */
const OGGETTO_DEL_BLOCCO = Object.freeze({
  dispositivi: "elettrodomestici",
  /* La striscia col menu e il nome della casa: il disegno e' quello della
   * plancia stessa. Il catalogo non ha una voce «intestazione», e inventare
   * un'icona fuori catalogo per una riga di configurazione sarebbe l'unica
   * icona non nostra in tutta la scheda. */
  intestazione: "home",
});

const disegnoDelBlocco = (nome) => oggettoWidget(OGGETTO_DEL_BLOCCO[nome] || nome);

function schedaAperta() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function pannelloMarkup() {
  const nomi = NOMI_DEI_BLOCCHI();
  const fila = ordineSalvato();
  const righe = fila
    .map((nome, indice) => {
      const etichetta = nomi[nome] || nome;
      return `<div class="ed-row dm-blocco-row" data-blocco="${esc(nome)}">
        <span class="dm-blocco-icona" aria-hidden="true">${disegnoDelBlocco(nome)}</span>
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
        "In che ordine si vedono in Home. Le prime due — la striscia col menù e il riquadro col meteo — finché stanno in cima restano sopra la pagina, dove sono sempre state; spostandole più in basso scendono in pagina insieme agli altri blocchi. La striscia col menù scende solo qui: sulle altre pagine torna in alto da sola, o l'hamburger sparirebbe. Dentro ogni blocco l'ordine si fa dove si configura quel blocco: le persone nella loro scheda, le tessere in Widget, le azioni rapide nella loro.",
        "The order they appear in on Home. The first two — the strip with the menu and the weather box — stay above the page as long as they are on top, where they have always been; move them further down and they come into the page with the other blocks. The menu strip only comes down here: on the other pages it goes back up by itself, or the hamburger would disappear. Inside each block the order is set where that block is configured: people in their own tab, tiles in Widgets, quick actions in theirs.",
      ),
    )}</div>
    <div class="dm-blocco-list">${righe}</div>
    ${pastiglieMarkup()}
    ${stanzeMarkup()}`;
}

/* L'interruttore delle pastiglie di stato (#491).
 *
 * Sta qui sotto l'ordine dei blocchi e non in mezzo a loro, perche' non e' un
 * blocco: e' una riga che si accende quando la caldaia e' accesa o l'antifurto
 * inserito, e sta in cima perche' e' un avviso. Riordinarla vorrebbe dire
 * poterla mandare in fondo, cioe' non vederla mai; spegnerla invece e' una
 * scelta che si fa sapendo cosa si spegne. */
function pastiglieMarkup() {
  const accese = lePastiglieSiVedono(readJson(CHIAVE_PASTIGLIE, null));
  return `<div class="ed-row dm-blocco-pastiglie">
    <span class="ed-row-main"><strong class="ed-row-new">${esc(
      t("Pastiglie di stato", "Status pills"),
    )}</strong><small class="ed-row-old">${esc(
      t(
        "La riga in cima alla Home: caldaia accesa e antifurto inserito. Compare da sola solo quando ha qualcosa da dire.",
        "The row at the top of Home: boiler on and alarm armed. It only shows up when it has something to say.",
      ),
    )}</small></span>
    <label class="dm-blocco-switch"><input type="checkbox" data-dm-pastiglie${
      accese ? " checked" : ""
    }><span></span></label>
  </div>`;
}

/* Quali stanze si vedono in plancia (#493).
 *
 * «It should also be possible to choose which rooms or areas appear on the home
 * screen.» Una casa di dodici stanze non le vuole tutte in plancia: ne vuole
 * tre — il giardino, il garage, la camera dei bambini. Senza nessuna spuntata
 * il blocco non c'e', ed e' giusto cosi': una plancia non deve riempirsi da
 * sola di roba che nessuno ha chiesto.
 */
function stanzeDiCasa() {
  try {
    const lette = root.getStanze?.();
    if (Array.isArray(lette)) return lette;
  } catch (_errore) {}
  const salvate = readJson("cd_stanze", []);
  return Array.isArray(salvate) ? salvate : [];
}

function stanzeMarkup() {
  const stanze = stanzeDiCasa();
  if (!stanze.length) return "";
  const scelte = stanzeScelte();
  const righe = stanze
    .map((stanza) => {
      const id = idDellaStanza(stanza);
      if (!id) return "";
      const accesa = laStanzaSiVede(scelte, stanza);
      return `<label class="ed-row dm-blocco-stanza">
        <span class="dm-blocco-icona" aria-hidden="true">${iconGlyphHtml(stanza.icon, {
          size: 22,
          kind: "room",
          fallback: "\u{1F6CB}\uFE0F",
        })}</span>
        <span class="ed-row-main"><strong class="ed-row-new">${esc(clean(stanza.name) || id)}</strong></span>
        <span class="dm-blocco-switch"><input type="checkbox" data-dm-stanza-plancia-scelta="${esc(id)}"${
          accesa ? " checked" : ""
        }><span></span></span>
      </label>`;
    })
    .join("");
  /* Il tetto si scrive a parole, non interpolato: una chiave di traduzione con
   * dentro un pezzo di codice non e' una frase che si possa tradurre. Che le
   * parole dicano il numero vero lo tiene una prova. */
  return `<div class="ed-sec-title dm-blocco-sep">\u{1F6CB}\uFE0F ${esc(t("Stanze in plancia", "Rooms on Home"))}</div>
    <div class="ed-intro">${esc(
      t(
        "Quali stanze si vedono in Home, con la temperatura e quante cose sono accese: un tocco porta dentro la stanza. Al massimo otto; nessuna spuntata vuol dire nessun blocco.",
        "Which rooms show up on Home, with the temperature and how many things are on: one tap takes you into the room. At most eight; none ticked means no block at all.",
      ),
    )}</div>
    <div class="dm-blocco-list">${righe}</div>`;
}

/** Scrive addosso al documento se le pastiglie si vedono. */
export function vestiLePastiglie() {
  const radice = doc?.documentElement;
  if (!radice) return;
  const accese = lePastiglieSiVedono(readJson(CHIAVE_PASTIGLIE, null));
  attributoSeCambia(radice, "data-dm-pastiglie", accese ? "si" : "no");
}

/** Il pannello in cima alla scheda Home dell'editor, quando e' quella aperta. */
export function ensurePannelloDeiBlocchi(body = doc?.getElementById?.("ed-body")) {
  if (!body) return false;
  let pannello = body.querySelector(":scope > [data-dm-home-blocchi]");
  if (schedaAperta() !== SCHEDA_HOME) {
    pannello?.remove();
    return false;
  }
  const firma = ordineSalvato().join(",");
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
  /* La casella delle pastiglie: si scrive il «no», e il «si'» si scrive
   * vuoto. Cosi' chi non l'ha mai toccata non ha niente in memoria, e la
   * casella che non c'e' vale «come e' sempre stato». */
  const casella = event.target?.closest?.("[data-dm-home-blocchi] [data-dm-pastiglie]");
  if (casella) {
    writeJsonIfChanged(CHIAVE_PASTIGLIE, casella.checked ? null : "no");
    vestiLePastiglie();
    return;
  }
  /* La spunta di una stanza (#493): si scrive l'elenco, il blocco si rifa'
   * subito e si rimette in fila insieme agli altri — la prima stanza spuntata
   * lo fa nascere, l'ultima tolta lo fa sparire. */
  const stanza = event.target?.closest?.(
    "[data-dm-home-blocchi] [data-dm-stanza-plancia-scelta]",
  );
  if (stanza) {
    const id = clean(stanza.getAttribute("data-dm-stanza-plancia-scelta"));
    /* Le stanze di casa servono a contare il tetto su quelle che esistono
     * davvero: un id rimasto in memoria di una stanza cancellata non occupa un
     * posto in plancia e non deve occuparne uno qui. */
    const prossime = conLaStanza(stanzeScelte(), { id }, stanza.checked, stanzeDiCasa());
    writeJsonIfChanged(CHIAVE_STANZE_IN_PLANCIA, prossime);
    /* Il tetto: se la spunta non e' entrata, la casella torna com'era invece
     * di restare accesa su una scelta che non c'e'. */
    if (stanza.checked && !prossime.includes(id)) stanza.checked = false;
    ridisegnaStanzeInPlancia();
    try {
      applicaLOrdineDeiBlocchi();
    } catch (_error) {}
    return;
  }
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
    /* Il riquadro col meteo (#492) cambia casa prima che si metta in fila:
     * scavalcato, deve prima staccarsi dall'intestazione e scendere in pagina,
     * altrimenti qui non c'e' niente da spostare e lo si vedrebbe muoversi
     * solo al prossimo giro di stati. */
    rigaDellaTestata();
    applicaLOrdineDeiBlocchi();
  } catch (_error) {}
  ensurePannelloDeiBlocchi();
}

function stile() {
  return `
    #ed-body .dm-home-blocchi{display:block;margin-bottom:14px}
    #ed-body .dm-blocco-list{display:grid;gap:6px;margin-bottom:14px}
    #ed-body .dm-blocco-row{display:flex!important;align-items:center;gap:10px;padding:8px 12px!important}
    #ed-body .dm-blocco-icona{font-size:17px;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:0 0 24px}
    #ed-body .dm-blocco-icona .dm-oggetto{width:24px;height:24px;display:block}
    #ed-body .dm-blocco-icona .dm-icon-engine-glyph{display:inline-flex;align-items:center;justify-content:center}
    #ed-body .dm-blocco-icona svg{max-width:100%;max-height:100%}
    #ed-body .dm-blocco-move[disabled]{opacity:.3;pointer-events:none}
    #ed-body .dm-blocco-pastiglie,
    #ed-body .dm-blocco-stanza{display:flex!important;align-items:center;gap:12px;padding:10px 12px!important}
    #ed-body .dm-blocco-stanza{cursor:pointer}
    #ed-body .dm-blocco-sep{margin-top:4px}
    #ed-body .dm-blocco-pastiglie .ed-row-old{display:block;margin-top:2px;line-height:1.35}
    #ed-body .dm-blocco-switch{flex:0 0 auto;display:inline-flex;cursor:pointer}
    #ed-body .dm-blocco-switch input{position:absolute;opacity:0;width:0;height:0}
    #ed-body .dm-blocco-switch span{
      display:inline-flex;align-items:center;width:46px;height:28px;padding:3px;
      border-radius:999px;background:var(--divider-color,#cbd5e1);transition:background .18s ease}
    #ed-body .dm-blocco-switch span::after{
      content:"";width:22px;height:22px;border-radius:50%;background:#fff;
      box-shadow:0 1px 3px rgba(15,23,42,.3);transition:translate .18s ease}
    #ed-body .dm-blocco-switch input:checked+span{background:var(--accent,#0ea5e9)}
    #ed-body .dm-blocco-switch input:checked+span::after{translate:18px 0}
    #ed-body .dm-blocco-switch input:focus-visible+span{outline:2px solid var(--accent,#0ea5e9);outline-offset:2px}
    /* Spente: la riga non c'e'. Non si toglie dal documento — la riscrive il
       guscio a ogni cambio di stato, e toglierla vorrebbe dire rincorrerlo. */
    html[data-dm-pastiglie="no"] #dashboard-pills-row{display:none!important}
  `;
}

export function installHomeBlocchiSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-home-blocchi", stile());
  onEditorRedraw("__dmHomeBlocchiEditor", () => ensurePannelloDeiBlocchi());
  doc.addEventListener("click", onClickFreccia);
  doc.addEventListener("change", onClickFreccia);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:plancia-dipinta",
    /* Un blocco che nasce a meta' giro lo dice: nasce in fondo alla pagina, e
     * senza questo giro in piu' ci resterebbe fino al prossimo evento di
     * stato — la prima stanza spuntata si vedeva comparire sotto tutto. */
    "dashboardmodern:blocco-nuovo",
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
