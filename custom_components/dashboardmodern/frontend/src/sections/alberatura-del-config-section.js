/* Le linguette del Config messe in ordine, e le insegne delle famiglie.
 *
 * «Per cortesia mi organizzi le sezioni del config con criterio, vedo cose
 * mischiate in sezioni che non c'entrano nulla.»
 *
 * L'ordine delle trentadue linguette non lo decideva nessuno: diciotto le
 * scrive il guscio storico in fila, e le altre quattordici se le infilano i
 * moduli subito prima di «Runtime», ognuno quando gli capita di installarsi.
 * Il risultato era Rifiuti fra Backup e Varchi, l'Agenda dopo i Robot, e
 * nessuna ragione per cui.
 *
 * Qui l'ordine c'è, e sta scritto in un posto solo — `core/alberatura-del-
 * config.js`. Questo modulo lo applica: rimette le linguette nell'ordine
 * dell'albero e mette un'insegna davanti a ogni famiglia, così si vede dove
 * finisce una e comincia l'altra. Sopra, una fila di famiglie che porta dove
 * si vuole andare.
 *
 * ── Perché nessuna linguetta si nasconde ─────────────────────────────────
 *
 * La tentazione era la seconda fila: la famiglia sopra, e sotto solo le sue
 * schede. Ma una linguetta nascosta non si può cliccare — non dal dito e non
 * dalle prove, e in questo progetto le prove che aprono una scheda cliccandola
 * sono una quarantina. Rompere quaranta punti per un'insegna sarebbe stato
 * pagare il riordino con la sicurezza di sapere che tutto il resto funziona.
 *
 * Quindi tutte restano dove sono, visibili e premibili, e la fila delle
 * famiglie fa da indice: porta lì, non toglie il resto. Chi arriva vede sette
 * insegne invece di trentadue nomi in fila, che era il punto.
 *
 * ── Perché si riordina a ogni giro ───────────────────────────────────────
 *
 * Perché i moduli continuano a infilarsi prima di «Runtime» quando si
 * installano, e non gli si può chiedere di sapere l'ordine — sapere l'ordine
 * è il mestiere dell'elenco, non il loro. Rimettere in fila trentadue nodi
 * costa niente, e farlo dopo ogni ridisegno vuol dire che una scheda nuova
 * trova il suo posto senza che nessuno la registri da nessuna parte.
 */
import {
  famigliaDellaScheda,
  famiglieConSchede,
  inOrdine,
} from "../core/alberatura-del-config.js";
import { clean, doc, esc, installStyle, onEditorRedraw, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALBERATURA__";
const state = (root[KEY] ||= {
  installed: false,
  riordinando: false,
  famiglia: "",
});

const FILA = "dm-alberatura-famiglie";
const INSEGNA = "dm-alberatura-insegna";

function fila() {
  return doc?.querySelector?.(".ed-tab")?.parentElement || null;
}

function linguette(dentro) {
  return [...(dentro?.querySelectorAll?.(":scope > .ed-tab") || [])];
}

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/** Come si chiama una famiglia adesso, nella lingua di chi guarda. */
function nomeDellaFamiglia(voce) {
  return t(voce.it, voce.en);
}

/* ── il riordino ──────────────────────────────────────────────────────── */

/* Le insegne sono figlie della stessa fila delle linguette, e non sono
 * linguette: niente `ed-tab`, niente `data-tab`, niente da cliccare. Chi cerca
 * una scheda per identificativo non le trova, ed è giusto così. */
function insegna(dentro, voce) {
  let nodo = dentro.querySelector(`:scope > .${INSEGNA}[data-famiglia="${CSS.escape(voce.chiave)}"]`);
  if (!nodo) {
    nodo = doc.createElement("span");
    nodo.className = INSEGNA;
    nodo.dataset.famiglia = voce.chiave;
    nodo.setAttribute("aria-hidden", "true");
  }
  const testo = `${voce.glifo} ${nomeDellaFamiglia(voce)}`;
  if (nodo.textContent !== testo) nodo.textContent = testo;
  return nodo;
}

/**
 * Rimette la fila delle linguette nell'ordine dell'albero.
 *
 * Nessuna sparisce e nessuna nasce: si spostano, e basta. Le insegne che non
 * hanno più una famiglia sotto se ne vanno — succede quando si spegne l'ultima
 * sezione di una famiglia.
 */
export function riordinaLeLinguette() {
  const dentro = fila();
  if (!dentro || state.riordinando) return false;
  const bottoni = new Map(
    linguette(dentro).map((nodo) => [clean(nodo.dataset.tab), nodo]).filter(([id]) => id),
  );
  if (!bottoni.size) return false;
  const gruppi = famiglieConSchede([...bottoni.keys()]);
  state.riordinando = true;
  try {
    /* Si costruisce la fila giusta e poi la si appende in ordine: `append` su
     * un nodo che è già dentro lo sposta, non lo duplica. */
    const vive = new Set();
    for (const voce of gruppi) {
      dentro.append(insegna(dentro, voce));
      vive.add(voce.chiave);
      for (const id of voce.schede) dentro.append(bottoni.get(id));
    }
    for (const vecchia of dentro.querySelectorAll(`:scope > .${INSEGNA}`))
      if (!vive.has(clean(vecchia.dataset.famiglia))) vecchia.remove();
  } finally {
    state.riordinando = false;
  }
  return true;
}

/* ── la fila delle famiglie, che è anche un filtro ────────────────────── */

/* Perché il filtro parte spento, e perché segue la scheda attiva.
 *
 * Una fila di famiglie che porta soltanto dove si vuole andare lascia
 * trentadue linguette in colonna: le insegne dicono chi sta con chi, ma la
 * colonna resta lunga. Toccare una famiglia e vedere solo le sue schede è
 * l'altra metà della cosa, ed è quella che accorcia davvero.
 *
 * Due regole, e sono la ragione per cui questo si può fare senza rompere
 * niente:
 *
 * 1. A riposo NON filtra. Chi apre il Config le vede tutte, com'è sempre
 *    stato: il filtro è una cosa che si chiede, non una che si subisce. Vale
 *    anche per le prove — una quarantina aprono una scheda cliccandola, e una
 *    linguetta nascosta non si può cliccare, né col dito né da una prova.
 *
 * 2. Il filtro SEGUE la scheda attiva. Se si finisce su una scheda di
 *    un'altra famiglia — da un collegamento, dalla ricerca, dal tasto
 *    «Configura» dell'elenco delle sezioni — il filtro ci si sposta dietro.
 *    Così non può mai esistere il caso in cui la scheda che stai guardando è
 *    quella nascosta, che sarebbe il modo in cui un filtro diventa un guasto.
 *
 * Ritoccare la famiglia accesa lo spegne: è l'unico gesto che serve per
 * tornare a vederle tutte, ed è lo stesso dito nello stesso posto.
 */
const NASCOSTA = "dm-alberatura-fuori";

/** La famiglia scelta adesso, o "" quando si vedono tutte. */
const famigliaScelta = () => clean(state.famiglia);

/** Mostra o nasconde le linguette e le insegne secondo la famiglia scelta. */
function applicaIlFiltro() {
  const dentro = fila();
  if (!dentro) return false;
  const scelta = famigliaScelta();
  for (const nodo of linguette(dentro)) {
    const id = clean(nodo.dataset.tab);
    const fuori = Boolean(scelta) && Boolean(id) && famigliaDellaScheda(id) !== scelta;
    nodo.classList.toggle(NASCOSTA, fuori);
  }
  for (const insegna of dentro.querySelectorAll(`:scope > .${INSEGNA}`))
    insegna.classList.toggle(
      NASCOSTA,
      Boolean(scelta) && clean(insegna.dataset.famiglia) !== scelta,
    );
  return true;
}

/* Il filtro non nasconde mai la scheda che si sta guardando: se l'attiva è
 * finita fuori, il filtro le va dietro. */
function ilFiltroSegueLaScheda() {
  const scelta = famigliaScelta();
  if (!scelta) return false;
  const attiva = schedaAttiva();
  if (!attiva || famigliaDellaScheda(attiva) === scelta) return false;
  state.famiglia = famigliaDellaScheda(attiva);
  return true;
}

function apriLaFamiglia(chiave) {
  const dentro = fila();
  if (!dentro) return;
  const ids = linguette(dentro)
    .map((nodo) => clean(nodo.dataset.tab))
    .filter((id) => id && famigliaDellaScheda(id) === chiave);
  if (!ids.length) return;
  /* Ritoccare la famiglia accesa la spegne: si torna a vederle tutte. */
  if (famigliaScelta() === chiave) {
    state.famiglia = "";
    applicaIlFiltro();
    return;
  }
  const attiva = schedaAttiva();
  /* Se si è già dentro quella famiglia non si cambia scheda: chi tocca
   * «Casa» mentre sta configurando le Luci vuole vedere dov'è, non perdere
   * il posto. */
  const dove = ids.includes(attiva) ? attiva : inOrdine(ids)[0];
  state.famiglia = chiave;
  if (dove !== attiva) {
    try {
      root.editorSwitch?.(dove);
    } catch (_error) {}
  }
  applicaIlFiltro();
  const bottone = dentro.querySelector(`:scope > .ed-tab[data-tab="${CSS.escape(dove)}"]`);
  try {
    bottone?.scrollIntoView?.({ block: "nearest", inline: "start", behavior: "smooth" });
  } catch (_error) {
    bottone?.scrollIntoView?.(true);
  }
}

function ensureFila() {
  const tabs = fila();
  if (!tabs) return false;
  const bottoni = linguette(tabs)
    .map((nodo) => clean(nodo.dataset.tab))
    .filter(Boolean);
  if (!bottoni.length) return false;
  const gruppi = famiglieConSchede(bottoni);
  let riga = doc.getElementById(FILA);
  if (!riga) {
    riga = doc.createElement("div");
    riga.id = FILA;
    riga.className = FILA;
    tabs.before(riga);
  } else if (riga.nextElementSibling !== tabs) {
    tabs.before(riga);
  }
  const attiva = famigliaDellaScheda(schedaAttiva());
  const scelta = famigliaScelta();
  /* Il chip acceso è quello della scheda che si sta guardando; quello che
   * FILTRA lo dice `aria-pressed`, perché sono due cose diverse: si può stare
   * su una scheda della Sicurezza senza aver chiesto di vedere solo quella. */
  const markup = gruppi
    .map(
      (voce) =>
        `<button type="button" class="dm-alberatura-famiglia${voce.chiave === attiva ? " active" : ""}" aria-pressed="${voce.chiave === scelta ? "true" : "false"}" data-dm-famiglia="${esc(voce.chiave)}"><span aria-hidden="true">${esc(voce.glifo)}</span>${esc(nomeDellaFamiglia(voce))}</button>`,
    )
    .join("");
  /* «Tutte» c'e' sempre, e quando non si sta filtrando e' lei quella scelta.
   *
   * Prima compariva solo a filtro acceso: la si toccava, il filtro si
   * spegneva, e il tasto spariva sotto il dito che l'aveva appena premuto —
   * «quando clicco su tutte scompare tasto tutte». Un tasto che se ne va
   * quando lo usi non e' un tasto, e' una trappola: adesso resta al suo posto
   * e si limita ad accendersi, come le altre. */
  const coda = `<button type="button" class="dm-alberatura-famiglia dm-alberatura-tutte${scelta ? "" : " active"}" aria-pressed="${scelta ? "false" : "true"}" data-dm-famiglia-tutte>${esc(t("Tutte", "All"))}</button>`;
  if (riga.innerHTML !== markup + coda) riga.innerHTML = markup + coda;
  return true;
}

/* ── il nome della sezione, in cima alla sua scheda ───────────────────── */

/* «In ogni sezione del config in alto voglio l'etichetta della sezione
 * cliccata: se clicco Home entro in Home e mi deve uscire la scritta Home.»
 *
 * Il Config e' una colonna di nomi a sinistra e un corpo a destra, e il corpo
 * non diceva in che scheda si fosse: lo diceva soltanto la linguetta accesa,
 * che su un telefono e' larga quarantasei pixel e porta il solo simbolo. Si
 * scorreva dentro una scheda senza sapere quale.
 *
 * Il nome non si inventa: e' quello scritto sulla linguetta, ed e' anche
 * l'unico che segue la lingua di chi guarda senza che questo modulo sappia
 * niente delle traduzioni. Accanto ci va l'insegna della sua famiglia, che
 * dice da dove si e' entrati.
 */
const TITOLO = "dm-alberatura-titolo";

function nomeDellaScheda(bottone) {
  const scritto = clean(bottone?.querySelector?.("[data-dm-config-name]")?.textContent);
  if (scritto) return scritto;
  /* Senza il pezzo del nome si legge la linguetta intera, togliendole il
   * simbolo davanti: e' quello che si vedeva prima che la colonna imparasse a
   * dividere le due cose. */
  return clean(bottone?.textContent).replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export function ensureTitoloDellaSezione() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo) return false;
  const attiva = schedaAttiva();
  const bottone = attiva
    ? doc.querySelector(`.ed-tab[data-tab="${CSS.escape(attiva)}"]`)
    : null;
  const nome = nomeDellaScheda(bottone);
  if (!nome) return false;
  const famiglia = famiglieConSchede([attiva]).find((voce) => voce.schede.includes(attiva));
  let testa = corpo.querySelector(`:scope > .${TITOLO}`);
  if (!testa) {
    testa = doc.createElement("h2");
    testa.className = TITOLO;
  }
  /* Il guscio riscrive il corpo a ogni cambio di scheda: il titolo torna in
   * cima da se', invece di essere rimesso li' da chi si ricorda di farlo. */
  if (corpo.firstElementChild !== testa) corpo.prepend(testa);
  const insegnaTesto = famiglia ? `${famiglia.glifo} ${nomeDellaFamiglia(famiglia)}` : "";
  const markup = `${insegnaTesto ? `<span class="${TITOLO}-famiglia">${esc(insegnaTesto)}</span>` : ""}<span class="${TITOLO}-nome">${esc(nome)}</span>`;
  if (testa.innerHTML !== markup) testa.innerHTML = markup;
  return true;
}

/* ── all'apertura si parte dalla Plancia ──────────────────────────────── */

/* «Quando si apre la sezione config, per default mettilo su Plancia.»
 *
 * Il Config riapriva sulla scheda di prima — chi aveva chiuso su «Macchine e
 * rete» la ritrovava li' il giorno dopo, che e' un posto profondo in cui non
 * si e' scelto di essere. Si riparte dalla prima scheda della prima famiglia.
 *
 * Si aggancia all'APERTURA, non al ridisegno. Farlo a ogni giro voleva dire
 * rimandare indietro chiunque cambiasse scheda: il ridisegno arriva anche
 * dopo un `editorSwitch`, e chi aveva appena scelto «Widget» se lo vedeva
 * revocare un istante dopo — le prove l'hanno visto subito. Qui si scrive la
 * scheda una volta, nel momento in cui la finestra si apre, e da li' in poi
 * comanda chi tocca.
 *
 * E soltanto se quella scheda esiste davvero: chi ha spento la Plancia non
 * deve trovarsi rimbalzato su una linguetta che non c'e'.
 */
export function partiDallaPlancia() {
  const dentro = fila();
  if (!dentro) return false;
  const bottoni = linguette(dentro)
    .map((nodo) => clean(nodo.dataset.tab))
    .filter(Boolean);
  const prima = famiglieConSchede(bottoni)[0]?.schede?.[0];
  if (!prima || schedaAttiva() === prima) return false;
  try {
    root.editorSwitch?.(prima);
  } catch (_error) {
    return false;
  }
  return true;
}

/** Un giro solo: l'ordine, il filtro che non nasconde l'attiva, poi l'indice. */
export function ensureAlberatura() {
  const fatto = riordinaLeLinguette();
  ilFiltroSegueLaScheda();
  applicaIlFiltro();
  ensureFila();
  ensureTitoloDellaSezione();
  return fatto;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(evento) {
  if (evento.target?.closest?.("[data-dm-famiglia-tutte]")) {
    evento.preventDefault();
    state.famiglia = "";
    applicaIlFiltro();
    ensureFila();
    return;
  }
  const chip = evento.target?.closest?.("[data-dm-famiglia]");
  if (!chip) return;
  evento.preventDefault();
  apriLaFamiglia(clean(chip.dataset.dmFamiglia));
  /* L'insegna attiva cambia con la scheda, e la scheda l'abbiamo appena
   * cambiata noi: il ridisegno del guscio arriva dopo. */
  root.queueMicrotask?.(ensureFila);
}

function installStili() {
  installStyle(
    "dm-alberatura-style",
    `
    /* La fila si mette in una riga sua della griglia del Config.
     *
     * Il Config non e' un blocco che scorre: e' una griglia di due colonne —
     * la colonna delle linguette a sinistra, il corpo a destra — con la
     * testata che le scavalca tutte e due. Le due righe sono dichiarate a
     * mano, e ogni pezzo ha la sua casella scritta addosso.
     *
     * Infilare una fila nuova senza dirle dove andare vuol dire lasciarla
     * piazzare da sola, e si sistemava SOPRA la colonna delle linguette. Su
     * uno schermo largo si vedeva lo stesso e sembrava a posto; su un telefono
     * quella colonna e' larga 46 pixel, e la fila delle famiglie ci finiva
     * sotto: visibile, e impossibile da premere.
     *
     * Qui la griglia diventa di tre righe e ognuno riprende la sua: la
     * testata, poi la fila delle famiglie per tutta la larghezza, e sotto le
     * linguette col loro corpo. Il foglio del guscio nomina le linguette con
     * due classi; qui se ne nomina anche il padre, cioe' si scende di un figlio
     * in piu': non si alza la voce con un !important, si ha una ragione in
     * piu'. */
    /* Quattro righe: la testata, la ricerca, le famiglie, e sotto la colonna
       col suo corpo. La ricerca vale per tutta la configurazione e sta per
       tutta la larghezza: e' li' che si vede che non appartiene alla scheda
       aperta. */
    #editor-modal.modal-wrapper .ed-shell{grid-template-rows:auto auto auto auto}
    #editor-modal.modal-wrapper .ed-shell>.dm-cerca-config{grid-area:2 / 1 / 3 / 3}
    #editor-modal.modal-wrapper .ed-shell>#${FILA}{grid-area:3 / 1 / 4 / 3}
    #editor-modal.modal-wrapper .ed-shell>.ed-tabs{grid-area:4 / 1 / 5 / 2}
    #editor-modal.modal-wrapper .ed-shell>.ed-body{grid-area:4 / 2 / 5 / 3}
    #${FILA}{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 0}
    #${FILA} .dm-alberatura-famiglia{
      display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;cursor:pointer;
      border:1px solid var(--divider-color,#dbe4ee);background:var(--secondary-background-color,#eef2f7);
      color:var(--text-dim,#64748b);font:inherit;font-size:11.5px;font-weight:900;letter-spacing:.03em}
    #${FILA} .dm-alberatura-famiglia:hover{border-color:var(--primary-color,#0ea5e9)}
    #${FILA} .dm-alberatura-famiglia.active{
      background:var(--primary-color,#0ea5e9);border-color:var(--primary-color,#0ea5e9);color:#fff}
    #${FILA} .dm-alberatura-famiglia:focus-visible{outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:2px}
    /* La famiglia che sta filtrando porta un anello: acceso vuol dire «sei
       qui», con l'anello vuol dire «vedi solo questa». */
    #${FILA} .dm-alberatura-famiglia[aria-pressed="true"]{
      box-shadow:0 0 0 2px var(--card-bg,#fff),0 0 0 4px var(--primary-color,#0ea5e9)}
    #${FILA} .dm-alberatura-tutte{
      background:transparent;border-style:dashed;color:var(--text-dim,#64748b)}
    /* Scelta anche lei, quando non si sta filtrando: e' lo stato normale del
       Config, e deve vedersi che e' uno stato, non l'assenza di uno. */
    #${FILA} .dm-alberatura-tutte.active{
      background:var(--secondary-background-color,#e2e8f0);border-style:solid;
      border-color:var(--divider-color,#cbd5e1);color:var(--primary-text-color,#0f172a)}
    /* Fuori dalla famiglia scelta. A riposo questa classe non ce l'ha nessuno:
       il filtro si accende toccando una famiglia, e chi apre il Config le vede
       tutte com'e' sempre stato. */
    .ed-tab.${NASCOSTA},.${INSEGNA}.${NASCOSTA}{display:none!important}
    /* L'insegna sta nella fila delle linguette e non è una linguetta: non si
       preme, non si sceglie, dice soltanto dove comincia una famiglia. */
    .${INSEGNA}{
      align-self:center;flex:0 0 auto;padding:0 8px 0 4px;
      font-size:9.5px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8);white-space:nowrap;pointer-events:none;user-select:none}
    .${INSEGNA}:first-child{padding-left:0}

    /* ── la colonna come un menu, con le sue voci sotto l'insegna ────────
     *
     * «Nel menu laterale si vede male: crea il menu con sotto-menu nella barra
     * laterale.» In colonna le insegne erano centrate — la regola sopra le
     * scrive per una fila orizzontale — e finivano in mezzo alle voci senza
     * separarle da niente: trentadue nomi con sette scritte piccole dentro,
     * tutti allo stesso livello.
     *
     * Qui l'insegna diventa una testata larga quanto la colonna, con una linea
     * che apre la famiglia, e le voci scendono di un gradino sotto di lei con
     * il filo che le tiene insieme. Si vede a colpo d'occhio dove comincia una
     * famiglia e cosa le appartiene.
     *
     * Nessuna voce sparisce: restano tutte visibili e premibili, come prima —
     * e' la regola di questo modulo, e sono quaranta prove a dipenderne. */
    #editor-modal.modal-wrapper .ed-tabs>.${INSEGNA}{
      align-self:stretch;display:block;white-space:normal;
      margin:12px 0 4px;padding:8px 6px 5px;
      border-top:1px solid var(--card-border,#dbe4ee);
      font-size:9.5px;letter-spacing:.1em}
    #editor-modal.modal-wrapper .ed-tabs>.${INSEGNA}:first-child{
      margin-top:0;padding-top:2px;border-top:0}
    /* Il gradino: le voci di una famiglia rientrano, e il filo a sinistra dice
       che stanno sotto la sua insegna. */
    #editor-modal.modal-wrapper .ed-tabs>.ed-tab{
      margin-left:9px;border-left:2px solid var(--card-border,#e2e8f0);
      border-top-left-radius:6px;border-bottom-left-radius:6px}
    #editor-modal.modal-wrapper .ed-tabs>.ed-tab.active{
      border-left-color:var(--primary-color,#0ea5e9)}
    @media (orientation: portrait) and (max-width: 640px){
      /* Da telefono la colonna e' larga quarantasei pixel e porta i soli
         simboli: il gradino se lo mangerebbe tutto, e l'insegna diventa una
         riga sola col suo glifo. */
      #editor-modal.modal-wrapper .ed-tabs>.ed-tab{margin-left:0;border-left:0}
      #editor-modal.modal-wrapper .ed-tabs>.${INSEGNA}{
        margin:8px 0 2px;padding:6px 0 4px;text-align:center;
        font-size:0;letter-spacing:0}
      /* Il solo glifo, che nel testo dell'insegna e' il primo carattere. */
      #editor-modal.modal-wrapper .ed-tabs>.${INSEGNA}::first-letter{font-size:12px}
    }

    /* ── il nome della sezione, in cima al suo corpo ─────────────────── */
    .${TITOLO}{
      display:flex;flex-direction:column;gap:2px;margin:0 0 14px;padding:0 0 10px;
      border-bottom:1px solid var(--card-border,#e2e8f0)}
    .${TITOLO}-famiglia{
      font-size:9.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8)}
    .${TITOLO}-nome{
      font-size:19px;font-weight:900;letter-spacing:-.01em;
      color:var(--primary-text-color,#0f172a);line-height:1.15}
    @media(max-width:640px){
      .${TITOLO}{margin-bottom:11px;padding-bottom:8px}
      .${TITOLO}-nome{font-size:17px}
    }
    @media(max-width:640px){
      #${FILA}{padding:8px 10px 0}
      #${FILA} .dm-alberatura-famiglia{padding:5px 10px;font-size:11px}
      .${INSEGNA}{font-size:9px;padding:0 6px 0 2px}
    }
    `,
  );
}

/* Un avvolgimento che agisce prima di restituire, non in coda.
 *
 * `wrapFunction` mette il richiamo in un microtask, ed e' giusto per chi deve
 * guardare com'e' finito il disegno. Qui serve il contrario: bisogna scegliere
 * la scheda mentre la finestra si apre, prima che chi ha aperto dica la sua. */
function avvolgiLApertura() {
  const nome = "apriConfigEntita";
  const originale = root[nome];
  if (typeof originale !== "function" || originale.__dmAlberaturaApre) return false;
  function avvolta(...argomenti) {
    const esito = originale.apply(this, argomenti);
    try {
      ensureAlberatura();
      partiDallaPlancia();
    } catch (_error) {}
    return esito;
  }
  Object.assign(avvolta, originale);
  avvolta.__dmAlberaturaApre = true;
  avvolta.__dmPrevious = originale;
  root[nome] = avvolta;
  return true;
}

export function installAlberatura() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  doc.addEventListener("click", onClick);
  /* Due passate: una subito e una dopo i microtask, perché è in quelli che i
   * quattordici moduli si aggiungono la loro linguetta. La seconda costa il
   * riordino di trentadue nodi che sono già in ordine — cioè niente. */
  const giro = () => {
    ensureAlberatura();
    root.setTimeout?.(ensureAlberatura, 0);
  };
  onEditorRedraw("__dmAlberatura", () => root.queueMicrotask?.(giro));
  /* All'apertura si parte dalla Plancia: una volta, e SUBITO.
   *
   * Subito perche' chi apre il Config molto spesso apre e poi chiede una
   * scheda precisa, nella stessa riga: la finestra si apre e un istante dopo
   * si va dove si voleva andare. Mettendo la nostra scelta in coda — anche
   * solo di un microtask — arrivava dopo la sua, e la revocava: si chiedeva
   * «Widget» e ci si ritrovava su «Impostazioni». Qui si scrive la scheda
   * mentre la finestra si apre, cosi' chiunque parli dopo ha ragione. */
  avvolgiLApertura();
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(giro));
  giro();
  return true;
}

installAlberatura();
