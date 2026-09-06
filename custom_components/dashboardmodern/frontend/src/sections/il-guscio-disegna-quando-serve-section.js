/* Il guscio disegna quando serve, non a ogni battito.
 *
 * Dal campo: «ci sono le vecchie sezioni sotto che vengono sovrascritte», e
 * il telefono che si scalda con la plancia aperta. Non c'e' niente di vecchio
 * sotto: c'e' il runtime vendorizzato che fa un lavoro e un modulo che lo
 * rifa' sopra, e il primo lo fa piu' spesso di quanto qualcuno guardi.
 *
 * Quattro cose, tutte con lo stesso difetto — lavoro fatto senza che nessuno
 * lo abbia chiesto — e tutte con un padrone solo, qui:
 *
 * 1. `cdRenderSoon`. Ogni `state_changed` di ogni entita' di casa, anche di
 *    quelle che la plancia non mostra, anche a scheda nascosta, chiedeva un
 *    `render()` intero al fotogramma dopo: settecento righe, settantaquattro
 *    getElementById, la finestra dei dettagli riscritta, e la decina di moduli
 *    agganciati dietro. I moduli hanno gia' il loro cancello (state-event-gate,
 *    mezzo secondo): il guscio adesso ha lo stesso passo. Una raffica fa un
 *    disegno, a scheda nascosta non se ne fa nessuno e al ritorno se ne fa
 *    uno. Chi chiama `render()` a mano lo ha ancora subito, sincrono.
 *
 * 2. La finestra dei dettagli. `render()` la riscriveva da capo
 *    (`innerHTML`) a ogni giro, con gli stessi stati di prima. Si riscrive
 *    solo quando gli stati del suo gruppo sono cambiati davvero.
 *
 * 3. I timer del guscio. Una ventina di `setInterval` armati mentre il
 *    runtime viene letto, senza identificativo, per sempre: la barra ogni tre
 *    secondi, le tapparelle ogni due, l'auto-nascondi ogni minuto, gli
 *    orologi delle telecamere ogni secondo anche da Home. Il preludio li
 *    annota mentre nascono; qui si spengono quelli che un modulo fa gia' o che
 *    sono morti, e la logica vera che portavano — il passo dell'irrigazione,
 *    la sveglia della piscina, l'ora sulle telecamere — la fa un orologio che
 *    gira SOLO finche' serve e finche' la pagina si vede.
 *
 * 4. Le particelle della ricarica. Sessanta fotogrammi al secondo su una tela
 *    che sta in una pagina non aperta, o in una scheda nascosta. Si fermano
 *    quando nessuno le guarda e ripartono quando qualcuno torna a guardarle.
 *
 * Il filtro per entita' del cancello dei moduli qui NON si applica: `render()`
 * legge anche entita' che non stanno nella configurazione — `weather.home`,
 * `switch.caldaia`, i ripieghi di `cdFirstMapped`, i gruppi del Quadro Avvisi —
 * e scartare un evento «non configurato» vorrebbe dire lasciare indietro una
 * di quelle. Il passo di mezzo secondo basta da solo a togliere il grosso.
 */
import { allStates, doc, lexicalGlobal, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_GUSCIO_QUANDO_SERVE__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  /* Il disegno del guscio. */
  timer: 0,
  frame: 0,
  pendente: false,
  disegni: 0,
  /* La finestra dei dettagli. */
  dettagli: null,
  firma: "",
  passaggio: false,
  /* I timer del guscio e gli orologi che li sostituiscono. */
  potati: [],
  orologio: 0,
  irrigazione: 0,
  piscina: 0,
  osservatori: [],
  /* Le particelle della ricarica. */
  tela: null,
  particelleVolute: false,
});

/** Lo stesso passo del cancello dei moduli (state-event-gate, 500 ms). */
export const RITARDO_DEL_DISEGNO_MS = 500;

function nascosta() {
  return doc?.visibilityState === "hidden";
}

function paginaAttiva(id) {
  return Boolean(doc?.getElementById?.(id)?.classList?.contains("active"));
}

/* ── 1. il disegno del guscio ─────────────────────────────────────────── */

function disegna() {
  state.frame = 0;
  state.timer = 0;
  state.pendente = false;
  state.disegni += 1;
  try {
    root.render?.();
  } catch (_errore) {}
}

function fotogramma() {
  /* A scheda nascosta il fotogramma non arriva: si resta in attesa del
   * ritorno, che disegna una volta. */
  if (nascosta() || state.frame) return;
  state.frame = root.requestAnimationFrame?.(disegna) || root.setTimeout?.(disegna, 16) || 0;
  if (!state.frame) disegna();
}

/**
 * Chiede un disegno del guscio. Senza `subito` si aspetta il passo del
 * cancello, cosi' una raffica di eventi fa un disegno solo; con `subito` si
 * disegna al fotogramma dopo — e' il ritorno alla scheda, o una pagina che si
 * apre. A scheda nascosta si prende nota e basta.
 */
export function richiediDisegno({ subito = false } = {}) {
  state.pendente = true;
  if (nascosta()) return false;
  if (subito) {
    if (state.timer) {
      root.clearTimeout?.(state.timer);
      state.timer = 0;
    }
    fotogramma();
    return true;
  }
  if (state.timer || state.frame) return true;
  state.timer =
    root.setTimeout?.(() => {
      state.timer = 0;
      fotogramma();
    }, RITARDO_DEL_DISEGNO_MS) || 0;
  if (!state.timer) fotogramma();
  return true;
}

function installaIlDisegno() {
  const attuale = root.cdRenderSoon;
  if (typeof attuale === "function" && attuale.__dmQuandoServe) return false;
  function cdRenderSoonQuandoServe() {
    richiediDisegno();
  }
  cdRenderSoonQuandoServe.__dmQuandoServe = true;
  cdRenderSoonQuandoServe.__dmPrevious = attuale;
  root.cdRenderSoon = cdRenderSoonQuandoServe;
  return true;
}

/* Le temperature dell'inverter le leggeva un timer da due secondi, con la
 * vista aperta. Cambiano quando cambia uno stato, e un cambio di stato fa un
 * disegno: si leggono dopo quello. */
function dopoIlDisegno() {
  if (!paginaAttiva("view-temp")) return;
  try {
    root.renderInverterTemp?.();
  } catch (_errore) {}
}

/* ── 2. la finestra dei dettagli ──────────────────────────────────────── */

/* La firma degli stati del gruppo che la finestra elenca: `last_updated`
 * cambia a ogni evento dell'entita' in Home Assistant; dove manca (stati
 * finti, sintetici) contano gli attributi. Il gruppo stesso entra nella
 * firma, cosi' una configurazione nuova ridisegna. */
export function firmaDellaFinestra(tipo, gruppi = lexicalGlobal("GRUPPI_MONITORAGGIO"), stati) {
  const ids = Array.isArray(gruppi?.[tipo]) ? gruppi[tipo] : null;
  if (!ids) return "";
  const letture = stati || lexicalGlobal("STATES") || allStates();
  return ids
    .map((id) => {
      const stato = letture?.[id];
      if (!stato) return `${id}:`;
      return `${id}:${stato.state}:${stato.last_updated || JSON.stringify(stato.attributes ?? null)}`;
    })
    .join("|");
}

function finestraAperta() {
  return Boolean(doc?.getElementById?.("details-modal")?.classList?.contains("show"));
}

/* Il guscio riscrive la finestra chiamando `apriDettagli(null, tipo)`: senza
 * evento, con il tipo di quella aperta. E' l'unico richiamo che si puo'
 * risparmiare; un tocco dell'utente riscrive sempre.
 *
 * Questo involucro sta FUORI da tutti gli altri: la vetrina degli
 * elettrodomestici e il popup del clima si agganciano allo stesso nome, e il
 * secondo decora la lista appena scritta — su una lista non riscritta
 * decorerebbe due volte. Per restare fuori si installa quando i moduli sono
 * tutti dentro (`runtime-ready`), e porta con se' i loro segni, cosi' nessuno
 * si rimette sopra. Se qualcuno ci si mette lo stesso, un secondo involucro
 * nostro non decide niente: `passaggio` lo lascia passare. */
function installaLaFinestra() {
  const attuale = root.apriDettagli;
  if (typeof attuale !== "function" || attuale === state.dettagli) return false;
  function apriDettagliQuandoServe(evento, tipo, ...resto) {
    const richiamo =
      !evento && !state.passaggio && tipo && tipo === lexicalGlobal("currentPopupType");
    if (richiamo && finestraAperta()) {
      const firma = firmaDellaFinestra(tipo);
      if (firma && firma === state.firma) return undefined;
    }
    state.passaggio = true;
    try {
      return attuale.call(this, evento, tipo, ...resto);
    } finally {
      state.passaggio = false;
      state.firma = firmaDellaFinestra(tipo);
    }
  }
  Object.assign(apriDettagliQuandoServe, attuale);
  apriDettagliQuandoServe.__dmQuandoServe = true;
  apriDettagliQuandoServe.__dmPrevious = attuale;
  state.dettagli = apriDettagliQuandoServe;
  root.apriDettagli = apriDettagliQuandoServe;
  return true;
}

/* ── 3. i timer del guscio ────────────────────────────────────────────── */

/**
 * I timer del runtime vendorizzato che qui si spengono, riconosciuti dal
 * sorgente e dal passo con cui il preludio li ha annotati. Restano accesi
 * quelli che portano una logica che nessun modulo fa: il programma
 * dell'irrigazione e il conteggio della piscina, ogni trenta secondi, e il
 * controllo aggiornamenti ogni sei ore (che nella plancia ospitata esce
 * subito).
 */
export const TIMER_DEL_GUSCIO = Object.freeze([
  /* renderTapparelle: la scena delle tapparelle e' del modulo, che disegna
   * agli eventi di stato con la sua firma. */
  { nome: "tapparelle", period: 2000, firma: /renderTapparelle\(\)/ },
  /* cdIrrNext + renderIrrigazione ogni secondo, con `offsetParent` letto a
   * ogni giro: il passo lo fa l'orologio qui sotto, solo con una sequenza in
   * corso. */
  { nome: "irrigazione", period: 1000, firma: /cdIrrNext\(\)/ },
  /* cdPoolStopFilter + renderPiscina ogni due secondi: la fine della
   * filtrazione e' una sveglia, non un sondaggio. */
  { nome: "piscina", period: 2000, firma: /cdPoolStopFilter\(\)/ },
  /* cdEvCarsRefresh: leggeva `cd_ev_cars` dal localStorage ogni due secondi;
   * il modulo dell'auto lo richiama quando la configurazione cambia. */
  { nome: "auto", period: 2000, firma: /cdEvCarsRefresh\(\)/ },
  /* cdApplyNavVis ogni tre secondi: la barra la rilegge il suo modulo dopo
   * ogni disegno e a ogni configurazione arrivata. */
  { nome: "barra", period: 3000, firma: /cdApplyNavVis\(\)/ },
  /* cdApplBridge: morto, `APPLIANCES` non esiste e la funzione esce alla
   * prima riga. */
  { nome: "ponte-elettrodomestici", period: 15000, firma: /^function cdApplBridge\b/ },
  /* renderInverterTemp ogni due secondi a vista aperta: dopo il disegno. */
  { nome: "inverter", period: 2000, firma: /renderInverterTemp\(\)/ },
  /* updateClimaCards e updateDeviceCards ogni venti secondi: girano gia'
   * dentro ogni render(). */
  { nome: "clima", period: 20000, firma: /updateClimaCards\(\)/ },
  { nome: "dispositivi", period: 20000, firma: /updateDeviceCards\(\)/ },
  /* cdAutoHide ogni minuto: tutto il documento con `[onclick]` e scritture
   * di stile. Si rifa' quando cambia la configurazione, che e' l'unica cosa
   * che lo puo' cambiare. */
  { nome: "auto-nascondi", period: 60000, firma: /cdAutoHide\(\)/ },
  /* updateCamClocks ogni secondo, da qualunque pagina: l'orologio qui sotto
   * gira solo con la Sicurezza aperta e la scheda in vista. */
  { nome: "orologi", period: 1000, firma: /^function updateCamClocks\b/ },
]);

/**
 * Spegne i timer del guscio che un modulo fa gia' o che sono morti. Legge
 * l'elenco che il preludio tiene in `__DASHBOARDMODERN_LEGACY_INTERVALS__`;
 * ogni voce spenta resta li', segnata, per la Diagnostica.
 */
export function potaITimerDelGuscio(elenco = root.__DASHBOARDMODERN_LEGACY_INTERVALS__) {
  if (!Array.isArray(elenco)) return [];
  const potati = [];
  for (const voce of elenco) {
    if (!voce || voce.cleared) continue;
    const regola = TIMER_DEL_GUSCIO.find(
      (candidata) =>
        candidata.period === voce.period && candidata.firma.test(String(voce.fn || "")),
    );
    if (!regola) continue;
    try {
      root.clearInterval?.(voce.id);
    } catch (_errore) {}
    voce.cleared = true;
    voce.owner = regola.nome;
    potati.push(regola.nome);
    state.potati.push(regola.nome);
  }
  return potati;
}

/* L'ora sulle telecamere: ogni secondo, ma solo con la Sicurezza aperta e la
 * scheda in vista. Da Home non c'e' nessun orologio da aggiornare. */
export function sincronizzaOrologi() {
  const serve =
    !nascosta() && paginaAttiva("page-security") && typeof root.updateCamClocks === "function";
  if (serve && !state.orologio) {
    try {
      root.updateCamClocks();
    } catch (_errore) {}
    state.orologio =
      root.setInterval?.(() => {
        try {
          root.updateCamClocks?.();
        } catch (_errore) {}
      }, 1000) || 0;
    return true;
  }
  if (!serve && state.orologio) {
    root.clearInterval?.(state.orologio);
    state.orologio = 0;
    return true;
  }
  return false;
}

function sequenzaInCorso() {
  const irrigazione = root.CD_IRR;
  return Boolean(irrigazione) && Number(irrigazione.cur) >= 0;
}

/* Il passo dell'irrigazione: chiude una zona e apre la prossima quando il suo
 * tempo e' scaduto. E' logica vera — acqua — e corre anche a scheda nascosta;
 * il disegno del conto alla rovescia invece solo con la pagina in vista. */
function battitoIrrigazione() {
  try {
    if (sequenzaInCorso() && Date.now() > Number(root.CD_IRR?.until)) root.cdIrrNext?.();
  } catch (_errore) {}
  if (!sequenzaInCorso()) {
    sincronizzaIrrigazione();
    return;
  }
  if (nascosta() || !paginaAttiva("page-irrigazione")) return;
  try {
    root.renderIrrigazione?.();
  } catch (_errore) {}
}

export function sincronizzaIrrigazione() {
  const serve = sequenzaInCorso();
  if (serve && !state.irrigazione) {
    state.irrigazione = root.setInterval?.(battitoIrrigazione, 1000) || 0;
    return true;
  }
  if (!serve && state.irrigazione) {
    root.clearInterval?.(state.irrigazione);
    state.irrigazione = 0;
    return true;
  }
  return false;
}

/* La fine della filtrazione della prima vasca e' un'ora precisa
 * (`CD_POOL.stopAt`): una sveglia a quell'ora, non un sondaggio ogni due
 * secondi per tutta la giornata. Le vasche oltre la prima hanno il loro
 * modulo, con il loro orologio. */
export function sincronizzaPiscina() {
  if (state.piscina) {
    root.clearTimeout?.(state.piscina);
    state.piscina = 0;
  }
  const stopAt = Number(root.CD_POOL?.stopAt) || 0;
  if (!stopAt) return false;
  const attesa = Math.max(0, stopAt - Date.now()) + 250;
  state.piscina =
    root.setTimeout?.(() => {
      state.piscina = 0;
      try {
        const scadenza = Number(root.CD_POOL?.stopAt) || 0;
        if (scadenza && Date.now() > scadenza) root.cdPoolStopFilter?.();
        else sincronizzaPiscina();
      } catch (_errore) {}
    }, attesa) || 0;
  return Boolean(state.piscina);
}

/* L'auto-nascondi legge le entita' mappate: si rifa' quando la mappatura
 * arriva da un altro dispositivo o si azzera. Il salvataggio dall'editor lo
 * chiama gia' da se'. */
function riNascondi() {
  try {
    root.cdAutoHide?.();
  } catch (_errore) {}
}

function installaGliOrologi() {
  wrapFunction("cdIrrStartSeq", "__dmQuandoServeIrrigazione", sincronizzaIrrigazione);
  wrapFunction("cdPoolStartFilter", "__dmQuandoServePiscinaAvvio", sincronizzaPiscina);
  wrapFunction("cdPoolStopFilter", "__dmQuandoServePiscinaStop", sincronizzaPiscina);
  wrapFunction("render", "__dmQuandoServeInverter", dopoIlDisegno);
  sincronizzaOrologi();
  sincronizzaIrrigazione();
  sincronizzaPiscina();
}

/* ── 4. le particelle della ricarica ──────────────────────────────────── */

function evInVista() {
  return !nascosta() && paginaAttiva("page-ev");
}

/* Il guscio chiama `lmStartParticles(tela)` dentro render() quando l'auto
 * carica e `tela._animRunning` e' spento, e lo accende prima di chiamare. Se
 * la pagina non si vede si rispegne subito: il giro non parte, e il render
 * che arrivera' quando la pagina si vede lo fara' partire. */
function installaLeParticelle() {
  const attuale = root.lmStartParticles;
  if (typeof attuale !== "function" || attuale.__dmQuandoServe) return false;
  function lmStartParticlesQuandoServe(tela, ...resto) {
    if (!tela) return attuale.call(this, tela, ...resto);
    state.tela = tela;
    if (!evInVista()) {
      tela._animRunning = false;
      state.particelleVolute = true;
      return undefined;
    }
    state.particelleVolute = false;
    return attuale.call(this, tela, ...resto);
  }
  lmStartParticlesQuandoServe.__dmQuandoServe = true;
  lmStartParticlesQuandoServe.__dmPrevious = attuale;
  root.lmStartParticles = lmStartParticlesQuandoServe;
  return true;
}

export function fermaLeParticelle() {
  const tela = state.tela;
  if (!tela?._animRunning) return false;
  tela._animRunning = false;
  state.particelleVolute = true;
  return true;
}

/* Ripartire vuol dire chiedere un disegno: e' il guscio a sapere se l'auto
 * sta ancora caricando, e a far ripartire il giro se si'. */
export function riprendiLeParticelle() {
  if (!state.particelleVolute || !evInVista()) return false;
  state.particelleVolute = false;
  richiediDisegno({ subito: true });
  return true;
}

/* ── il cambio di pagina e di scheda ──────────────────────────────────── */

function dopoIlCambio() {
  sincronizzaOrologi();
  if (evInVista()) riprendiLeParticelle();
  else fermaLeParticelle();
}

function alCambioDiVisibilita() {
  if (nascosta()) {
    fermaLeParticelle();
    sincronizzaOrologi();
    return;
  }
  /* Il ritorno: quello che si e' accumulato al buio si disegna una volta. */
  if (state.pendente) richiediDisegno({ subito: true });
  dopoIlCambio();
}

/* Le pagine cambiano classe: dal tocco sulla barra, da un modulo, da una
 * prova. Un osservatore sull'attributo di tre elementi non costa niente da
 * fermo e vede tutte le strade. */
function osservaLePagine() {
  if (state.osservatori.length || typeof root.MutationObserver !== "function") return;
  for (const id of ["page-security", "page-ev", "page-irrigazione"]) {
    const pagina = doc?.getElementById?.(id);
    if (!pagina) continue;
    const osservatore = new root.MutationObserver(dopoIlCambio);
    osservatore.observe(pagina, { attributes: true, attributeFilter: ["class"] });
    state.osservatori.push(osservatore);
  }
}

function installaTutto() {
  installaIlDisegno();
  installaLeParticelle();
  installaGliOrologi();
  potaITimerDelGuscio();
  osservaLePagine();
}

export function installGuscioQuandoServe() {
  if (!doc) return false;
  installaTutto();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("visibilitychange", alCambioDiVisibilita);
    root.addEventListener?.("pageshow", alCambioDiVisibilita);
    root.addEventListener?.("pagehide", fermaLeParticelle);
    for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
      root.addEventListener?.(evento, () => {
        installaTutto();
        installaLaFinestra();
      });
    for (const evento of ["dashboardmodern:persistence-restored", "dashboardmodern:config-reset"])
      root.addEventListener?.(evento, riNascondi);
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installGuscioQuandoServe, { once: true });
} else if (doc) {
  installGuscioQuandoServe();
}
