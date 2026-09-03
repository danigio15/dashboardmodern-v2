/* Un'azione rapida chiama il servizio che quell'entita' sa eseguire.
 *
 * «Ho l'entita' button.ingresso_apri_la_porta e l'ho messa in azioni con il
 * "toggle" nella speranza che in home quando lo premo mi apre il portone ma
 * non lo fa e non capisco se e' un problema di integrazione o sono nella
 * sezione errata.» La sezione era quella giusta: e' la plancia che chiedeva a
 * Home Assistant una cosa che non esiste.
 *
 * Il guscio sceglie il servizio da una riga sola: script e scene ricevono
 * `turn_on`, tutto il resto `toggle`, preso dal dominio dell'entita'. Per una
 * luce o una presa e' corretto, ma `toggle` non e' un servizio universale:
 *
 *   - un `button` ha soltanto `press` — e' un pulsante, non ha due stati da
 *     scambiare, ed e' esattamente il caso del portone;
 *   - un `input_button` lo stesso;
 *   - una `scene` non si scambia, si accende: `scene.turn_on`;
 *   - una `lock` ha `lock` e `unlock`, e quale delle due dipende da com'e'
 *     messa adesso.
 *
 * Chiamare `button.toggle` non da' errore a schermo: Home Assistant risponde
 * che quel servizio non c'e', il messaggio resta nella console e il portone
 * non si muove. Da fuori sembra un tasto rotto.
 *
 * Qui si corregge solo la scelta del servizio, e solo dove `toggle` e' la
 * risposta sbagliata. Tutto il resto — i gruppi di luci, le azioni
 * predefinite, la richiesta di conferma, la vibrazione — resta al guscio, che
 * lo fa gia' bene: questo modulo gli passa davanti soltanto per i domini che
 * conosce, e per tutti gli altri lo lascia lavorare.
 */
import { allStates, clean, lexicalGlobal, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_AZIONI_SERVIZIO__";
const state = (root[KEY] ||= { installed: false, listeners: false });

/* Cosa sa eseguire ogni dominio, quando l'utente chiede «premi questo».
 *
 * Solo i domini in cui `toggle` e' davvero sbagliato: dove il guscio ha
 * ragione non c'e' niente da correggere, e una tabella piu' lunga sarebbe
 * soltanto piu' roba che puo' invecchiare male. */
const SERVIZI = Object.freeze({
  button: () => "press",
  input_button: () => "press",
  scene: () => "turn_on",
  /* La serratura non si scambia con un servizio solo: si chiude o si apre, e
   * quale dei due dipende da com'e' messa adesso. */
  lock: (stato) => (clean(stato).toLowerCase() === "locked" ? "unlock" : "lock"),
  /* Un lettore ce l'ha, `media_player.toggle`, e fa una cosa che nessuno
   * voleva: spegne la cassa. Da un tasto con sopra la copertina del disco che
   * sta girando (#269) ci si aspetta la pausa — e da un lettore spento, che si
   * accenda, perche' mettere in pausa una cassa spenta non da' errore e non fa
   * niente. */
  media_player: (stato) =>
    ["off", "standby", "unavailable", "unknown", ""].includes(clean(stato).toLowerCase())
      ? "turn_on"
      : "media_play_pause",
});

/** Il servizio giusto per questa entita', o "" se `toggle` va gia' bene. */
export function servizioPerEntita(entity, states = {}) {
  const id = clean(entity);
  const dominio = id.includes(".") ? id.split(".")[0].toLowerCase() : "";
  const scelta = SERVIZI[dominio];
  if (!scelta) return "";
  return scelta(states?.[id]?.state) || "";
}

/* La chiamata, per la stessa strada che usa il guscio: il suo socket e il suo
 * contatore dei messaggi. Non si apre un secondo canale per una cosa che ne
 * ha gia' uno. */
function chiama(dominio, servizio, entity) {
  /* La stessa condizione del guscio — «se il socket c'e', manda» — e non una
   * piu' severa: qui si corregge una parola, non si cambia quando la plancia
   * decide di parlare. Un socket chiuso fa fallire l'invio, e il fallimento
   * e' gia' raccolto qui sotto. */
  const socket = lexicalGlobal("ws");
  if (!socket) return false;
  let id = 0;
  try {
    id = root.eval("msgId++");
  } catch (_error) {
    return false;
  }
  try {
    socket.send(
      JSON.stringify({
        id,
        type: "call_service",
        domain: dominio,
        service: servizio,
        service_data: { entity_id: entity },
      }),
    );
    return true;
  } catch (_error) {
    return false;
  }
}

/* Il guscio definisce `qaRun` quando gli pare: il suo script puo' arrivare
 * dopo i moduli, e al primo giro qui non c'e' ancora niente da avvolgere.
 * Percio' si riprova a ogni annuncio di avvio, e ci si ferma appena riesce. */
function avvolgi() {
  if (state.installed) return false;
  const originale = root.qaRun;
  if (typeof originale !== "function" || originale.__dmServizioGiusto) return false;

  const nostra = function qaRun(indice) {
    let azione = null;
    try {
      azione = root.getQuickActions?.()?.[indice] || null;
    } catch (_error) {
      azione = null;
    }
    /* Quello che il guscio sa gia' fare resta suo: i gruppi di luci, le azioni
     * predefinite, gli script e le scene dichiarate come tali. */
    if (!azione || ["luci_group", "builtin", "script", "scene"].includes(azione.type))
      return originale.call(this, indice);

    let entity = clean(azione.entity);
    try {
      entity = clean(root.resolveEntity?.(entity) || entity);
    } catch (_error) {}
    if (!entity.includes(".")) return originale.call(this, indice);

    /* Gli stati si chiedono a chi sa dove stanno: il guscio li tiene in una
     * variabile sua, non su `window`, e cercarli li' voleva dire non trovarli
     * — e una serratura senza stato si sarebbe fatta chiudere invece che
     * aprire. */
    const servizio = servizioPerEntita(entity, allStates());
    // Dove `toggle` e' la risposta giusta non c'e' niente da correggere.
    if (!servizio) return originale.call(this, indice);

    const esegui = () => {
      root.navigator?.vibrate?.(10);
      chiama(entity.split(".")[0], servizio, entity);
    };
    if (azione.confirm && typeof root.confermaAzione === "function") {
      root.confermaAzione({
        icon: azione.icon || "⚡",
        title: azione.name,
        message: azione.confirm,
        onConfirm: esegui,
      });
      return undefined;
    }
    esegui();
    return undefined;
  };

  nostra.__dmServizioGiusto = true;
  nostra.__dmPrevious = originale;
  root.qaRun = nostra;
  state.installed = true;
  return true;
}

export function installAzioniServizioGiusto() {
  if (avvolgi()) return true;
  if (state.listeners) return false;
  state.listeners = true;
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, avvolgi);
  root.document?.addEventListener?.("DOMContentLoaded", avvolgi, { once: true });
  return false;
}
