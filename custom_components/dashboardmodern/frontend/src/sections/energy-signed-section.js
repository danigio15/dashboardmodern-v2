/* Le letture ricavate dalla sorgente unica, pubblicate come stati veri.
 *
 * `signed-energy.js` sa dividere un sensore con segno nei suoi due versi, ma
 * chi disegna la mappa dei flussi non conosce quel modulo: legge la mappa degli
 * stati come farebbe per qualsiasi sensore di Home Assistant. Qui le due
 * letture ricavate vengono aggiunte a quella mappa, sotto un dominio riservato
 * che in Home Assistant non esiste.
 *
 * Sono proprieta' con un accessore, non valori copiati: rispondono con il
 * numero di adesso ogni volta che qualcuno le legge, cosi' non c'e' una seconda
 * copia da tenere aggiornata a ogni aggiornamento di stato — ed e' la copia
 * ferma un giro indietro il modo classico in cui una dashboard mente. Sono
 * anche non enumerabili: non si affacciano nell'elenco del selettore entita' e
 * non falsano i conteggi di chi cicla sugli stati.
 */
import { derivedEnergyStates, signedSourceEntities } from "../core/signed-energy.js";
import { dashboardStore, lexicalGlobal, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_SIGNED__";
const state = (root[KEY] ||= { installed: false, published: new Set() });

function energyModel() {
  try {
    const store = dashboardStore();
    return (store?.peekSection ? store.peekSection("energy") : store?.getSection?.("energy")) || {};
  } catch (_error) {
    return {};
  }
}

function registry() {
  const raw = lexicalGlobal("_RAW_STATES");
  return raw && typeof raw === "object" ? raw : null;
}

/* Le sole entita' che servono, cercate dove la plancia le tiene davvero.
 *
 * Collegata al websocket gli stati stanno in `_RAW_STATES`; ospitata dentro
 * Home Assistant arrivano dal ponte, in `__HASS__`. Le sorgenti dichiarate sono
 * al massimo una manciata, quindi si guarda una per una invece di rifare a ogni
 * lettura la fusione di tutte le entita' della casa. */
function sourceView(states, model) {
  const view = {};
  for (const id of signedSourceEntities(model))
    view[id] = states?.[id] || root.__HASS__?.states?.[id] || root.hass?.states?.[id];
  return view;
}

/** Pubblica, aggiorna o ritira le letture ricavate sulla mappa degli stati. */
export function refreshDerivedStates() {
  const states = registry();
  if (!states) return false;
  const model = energyModel();
  const sources = signedSourceEntities(model);
  const wanted = new Set(Object.keys(derivedEnergyStates(model, sourceView(states, model))));
  for (const id of state.published) {
    if (wanted.has(id)) continue;
    try {
      delete states[id];
    } catch (_error) {}
    state.published.delete(id);
  }
  if (!wanted.size) return sources.length === 0;
  for (const id of wanted) {
    if (state.published.has(id)) continue;
    try {
      Object.defineProperty(states, id, {
        configurable: true,
        enumerable: false,
        get: () => {
          const current = energyModel();
          return derivedEnergyStates(current, sourceView(states, current))[id];
        },
      });
      state.published.add(id);
    } catch (_error) {}
  }
  return true;
}

export function installEnergySignedSection() {
  if (state.installed) return;
  state.installed = true;
  refreshDerivedStates();
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "pageshow",
  ])
    root.addEventListener?.(event, () => refreshDerivedStates());
  try {
    dashboardStore()?.subscribe?.((change) => {
      if (change?.section === "energy") refreshDerivedStates();
    });
  } catch (_error) {}
}
