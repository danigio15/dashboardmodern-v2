/* La pastiglia dello stato e la tendina del target, sulla pagina dell'auto.
 *
 * Due cose che il guscio scrive a ogni giro e che da quando la colonnina entra
 * da un'integrazione scriveva male.
 *
 * La pastiglia: il guscio legge l'alfabeto delle colonnine — A, B, C, F — e
 * per tutto il resto stampa la parola grezza. La casella dello stato porta
 * adesso un `binary_sensor.charging` e la pastiglia diceva «on», «off»: «lo
 * stato dice off ma la vettura e' collegata; prima usciva come stato non
 * collegato, collegato, in ricarica». La lettera la decide il nucleo, col
 * cavo e la potenza come testimoni, e la pastiglia torna a parlare.
 *
 * La tendina: manda `select_option` o `set_value` all'entita' dietro
 * `dm.ev_target_soc`. Se quell'entita' e' un sensore — il target che l'auto
 * pubblica, di sola lettura — il comando cade nel vuoto e la tendina torna sul
 * valore di prima: «il menu a tendina della percentuale di ricarica evcc non
 * funziona». Qui la tendina lo dice invece di far finta; e davanti a un
 * `number` — cosi' pubblica evcc il suo limite — le voci si fanno dai suoi
 * min/max/step, perche' il guscio le costruisce solo dalle `options` di una
 * `select`, e senza voci il valore vero non si vedeva.
 *
 * La vetrina (`ev-showcase-section`) resta sola presentazione: questo modulo
 * legge i valori, e lo fa dalle stesse caselle che legge la foto.
 */
import { cavoDalloStato, codiceDellaRicarica } from "../core/stato-della-ricarica.js";
import { inKilowatt } from "../core/il-tempo-della-ricarica.js";
import { voceDiAdesso, vociDelTarget } from "../core/le-voci-del-target.js";
import { ragioneDelRifiuto } from "../core/vehicle-model.js";
import { liveState } from "./ev-section.js";
import { clean, doc, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EV_STATO_E_TARGET__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/* ── la pastiglia ────────────────────────────────────────────────────── */

/* Gli stessi colori che il guscio usa per le lettere: la pastiglia cambia
 * parola, non veste. */
const COLORI_STATO = Object.freeze({
  C: ["#06b6d4", "rgba(6,182,212,0.25)"],
  B: ["#f59e0b", "rgba(245,158,11,0.25)"],
  A: ["#94a3b8", "rgba(0,0,0,0.4)"],
  N: ["#94a3b8", "rgba(0,0,0,0.4)"],
  F: ["#ef4444", "rgba(0,0,0,0.4)"],
});
const ETICHETTE_STATO = () => ({
  A: t("Non connessa", "Not connected"),
  B: `🔌 ${t("Collegata", "Plugged in")}`,
  C: `⚡ ${t("In carica", "Charging")}`,
  N: t("Non in carica", "Not charging"),
  F: `⚠️ ${t("Errore", "Error")}`,
});

/* Il cavo lo dice solo il suo sensore. Un «off» del sensore di carica non e'
 * un cavo fuori: e' una carica ferma, e il cavo puo' essere dentro. Le parole
 * del cavo stanno nel nucleo, perche' le legge anche la tessera in Home (#348):
 * un cavo solo, una lettura sola. */
function cavoDichiarato() {
  return cavoDalloStato(liveState("dm.ev_cavo_collegato")?.state);
}

/* La potenza che passa nel cavo, in kilowatt.
 *
 * L'unita' la dichiara l'entita', e conta: qui si leggeva il numero nudo e lo
 * si passava al nucleo come se fossero watt. Una colonnina che pubblica kW —
 * evcc lo fa — diceva «1.61», e 1,61 watt non sono una carica: la pastiglia e
 * il tempo di fine restavano fermi con l'auto attaccata che caricava
 * davvero. */
export function kilowattDellaColonnina() {
  for (const ref of ["dm.ev_potenza_wallbox", "dm.ev_charge_power"]) {
    const stato = liveState(ref);
    const kilowatt = inKilowatt(stato?.state, stato?.attributes?.unit_of_measurement);
    if (kilowatt !== null) return kilowatt;
  }
  return null;
}

/** La stessa potenza in watt: e' cosi' che la chiede il nucleo della ricarica. */
function potenzaDellaColonnina() {
  const kilowatt = kilowattDellaColonnina();
  return kilowatt === null ? null : kilowatt * 1000;
}

/* Se la plancia ha ALMENO UNA fonte da cui sapere della ricarica. E' un fatto
 * di configurazione, non di attesa: distingue «non me l'hai detto» da «non ho
 * ancora letto». */
function sorgenteDellaRicarica() {
  return [
    "dm.ev_stato_ricarica",
    "dm.ev_cavo_collegato",
    "dm.ev_potenza_wallbox",
    "dm.ev_charge_power",
  ].some((ref) => Boolean(entitaDi(ref)));
}

/* La lettera della ricarica adesso, qualunque dialetto parli la colonnina.
 *
 * La leggono in due: la pastiglia, che ci scrive la parola, e il tempo di fine
 * carica, che senza sapere se sta caricando non puo' contare niente — ed e'
 * esattamente il difetto per cui la casella diceva IN ATTESA con 1,61 kW nel
 * cavo. Una lettura sola, un verdetto solo. */
export function codiceDellaRicaricaAdesso() {
  const grezzo = clean(liveState("dm.ev_stato_ricarica")?.state);
  if (/^[abcdf]$/i.test(grezzo)) return grezzo.toUpperCase().replace("D", "C");
  return codiceDellaRicarica({
    stato: grezzo,
    collegata: cavoDichiarato(),
    potenza: potenzaDellaColonnina(),
  });
}

export function paintStatoRicarica(scope = doc) {
  if (!scope?.querySelectorAll) return "";
  const grezzo = clean(liveState("dm.ev_stato_ricarica")?.state);
  const codice = codiceDellaRicaricaAdesso();
  /* Le lettere le legge gia' il guscio, con le stesse parole: niente da rifare. */
  if (/^[abcdf]$/i.test(grezzo)) return codice;
  if (!codice) {
    /* Niente da cui ricavare una lettera. Se e' perche' nessuna entita' della
     * ricarica e' mappata, la pastiglia sparisce: il pallino verde col
     * trattino del guscio (#326) e' il ramo «nessun codice», e verde in quella
     * fila vuol dire «tutto bene» a chi guarda. Se invece le entita' ci sono e
     * non hanno ancora risposto, si lascia com'e': fra un attimo parlano. */
    const scatolaMuta = doc?.getElementById?.("lm-charge-badge");
    if (scatolaMuta) scatolaMuta.hidden = !sorgenteDellaRicarica();
    return "";
  }
  const testo = ETICHETTE_STATO()[codice];
  for (const nodo of scope.querySelectorAll("#lm-stato-txt,.v-ev-stato-all"))
    if (nodo.textContent !== testo) nodo.textContent = testo;
  const [colore, fondo] = COLORI_STATO[codice];
  const punto = doc.getElementById("lm-dot");
  if (punto && punto.style.background !== colore) punto.style.background = colore;
  const scatola = doc.getElementById("lm-charge-badge");
  if (scatola) {
    // Qualcosa da dire c'e': se era sparita per mancanza di fonti, torna.
    if (scatola.hidden) scatola.hidden = false;
    if (scatola.style.background !== fondo) scatola.style.background = fondo;
    scatola.style.borderColor = `${colore}66`;
    if (scatola.dataset.dmStato !== codice) scatola.dataset.dmStato = codice;
  }
  return codice;
}

/* ── il target di carica ─────────────────────────────────────────────── */

const COMANDABILI = new Set(["select", "input_select", "number", "input_number"]);
const TENDINE_DEL_TARGET = Object.freeze(["sel-target-soc", "sel-target-soc-popup"]);
const MUTO = /^(unknown|unavailable|none|)$/i;

function entitaDi(ref) {
  try {
    const risolta = clean(root.resolveEntity?.(ref));
    return risolta && risolta !== ref ? risolta : "";
  } catch (_error) {
    return "";
  }
}

/** Se il target e' un'entita' a cui non si puo' dare un ordine. */
export function targetDiSolaLettura() {
  const entita = entitaDi("dm.ev_target_soc");
  return Boolean(entita) && !COMANDABILI.has(entita.split(".")[0]);
}

/* Le voci della tendina sono quelle dell'entita', sempre.
 *
 * «Menu di scelta percentuale non e' quello dell'entita', per questo va in
 * errore e non mi cambia la percentuale.» Qui c'erano sei valori di serie —
 * 50, 60, 70, 80, 90, 100 — usati come ripiego ogni volta che i min/max
 * dell'entita' non stavano in venticinque passi: un limite che va da 0 a 100
 * col passo di 1 ci cadeva sempre. E il ripiego non era innocuo: scrivendolo
 * si metteva anche il cartello `populated`, che al guscio dice «ci ho gia'
 * pensato io» e gli impedisce per sempre di riempire la tendina con le
 * opzioni vere quando arrivano. Sei valori inventati, stampati sopra
 * l'elenco dell'entita', e ogni scelta fuori da quello vero rifiutata.
 *
 * Adesso l'elenco viene dall'entita' — le sue `options`, o i suoi min, max e
 * passo — e quando l'entita' non dice niente non si inventa niente: la
 * tendina resta com'e', e il cartello non si mette, cosi' il guscio puo'
 * ancora fare la sua parte. */
function assicuraLeVoci(select, stato) {
  const { voci, padrone } = vociDelTarget(stato);
  if (!padrone) return;
  const volute = voci.map((voce) => voce.valore);
  const presenti = [...select.options].map((voce) => voce.value);
  if (presenti.join("\u0000") !== volute.join("\u0000")) {
    select.replaceChildren(
      ...voci.map((voce) => {
        const opzione = doc.createElement("option");
        opzione.value = voce.valore;
        opzione.textContent = voce.testo;
        return opzione;
      }),
    );
    select.dataset.populated = "true";
  }
  const valore = clean(stato?.state);
  if (!valore || MUTO.test(valore)) return;
  /* La voce di adesso si sceglie per valore, non per stringa: «95.0» e «95»
   * sono lo stesso limite, e sceglierla per uguaglianza di parola lasciava la
   * tendina sulla prima voce — cioe' su un numero che nessuno ha scelto. */
  const scelta = voceDiAdesso(voci, valore);
  if (scelta && select.value !== scelta) select.value = scelta;
}

export function paintTarget() {
  const solaLettura = targetDiSolaLettura();
  const entita = entitaDi("dm.ev_target_soc");
  const stato = entita ? liveState("dm.ev_target_soc") : null;
  const titolo = solaLettura
    ? t(
        "Questo target è un sensore di sola lettura: per cambiarlo da qui collega evcc, o un'entità number/select, nella scheda Auto.",
        "This target is a read-only sensor: to change it from here connect evcc, or a number/select entity, in the Car tab.",
      )
    : "";
  for (const id of TENDINE_DEL_TARGET) {
    const select = doc.getElementById(id);
    if (!select) continue;
    if (select.disabled !== solaLettura) select.disabled = solaLettura;
    if (select.title !== titolo) select.title = titolo;
    const segno = solaLettura ? "sola-lettura" : entita ? "comando" : "";
    if (select.dataset.dmTarget !== segno) select.dataset.dmTarget = segno;
    if (!solaLettura && stato) assicuraLeVoci(select, stato);
  }
  return solaLettura;
}

/* Il rifiuto, detto in modo che si sappia cosa farci.
 *
 * «Home Assistant ha rifiutato il target: Leapmotor remote control result
 * failed: Token is invalid.» La riga era vera e restava vera — il comando
 * all'auto non e' arrivato — ma da fuori non si sa da che parte prenderla, e si
 * finisce per riprovare la tendina all'infinito.
 *
 * Un gettone scaduto ha un rimedio preciso, e va detto. Quello che ha detto
 * Home Assistant resta comunque in coda, fra parentesi: e' quello che serve a
 * chi apre una segnalazione, e toglierlo sarebbe nascondere la prova.
 */
function parolePerIlRifiuto(dettaglio) {
  const testa = t("Home Assistant ha rifiutato il target", "Home Assistant refused the target");
  const ragione = ragioneDelRifiuto(dettaglio);
  const consiglio =
    ragione === "autenticazione"
      ? t(
          "L'integrazione dell'auto non è più collegata al suo account: riconnettila in Impostazioni → Dispositivi e servizi.",
          "The car integration is no longer connected to its account: reconnect it in Settings → Devices & services.",
        )
      : ragione === "permesso"
        ? t(
            "Home Assistant non ti autorizza a comandare questa entità: serve un utente con il permesso, oppure l'entità è esposta in sola lettura.",
            "Home Assistant does not allow you to command this entity: it needs a user with permission, or the entity is exposed read-only.",
          )
        : ragione === "non-raggiungibile"
          ? t(
              "L'auto non ha risposto in tempo: le vetture in cloud dormono, spesso basta riprovare fra un minuto.",
              "The car did not answer in time: cloud vehicles sleep, trying again in a minute usually works.",
            )
          : "";
  if (!consiglio) return dettaglio ? `${testa}: ${dettaglio}` : testa;
  return dettaglio ? `${consiglio} (${dettaglio})` : consiglio;
}

/* Il comando della tendina passa di qui prima del guscio: a un sensore non si
 * manda niente, e lo si dice. */
function installaIlComando() {
  if (typeof root.changeSelect !== "function" || root.changeSelect.__dmEvStatoETarget) return;
  const previous = root.changeSelect;
  function cambia(ref, valore, ...rest) {
    if (clean(ref) !== "dm.ev_target_soc") return previous.call(this, ref, valore, ...rest);
    if (targetDiSolaLettura()) {
      try {
        root.edToast?.(
          t(
            "Il target è di sola lettura: collega evcc nella scheda Auto per cambiarlo.",
            "The target is read-only: connect evcc in the Car tab to change it.",
          ),
        );
      } catch (_error) {}
      schedule();
      return undefined;
    }
    /* Il guscio manda il comando e non ascolta la risposta: un limite
     * rifiutato — un numero fuori dal passo, un'entita' che non c'e' piu' —
     * lasciava la tendina che tornava indietro senza una parola («clicco 90
     * nel menu, continua a non aggiornarsi»). Qui la risposta si ascolta, e
     * un rifiuto si dice. */
    const entita = entitaDi("dm.ev_target_soc");
    if (typeof root.dmCallHaService !== "function" || !entita)
      return previous.call(this, ref, valore, ...rest);
    const dominio = entita.split(".")[0];
    const chiamata =
      dominio === "number" || dominio === "input_number"
        ? root.dmCallHaService(dominio, "set_value", {
            entity_id: entita,
            value: Number.parseFloat(valore),
          })
        : root.dmCallHaService(dominio, "select_option", {
            entity_id: entita,
            option: String(valore),
          });
    try {
      root.navigator?.vibrate?.(10);
    } catch (_error) {}
    Promise.resolve(chiamata).catch((errore) => {
      try {
        root.edToast?.(parolePerIlRifiuto(clean(errore?.message || errore)));
      } catch (_error) {}
      schedule();
    });
    return undefined;
  }
  cambia.__dmEvStatoETarget = true;
  cambia.__dmPrevious = previous;
  root.changeSelect = cambia;
}

/* ── il giro ─────────────────────────────────────────────────────────── */

function siGuarda() {
  return Boolean(
    doc?.getElementById?.("page-ev")?.classList.contains("active") ||
    doc?.getElementById?.("ev-popup")?.classList.contains("show"),
  );
}

export function renderEvStatoETarget() {
  /* Basta uno dei due: la pastiglia sull'eroe o la tendina del target. Una
   * pagina senza l'eroe — nessuna foto — ha lo stesso la tendina. */
  if (!doc?.getElementById?.("lm-charge-badge") && !doc?.getElementById?.("sel-target-soc"))
    return false;
  paintStatoRicarica();
  paintTarget();
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    if (siGuarda()) renderEvStatoETarget();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

/* Subito, nello stesso fotogramma in cui il guscio ha scritto.
 *
 * Il guscio risponde alle notizie della casa con `cdRenderSoon`: un disegno per
 * fotogramma, chiesto DENTRO un `requestAnimationFrame`. Chi da li' si mette in
 * coda per «il prossimo fotogramma» arriva a quello DOPO — e quello in corso il
 * telefono lo dipinge com'e', con la parola grezza dentro. Filmato sul campo:
 * la pastiglia diceva «Non in carica» e sette volte in nove secondi lampeggiava
 * «off» col pallino verde, otto millisecondi per volta a 120 Hz.
 *
 * Il momento giusto non e' il fotogramma dopo: e' la fine del giro in cui il
 * guscio ha scritto. Il microtask di `wrapFunction` cade li', prima che il
 * browser dipinga, e qui si dipinge da quello — senza chiedere un fotogramma
 * che non serve. */
function dipingiPrimaCheSiVeda() {
  if (siGuarda()) renderEvStatoETarget();
}

export function installEvStatoETargetSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  /* Il guscio riscrive pastiglia e tendina a ogni suo giro: si ripassa nello
   * stesso giro, non al fotogramma dopo, cosi' fra la parola grezza e quella
   * tradotta non c'e' un fotogramma che si veda. */
  wrapFunction("render", "__dmEvStatoETargetRender", dipingiPrimaCheSiVeda);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="ev"],[data-page="ev"],.ev-open,[data-open-ev]'))
        root.queueMicrotask?.(schedule);
    },
    true,
  );
  installaIlComando();
  schedule();
  return true;
}
