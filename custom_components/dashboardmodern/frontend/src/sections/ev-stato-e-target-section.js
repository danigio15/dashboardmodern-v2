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
import { codiceDellaRicarica } from "../core/stato-della-ricarica.js";
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
 * un cavo fuori: e' una carica ferma, e il cavo puo' essere dentro. */
const CAVO_DENTRO = /^(on|true|1|home|connected|plugged|collegato|attaccato)$/i;
const CAVO_FUORI = /^(off|false|0|not_home|disconnected|unplugged|scollegato|staccato)$/i;

function cavoDichiarato() {
  const stato = clean(liveState("dm.ev_cavo_collegato")?.state);
  if (CAVO_DENTRO.test(stato)) return true;
  if (CAVO_FUORI.test(stato)) return false;
  return null;
}

function potenzaDellaColonnina() {
  for (const ref of ["dm.ev_potenza_wallbox", "dm.ev_charge_power"]) {
    const letta = Number(liveState(ref)?.state);
    if (Number.isFinite(letta)) return letta;
  }
  return null;
}

export function paintStatoRicarica(scope = doc) {
  if (!scope?.querySelectorAll) return "";
  const grezzo = clean(liveState("dm.ev_stato_ricarica")?.state);
  /* Le lettere le legge gia' il guscio, con le stesse parole: niente da rifare. */
  if (/^[abcdf]$/i.test(grezzo)) return grezzo.toUpperCase().replace("D", "C");
  const codice = codiceDellaRicarica({
    stato: grezzo,
    collegata: cavoDichiarato(),
    potenza: potenzaDellaColonnina(),
  });
  if (!codice) return "";
  const testo = ETICHETTE_STATO()[codice];
  for (const nodo of scope.querySelectorAll("#lm-stato-txt,.v-ev-stato-all"))
    if (nodo.textContent !== testo) nodo.textContent = testo;
  const [colore, fondo] = COLORI_STATO[codice];
  const punto = doc.getElementById("lm-dot");
  if (punto && punto.style.background !== colore) punto.style.background = colore;
  const scatola = doc.getElementById("lm-charge-badge");
  if (scatola) {
    if (scatola.style.background !== fondo) scatola.style.background = fondo;
    scatola.style.borderColor = `${colore}66`;
    if (scatola.dataset.dmStato !== codice) scatola.dataset.dmStato = codice;
  }
  return codice;
}

/* ── il target di carica ─────────────────────────────────────────────── */

const COMANDABILI = new Set(["select", "input_select", "number", "input_number"]);
const TENDINE_DEL_TARGET = Object.freeze(["sel-target-soc", "sel-target-soc-popup"]);
const VOCI_DI_SERIE = Object.freeze([50, 60, 70, 80, 90, 100]);
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

function vociDelNumero(stato, attuale) {
  const attributi = stato?.attributes || {};
  const min = Number(attributi.min);
  const max = Number(attributi.max);
  const passo = Number(attributi.step) || 5;
  const voci = new Set();
  if (Number.isFinite(min) && Number.isFinite(max) && max > min && (max - min) / passo <= 25) {
    for (let v = min; v <= max + 1e-9; v += passo) voci.add(Math.round(v));
  } else for (const v of VOCI_DI_SERIE) voci.add(v);
  voci.add(attuale);
  return [...voci].sort((a, b) => a - b);
}

function assicuraLeVoci(select, stato) {
  const valore = clean(stato?.state);
  if (!valore || MUTO.test(valore)) return;
  /* Una tendina con le sue `options` la riempie il guscio. */
  if (Array.isArray(stato?.attributes?.options) && stato.attributes.options.length) return;
  const numero = Number(valore);
  if (!Number.isFinite(numero)) return;
  const attuale = Math.round(numero);
  /* Le voci si rifanno dai min/max/step dell'entita' ogni volta che non sono
   * gia' quelle: il guscio mette le sue cinque di serie, e con lo stato a 80
   * — che c'e' fra le cinque — si restava senza il 55 o il 75 (osservazione
   * della review). */
  const volute = vociDelNumero(stato, attuale).map(String);
  const presenti = [...select.options].map((voce) => voce.value);
  if (presenti.join(",") !== volute.join(",")) {
    select.replaceChildren(
      ...volute.map((v) => {
        const voce = doc.createElement("option");
        voce.value = v;
        voce.textContent = `${v}%`;
        return voce;
      }),
    );
    select.dataset.populated = "true";
  }
  if (select.value !== String(attuale)) select.value = String(attuale);
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
        root.edToast?.(
          `${t("Home Assistant ha rifiutato il target", "Home Assistant refused the target")}: ${clean(
            errore?.message || errore,
          )}`,
        );
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

export function installEvStatoETargetSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  /* Il guscio riscrive pastiglia e tendina a ogni suo giro: si ripassa subito
   * dopo, cosi' fra la parola grezza e quella tradotta non c'e' un fotogramma
   * che si veda. */
  wrapFunction("render", "__dmEvStatoETargetRender", schedule);
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
