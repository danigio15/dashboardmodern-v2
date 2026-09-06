// DM-FIX-20260812B
const STATE_EVENT = "dashboardmodern:state-changed";
const SERVICE_KEY = "DashboardModernEnergyService";
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;
const LEGACY_CONFIG_KEYS = Object.freeze([
  "dm_dashboard_state",
  "cd_stanze",
  "cd_cameras",
  "cd_appliances",
  "cd_loads",
  "cd_luci",
  "cd_people",
  "cd_security_doors",
  "cd_todo",
  "cd_clima_units",
  "cd_ev_cars",
  "cd_tapparelle",
  "cd_piscina",
  "cd_robot",
  "cd_irrigazione",
  "cd_energy_model",
  "cd_entity_overrides",
  "cd_ups",
  "cd_allerte",
  "cd_rifiuti",
]);
const CHIAVI_OSSERVATE = new Set(LEGACY_CONFIG_KEYS);

function makeEvent(root, detail) {
  if (typeof root.CustomEvent === "function") return new root.CustomEvent(STATE_EVENT, { detail });
  return { type: STATE_EVENT, detail };
}

function collectEntityIds(value, output, depth = 0) {
  if (depth > 12 || value == null) return;
  if (typeof value === "string") {
    const id = value.trim();
    if (ENTITY_ID.test(id)) output.add(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEntityIds(entry, output, depth + 1));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((entry) => collectEntityIds(entry, output, depth + 1));
  }
}

function collectStoredConfig(root, ids) {
  const storage = root.localStorage;
  if (!storage?.getItem) return;
  for (const key of LEGACY_CONFIG_KEYS) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      let value = raw;
      try {
        value = JSON.parse(raw);
      } catch (_error) {}
      collectEntityIds(value, ids);
    } catch (_error) {}
  }
}

/* Quando la configurazione cambia, e non «ogni tanto».
 *
 * L'elenco delle entita' configurate si rifaceva a tempo: ogni cinque secondi,
 * finche' gli eventi scorrevano, si rileggevano venti chiavi dal deposito, si
 * facevano venti JSON.parse e si ricamminava tutto lo stato del negozio. Su una
 * casa che parla di continuo era un lavoro fisso che non scopriva quasi mai
 * niente di nuovo — la configurazione cambia quando qualcuno la cambia.
 *
 * Adesso l'elenco si calcola la prima volta e poi resta, finche' non arriva
 * qualcosa che davvero lo smuove. Le cose che lo smuovono sono due:
 *
 *  - gli avvisi del negozio — un salvataggio dell'utente, un ripristino da
 *    Home Assistant, un azzeramento — che sono i cambi annunciati;
 *  - la scrittura di una chiave di configurazione, che e' l'unica porta per
 *    quelli che non annunciano niente (i gruppi di continuita', le allerte, i
 *    rifiuti, e il guscio storico che scrive per conto suo).
 *
 * Non sono due strade per lo stesso passaggio: sono i due modi in cui una
 * configurazione cambia in questa plancia, e tutti e due finiscono nella stessa
 * riga — dimenticare l'elenco. Rifarlo costa quanto costava, ma una volta per
 * modifica invece che dodici volte al minuto per sempre.
 */
const EVENTI_DI_CONFIGURAZIONE = Object.freeze([
  "dashboardmodern:store-user-write",
  "dashboardmodern:persistence-restored",
  "dashboardmodern:config-reset",
]);

function osservaLaConfigurazione(root, dimentica) {
  for (const evento of EVENTI_DI_CONFIGURAZIONE) root.addEventListener?.(evento, dimentica);

  const storage = root.localStorage;
  if (!storage || storage.__dmStateEventGateWatch) return;
  /* Si avvolge una volta sola per deposito, e si chiama sempre quello che
   * c'era prima: il negozio avvolge lo stesso metodo per i fatti suoi, e i due
   * involucri devono poter convivere in qualunque ordine si installino. */
  const scrivi = storage.setItem?.bind(storage);
  const cancella = storage.removeItem?.bind(storage);
  if (!scrivi) return;
  storage.setItem = function setItemOsservato(key, value) {
    const esito = scrivi(key, value);
    if (CHIAVI_OSSERVATE.has(key)) dimentica();
    return esito;
  };
  if (cancella) {
    storage.removeItem = function removeItemOsservato(key) {
      const esito = cancella(key);
      if (CHIAVI_OSSERVATE.has(key)) dimentica();
      return esito;
    };
  }
  storage.__dmStateEventGateWatch = true;
}

function configuredEntities(root) {
  const ids = new Set();
  try {
    collectEntityIds(root.DashboardModernModules?.store?.getState?.()?.sections, ids);
  } catch (_error) {}
  try {
    collectEntityIds(root.CD_BAKED_CONFIG, ids);
  } catch (_error) {}
  try {
    collectEntityIds(root.ENTITY_OVERRIDES, ids);
  } catch (_error) {}
  collectStoredConfig(root, ids);
  return ids;
}

/**
 * Discard live updates that are not used anywhere by the dashboard, then
 * coalesce the remaining notifications into a bounded batch. State registries
 * are still updated synchronously by the original broker. The initial
 * get_states snapshot never reaches this gate: the broker ingests it with
 * `emitEvent: false`, so there is no bootstrap storm to suppress here.
 */
export function installStateEventGate(broker, root = globalThis, { delay = 500 } = {}) {
  if (!broker || typeof broker.ingestState !== "function" || broker.__dmStateEventGate)
    return false;

  const original = broker.ingestState;
  const pendingIds = new Set();
  let lastState = null;
  let timer = 0;
  let interests = null;

  const currentInterests = () => {
    if (!interests) interests = configuredEntities(root);
    return interests;
  };
  /* Non si ricalcola qui: si dimentica, e il primo evento che passa lo rifa'.
   * Un salvataggio ne annuncia spesso piu' d'uno di seguito — il negozio
   * scrive tutte le sue chiavi — e rifare l'elenco a ogni scrittura vorrebbe
   * dire rifarlo dieci volte per un salvataggio solo. */
  osservaLaConfigurazione(root, () => {
    interests = null;
  });

  const flush = () => {
    timer = 0;
    if (!pendingIds.size) return;
    const entityIds = [...pendingIds];
    pendingIds.clear();
    const state = lastState;
    lastState = null;
    root.dispatchEvent?.(
      makeEvent(root, {
        entity_id: entityIds.at(-1) || "",
        entity_ids: entityIds,
        state,
        coalesced: true,
      }),
    );
  };

  const queue = (state) => {
    const id = String(state?.entity_id || "").trim();
    if (!id) return;
    const configured = currentInterests();
    // If neither the canonical nor legacy configuration is ready yet, remain
    // backward compatible and allow the event. Once configuration is known,
    // unrelated Home Assistant chatter is ignored.
    if (configured.size && !configured.has(id)) return;
    pendingIds.add(id);
    lastState = state || lastState;
    if (timer) return;
    timer = root.setTimeout?.(flush, Math.max(0, Number(delay) || 0)) || 0;
    if (!timer) root.queueMicrotask?.(flush);
  };

  broker.ingestState = function gatedIngestState(state, options) {
    const dispatch = root.dispatchEvent;

    if (typeof dispatch !== "function") return original.call(this, state, options);

    root.dispatchEvent = function gatedDispatch(event) {
      if (event?.type === STATE_EVENT) {
        queue(state);
        return true;
      }
      return dispatch.call(root, event);
    };

    try {
      return original.call(this, state, options);
    } finally {
      root.dispatchEvent = dispatch;
    }
  };

  Object.defineProperty(broker, "__dmStateEventGate", {
    value: Object.freeze({ flush, pendingIds, currentInterests }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return true;
}

/**
 * Arm a setter before energy-section.js is evaluated. That makes the broker
 * gate installation synchronous with DashboardModernEnergyService assignment,
 * so there is no race with a very fast bridge/WebSocket during startup.
 */
export function armStateEventGate(root = globalThis) {
  const current = root[SERVICE_KEY];
  if (current?.broker) {
    installStateEventGate(current.broker, root);
    return true;
  }

  const descriptor = Object.getOwnPropertyDescriptor(root, SERVICE_KEY);
  if (descriptor && !descriptor.configurable) return false;
  if (descriptor?.set?.__dmStateEventGateSetter) return true;

  let value = descriptor?.value;
  const setter = function setEnergyService(next) {
    value = next;
    installStateEventGate(next?.broker, root);
  };
  Object.defineProperty(setter, "__dmStateEventGateSetter", { value: true });

  Object.defineProperty(root, SERVICE_KEY, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get() {
      return value;
    },
    set: setter,
  });
  return true;
}

armStateEventGate();
