/* Di chi è questa entità: l'integrazione che l'ha creata.
 *
 * Lo stato di un'entità dice com'è fatta — il dominio, la classe, l'unità —
 * ma non dice da dove arriva, e per certe domande è l'unica cosa che conta.
 * `device_class: connectivity` ce l'hanno il router, la stampante, il telefono
 * e la presa Wi-Fi: guardando lo stato sono la stessa cosa, e una sezione che
 * si riempie da sé li prende tutti. Guardando l'integrazione sono un pezzo di
 * rete e tre elettrodomestici.
 *
 * Il registro di Home Assistant lo sa, e il comando `integrations/catalog`
 * della plancia lo chiede — per nome, con `entity_ids`, invece che per
 * dispositivo. Qui c'è la memoria di quelle risposte: si chiede una volta per
 * entità, si tiene, e chi disegna se lo fa dire senza aspettare.
 *
 * Chi non torna dal registro non è un errore: è un'entità che il registro non
 * conosce — un template, una helper scritta a mano nel `configuration.yaml`.
 * Anche quella si segna, con l'integrazione vuota, perché richiederla a ogni
 * giro sarebbe una domanda che non ha mai risposta.
 *
 * Il trasporto sta qui e non in chi chiama: dentro la cornice il guscio ha la
 * sua presa, che è il ponte; sulla pagina servita da sola è la presa vera; e
 * se il guscio non l'ha ancora aperta c'è il broker dell'energia, che ne apre
 * una sua. Sono tre strade per la stessa domanda, e scriverle due volte
 * vorrebbe dire tenerle allineate a mano.
 */
import { chiediAHomeAssistant, clean, root } from "./shared.js";

/** Il comando che risponde «di chi è questa entità». */
export const TIPO_CATALOGO = "dashboardmodern/integrations/catalog";

/** Si annuncia quando si è imparato qualcosa di nuovo. */
export const EVENTO_PIATTAFORME = "dashboardmodern:piattaforme";

/* Il tetto del backend (MAX_ENTITY_IDS): un lotto più grande si spezza. */
const MAX_PER_RICHIESTA = 500;

const KEY = "__DASHBOARDMODERN_DI_CHI_E__";
const state = (root[KEY] ||= { piattaforme: new Map(), chieste: new Set() });

/**
 * La domanda al backend, per la strada che c'è.
 *
 * Ci passano sia il menù delle integrazioni degli elettrodomestici sia questa
 * memoria: è lo stesso comando, e la scelta della strada è la stessa.
 */
export async function chiediAlCatalogo(payload, timeout = 15000) {
  try {
    return await chiediAHomeAssistant(payload, timeout);
  } catch (errore) {
    const broker = root.DashboardModernEnergyService?.broker;
    if (typeof broker?.request !== "function") throw errore;
    return broker.request(payload);
  }
}

/** Quello che si sa adesso: `{ "binary_sensor.x": "proxmoxve" }`. */
export function piattaformeConosciute() {
  return Object.fromEntries(state.piattaforme);
}

/** Se di questa entità si è già chiesto (con o senza risposta utile). */
export function siSaDiChiE(entity) {
  return state.piattaforme.has(clean(entity));
}

function annuncia() {
  try {
    root.dispatchEvent?.(new CustomEvent(EVENTO_PIATTAFORME));
  } catch (_errore) {}
}

/**
 * Impara di chi sono queste entità, chiedendo solo quelle che mancano.
 *
 * Torna quello che si sa dopo aver chiesto. Non fallisce mai in faccia a chi
 * disegna: un socket chiuso vuol dire «non lo so ancora», e la domanda si
 * dimentica così il giro dopo si riprova invece di restare per sempre senza.
 */
export async function scopriLePiattaforme(entityIds = []) {
  const mancanti = [...new Set((entityIds || []).map(clean).filter(Boolean))].filter(
    (entity) => !state.piattaforme.has(entity) && !state.chieste.has(entity),
  );
  if (!mancanti.length) return piattaformeConosciute();
  for (const entity of mancanti) state.chieste.add(entity);
  try {
    for (let da = 0; da < mancanti.length; da += MAX_PER_RICHIESTA) {
      const lotto = mancanti.slice(da, da + MAX_PER_RICHIESTA);
      const risposta = await chiediAlCatalogo({ type: TIPO_CATALOGO, entity_ids: lotto });
      const righe = Array.isArray(risposta?.entities) ? risposta.entities : [];
      for (const riga of righe) {
        const entity = clean(riga?.entity_id);
        if (entity) state.piattaforme.set(entity, clean(riga?.platform));
      }
      for (const entity of lotto)
        if (!state.piattaforme.has(entity)) state.piattaforme.set(entity, "");
    }
    annuncia();
  } catch (errore) {
    for (const entity of mancanti) state.chieste.delete(entity);
    root.console?.warn?.("[DashboardModern] di chi è", errore);
  }
  return piattaformeConosciute();
}

/** Dimentica tutto: serve alle prove, e a chi ricarica la configurazione. */
export function scordaLePiattaforme() {
  state.piattaforme.clear();
  state.chieste.clear();
}
