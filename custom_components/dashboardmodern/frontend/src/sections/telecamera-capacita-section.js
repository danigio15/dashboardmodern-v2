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
  /* entity → { frontend_stream_types: [...] } quando ha risposto, oppure
   * `{ caduta: quando }` quando la domanda è stata fatta e non ha risposto. */
  dette: new Map(),
  inCorso: new Set(),
});

/** Quanto si aspetta una risposta: è una domanda piccola, non un flusso. */
const ATTESA = 6000;

/* Quanto si aspetta prima di richiedere a chi non ha risposto.
 *
 * Una risposta mancata non è una risposta definitiva: la prima domanda parte
 * appena la plancia è in piedi, e può correre contro il socket che si sta
 * ancora alzando. Segnata come «non lo so» per sempre, quella telecamera
 * restava sul ripiego fino al ricaricamento della pagina — cioè proprio la
 * situazione che questa sezione esiste per togliere.
 *
 * Ma nemmeno si richiede a ogni giro: un Home Assistant che quella domanda non
 * ce l'ha risponde «no» ogni volta, e chiederglielo ogni due secondi sarebbe
 * rumore sul socket per sempre. Mezzo minuto è la distanza fra le due cose: un
 * socket che torna su si riprende la risposta al primo evento utile, e chi
 * dice no lo dice al massimo due volte al minuto. */
const RIPROVA_DOPO = 30_000;

/** Se a questa telecamera si può richiedere: non ha mai risposto, ed è passato abbastanza. */
function siPuoRichiedere(entity, adesso) {
  const detta = state.dette.get(entity);
  if (detta === undefined) return true;
  if (detta && typeof detta === "object" && Array.isArray(detta.frontend_stream_types))
    return false;
  const quando = Number(detta?.caduta) || 0;
  return adesso - quando >= RIPROVA_DOPO;
}

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
 * arrangia con quello che c'è negli attributi — e a tenerli separati è
 * `siPuoRichiedere`, che di una domanda caduta si segna l'ora e la rifà più
 * tardi invece di insistere subito o di non riprovare mai più.
 */
export function capacitaDellaTelecamera(entity) {
  const detta = state.dette.get(clean(entity));
  return Array.isArray(detta?.frontend_stream_types) ? detta : null;
}

/** Se Home Assistant ha risposto davvero: una domanda caduta non conta. */
export function capacitaChieste(entity) {
  return Boolean(capacitaDellaTelecamera(entity));
}

/** Chiede le capacità di una telecamera, una volta sola. */
export async function chiediLeCapacita(entity, adesso = Date.now()) {
  const cercata = clean(entity);
  if (!cercata.startsWith("camera.")) return null;
  if (state.inCorso.has(cercata) || !siPuoRichiedere(cercata, adesso))
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
    state.dette.set(
      cercata,
      elenco ? { frontend_stream_types: elenco } : { caduta: Date.now() },
    );
  } catch (_errore) {
    /* Chiesto, niente risposta: si segna QUANDO, non solo che è andata male.
     * Fra mezzo minuto si potrà richiedere — un socket che si riprende deve
     * poter dare la risposta che la prima volta non è arrivata — ma non
     * prima, così chi la domanda non ce l'ha non se la sente ripetere in
     * continuazione. */
    state.dette.set(cercata, { caduta: Date.now() });
  } finally {
    state.inCorso.delete(cercata);
  }
  return capacitaDellaTelecamera(cercata);
}

/** Le chiede per tutte le telecamere che ancora non l'hanno detto. */
export function chiediLeCapacitaDiTutte(adesso = Date.now()) {
  for (const entity of entitaDelle(telecamereDiCasa())) {
    if (state.inCorso.has(entity) || !siPuoRichiedere(entity, adesso)) continue;
    chiediLeCapacita(entity, adesso).catch(() => {});
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
