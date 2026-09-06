const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__";
const BETA27_SUBLOAD_KEY = "__DASHBOARDMODERN_BETA27_SUBLOAD_PRESERVE__";
const BETA27_PICKER_KEY = "__DASHBOARDMODERN_BETA27_PICKER_CONTRACT__";

/* I giri dell'Energia del guscio, spenti alla sorgente.
 *
 * Il documento storico ha i suoi cicli per i totali, e non sa che i periodi
 * adesso li tiene un modulo con una cadenza sua — un minuto sulla pagina
 * dell'Energia, cinque minuti altrove, e mai due letture per lo stesso
 * pacchetto. I suoi giri erano tre, tutti sopra quello:
 *
 * - `cdTotalsRun`, chiamato appena Home Assistant risponde all'accesso e poi
 *   ogni mezz'ora da `_cdTotalsTimer`;
 * - `cdRefreshPeriodDeltas(true)`, un secondo e mezzo dopo il primo disegno e
 *   di nuovo ogni volta che il Report si ridisegna;
 * - `cdDeriveFromTotals`, che ricava gli stessi quattro valori di
 *   `writeDerived` leggendo lo storico via REST (dentro il pannello e' un
 *   nulla di fatto — non c'e' nessun gettone — ma sulla pagina in piedi da
 *   sola sono quattro letture da inizio anno, ogni dieci minuti).
 *
 * Qui non si «sopprime» piu' la richiesta a valle: erano quindici secondi
 * decisi in questo file, cioe' una seconda regola di freschezza accanto a
 * quella vera. I tre nomi diventano deleghe a `refreshIfStale`, che e' la
 * domanda gentile del servizio: con un pacchetto fresco in mano non parte
 * niente, e quando e' vecchio parte una lettura sola come per tutti gli
 * altri. Il timer di mezz'ora si ferma e non puo' rinascere.
 */
const NOMI_DELEGATI = Object.freeze(["cdTotalsRun", "cdRefreshPeriodDeltas"]);

function chiediSeServe() {
  const servizio = root.DashboardModernEnergyService;
  if (servizio?.refreshIfStale) return servizio.refreshIfStale();
  return servizio?.refresh?.();
}

/* Il timer di mezz'ora del guscio non riparte.
 *
 * Il guscio lo crea all'accesso, e solo `if (!window._cdTotalsTimer)`: gli si
 * lascia trovare il posto occupato. La casella si chiude a chiave perche' quel
 * codice non e' in modo rigoroso — una scrittura su una proprieta' non
 * scrivibile li' non fa rumore, semplicemente non succede. */
function fermaIlTimerDeiTotali() {
  const acceso = root._cdTotalsTimer;
  if (acceso && acceso !== -1) root.clearInterval?.(acceso);
  const descrittore = Object.getOwnPropertyDescriptor(root, "_cdTotalsTimer");
  if (descrittore && !descrittore.configurable) return acceso !== -1;
  Object.defineProperty(root, "_cdTotalsTimer", {
    value: -1,
    writable: false,
    configurable: true,
    enumerable: true,
  });
  return true;
}

export function installEnergyLegacyGuardSection() {
  const stato = (root[KEY] ||= { installed: false, delegati: [] });
  fermaIlTimerDeiTotali();

  for (const nome of NOMI_DELEGATI) {
    if (root[nome]?.__dmDelegaAllAggiornamento) continue;
    function delegaAlModulo() {
      return chiediSeServe();
    }
    delegaAlModulo.__dmDelegaAllAggiornamento = true;
    delegaAlModulo.__dmPrevious = root[nome];
    root[nome] = delegaAlModulo;
    if (!stato.delegati.includes(nome)) stato.delegati.push(nome);
  }

  /* `cdDeriveFromTotals` non delega: non e' un aggiornamento, e' una seconda
   * derivazione degli stessi quattro valori che il modulo gia' scrive
   * (`writeDerived`), fatta con letture REST dello storico. Due mani sugli
   * stessi slot, e la seconda con dati piu' grossolani: si spegne. */
  if (!root.cdDeriveFromTotals?.__dmDerivazioneSpenta) {
    function derivazioneSpenta() {
      return undefined;
    }
    derivazioneSpenta.__dmDerivazioneSpenta = true;
    derivazioneSpenta.__dmPrevious = root.cdDeriveFromTotals;
    root.cdDeriveFromTotals = derivazioneSpenta;
  }

  stato.installed = true;
  return root[KEY];
}

function cleanSubloadValue(value) {
  return String(value ?? "").trim();
}

function subloadIdentity(item = {}) {
  return [
    cleanSubloadValue(item.id),
    cleanSubloadValue(item.name),
    cleanSubloadValue(item.pwrLive || item.pwr),
    cleanSubloadValue(item.daily),
    cleanSubloadValue(item.monthly),
    cleanSubloadValue(item.total),
  ].join("|");
}

function configuredSubloadIdentities(groupId) {
  try {
    const parsed = JSON.parse(root.localStorage?.getItem?.("cd_subloads_extra") || "{}");
    const items = Array.isArray(parsed?.[groupId]) ? parsed[groupId] : [];
    return new Set(items.map(subloadIdentity));
  } catch (_error) {
    return new Set();
  }
}

/**
 * Beta 27 projects the configurable Energy hierarchy into the legacy popup
 * contract. Keep the baked/previously configured children and append only new
 * custom children, so opening Cucina/Lavanderia never loses existing devices.
 */
export function mergePreservedSubloadItems(baseItems = [], incomingItems = []) {
  const merged = [];
  const seen = new Set();
  for (const item of [
    ...(Array.isArray(baseItems) ? baseItems : []),
    ...(Array.isArray(incomingItems) ? incomingItems : []),
  ]) {
    if (!item || typeof item !== "object") continue;
    const key = subloadIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function beta27SubloadRuntimeConfig() {
  try {
    const value = root.eval?.(
      "typeof SUBLOADS_CONFIG !== 'undefined' ? SUBLOADS_CONFIG : null",
    );
    return value && typeof value === "object" ? value : null;
  } catch (_error) {
    return null;
  }
}

function protectBeta27SubloadGroup(groupId, group, state) {
  if (!group || typeof group !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(group, "items");
  if (descriptor?.get?.__dmBeta27Preserved) return true;
  if (descriptor && !descriptor.configurable) return false;

  const configured = configuredSubloadIdentities(groupId);
  const preserved = Array.isArray(group.items)
    ? group.items.filter((item) => !configured.has(subloadIdentity(item)))
    : [];
  const record = state.groups.get(groupId) || { preserved, current: preserved };
  if (!state.groups.has(groupId)) state.groups.set(groupId, record);

  function getItems() {
    return record.current;
  }
  getItems.__dmBeta27Preserved = true;
  Object.defineProperty(group, "items", {
    configurable: true,
    enumerable: true,
    get: getItems,
    set(value) {
      record.current = mergePreservedSubloadItems(record.preserved, value);
    },
  });
  group.items = preserved;
  return true;
}

export function installBeta27SubloadPreservation() {
  const runtime = beta27SubloadRuntimeConfig();
  if (!runtime) return false;
  const state = (root[BETA27_SUBLOAD_KEY] ||= {
    installed: false,
    groups: new Map(),
  });
  let protectedAny = false;
  for (const [groupId, group] of Object.entries(runtime)) {
    if (!group || typeof group !== "object" || !Array.isArray(group.items)) continue;
    if (protectBeta27SubloadGroup(groupId, group, state)) protectedAny = true;
  }
  state.installed ||= protectedAny;
  return protectedAny;
}

/**
 * Keep every Beta 27 entity field on the same DOM contract used by the shipped
 * entity-picker guard. The hierarchical Loads renderer owns the click handler;
 * this bridge only declares the canonical input/target relationship so the
 * global guard never creates a second lens/dialog and E2E/runtime diagnostics
 * can verify a strict 1:1 picker invariant.
 */
export function reconcileBeta27EntityPickerContract(scope = doc) {
  if (!scope?.querySelectorAll) return 0;
  let count = 0;
  scope
    .querySelectorAll(".dm-beta27-load-editor .dm-entity-picker[data-beta27-entity-target]")
    .forEach((button) => {
      const targetId = cleanSubloadValue(button.dataset.beta27EntityTarget);
      if (!targetId) return;
      const input = doc?.getElementById?.(targetId);
      if (!input) return;
      input.dataset.entityInput = "true";
      button.dataset.entityTarget = targetId;
      count += 1;
    });
  return count;
}

function scheduleBeta27EntityPickerContract() {
  root.queueMicrotask?.(() => reconcileBeta27EntityPickerContract());
}

function installBeta27EditorContractBridge() {
  const state = (root[BETA27_PICKER_KEY] ||= { installed: false, wrapped: new Set() });

  for (const name of ["editorSwitch", "apriConfigEntita"]) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmBeta27PickerContract) continue;
    function beta27PickerContractOwner(...args) {
      const result = current.apply(this, args);
      scheduleBeta27EntityPickerContract();
      return result;
    }
    beta27PickerContractOwner.__dmBeta27PickerContract = true;
    beta27PickerContractOwner.__dmPrevious = current;
    root[name] = beta27PickerContractOwner;
    state.wrapped.add(name);
  }

  if (!state.installed) {
    state.installed = true;
    doc?.addEventListener?.(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            ".ed-tab,.ed-inner-tab,[data-energy-panel],[data-beta27-child-add],[data-beta27-child-edit]",
          )
        )
          scheduleBeta27EntityPickerContract();
      },
      true,
    );
  }
  scheduleBeta27EntityPickerContract();
  return true;
}

installEnergyLegacyGuardSection();
installBeta27SubloadPreservation();
installBeta27EditorContractBridge();
/* Il guscio si annuncia dopo: se e' arrivato lui a definire i suoi nomi dopo
 * di noi, si rimettono le deleghe. */
root.addEventListener?.("dashboardmodern:legacy-ready", () => {
  installEnergyLegacyGuardSection();
  installBeta27SubloadPreservation();
  installBeta27EditorContractBridge();
});
root.addEventListener?.("dashboardmodern:runtime-ready", () => {
  installEnergyLegacyGuardSection();
  installBeta27SubloadPreservation();
  installBeta27EditorContractBridge();
});
