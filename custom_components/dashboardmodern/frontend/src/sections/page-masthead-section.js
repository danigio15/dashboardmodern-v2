/* One heading for every section of the dashboard.
 *
 * Each page had grown its own idea of a title: Solar thermal opens with a
 * full-bleed hero — gradient name, a line of context under it, a live pill —
 * Security and Climate print a bare coloured h2, Temperature an uppercase h2
 * with a timestamp, and Tapparelle, Piscina, Irrigazione, Energia and
 * Elettrodomestici print nothing at all: their first card doubles as the
 * heading. Opening two pages in a row looked like opening two applications.
 *
 * The Solar thermal hero is the shape the whole dashboard now uses. This
 * module builds that same block on every other page, in the page's own two
 * accent colours, and folds away the heading a page used to print for itself.
 * Solar thermal keeps the one it already has — it is the original — and the
 * MiniPC keeps its own, because that header carries live controls.
 *
 * Nothing else on the page is touched: this module renders no data and owns
 * no state.
 */
import { clean, doc, english, esc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_PAGE_MASTHEAD__";
const STYLE_ID = "dm-page-masthead-style";
const state = (root[KEY] ||= { installed: false, frame: 0, seeded: false, mastheads: {} });

/* The pages of the dashboard, what each one is, and the two colours its
 * heading is drawn in — the first tints the sun disc and starts the title
 * gradient, the second closes it. `fold` names the heading the page printed
 * before this module existed. */
const PAGES = Object.freeze([
  {
    id: "page-temp",
    tint: ["249,115,22", "14,165,233"],
    it: ["Temperature", "Sensori stanza per stanza · Comfort · Umidità"],
    en: ["Temperatures", "Room by room sensors · Comfort · Humidity"],
    fold: "h2:not(.dm-page-mast-title)",
  },
  {
    id: "page-tapparelle",
    tint: ["99,102,241", "14,165,233"],
    it: ["Finestre", "Tapparelle · Tende · Sensori di apertura"],
    en: ["Windows", "Shutters · Curtains · Contact sensors"],
  },
  {
    id: "page-robot",
    tint: ["100,116,139", "14,165,233"],
    it: ["Robot aspirapolvere", "Stato · Batteria · Mappa della casa"],
    en: ["Robot vacuum", "State · Battery · Home map"],
  },
  /* Le Stanze sono nate dopo questo elenco e ci sono rimaste fuori: erano la
   * sola pagina della plancia che partiva dalle linguette, senza mai dire dove
   * si era arrivati. */
  {
    id: "page-stanze",
    tint: ["217,119,6", "14,165,233"],
    it: ["Stanze", "Una stanza per volta · Scene · Sensori"],
    en: ["Rooms", "One room at a time · Scenes · Sensors"],
  },
  {
    id: "page-luci",
    tint: ["245,158,11", "249,115,22"],
    it: ["Luci", "Accensione · Luminosità · Colore"],
    en: ["Lights", "On/off · Brightness · Colour"],
  },
  /* Le Prese sono nate insieme alla loro pagina, e l'intestazione nasce con
   * loro: una sezione nuova entra qui il giorno stesso, non alla prima
   * segnalazione — che infatti e' arrivata. */
  {
    id: "page-prese",
    tint: ["71,85,105", "245,158,11"],
    it: ["Prese", "Accensione · Consumi · Stanza per stanza"],
    en: ["Sockets", "On/off · Consumption · Room by room"],
  },
  {
    id: "page-piscina",
    tint: ["14,165,233", "34,211,238"],
    it: ["Piscina", "Qualità dell'acqua · Filtrazione · Riscaldamento"],
    en: ["Pool", "Water quality · Filtration · Heating"],
  },
  {
    id: "page-irrigazione",
    tint: ["14,165,233", "34,197,94"],
    it: ["Irrigazione", "Zone · Programma · Pioggia prevista"],
    en: ["Irrigation", "Zones · Schedule · Forecast rain"],
  },
  {
    id: "page-ev",
    tint: ["34,197,94", "14,165,233"],
    it: ["Auto elettrica", "Carica · Autonomia · Wallbox"],
    en: ["Electric vehicle", "Charge · Range · Wallbox"],
  },
  {
    id: "page-clima",
    tint: ["14,165,233", "99,102,241"],
    it: ["Sistema climatico", "Riscaldamento · Raffrescamento · Zone"],
    en: ["Climate system", "Heating · Cooling · Zones"],
    fold: ".sec-header, .dm-cl-mast-ic, .dm-cl-mast-copy",
  },
  {
    id: "page-energy",
    tint: ["245,158,11", "34,197,94"],
    it: ["Energia", "Produzione · Consumi · Report"],
    en: ["Energy", "Production · Consumption · Report"],
  },
  {
    id: "page-appliances-main",
    tint: ["14,165,233", "99,102,241"],
    it: ["Elettrodomestici", "Cicli · Consumi · Stato di ogni apparecchio"],
    en: ["Appliances", "Cycles · Consumption · Each device's state"],
    fold: ".dm-appl-brand",
  },
  {
    id: "page-security",
    tint: ["190,18,60", "249,115,22"],
    it: ["Sistema di sicurezza", "Antifurto · Telecamere · Aperture"],
    en: ["Security system", "Alarm · Cameras · Openings"],
    fold: ".sec-header, .dm-sec-mast-ic, .dm-sec-mast-copy",
  },
  /* Solare termico e MiniPC avevano l'intestazione che hanno ispirato tutte le
   * altre, e per questo erano rimaste fuori: ma "come le altre" vuol dire anche
   * loro. Qui si ripiega solo il titolo, non la fascia che lo conteneva: quella
   * porta la pastiglia di stato viva, che resta dov'e' e continua a dire cosa
   * sta facendo l'impianto. */
  {
    id: "page-boiler",
    tint: ["249,115,22", "14,165,233"],
    it: ["Impianto solare termico", "Circuito primario · Boiler · Ricircolo sanitario"],
    en: ["Solar thermal system", "Primary loop · Tank · DHW recirculation"],
    fold: ".boiler-title, .dm-st-sub",
  },
  {
    id: "page-server",
    tint: ["14,165,233", "99,102,241"],
    it: ["MiniPC Server", "Home Assistant · Sistema core"],
    en: ["MiniPC Server", "Home Assistant · Core system"],
    // La fascia tiene la sua pastiglia "online" e le sue misure: si ripiega
    // solo il nome che la pagina stampava per conto suo.
    // Il MiniPC compariva due volte in questo elenco, con due tinte e due
    // sottotitoli diversi: l'ultimo vinceva a ogni passata e il primo non si
    // e' mai visto. Resta quello che si vedeva.
    fold: ".srv-hero-brand",
  },
]);

function labelsFor(page) {
  /* The pair is authored it/en; `t` turns it into the active language. */
  return { title: t(page.it[0], page.en[0]), subtitle: t(page.it[1], page.en[1]) };
}

/* The heading opens the page, and the way back opens the heading. Pages used to
 * keep that button in three different places — a direct child of the section, a
 * grid item inside the cards, or nowhere at all — which is why the same button
 * landed above the title on one page and below it on the next. It is drawn here
 * now, once, and whatever copy the page still builds for itself is folded away
 * on sight. */
function backHomeMarkup() {
  const label = t("Home", "Home");
  return `<button type="button" class="back-home-btn dm-mast-back" data-dm-mast-back="true"
    onclick="document.querySelector('[data-tab=&quot;home&quot;]').click(); if(navigator.vibrate)navigator.vibrate(5);">
    <span class="bh-icon">←</span><span>${esc(label)}</span>
  </button>`;
}

/* Dove nasce l'intestazione.
 *
 * Alcune pagine tengono il proprio contenuto dentro un contenitore che ne fissa
 * la larghezza, altre lo lasciano correre per tutta la scheda. L'intestazione
 * nasceva sempre in cima alla pagina con una larghezza sua: sulle pagine larghe
 * restava un rettangolo stretto e spostato, con il contenuto sotto molto piu'
 * largo. Nasce invece dove nasce il contenuto, cosi' e' larga esattamente
 * quanto lui, senza doverlo sapere. */
function tallestWrapper(host) {
  let best = null;
  let tallest = 0;
  for (const wrapper of host.querySelectorAll(
    ':scope > div[style*="max-width"], :scope > [class*="dashboard"]',
  )) {
    // Un contenitore che al momento non occupa spazio non e' il posto giusto:
    // la pagina Energia ne tiene uno per vista e ne mostra una sola, e
    // l'intestazione ci sarebbe finita dentro larga zero. Fra quelli che si
    // vedono vince il piu' alto: e' il contenuto. La pagina Auto apre con una
    // striscia della stessa larghezza che pero' contiene solo la tendina dei
    // profili, e l'intestazione non va incassata li' dentro.
    const height = wrapper.getBoundingClientRect().height;
    if (!wrapper.getClientRects().length || height <= tallest) continue;
    tallest = height;
    best = wrapper;
  }
  return best;
}

/* La prima cosa che si vede sulla pagina, che non sia l'intestazione stessa. */
function firstVisibleChild(host) {
  for (const child of host.children) {
    if (child.classList?.contains("dm-page-mast")) continue;
    if (!child.getClientRects().length) continue;
    return child;
  }
  return null;
}

function mountFor(host) {
  const best = tallestWrapper(host);
  /* L'intestazione apre la pagina: se il contenitore del contenuto non e' la
   * prima cosa che si vede, incassarcela dentro la manda sotto quello che gli
   * sta sopra.
   *
   * Su Energia il contenuto della vista Report si chiama energy-dashboard e la
   * riga di linguette REPORT / ISTANTANEA / GIORNALIERA / MENSILE la precede:
   * l'intestazione finiva sotto le linguette, cioe' la pagina si apriva con i
   * suoi comandi e il nome veniva dopo. Su Auto e' la striscia del profilo a
   * stare davanti al contenuto, e il nome della pagina compariva sotto la
   * targhetta della marca.
   *
   * In quei casi l'intestazione nasce sulla pagina, prima di tutto, e la
   * larghezza gliela da' `alignToContent` copiandola dal contenuto. */
  if (best && best !== firstVisibleChild(host)) return host;
  return best || soleContentWrapper(host) || host;
}

/* Larga quanto il contenuto anche quando non ci sta dentro.
 *
 * Un'intestazione che nasce sulla pagina e' larga quanto la scheda, e sotto di
 * lei il contenuto puo' essere incolonnato al centro molto piu' stretto: sul
 * telefono non si vede, su uno schermo largo si vede benissimo. Qui prende la
 * misura del contenuto e la porta con se'. Se il contenuto e' largo quanto la
 * pagina non c'e' niente da imporre e il limite si toglie. */
function alignToContent(host, mast, mount) {
  escapeMountPadding(mast, mount);
  const content = mount === host ? tallestWrapper(host) : null;
  // Si copia il limite che il contenuto si e' dato, non la sua larghezza di
  // adesso: la larghezza include gia' il margine interno della pagina e
  // l'intestazione, che quel margine ce l'ha anche lei, verrebbe piu' stretta
  // del contenuto di due margini. Se il contenuto non si e' dato un limite non
  // c'e' niente da copiare.
  const declared = content ? root.getComputedStyle?.(content)?.maxWidth : "";
  const width = /^[\d.]+px$/.test(declared || "") ? Number.parseFloat(declared) : 0;
  const room = host.getBoundingClientRect().width;
  if (width > 0 && room - width > 3) {
    const limit = `${Math.round(width)}px`;
    if (mast.style.getPropertyValue("--dm-mast-room") !== limit) {
      mast.style.setProperty("--dm-mast-room", limit);
    }
    return;
  }
  if (mast.style.getPropertyValue("--dm-mast-room")) {
    mast.style.removeProperty("--dm-mast-room");
  }
}

/* Il margine interno della casa non e' dell'intestazione.
 *
 * Tapparelle tiene il proprio contenuto in un blocco con sedici pixel di
 * margine per lato — l'unica pagina che lo fa — e l'intestazione, che nasce li'
 * dentro, li prendeva con se': sul telefono restava una striscia bianca
 * staccata dai bordi mentre su tutte le altre pagine tocca i lati. Il margine
 * serve a distanziare le card dal bordo, non ad accorciare l'apertura della
 * pagina, quindi l'intestazione ne esce e resta larga quanto la casa. */
function escapeMountPadding(mast, mount) {
  const style = mount === mast.parentElement ? root.getComputedStyle?.(mount) : null;
  const left = Number.parseFloat(style?.paddingLeft || "0") || 0;
  const right = Number.parseFloat(style?.paddingRight || "0") || 0;
  const bleed = Math.min(left, right);
  if (bleed > 0) {
    const value = `${Math.round(bleed)}px`;
    if (mast.style.getPropertyValue("--dm-mast-bleed") !== value) {
      mast.style.setProperty("--dm-mast-bleed", value);
      mast.style.setProperty("--dm-mast-side", `-${Math.round(bleed)}px`);
    }
    return;
  }
  if (mast.style.getPropertyValue("--dm-mast-bleed")) {
    mast.style.removeProperty("--dm-mast-bleed");
    mast.style.removeProperty("--dm-mast-side");
  }
}

/* Quando il contenuto della pagina e' tutto in un blocco solo.
 *
 * Alcune pagine non marcano il contenitore in alcun modo riconoscibile: Clima
 * tiene tutto dentro un unico riquadro che si stringe da se', e l'intestazione
 * restava larga quanto la scheda mentre cio' che introduceva era piu' stretto
 * di quasi duecento pixel. Se sotto l'intestazione c'e' un solo blocco che si
 * vede, ed e' piu' stretto della pagina, quello e' il contenuto e l'apertura e'
 * la sua. Se i blocchi sono piu' d'uno la pagina si impagina da sola e
 * l'intestazione resta dov'e'. */
function soleContentWrapper(host) {
  let only = null;
  for (const child of host.children) {
    if (child.classList?.contains("dm-page-mast")) continue;
    if (!child.getClientRects().length) continue;
    if (only) return null;
    only = child;
  }
  if (!only) return null;
  const width = only.getBoundingClientRect().width;
  return width > 0 && host.getBoundingClientRect().width - width > 3 ? only : null;
}

function foldForeignBackButtons(host) {
  for (const button of host.querySelectorAll(".back-home-btn")) {
    if (button.dataset.dmMastBack === "true") continue;
    if (button.dataset.dmMastFolded === "true") continue;
    button.dataset.dmMastFolded = "true";
  }
}

/* A heading a page prints for itself, and nothing else.
 *
 * Temperature's own title is an `h2`, and so is the name inside every room
 * card it draws: folding every `h2` on the page took the cards' titles with it
 * and collapsed a card to nothing. A heading is folded only where it opens the
 * page — never inside a card, and never below the block that replaced it. */
function foldLegacyHeading(host, selector) {
  if (!selector) return;
  for (const node of host.querySelectorAll(selector)) {
    if (node.closest(".dm-page-mast")) continue;
    if (node.closest('[class*="card"],[class*="-cell"],[data-room-id]')) continue;
    if (node.dataset.dmMastFolded === "true") continue;
    node.dataset.dmMastFolded = "true";
  }
}

function ensureMasthead(page) {
  const host = doc?.getElementById?.(page.id);
  if (!host) return false;
  const labels = labelsFor(page);
  let mast = state.mastheads?.[page.id];
  const mount = mountFor(host);
  /* L'intestazione che c'e' gia' si sposta, non si rifa'.
   *
   * La casa puo' cambiare mentre la pagina e' viva: su Auto la striscia del
   * profilo compare quando le auto diventano due, e da quel momento il
   * contenitore del contenuto non e' piu' la prima cosa che si vede, quindi
   * l'intestazione passa dal contenitore alla pagina. Trattare quel cambio come
   * "l'intestazione non c'e'" ne faceva una seconda e lasciava la prima dov'era:
   * due nomi e due pulsanti Home sulla stessa pagina, per chi ha due auto.
   *
   * Si cerca quindi in tutta la pagina, non solo fra i figli diretti, e a
   * spostarla ci pensa l'inserimento in fondo a questa funzione. */
  if (mast && !mast.isConnected) mast = null;
  if (!mast) mast = host.querySelector(".dm-page-mast");
  if (!mast) {
    mast = doc.createElement("header");
    mast.className = "dm-page-mast";
    mast.dataset.dmPageMast = page.id;
    mast.style.setProperty("--dm-mast-a", page.tint[0]);
    mast.style.setProperty("--dm-mast-b", page.tint[1]);
    mast.innerHTML =
      backHomeMarkup() +
      `<h2 class="dm-page-mast-title">${esc(labels.title)}</h2>` +
      `<div class="dm-page-mast-sub">${esc(labels.subtitle)}</div>`;
    mount.insertBefore(mast, mount.firstChild);
    (state.mastheads ||= {})[page.id] = mast;
  } else {
    (state.mastheads ||= {})[page.id] = mast;
    const title = mast.querySelector(".dm-page-mast-title");
    const subtitle = mast.querySelector(".dm-page-mast-sub");
    if (title && clean(title.textContent) !== labels.title) title.textContent = labels.title;
    if (subtitle && clean(subtitle.textContent) !== labels.subtitle) {
      subtitle.textContent = labels.subtitle;
    }
  }
  // A page redrawn by its own renderer can put its content above the heading:
  // the heading opens the page, always.
  if (mast.parentElement !== mount || mount.firstElementChild !== mast) {
    mount.insertBefore(mast, mount.firstChild);
  }
  alignToContent(host, mast, mount);
  foldForeignBackButtons(host);
  foldLegacyHeading(host, page.fold);
  return true;
}

/* The page on screen, and nothing else.
 *
 * Every pass used to walk all nine pages, and each one cost three full
 * subtree scans — the heading, the back buttons, the legacy title. The eight
 * pages that are display:none gain nothing from being scanned: the pass that
 * follows a tab change reaches the one that comes up. The first pass still
 * builds them all, so a page opened without a click already has its heading. */
function pagesToRender() {
  if (!state.seeded) return PAGES;
  const active = doc?.querySelector?.(".page.active");
  const page = active?.id ? PAGES.find((candidate) => candidate.id === active.id) : null;
  return page ? [page] : [];
}

export function renderPageMastheads() {
  if (!doc) return false;
  for (const page of pagesToRender()) ensureMasthead(page);
  state.seeded = true;
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    renderPageMastheads();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

/* The measurements below are the Solar thermal header's own: same padding,
 * same sun disc, same 2px gradient rule closing the block, same type. Only the
 * two accent colours change from page to page, and they arrive as custom
 * properties on the element itself. */
/* Folding by CSS rather than by hand: a page that rebuilds its own markup —
 * the shutter grid does it on every state change — puts its heading and its
 * copy of the back button back a frame after any pass could mark them, and the
 * two then flash in and out. A rule keyed on the page id catches them the
 * moment they are parsed, whoever wrote them and whenever. */
function foldRules() {
  return PAGES.map((page) => {
    const rules = [`#${page.id} .back-home-btn:not(.dm-mast-back)`];
    for (const selector of (page.fold || "").split(",")) {
      const trimmed = selector.trim();
      if (trimmed) rules.push(`#${page.id} ${trimmed}`);
    }
    return `${rules.join(",\n    ")}{display:none!important}`;
  }).join("\n    ");
}

/* La fascia della plancia si vede sulla Home e basta, e a dirlo e' la pagina
 * aperta — non l'ultimo che ha cliccato.
 *
 * Il guscio la accende e la spegne dentro il gestore delle voci in basso:
 * «se hai premuto Home mettila a flex, altrimenti a none». Sembra la stessa
 * cosa ma non lo e', perche' quel gestore lo lega una volta sola al
 * caricamento, e le tre pagine nate dopo — Stanze, Luci, Aspirapolvere — hanno
 * ciascuna il proprio ascolto, che di quella fascia non sa niente. Il
 * risultato e' che la fascia si porta dietro lo stato lasciato dalla pagina
 * di prima: da Home a Stanze resta accesa (due intestazioni sulla stessa
 * pagina), e chi torna alla Home da una strada che non passa per la voce in
 * basso se la ritrova spenta — la testata della Home sparita, senza aver
 * toccato niente.
 *
 * La decisione non e' di un clic, e' della pagina che sta aperta: qui si
 * scrive cosi', e con il peso massimo, perche' quello che il guscio si scrive
 * addosso sull'elemento vince su qualunque foglio che non lo abbia. Chi non
 * conosce `:has` — nessun browser di oggi, ma la rete e' lunga — non si
 * prende nessuna delle due righe e resta al comportamento di prima, invece di
 * ritrovarsi la fascia accesa dappertutto. */
/* E si parla della fascia della plancia, che e' una sola ed e' figlia diretta
 * del corpo del documento: da qui il `>`. Non e' un vezzo — `header` e basta
 * prende anche le intestazioni delle finestre di modifica, che stanno in fondo
 * al corpo dentro la loro scheda, e le spegneva tutte, croce di chiusura
 * compresa, ogni volta che la pagina aperta non era la Home. */
function regolaDellaFascia() {
  const fascia = "header:not(.dm-page-mast)";
  return `@supports selector(:has(*)){
      body:has(.page.active)>${fascia}{display:flex!important}
      body:has(.page.active:not(#page-home))>${fascia}{display:none!important}
    }`;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    ${foldRules()}
    ${regolaDellaFascia()}
    /* Una sola larghezza per tutte le sezioni.
     *
     * Ogni sezione si era scelta la sua: Energia, Elettrodomestici e
     * Temperature prendono tutto lo schermo, Clima e Sicurezza si fermano a
     * 1250, Solare a 1120, Tapparelle a 1100, Piscina a 1040, e Auto,
     * Irrigazione e MiniPC a 1000 — sette misure diverse, alcune scritte a mano
     * dentro alla plancia e altre nei moduli. Passando da una sezione all'altra
     * il contenuto si stringe e si allarga, e con lui l'intestazione, che e'
     * larga quanto quello che annuncia.
     *
     * La misura sta adesso in un posto solo. Vale per il contenuto, e
     * l'intestazione la eredita perche' continua a misurarsi su di lui: chi
     * volesse rimettere un limite cambia --dm-page-room qui e le sezioni lo
     * seguono tutte insieme. */
    html body .page{--dm-page-room:none}
    html body .page > div[style*="max-width"],
    html body #page-tapparelle#page-tapparelle > div,
    html body #page-clima .dm-cl-shell,
    html body #page-security .dm-sec-shell,
    html body #page-boiler .boiler-dashboard{
      max-width:var(--dm-page-room)!important
    }
    /* La piscina la larghezza se la fissa, non si limita a metterle un tetto. */
    html body #page-piscina #pool-wrap[data-dm-pool-scene]{
      width:100%!important;max-width:var(--dm-page-room)!important
    }
    .dm-page-mast{
      position:relative!important;display:block!important;box-sizing:border-box!important;
      width:calc(100% + 2 * var(--dm-mast-bleed,0px))!important;
      max-width:var(--dm-mast-room,none)!important;
      margin:0 0 18px!important;margin-inline:var(--dm-mast-side,auto)!important;
      grid-column:1/-1!important;flex:1 1 100%!important;
      align-self:stretch!important;justify-self:stretch!important;
      padding:26px 30px 24px!important;border-radius:28px!important;text-align:left!important;
      border:1px solid var(--divider-color,rgba(15,23,42,.10))!important;
      background:
        radial-gradient(130% 190% at 88% -60%, rgba(var(--dm-mast-a,249,115,22),.20), transparent 58%),
        var(--ha-card-background,var(--card-bg,#fff))!important;
      box-shadow:0 18px 44px rgba(15,23,42,.08), 0 2px 6px rgba(15,23,42,.04)!important;
      overflow:hidden!important
    }
    html[data-theme="dark"] .dm-page-mast{box-shadow:0 18px 44px rgba(0,0,0,.42)!important}
    .dm-page-mast::after{
      content:""!important;position:absolute!important;inset:auto 0 0 0!important;height:2px!important;
      background:linear-gradient(90deg,
        rgb(var(--dm-mast-a,249,115,22)),
        rgb(var(--dm-mast-b,14,165,233)) 62%, transparent)!important;
      opacity:.7!important
    }
    .dm-page-mast .dm-mast-back{
      position:relative!important;display:inline-flex!important;align-items:center!important;
      gap:8px!important;margin:0 0 14px!important;padding:8px 16px 8px 13px!important;
      border-radius:999px!important;border:1px solid var(--divider-color,rgba(15,23,42,.10))!important;
      background:var(--ha-card-background,var(--card-bg,#fff))!important;
      box-shadow:0 6px 16px rgba(15,23,42,.07)!important;cursor:pointer!important;
      font-family:inherit!important;font-size:12px!important;font-weight:900!important;
      letter-spacing:1.3px!important;text-transform:uppercase!important;
      color:var(--text,#0f172a)!important
    }
    .dm-page-mast .dm-mast-back .bh-icon{font-size:14px!important;line-height:1!important}
    .dm-page-mast-title{
      position:relative!important;margin:0!important;
      font-family:'Oswald',system-ui,sans-serif!important;font-weight:700!important;
      font-size:clamp(21px,3.3vw,34px)!important;line-height:1.1!important;
      letter-spacing:2px!important;text-transform:uppercase!important;text-align:left!important;
      color:rgb(var(--dm-mast-a,249,115,22))!important
    }
    .dm-page-mast-sub{
      position:relative!important;margin-top:7px!important;font-size:11px!important;
      font-weight:800!important;letter-spacing:1.4px!important;text-transform:uppercase!important;
      text-align:left!important;
      color:var(--secondary-text-color,var(--text-dim,#64748b))!important
    }
    /* Elettrodomestici kept its name and its view switch in one card. With the
       name folded away the card held a single pair of buttons and read as an
       empty band, so it gives up its own skin and lets the buttons sit on the
       page. */
    #page-appliances-main .dm-appl-head{
      padding:0!important;margin:0 0 12px!important;border:0!important;
      background:none!important;box-shadow:none!important
    }
    /* Le fasce che portavano il titolo di Solare termico e MiniPC ora portano
       solo la pastiglia di stato: si stringono su quella invece di lasciare in
       mezzo la banda vuota di quando c'era anche il titolo.
       L'imbottitura del Solare termico non si scrive piu' qui: la scrive
       solar-thermal-design-section, che quell'intestazione la disegna, e la
       lega al segno che questa fascia le lascia addosso, «dm-mast-folded».
       Prima erano due fogli a dichiarare la stessa imbottitura con due valori
       diversi, e vinceva chi caricava per ultimo. */
    #page-server .srv-hero-top{padding-top:12px!important;padding-bottom:12px!important}

    /* The heading a page printed for itself: kept in the document for whoever
       writes into it, and no longer drawn twice. */
    [data-dm-mast-folded="true"]{display:none!important}
    @media(max-width:560px){
      .dm-page-mast{padding:20px 18px 18px!important;border-radius:22px!important;margin-bottom:14px!important}
      .dm-page-mast-sub{font-size:9.5px!important;letter-spacing:1px!important}
    }
  `,
  );
}

export function installPageMastheadSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, schedule);
  }
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.bottom-nav-btn,.back-home-btn")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installPageMastheadSection, { once: true });
} else {
  installPageMastheadSection();
}
