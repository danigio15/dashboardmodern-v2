/* Che flussi sa fare ogni telecamera: lo si chiede a Home Assistant.
 *
 * «A seguito del [Bug]: Continuano i problemi con Cam Arlo #418 continuano ad
 * esserci problemi in quanto si vede un'anteprima ma le live non partono da
 * nessuna schermata» (#502).
 *
 * La plancia sceglie la strada del video da quello che Home Assistant dichiara
 * della telecamera, e lo leggeva da un attributo dello stato:
 * `frontend_stream_type`. Quell'attributo Home Assistant l'ha dichiarato
 * superato nel dicembre 2024 e l'ha TOLTO nella 2025.6 — dalla 2025.6 in poi
 * negli attributi non c'è più. Chi lo leggeva concludeva che nessuna
 * telecamera sa trasmettere: né WebRTC né HLS, quindi il proxy dei fotogrammi
 * e poi le istantanee. È per questo che si vedeva l'anteprima e la live non
 * partiva «da nessuna schermata», e su ogni telecamera, non solo sulle Arlo.
 *
 * Al posto dell'attributo Home Assistant ha messo una domanda:
 * `camera/capabilities`, che torna `frontend_stream_types`. È la stessa che fa
 * la sua finestra per decidere che lettore montare, ed è questa che si fa qui.
 *
 * Si chiede una volta per telecamera, e si chiede per TUTTE appena la plancia
 * è in piedi invece che al primo tocco: la risposta deve essere già in mano
 * quando qualcuno apre il popup, o la prima apertura sceglierebbe la strada al
 * buio. È una domanda piccola e sono poche telecamere; si tengono in memoria e
 * non si scrivono da nessuna parte, perché la risposta cambia quando cambia
 * l'impianto — go2rtc che compare, un'integrazione che si aggiorna — e una
 * risposta vecchia salvata varrebbe meno di nessuna risposta.
 *
 * Se la domanda non si può fare — un Home Assistant più vecchio che non la
 * conosce, il ponte che la rifiuta — non si insiste e non si rompe niente:
 * chi sceglie la strada ha altre due fonti, e sono scritte in
 * `core/strategie-telecamera.js`.
 */
import { chiediAHomeAssistant, clean, readJson, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TELECAMERA_CAPACITA__";
const state = (root[KEY] ||= {
  installed: false,
  /* entity → { frontend_stream_types: [...] }, o `false` quando la domanda è
   * stata fatta e non ha risposto: `false` vuol dire «chiesto, niente», e serve
   * a non richiedere in continuazione a chi non sa rispondere. */
  dette: new Map(),
  inCorso: new Set(),
});

/** Quanto si aspetta una risposta: è una domanda piccola, non un flusso. */
const ATTESA = 6000;

/** Le telecamere configurate, così come le legge il resto della plancia. */
function telecamereDiCasa() {
  try {
    const lette = root.getCameras?.();
    if (Array.isArray(lette)) return lette;
  } catch (_errore) {}
  const salvate = readJson("cd_cameras", []);
  return Array.isArray(salvate) ? salvate : [];
}

function entitaDelle(righe) {
  const viste = new Set();
  for (const riga of righe) {
    const entity = clean(riga?.entity || riga?.camera_entity);
    if (entity.startsWith("camera.")) viste.add(entity);
  }
  return [...viste];
}

/**
 * Quello che Home Assistant ha detto di questa telecamera, o `null`.
 *
 * `null` vuol dire «non lo so»: o non si è ancora chiesto, o la domanda non ha
 * avuto risposta. Chi sceglie la strada tratta i due casi allo stesso modo — si
 * arrangia con quello che c'è negli attributi — e la differenza la sa soltanto
 * `capacitaChieste`, che serve a non insistere.
 */
export function capacitaDellaTelecamera(entity) {
  const detta = state.dette.get(clean(entity));
  return detta && typeof detta === "object" ? detta : null;
}

/** Se a Home Assistant è stato chiesto, e ha risposto. */
export function capacitaChieste(entity) {
  return Boolean(capacitaDellaTelecamera(entity));
}

/** Chiede le capacità di una telecamera, una volta sola. */
export async function chiediLeCapacita(entity) {
  const cercata = clean(entity);
  if (!cercata.startsWith("camera.")) return null;
  if (state.dette.has(cercata) || state.inCorso.has(cercata))
    return capacitaDellaTelecamera(cercata);
  state.inCorso.add(cercata);
  try {
    const risposta = await chiediAHomeAssistant(
      { type: "camera/capabilities", entity_id: cercata },
      ATTESA,
    );
    /* La risposta è `{frontend_stream_types: [...]}`. Un Home Assistant che la
     * domanda non ce l'ha risponde con un errore, e finisce nel `catch`; uno
     * che risponde una forma che non ci si aspetta vale come un «non lo so». */
    const tipi = risposta?.frontend_stream_types;
    const elenco = tipi instanceof Set ? [...tipi] : Array.isArray(tipi) ? tipi : null;
    state.dette.set(cercata, elenco ? { frontend_stream_types: elenco } : false);
  } catch (_errore) {
    /* Chiesto, niente risposta: non si richiede a ogni giro di stati. Il
     * ricordo sta in memoria, quindi un ricaricamento ci riprova — che è
     * giusto: fra un ricaricamento e l'altro può essere cambiato Home
     * Assistant. */
    state.dette.set(cercata, false);
  } finally {
    state.inCorso.delete(cercata);
  }
  return capacitaDellaTelecamera(cercata);
}

/** Le chiede per tutte le telecamere che ancora non l'hanno detto. */
export function chiediLeCapacitaDiTutte() {
  for (const entity of entitaDelle(telecamereDiCasa())) {
    if (state.dette.has(entity) || state.inCorso.has(entity)) continue;
    chiediLeCapacita(entity).catch(() => {});
  }
}

/** Dimentica quello che si sapeva: l'impianto è cambiato. */
export function scordaLeCapacita() {
  state.dette.clear();
}

export function installTelecameraCapacita() {
  if (state.installed) return false;
  state.installed = true;
  /* Appena il ponte è in piedi, e a ogni ritorno: il socket può essere caduto e
   * tornato, e le telecamere nuove si configurano mentre la plancia gira. */
  for (const evento of [
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:bridge-ready",
  ])
    root.addEventListener?.(evento, () => chiediLeCapacitaDiTutte());
  /* E quando si salva la configurazione: una telecamera appena aggiunta deve
   * poter dire cosa sa fare senza aspettare un ricaricamento. */
  root.addEventListener?.("dashboardmodern:config-saved", () => chiediLeCapacitaDiTutte());
  chiediLeCapacitaDiTutte();
  return true;
}
