/* Cosa della console di ricarica ha qualcosa dietro.
 *
 * La pagina dell'auto e il suo popup mostrano tre cose che esistono solo se
 * qualcuno gestisce la ricarica con evcc: il target di carica con la sua
 * percentuale, l'autonomia calcolata su quel target, e i quattro tasti delle
 * modalita'. Chi la macchina la attacca e basta non ha nessuna di quelle
 * entita', e si trovava davanti un target fermo su "—" e quattro tasti che non
 * fanno niente.
 *
 * Qui si decide soltanto cosa e' configurato davvero. Niente DOM: chi disegna
 * riceve due risposte e nasconde di conseguenza.
 */

const clean = (value) => String(value ?? "").trim();

/* I riferimenti che la configurazione usa per le due cose. `dm.ev_target_soc`
 * regge il target — la plancia lo legge come `input_dm.ev_target_soc`, che e' lo
 * stesso riferimento visto dal lato dei comandi — e la modalita' regge i tasti. */
export const EVCC_REFS = Object.freeze({
  target: ["dm.ev_target_soc", "input_dm.ev_target_soc"],
  mode: ["dm.ev_modalita_ricarica_evcc", "input_dm.ev_modalita_ricarica_evcc"],
});

/* Un riferimento e' configurato quando la mappatura lo traduce in un'entita'
 * vera e quell'entita' risponde. Tradotto in se stesso vuol dire che nessuno lo
 * ha mappato, e uno stato assente o muto vuol dire che l'entita' non c'e' piu':
 * in tutti e due i casi non c'e' niente da mostrare. */
const MUTO = /^(unavailable|unknown|none|)$/i;

function configured(references, states = {}, resolve = (value) => value) {
  for (const reference of references) {
    let entity = reference;
    try {
      entity = clean(resolve(reference)) || reference;
    } catch (_error) {
      entity = reference;
    }
    if (!entity || entity === reference) continue;
    const state = states?.[entity]?.state;
    if (state != null && !MUTO.test(clean(state))) return true;
  }
  return false;
}

/** Cosa mostrare della console: il target, i tasti delle modalita', o niente. */
export function evccPresence(states = {}, resolve = (value) => value) {
  return {
    target: configured(EVCC_REFS.target, states, resolve),
    mode: configured(EVCC_REFS.mode, states, resolve),
  };
}
