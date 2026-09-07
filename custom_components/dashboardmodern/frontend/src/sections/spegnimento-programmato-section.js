/* Il conto alla rovescia del clima, dal lato della plancia (#364).
 *
 * Il timer vero sta in Home Assistant — `custom_components/dashboardmodern/
 * spegnimento.py` — perche' un timer nel browser muore chiudendo la pagina, e
 * chi accende il condizionatore per due ore prima di dormire la pagina la
 * chiude sempre. Qui c'e' solo il pezzo che serve a farlo VEDERE: si chiede
 * quali spegnimenti sono appesi, li si tiene in una copia, e chi disegna la
 * card li legge senza chiedere niente a nessuno.
 *
 * Una sola copia per tutta la plancia. La card del Clima, il popup dell'unita'
 * e il widget della Home chiedono la stessa cosa: tre copie vorrebbero dire tre
 * conti alla rovescia che si scollano fra loro, che e' il difetto che questa
 * plancia ha gia' pagato altrove.
 *
 * E un solo battito. Il tempo che manca cambia una volta al minuto, non a ogni
 * disegno: il battito lo tiene questa sezione, e chi ha una card aperta viene
 * avvisato. Senza timer appesi il battito non parte nemmeno.
 */
import { timerVivi } from "../core/spegnimento-programmato.js";
import { chiediAHomeAssistant, clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SPEGNIMENTO__";
const state = (root[KEY] ||= {
  installed: false,
  scadenze: {},
  chiesto: 0,
  inVolo: null,
  battito: 0,
});

const TIPO_ELENCO = "dashboardmodern/clima/timer/list";
const TIPO_METTI = "dashboardmodern/clima/timer/set";
const TIPO_TOGLI = "dashboardmodern/clima/timer/clear";

/** L'evento con cui chi disegna scopre che il tempo e' cambiato. */
export const EVENTO_SPEGNIMENTI = "dashboardmodern:spegnimenti";

/* Ogni due minuti al massimo si richiede l'elenco: le scadenze le decide
 * questa plancia, e il resto del tempo la copia e' gia' giusta. Serve per le
 * altre — il tablet in cucina che deve accorgersi del timer messo dal telefono
 * — e per il caso in cui Home Assistant abbia spento e noi non lo sappiamo. */
const FRESCO_MS = 2 * 60 * 1000;

function annuncia() {
  try {
    root.dispatchEvent?.(new CustomEvent(EVENTO_SPEGNIMENTI));
  } catch (_error) {}
}

/* Il battito che fa scendere i minuti sulle card aperte.
 *
 * Parte solo se c'e' almeno un timer appeso, e si ferma quando l'ultimo se ne
 * va: una plancia senza spegnimenti programmati non deve svegliarsi ogni
 * minuto per non fare niente. */
function regolaIlBattito() {
  const servono = Object.keys(state.scadenze).length > 0;
  if (servono && !state.battito) {
    state.battito = root.setInterval?.(() => {
      const prima = Object.keys(state.scadenze).length;
      state.scadenze = timerVivi(state.scadenze, Date.now());
      if (Object.keys(state.scadenze).length !== prima) regolaIlBattito();
      annuncia();
    }, 30_000);
    return;
  }
  if (!servono && state.battito) {
    root.clearInterval?.(state.battito);
    state.battito = 0;
  }
}

function aggiorna(mappa) {
  state.scadenze = timerVivi(mappa, Date.now());
  state.chiesto = Date.now();
  regolaIlBattito();
  annuncia();
}

/** Gli spegnimenti appesi, come li conosce adesso questa plancia. */
export function spegnimentiAppesi() {
  return state.scadenze;
}

/** La scadenza di QUELLA unita', o `null`. */
export function scadenzaDi(entita) {
  const id = clean(entita);
  return id && state.scadenze[id] != null ? state.scadenze[id] : null;
}

/**
 * Chiedi a Home Assistant quali spegnimenti sono appesi.
 *
 * Silenziosa per scelta: senza il backend nuovo — una plancia aggiornata a
 * meta', il socket ancora chiuso — la risposta e' un errore, e la card deve
 * limitarsi a non mostrare il conto alla rovescia. Non e' un guasto da
 * annunciare: e' una funzione che non c'e'.
 */
export async function leggiGliSpegnimenti({ force = false } = {}) {
  if (!force && Date.now() - state.chiesto < FRESCO_MS) return state.scadenze;
  if (state.inVolo) return state.inVolo;
  state.inVolo = (async () => {
    try {
      const risposta = await chiediAHomeAssistant({ type: TIPO_ELENCO }, 8000);
      aggiorna(risposta?.scadenze || {});
    } catch (_error) {
      /* La copia di prima resta: un socket caduto non e' «nessun timer». */
      state.chiesto = Date.now();
    } finally {
      state.inVolo = null;
    }
    return state.scadenze;
  })();
  return state.inVolo;
}

/**
 * Programma lo spegnimento di quell'unita' fra quei minuti — zero lo toglie.
 *
 * Torna `true` se Home Assistant ha preso in carico la richiesta. Al `false`
 * chi ha chiamato deve dirlo: un timer che si crede messo e non c'e' e' peggio
 * di nessun timer.
 */
export async function programmaSpegnimento(entita, minuti) {
  const id = clean(entita);
  if (!id) return false;
  const quanti = Math.max(0, Math.round(Number(minuti) || 0));
  try {
    if (!quanti) {
      await chiediAHomeAssistant({ type: TIPO_TOGLI, entity_id: id }, 8000);
      const resto = { ...state.scadenze };
      delete resto[id];
      aggiorna(resto);
      return true;
    }
    const risposta = await chiediAHomeAssistant(
      { type: TIPO_METTI, entity_id: id, minuti: quanti },
      8000,
    );
    const scadenza = Number(risposta?.scadenza);
    if (!Number.isFinite(scadenza)) return false;
    aggiorna({ ...state.scadenze, [id]: scadenza });
    return true;
  } catch (_error) {
    return false;
  }
}

export function installSpegnimentoProgrammatoSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  /* Si chiede una volta all'apertura, e poi solo quando serve: il conto alla
   * rovescia lo fa scendere il battito, non una domanda al minuto. */
  leggiGliSpegnimenti({ force: true });
}
