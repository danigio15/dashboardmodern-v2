// DM-FIX-20260817A
import { runSteps, stepReporter } from "../core/runtime-steps.js";
import { normalizeSection } from "../core/migrations.js";
import { reloadDashboard, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONFIG_PERSISTENCE__";
const USER_DATA_VERSION = 1;
/* La revisione 5 aggiunge le persone (`cd_people`): un salvataggio scritto
 * prima che la chiave esistesse non puo' dire «cancellata», e il travaso di
 * `mergeLegacyMissingConfig` gliela riempie da questo dispositivo.
 * La revisione 6 aggiunge le aperture della Sicurezza (`cd_security_doors`,
 * #195) e le liste ToDo della Home (`cd_todo`, #201), con la stessa regola.
 * La revisione 7 aggiunge le preferenze del ponte dei widget (`cd_widgets`):
 * quali tessere si vedono in Home e in che ordine.
 * La revisione 8 aggiunge le due scelte della 1.3.1: quali modalita' della
 * centrale si vogliono vedere (`cd_antifurto_modi`) e cosa fa il tasto Clima
 * rapido (`cd_clima_rapido`). Sono preferenze della plancia, non del
 * dispositivo che le ha fatte: senza stare qui restavano su un telefono solo e
 * dal backup sparivano.
 * La revisione 9 aggiunge le tre che mancavano ancora: le icone degli avvisi
 * (`cd_avvisi_icone`), le entita' assegnate a mano a una stanza
 * (`cd_stanze_entita`) e il segno progressivo delle auto (`cd_ev_meta`). Le
 * prime due erano configurazione che restava su un dispositivo solo; la terza
 * e' la guardia contro gli identificativi riusati, e senza viaggiare non
 * guardava niente.
 * La revisione 10 aggiunge le cose che si guardano e basta
 * (`cd_solo_lettura`). «Non e' meglio oscurare il tasto accendi/spegni sulla
 * presa del frigo?» — si', ed e' una decisione della casa, non del telefono da
 * cui la si e' presa: se non viaggia, il frigo e' protetto sul telefono di chi
 * ha configurato la plancia e spegnibile su tutti gli altri, che e' esattamente
 * il contrario di quello che serve.
 * La revisione 11 aggiunge le prese (`cd_prese`). Prima le prese si
 * configuravano fra le luci — la scheda Luci accetta anche `switch.` — e
 * viaggiavano dentro `cd_luci`; adesso hanno un elenco loro, e senza stare qui
 * resterebbero sul telefono che le ha configurate.
 * La revisione 12 aggiunge i passi del tasto Clima rapido per unita'
 * (`cd_clima_rapido_unita`): la cameretta a 24 gradi e il salone a 26 sono
 * una scelta della casa, e deve valere da ogni telefono.
 * La revisione 13 aggiunge le entita' in evidenza (`cd_evidenza`) — la tessera
 * della Home che tiene d'occhio sensori senza stanza — e il registro dei
 * sensori di fumo gia' visti (`cd_fumo_rilevato`): entrambe descrivono la
 * casa, non il telefono, e senza stare qui resterebbero sul dispositivo che
 * le ha configurate. */
/* La revisione 14 aggiunge il verso girato (#244): i sensori porta/finestra
 * che stanno a ON quando l'infisso e' chiuso (`cd_stati_invertiti`). E' un
 * fatto dei fili, non del telefono: letto da un dispositivo solo, gli altri
 * continuerebbero a dire «aperta» su una finestra chiusa. Con lei viaggiano
 * anche le quattro della stessa stagione che erano rimaste solo nelle liste
 * legacy del runtime — le voci del Caldo (`cd_termico_caldo`), i programmi
 * della lavatrice (`cd_lavatrice_programmi`), la card del Clima girata
 * (`cd_clima_inverti_card`) e la stazione meteo propria
 * (`cd_meteo_entita_proprie`): senza stare qui restavano sul dispositivo
 * che le aveva configurate e il ripristino da un altro le perdeva. */
/* La revisione 15 aggiunge lo scaldabagno elettrico (`cd_scaldabagni`, #253):
 * quali entita' lo descrivono — l'interruttore, la sonda dell'acqua,
 * l'obiettivo, il consumo. E' la casa, non il telefono: configurata da un
 * dispositivo, gli altri resterebbero senza la tessera. */
/* La revisione 16 aggiunge le altre due macchine del locale caldaia (#253):
 * quali impianti termici ci sono (`cd_impianti_termici`) e le caselle della
 * caldaia (`cd_caldaia`). Sono la casa, non il telefono: senza viaggiare, chi
 * sceglie «solare piu' caldaia» su un dispositivo troverebbe sugli altri la
 * pagina di prima. */
/* La revisione 17 aggiunge il gruppo di continuita' (`cd_ups`, #256): quali
 * entita' dicono se c'e' tensione, come sta la batteria e quanto carico
 * regge. E' la casa, non il telefono: chi lo configura dal tablet in cucina
 * non deve rifarlo dal telefono per vedere se la corrente e' caduta. */
/* La revisione 18 aggiunge i calendari scelti (`cd_calendari`, #259): quali
 * entita' `calendar.*` si guardano, con che nome e di che colore. Sono la
 * casa, non il telefono: chi li sceglie dal tablet non deve rifarlo dal
 * telefono per vedere gli stessi impegni. */
/* La revisione 19 aggiunge le sezioni che si fa l'utente (`cd_sezioni_mie`,
 * #262): titolo, icona e le entita' che ci ha messo dentro. Sono la casa nel
 * senso piu' letterale — le ha disegnate lui — e non viaggiare vorrebbe dire
 * rifarle su ogni dispositivo. */
/* La revisione 23 aggiunge la doppia conferma delle aperture
 * (`cd_porte_conferma`, #275): «poter decidere se attivare la doppia conferma
 * d'apertura o meno, per essere più celeri». È una scelta sulla casa, non sul
 * dispositivo: chi la spegne dal telefono la vuole spenta anche dal tablet. */
/* La revisione 22 aggiunge come si vede l'energia in Home con più impianti
 * (`cd_energia_tessere`, #286): una tessera sola con la somma, o una per
 * impianto. È una scelta sulla plancia, non su questo dispositivo — chi la fa
 * dal tablet la vuole anche sul telefono, come l'ordine delle tessere. */
/* La revisione 21 aggiunge le aree d'allarme (`cd_centrali`,
 * `cd_centrale_scelta`, #285). Stessa ragione degli impianti solari, e stessa
 * forma: l'elenco dice quali sono le aree, la scelta dice quale sta nella
 * mappatura `dm.security_centrale_allarme` — cioè quale il tastierino comanda.
 * Le due vanno insieme, e la mappatura viaggia da sempre. */
/* La revisione 20 aggiunge gli impianti solari (`cd_solari`, `cd_solare_scelto`).
 * «Solare termico continua ad avere un solo impianto»: adesso ce ne può essere
 * più d'uno, e vanno insieme — l'elenco dice quali sono, la scelta dice quale
 * sta nelle mappature `dm.boiler_*` in questo momento. Le mappature viaggiano
 * da sempre: se la scelta restasse su un dispositivo solo, il telefono
 * mostrerebbe l'impianto del tablet chiamandolo con l'altro nome. */
export const CONFIG_KEYS_REVISION = 23;
/* La generazione dello scrittore, nel salvataggio stesso.
 *
 * Le versioni prima di questa marcavano «modifica in sospeso» anche per le
 * riscritture di macchina — il persist d'avvio, i vecchi difetti che
 * riscrivevano `cd_ev_cars` da soli — e una plancia rimasta aperta col
 * runtime vecchio rispinge per sempre i suoi dati stantii, foto comprese.
 * Non possiamo aggiornare il codice che gira di la'; possiamo pero' non
 * credergli: uno scatto senza questa generazione (o con una piu' vecchia)
 * viene da uno di quei runtime, e su un dispositivo gia' configurato non
 * vince — si rispinge la copia propria finche' quella plancia non viene
 * ricaricata con la versione nuova. Fra dispositivi della stessa
 * generazione non cambia niente. */
export const WRITER_GENERATION = 1;
const PERSIST_META_KEY = "dm_persistence_meta";
const REMOTE_REFRESH_MIN_MS = 1200;

// Shared configuration store of the integration. Unlike frontend/*_user_data it
// is one copy for the whole installation instead of one per Home Assistant user,
// and its key does not contain the entry_id, so removing and re-adding the
// integration finds the same configuration again.
const SHARED_GET = "dashboardmodern/config/get";
const SHARED_SET = "dashboardmodern/config/set";
const SHARED_RESTORE = "dashboardmodern/config/restore";
const PRIMARY_PROFILE = "primary";

// A failed read must never promote this device to authoritative: it retries
// instead, because the previous behaviour let a transient socket failure turn an
// unconfigured device into the writer that emptied everybody else's plancia.
const HYDRATE_RETRY_MS = Object.freeze([1500, 3000, 6000, 12000, 30000]);
const PUSH_CONFLICT_RETRIES = 2;

const state = (root[KEY] ||= {
  installed: false,
  dirtyAt: 0,
  dirtyMarkTimer: 0,
  pushTimer: 0,
  pushPromise: null,
  needsPush: false,
  hydrating: false,
  hydrated: false,
  localWasConfigured: false,
  lastPullAt: 0,
  refreshTimer: 0,
  resetOwnerInstalled: false,
  resetting: false,
  mutationBridgeInstalled: false,
  remoteRevision: 0,
  remoteConfigured: false,
  hydrateRetryTimer: 0,
  transportFailures: 0,
});

// Complete shared dashboard configuration snapshot. Runtime counters/timers and
// true per-device preferences (connection credentials, theme/navbar mode) stay
// local. Everything edited as dashboard content is shared across devices.
export const CONFIG_KEYS = Object.freeze([
  "dm_dashboard_state",
  "dm_schema_version",
  "cd_branding",
  "cd_sections",
  // La scelta fatta a mano sulle sezioni viaggia con la configurazione: se
  // resta su un solo dispositivo, gli altri se la riaccendono da soli.
  "cd_sections_manual",
  "cd_section_names",
  "cd_stanze",
  "cd_floors",
  "cd_floor_icons",
  "cd_cameras",
  "cd_appliances",
  "cd_loads",
  "cd_devices",
  "cd_people",
  "cd_security_doors",
  // Quali modalita' della centrale si e' scelto di non vedere.
  "cd_antifurto_modi",
  "cd_todo",
  "cd_widgets",
  "cd_luci",
  "cd_luci_rooms",
  "cd_luci_order",
  // Le cose che si guardano e basta: la presa del frigo, quella del modem.
  "cd_solo_lettura",
  // Le prese: TV del salotto, Firestick, modem.
  "cd_prese",
  "cd_luci_room_order",
  // I sensori porta/finestra che parlano al contrario (#244): ON = chiuso.
  "cd_stati_invertiti",
  // Le voci della parte Caldo del Clima (caldaia, pompe): lista libera.
  "cd_termico_caldo",
  // I programmi rapidi della lavatrice: nome, entita', icona.
  "cd_lavatrice_programmi",
  // La card del Clima girata: grande l'ambiente, piccola la target.
  "cd_clima_inverti_card",
  // La stazione meteo con entita' proprie, dietro la sua casella.
  "cd_meteo_entita_proprie",
  "cd_clima_units",
  // Cosa accende il tasto Clima rapido: modalita', temperatura e ventola.
  "cd_clima_rapido",
  // Gli stessi passi, ma di OGNI unita': la cameretta a 24, il salone a 26.
  "cd_clima_rapido_unita",
  // Le entita' in evidenza: la tessera che tiene d'occhio sensori senza stanza.
  "cd_evidenza",
  "cd_scaldabagni",
  "cd_impianti_termici",
  "cd_caldaia",
  // Gli impianti solari e quale di loro sta in pagina (#253 → più d'uno).
  "cd_solari",
  "cd_solare_scelto",
  // Le aree d'allarme e quale di loro il tastierino comanda (#285).
  "cd_centrali",
  "cd_centrale_scelta",
  // Come si vede l'energia in Home con più impianti: somma o una per impianto (#286).
  "cd_energia_tessere",
  // Se il tocco su un'apertura chiede conferma (#275).
  "cd_porte_conferma",
  "cd_ups",
  "cd_calendari",
  // Le sezioni che si fa l'utente (#262): titolo, icona, e le entita' dentro.
  "cd_sezioni_mie",
  // I sensori di fumo gia' visti: il rilevamento non li ripropone due volte.
  "cd_fumo_rilevato",
  "cd_ev_cars",
  "cd_ev_car_active",
  "cd_ev_visual",
  /* `cd_ev_image` e `cd_ev_image_plugged` non stanno piu' qui.
   *
   * Sono le due caselle da cui il disegno legge la foto dell'auto attiva: non
   * una configurazione, ma il disegno di adesso, ricavato dal profilo scelto su
   * *questo* dispositivo. Spedirle voleva dire che la configurazione condivisa
   * si portava dietro la foto dell'auto che era attiva altrove, e al ritorno la
   * riscriveva qui: si apriva la plancia, compariva la foto giusta — quella che
   * la semina aveva appena messo — e un istante dopo arrivava il salvataggio e
   * ci metteva l'altra vettura. Segnalato esattamente cosi', ed era esattamente
   * questo.
   *
   * Le foto viaggiano dove devono, dentro `cd_ev_cars`: ogni auto si porta le
   * sue, e ogni dispositivo disegna quella dell'auto che ha scelto lui. Chi
   * legge queste due chiavi da un salvataggio vecchio non le trova piu' nella
   * lista, quindi non vengono ne' lette ne' riscritte: restano dove sono senza
   * dare fastidio a nessuno. */
  "cd_visual_prefer_image",
  "cd_tapparelle",
  "cd_piscina",
  "cd_irrigazione",
  "cd_robot",
  "cd_energy_model",
  "cd_entity_overrides",
  "cd_quick_actions",
  "cd_navbar_order",
  // La barra a scomparsa o ferma e' una scelta della plancia, non del
  // dispositivo che l'ha fatta: chi la mette ferma sul telefono se la ritrova
  // ferma anche sul computer.
  "cd_navbar_mode",
  "cd_energy_views",
  "cd_slot_labels",
  "cd_flow_nodes",
  "cd_gruppi_extra",
  "cd_gruppi_removed",
  "cd_avvisi_names_extra",
  "cd_avvisi_custom",
  "cd_subload_groups",
  "cd_subloads_extra",
  "cd_report_devices",
  "cd_lavatrice_visual",
  "cd_text_overrides",
  "cd_hidden_elements",
  "cd_costo_kwh",
  "cd_prezzo_immissione",
  /* Le tre della revisione 9, trovate contando chi scrive cosa.
   *
   * `cd_avvisi_icone`: l'icona scelta per ogni avviso. Si sceglieva sul
   * telefono e sul computer restava quella di serie.
   * `cd_stanze_entita`: a quale stanza appartiene un'entita' che la stanza non
   * ce l'ha per mestiere. Configurata da una parte, di la' non esisteva.
   * `cd_ev_meta`: il numero piu' alto mai dato a un'auto. Questo non e' una
   * comodita': se non viaggia, il secondo dispositivo riparte da capo col
   * conteggio e la prossima auto nasce con l'identificativo di una cancellata,
   * ereditandone le foto — che e' esattamente il difetto che quel numero esiste
   * per impedire. */
  "cd_avvisi_icone",
  "cd_stanze_entita",
  "cd_ev_meta",
]);

const LEGACY_SYNC_CONTROL_KEYS = Object.freeze(["cd_sync_ts", "cd_sync_dirty"]);

function instanceId() {
  return String(
    root.__DASHBOARDMODERN_INSTANCE__ || root.__DASHBOARDMODERN_STORAGE_NS__ || "integration",
  );
}

export function integrationUserDataKey({ primary = true, instance = "" } = {}) {
  const suffix =
    primary === false && instance
      ? `__${String(instance)
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 16)}`
      : "";
  return `dashboardmodern_integration_config${suffix}`;
}

/* Se questa plancia sia la principale, e cosa fare quando non lo dice nessuno.
 *
 * Il valore lo dichiara l'integrazione. Quando manca — un pannello vecchio
 * rimasto nella cache del browser — qui si dava per scontato di essere la
 * principale, e una plancia ospitata che non sapeva di non esserlo finiva a
 * leggere e scrivere la configurazione dell'altra: due plance, una
 * configurazione sola.
 *
 * La spia non puo' essere l'istanza. Ne ha una anche la principale — l'ospita
 * la stessa integrazione, con la stessa marcatura — e prenderla per prova di
 * essere secondari mandava proprio la principale a scrivere nella cassetta di
 * un'altra: il difetto di prima, girato dall'altra parte. La spia e' il
 * profilo, che una plancia secondaria si porta dietro (`dmc=`) e la principale
 * no: se il profilo c'e' ed e' di un'altra cassetta, non siamo la principale.
 * Senza ne' dichiarazione ne' profilo si resta come si e' sempre stati. */
export function laPrincipale() {
  const dichiarata = root.__DASHBOARDMODERN_PRIMARY__;
  if (dichiarata !== undefined && dichiarata !== null) return dichiarata !== false;
  const profilo = sanitizeProfile(root.__DASHBOARDMODERN_PROFILE__ || parentProfile() || "");
  return profilo ? profilo === PRIMARY_PROFILE : true;
}

function userDataKey() {
  return integrationUserDataKey({
    primary: laPrincipale(),
    instance: root.__DASHBOARDMODERN_INSTANCE__,
  });
}

function legacyUserDataKey() {
  return `dashboardmodern_v2_config:${instanceId()}`;
}

export async function migrateLegacyUserData(fetchValue, pushValue) {
  const current = await fetchValue(userDataKey());
  if (current) return current;
  const legacy = await fetchValue(legacyUserDataKey());
  if (!legacy) return null;
  await pushValue(userDataKey(), legacy);
  return legacy;
}

export function sanitizeProfile(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

function parentProfile() {
  try {
    if (root.parent && root.parent !== root) return root.parent.__DASHBOARDMODERN_PROFILE__;
  } catch (_error) {}
  return undefined;
}

/**
 * Resolve the shared storage profile of this plancia.
 *
 * The integration injects it, and it is intentionally not derived from the
 * entry_id. A profile is never invented: an older cached panel that does not
 * provide one keeps the historical per-user transport for a secondary plancia
 * rather than writing a guessed key that the integration would not find again.
 */
export function configProfileFor({ profile = "", primary = true } = {}) {
  const explicit = sanitizeProfile(profile);
  if (explicit) return explicit;
  return primary !== false ? PRIMARY_PROFILE : "";
}

function currentProfile() {
  return configProfileFor({
    profile: root.__DASHBOARDMODERN_PROFILE__ || parentProfile() || "",
    primary: laPrincipale(),
  });
}

function valuesFromStorage(storage = root.localStorage) {
  const values = {};
  for (const key of CONFIG_KEYS) {
    const value = storage?.getItem?.(key);
    if (value !== null && value !== undefined) values[key] = value;
  }
  return values;
}

function localValues() {
  return valuesFromStorage(root.localStorage);
}

function meaningfulScalar(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return value;
  return false;
}

function meaningfulNested(value, { ignoreMetadata = false } = {}) {
  if (Array.isArray(value)) return value.some((item) => meaningfulNested(item));
  if (value && typeof value === "object")
    return Object.entries(value).some(
      ([key, child]) => !(ignoreMetadata && key === "metadata") && meaningfulNested(child),
    );
  return meaningfulScalar(value);
}

export function meaningfulConfigValues(values = {}) {
  const stateValue = values.dm_dashboard_state;
  if (stateValue) {
    try {
      const parsed = JSON.parse(stateValue);
      const sections = parsed?.sections || {};
      if (
        Object.entries(sections).some(([name, value]) =>
          name === "energy"
            ? meaningfulNested(value, { ignoreMetadata: true })
            : meaningfulNested(value),
        )
      )
        return true;
    } catch (_error) {}
  }
  return Object.entries(values).some(([key, value]) => {
    if (["dm_dashboard_state", "dm_schema_version", "cd_sections"].includes(key)) return false;
    try {
      return meaningfulNested(JSON.parse(value));
    } catch (_error) {
      return String(value || "").trim().length > 0;
    }
  });
}

function meaningfulLocal(values = localValues()) {
  return meaningfulConfigValues(values);
}

export function normalizeRemoteSnapshot(remote) {
  if (!remote || typeof remote !== "object" || Array.isArray(remote)) return null;
  if (
    Number(remote.version) === USER_DATA_VERSION &&
    remote.values &&
    typeof remote.values === "object" &&
    !Array.isArray(remote.values)
  ) {
    return {
      version: USER_DATA_VERSION,
      keys_revision: Number(remote.keys_revision) || 0,
      updated_at: Number(remote.updated_at) || 0,
      values: Object.fromEntries(
        CONFIG_KEYS.flatMap((key) =>
          typeof remote.values[key] === "string" ? [[key, remote.values[key]]] : [],
        ),
      ),
      migrated_from: remote.migrated_from || "",
    };
  }

  // Older releases and the vendored legacy runtime wrote a flat payload to the
  // same user_data key. Accept it once and upgrade it to the canonical envelope.
  const legacyValues = Object.fromEntries(
    CONFIG_KEYS.flatMap((key) => (typeof remote[key] === "string" ? [[key, remote[key]]] : [])),
  );
  if (
    Object.keys(legacyValues).length ||
    Object.prototype.hasOwnProperty.call(remote, "__ts") ||
    Object.prototype.hasOwnProperty.call(remote, "_savedAt")
  ) {
    return {
      version: USER_DATA_VERSION,
      keys_revision: 0,
      updated_at: Number(remote.__ts || remote._savedAt) || 0,
      values: legacyValues,
      migrated_from: "legacy-flat",
    };
  }
  return null;
}

/**
 * Normalize one shared-store snapshot as returned by dashboardmodern/config/get.
 */
export function normalizeSharedSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const values = snapshot.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  return {
    revision: Number(snapshot.revision) || 0,
    updated_at: Number(snapshot.updated_at) || 0,
    keys_revision: Number(snapshot.keys_revision) || 0,
    writer_generation: Number(snapshot.writer_generation) || 0,
    reset: snapshot.reset === true,
    values: Object.fromEntries(
      CONFIG_KEYS.flatMap((key) => (typeof values[key] === "string" ? [[key, values[key]]] : [])),
    ),
  };
}

/**
 * A snapshot written before the current revision was written by a build that
 * did not know about every key this one syncs, so absence in it cannot mean
 * "deleted". Fill only the missing old fields from the current device once;
 * values actually present remotely still win. At the current revision the
 * payload is complete again, so absence means deletion.
 *
 * Revision 3 adds the second vehicle photo (`cd_ev_image_plugged`).
 * La revisione resta 4: la 5 non aggiunge nessuna chiave — le due foto
 * dell'auto sono state *tolte*, e una chiave tolta non si puo' riempire da
 * qui. Alzarla avrebbe voluto dire mandare ogni salvataggio di revisione 4
 * dentro a questo travaso, cioe' rimettere dentro da questo dispositivo valori
 * che qualcun altro aveva cancellato apposta.
 *
 * Si riempie solo con chiavi che questa versione sincronizza davvero. Prima si
 * riversava dentro tutto quello che il dispositivo aveva sottomano, e una
 * chiave ritirata — le due foto dell'auto — rientrava dalla finestra proprio
 * mentre la si stava togliendo di mezzo: il salvataggio vecchio non ce l'aveva
 * piu', ma il travaso gliela rimetteva. Ritirata vuol dire ritirata.
 */
/* Il travaso pieno e' voluto, e non si stringe senza toccare il ripristino.
 *
 * La revisione dice fin dove lo scatto conosce l'elenco delle chiavi, e per le
 * chiavi che gia' conosceva l'assenza vorrebbe dire «cancellata»: travasarle
 * tutte, in effetti, puo' riportare in vita quello che qualcun altro aveva
 * tolto. Ma `applyRestoredValues` CANCELLA dal dispositivo ogni chiave che il
 * salvataggio non porta: smettere di travasarle, senza cambiare anche quello,
 * non fa tornare indietro dei dati — li butta via. Provato: con il travaso
 * ristretto, un dispositivo che idrata uno scatto piu' vecchio si vedeva
 * sparire le auto che aveva in casa.
 *
 * Fra i due mali, quello che si puo' disfare a mano (una voce ricomparsa) e
 * quello che non si puo' (una configurazione persa), qui si tiene il primo.
 * Stringere il travaso e' un lavoro suo: il ripristino deve prima saper
 * distinguere «non c'e' perche' cancellata» da «non c'e' perche' allora non
 * esisteva», e quella distinzione oggi non ce l'ha. */
export function mergeLegacyMissingConfig(remote, local = {}) {
  if (!remote || Number(remote.keys_revision) >= CONFIG_KEYS_REVISION) return remote;
  const mancanti = Object.fromEntries(
    CONFIG_KEYS.flatMap((key) => (typeof local?.[key] === "string" ? [[key, local[key]]] : [])),
  );
  return {
    ...remote,
    values: { ...mancanti, ...(remote.values || {}) },
  };
}

export function sameConfigValues(left = {}, right = {}) {
  return CONFIG_KEYS.every((key) => {
    const a = Object.prototype.hasOwnProperty.call(left || {}, key) ? String(left[key]) : null;
    const b = Object.prototype.hasOwnProperty.call(right || {}, key) ? String(right[key]) : null;
    return a === b;
  });
}

export function persistenceReconcileAction({
  remote = null,
  localConfigured = false,
  pendingAt = 0,
  local = {},
} = {}) {
  if (!remote) return localConfigured ? "push-local" : "none";
  const normalized = normalizeRemoteSnapshot(remote);
  if (!normalized) return "unsupported";
  if (sameConfigValues(local, normalized.values)) return "in-sync";
  return Number(pendingAt) > Number(normalized.updated_at || 0) ? "push-local" : "restore-remote";
}

/**
 * Decide what to do with the shared snapshot of this plancia.
 *
 * Conflicts are resolved on the store's own monotonic revision, never on a
 * device clock: comparing timestamps let a device whose clock ran ahead push a
 * stale snapshot over a newer one. Local edits therefore only win when they were
 * made on top of the revision this device last saw.
 *
 * - `auto-recover` — the shared plancia is empty although a configured revision
 *   is still kept and the emptying was not an explicit reset. This repairs an
 *   installation that a previous version already emptied, with no user action.
 */
export function sharedReconcileAction({
  snapshot = null,
  recoverable = [],
  local = {},
  localConfigured = false,
  pendingAt = 0,
  syncedRevision = 0,
} = {}) {
  const normalized = snapshot ? normalizeSharedSnapshot(snapshot) : null;
  if (!normalized) return localConfigured ? "push-local" : "none";
  if (!meaningfulConfigValues(normalized.values)) {
    if (localConfigured) return "push-local";
    if (!normalized.reset && recoverable.length > 0) return "auto-recover";
    return "none";
  }
  if (sameConfigValues(local, normalized.values)) return "in-sync";
  /* Il recinto di generazione. Uno scatto senza la generazione corrente viene
   * da un runtime vecchio — uno di quelli che marcavano «in sospeso» anche le
   * riscritture di macchina e rispingevano dati stantii per sempre. Su un
   * dispositivo gia' configurato quello scatto non vince: si rispinge la
   * copia propria, finche' la plancia vecchia non viene ricaricata. Fra
   * dispositivi della stessa generazione questa riga non decide mai. */
  if (localConfigured && Number(normalized.writer_generation) < WRITER_GENERATION)
    return "push-local";
  if (
    Number(pendingAt) > 0 &&
    localConfigured &&
    Number(syncedRevision) === Number(normalized.revision)
  )
    return "push-local";
  return "restore-remote";
}

function readMeta(storage = root.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(PERSIST_META_KEY) || "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeMeta(patch = {}, storage = root.localStorage) {
  const current = readMeta(storage);
  const next = { ...current, ...patch };
  try {
    storage?.setItem?.(PERSIST_META_KEY, JSON.stringify(next));
  } catch (_error) {}
  return next;
}

function legacyPendingTimestamp(storage = root.localStorage) {
  try {
    if (!storage?.getItem?.("cd_sync_dirty")) return 0;
    const value = Number(storage.getItem("cd_sync_ts"));
    return Number.isFinite(value) ? value : 0;
  } catch (_error) {
    return 0;
  }
}

function snapshot() {
  return {
    version: USER_DATA_VERSION,
    keys_revision: CONFIG_KEYS_REVISION,
    writer_generation: WRITER_GENERATION,
    updated_at: Date.now(),
    values: localValues(),
  };
}

function hostedBridge() {
  return Boolean(
    root.__DASHBOARDMODERN_HOSTED__ && (root.__DASHBOARDMODERN_BRIDGE_WS__ || root.WebSocket),
  );
}

function sharedStoreEnabled() {
  return Boolean(hostedBridge() && currentProfile());
}

function bridgeRequest(type, payload = {}) {
  if (!hostedBridge()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const Socket = root.__DASHBOARDMODERN_BRIDGE_WS__ || root.WebSocket;
    const id = 700000 + Math.floor(Math.random() * 200000);
    let sent = false;
    let socket;
    let finished = false;
    const timer = root.setTimeout?.(() => {
      if (finished) return;
      try {
        socket?.close?.();
      } catch (_error) {}
      finished = true;
      reject(new Error(`${type} timed out`));
    }, 8000);
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      if (timer) root.clearTimeout?.(timer);
      try {
        socket?.close?.();
      } catch (_error) {}
      callback(value);
    };
    const send = () => {
      if (sent || finished) return;
      sent = true;
      try {
        socket.send(JSON.stringify({ id, type, ...payload }));
      } catch (error) {
        finish(reject, error);
      }
    };
    try {
      socket = new Socket("ws://dashboardmodern.invalid/api/websocket");
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event?.data || "{}");
        } catch (_error) {
          return;
        }
        if (message.type === "auth_ok") {
          send();
          return;
        }
        if (message.type !== "result" || message.id !== id) return;
        if (message.success === false)
          finish(reject, new Error(message.error?.message || `${type} failed`));
        else finish(resolve, message.result);
      };
      socket.onerror = () => finish(reject, new Error(`${type} bridge error`));
      root.setTimeout?.(() => {
        if (!sent && !finished && socket?.readyState === 1 && root.__DASHBOARDMODERN_BRIDGE_WS__)
          send();
      }, 25);
    } catch (error) {
      finish(reject, error);
    }
  });
}

function sharedPayload(extra = {}) {
  const payload = { profile: currentProfile(), ...extra };
  const instance = String(root.__DASHBOARDMODERN_INSTANCE__ || "");
  if (instance) payload.entry_id = instance;
  return payload;
}

function sharedGet() {
  return bridgeRequest(SHARED_GET, sharedPayload());
}

function sharedSet(value, { expectedRevision = null, reset = false } = {}) {
  return bridgeRequest(
    SHARED_SET,
    sharedPayload({
      snapshot: {
        values: value.values,
        keys_revision: value.keys_revision,
        /* Senza questo campo il backend timbra 0 e il recinto scatta CONTRO
         * ogni scatto remoto: due dispositivi aggiornati si rispingerebbero
         * a vicenda — proprio l'oscillazione che il recinto deve fermare. */
        writer_generation: Number(value.writer_generation) || WRITER_GENERATION,
        updated_at: value.updated_at,
      },
      ...(expectedRevision === null ? {} : { expected_revision: Number(expectedRevision) }),
      ...(reset ? { reset: true } : {}),
    }),
  );
}

function sharedRestoreRevision(revision) {
  return bridgeRequest(SHARED_RESTORE, sharedPayload({ revision: Number(revision) }));
}

/**
 * Record that this device holds edits that are not in the shared store yet.
 *
 * The flag is written even before the first successful read, so an edit made
 * while Home Assistant was unreachable is not silently dropped: it is the
 * revision comparison in `sharedReconcileAction`, not the mere existence of the
 * flag, that decides whether those edits may overwrite the shared copy. Pushing
 * still waits for a successful read.
 */
function markPending({ schedule = true } = {}) {
  if (
    state.resetting ||
    state.hydrating ||
    root.__DASHBOARDMODERN_PERSIST_RESTORE__ ||
    root.__DASHBOARDMODERN_CONFIG_RESETTING__
  )
    return state.dirtyAt;
  const now = Date.now();
  state.dirtyAt = now;
  writeMeta({ pending_at: now });
  if (schedule && state.hydrated && hostedBridge()) schedulePush();
  return now;
}

function queuePendingFromStorage() {
  if (state.dirtyMarkTimer) return;
  state.dirtyMarkTimer =
    root.setTimeout?.(() => {
      state.dirtyMarkTimer = 0;
      markPending();
    }, 0) || 0;
  if (!state.dirtyMarkTimer) markPending();
}

function rememberSynced(revision, updatedAt) {
  state.dirtyAt = 0;
  state.remoteRevision = Number(revision) || 0;
  writeMeta({
    synced_at: Number(updatedAt) || Date.now(),
    synced_revision: state.remoteRevision,
    pending_at: 0,
  });
}

async function pushShared(attempt = 0) {
  const value = snapshot();
  const configured = meaningfulLocal(value.values);

  // The wipe this integration used to perform: a device with nothing configured
  // writing over a configured plancia. The store refuses it too; refusing here
  // as well means it never even leaves the device.
  if (!state.resetting && !configured && state.remoteConfigured) {
    console.warn("[DashboardModern] empty local configuration not pushed; re-reading shared copy");
    await hydrateRemote({ force: true });
    return false;
  }

  let result;
  try {
    result = await sharedSet(value, {
      expectedRevision: state.remoteRevision,
      reset: state.resetting,
    });
  } catch (error) {
    console.warn("[DashboardModern] shared config sync failed; local copy kept", error);
    return false;
  }

  const status = String(result?.status || "");
  if (status === "saved" || status === "unchanged") {
    state.localWasConfigured = configured;
    state.remoteConfigured = meaningfulConfigValues(result?.snapshot?.values || value.values);
    rememberSynced(result?.snapshot?.revision, result?.snapshot?.updated_at);
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:persistence-saved", { detail: value }));
    return true;
  }

  if (status === "refused-empty") {
    // Nothing was lost: adopt the copy the store protected.
    console.warn("[DashboardModern] shared store refused an empty snapshot; restoring it locally");
    return applySharedSnapshot(result.snapshot);
  }

  if (status === "conflict") {
    state.remoteRevision = Number(result?.snapshot?.revision) || 0;
    state.remoteConfigured = meaningfulConfigValues(result?.snapshot?.values || {});
    if (attempt >= PUSH_CONFLICT_RETRIES) {
      /* Cedere si', ma non a un runtime vecchio: adottare qui lo scatto di
       * una plancia della generazione prima vorrebbe dire perdere il duello
       * proprio con chi il recinto esiste per fermare. Si tiene la copia
       * propria e si riprova al giro dopo, quando quella plancia avra'
       * smesso di scrivere o sara' stata ricaricata. */
      const rimasto = normalizeSharedSnapshot(result?.snapshot);
      if (rimasto && rimasto.writer_generation < WRITER_GENERATION && configured) {
        console.warn("[DashboardModern] conflict against an older writer; keeping local copy");
        scheduleHydrateRetry(0);
        return false;
      }
      console.warn("[DashboardModern] shared config conflict persisted; keeping the stored copy");
      return applySharedSnapshot(result.snapshot);
    }
    return pushShared(attempt + 1);
  }

  console.warn("[DashboardModern] unexpected shared config result", result);
  return false;
}

async function pushLegacyUserData() {
  const value = snapshot();
  try {
    await bridgeRequest("frontend/set_user_data", { key: userDataKey(), value });
    state.dirtyAt = 0;
    state.localWasConfigured = meaningfulLocal(value.values);
    writeMeta({ synced_at: value.updated_at, pending_at: 0 });
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:persistence-saved", { detail: value }));
    return true;
  } catch (error) {
    console.warn("[DashboardModern] config sync failed; local copy kept", error);
    return false;
  }
}

async function pushNow() {
  if (!hostedBridge()) return true;
  if (!sharedStoreEnabled()) return pushLegacyUserData();
  if (!state.hydrated && !state.resetting) {
    // Never write before knowing what the installation already holds.
    scheduleHydrateRetry(0);
    return false;
  }
  return pushShared();
}

function schedulePush() {
  state.needsPush = true;
  if (state.pushPromise) return state.pushPromise;
  state.pushPromise = new Promise((resolve) => {
    const run = async () => {
      state.pushTimer = 0;
      let result = true;
      do {
        state.needsPush = false;
        result = (await pushNow()) && result;
      } while (state.needsPush);
      state.pushPromise = null;
      resolve(result);
    };
    state.pushTimer = root.setTimeout?.(run, 140) || 0;
    if (!state.pushTimer) run();
  });
  return state.pushPromise;
}

export function normalizeRestoredValues(values) {
  const restored = { ...values };
  if (typeof restored.cd_stanze === "string") {
    try {
      restored.cd_stanze = JSON.stringify(
        normalizeSection("rooms", JSON.parse(restored.cd_stanze)),
      );
    } catch (_error) {}
  }
  if (typeof restored.dm_dashboard_state === "string") {
    try {
      const restoredSnapshot = JSON.parse(restored.dm_dashboard_state);
      restoredSnapshot.sections ||= {};
      restoredSnapshot.sections.rooms = normalizeSection(
        "rooms",
        restoredSnapshot.sections.rooms || [],
      );
      /* Le auto viaggiano DUE volte — `cd_ev_cars` e questa copia dentro lo
       * stato canonico — e dopo il ripristino il negozio ripersiste dalla
       * copia canonica, sovrascrivendo la lista appena scritta due righe
       * sopra. Quando le due copie divergevano, vinceva in silenzio quella
       * canonica: e' il «c'e' qualche sezione che sovrascrive» segnalato per
       * giorni, applicato alle foto delle auto. La lista legacy e' quella che
       * ogni gesto scrive per prima, quindi e' lei la piu' fresca: la copia
       * canonica le si allinea qui, prima che qualcuno la ripersista. */
      if (typeof restored.cd_ev_cars === "string") {
        try {
          restoredSnapshot.sections.ev = normalizeSection(
            "ev",
            JSON.parse(restored.cd_ev_cars) || [],
          );
        } catch (_error) {}
      }
      restored.dm_dashboard_state = JSON.stringify(restoredSnapshot);
    } catch (_error) {}
  }
  return restored;
}

export function applyRestoredValues(storage, values) {
  if (!storage || !values || typeof values !== "object" || Array.isArray(values)) return false;
  const restored = normalizeRestoredValues(values);
  for (const key of CONFIG_KEYS) {
    const value = restored[key];
    if (typeof value === "string") storage.setItem(key, value);
    else storage.removeItem?.(key);
  }
  return true;
}

function restoreValues(values) {
  root.__DASHBOARDMODERN_PERSIST_RESTORE__ = true;
  try {
    return applyRestoredValues(root.localStorage, values);
  } finally {
    delete root.__DASHBOARDMODERN_PERSIST_RESTORE__;
  }
}

function refreshRuntimeAfterRestore(remote) {
  /* Tutto il giro di rilettura e' ripristino, non gesto: la rimigrazione del
   * negozio riscrive le chiavi appena arrivate nella propria serializzazione,
   * e fuori dalla finestra di idratazione — i rami di conflitto del push
   * passano da qui — quelle riscritture finivano marcate «in sospeso». */
  const eraRipristino = root.__DASHBOARDMODERN_PERSIST_RESTORE__;
  root.__DASHBOARDMODERN_PERSIST_RESTORE__ = true;
  try {
    root.DashboardModernModules?.store?.migrate?.();
  } catch (error) {
    console.warn(
      "[DashboardModern] canonical state reload after persistence restore failed",
      error,
    );
  } finally {
    if (!eraRipristino) delete root.__DASHBOARDMODERN_PERSIST_RESTORE__;
  }
  // La configurazione condivisa arriva quando arriva, e a volte porta con se'
  // un'entita' che qui non c'e' piu'. Se il primo passo inciampa, gli altri
  // devono partire lo stesso: erano proprio la visibilita' delle sezioni e il
  // disegno a restare indietro, e le sezioni configurate sparivano.
  runSteps(
    [
      ["cdEvCarsRefresh", () => root.cdEvCarsRefresh?.()],
      ["buildQuickActions", () => root.buildQuickActions?.()],
      ["cdApplyNavOrder", () => root.cdApplyNavOrder?.()],
      ["cdApplyNavVis", () => root.cdApplyNavVis?.()],
      ["buildTempCards", () => root.buildTempCards?.()],
      ["buildClimaCards", () => root.buildClimaCards?.()],
      ["render", () => root.render?.()],
    ],
    { onError: stepReporter(root.console, "configurazione ripristinata") },
  );
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:persistence-restored", { detail: remote }));
}

/** Apply one shared snapshot to this device and refresh the runtime. */
function applySharedSnapshot(rawSnapshot) {
  const normalized = normalizeSharedSnapshot(rawSnapshot);
  if (!normalized) return false;
  const merged = mergeLegacyMissingConfig(normalized, localValues());
  if (!restoreValues(merged.values)) return false;
  state.remoteRevision = normalized.revision;
  state.remoteConfigured = meaningfulConfigValues(normalized.values);
  state.localWasConfigured = meaningfulLocal(localValues());
  rememberSynced(normalized.revision, normalized.updated_at);
  refreshRuntimeAfterRestore(merged);
  return true;
}

/** Read the per-user copy written by earlier releases, without writing to it. */
async function readLegacyUserData() {
  try {
    const fetchValue = async (key) =>
      (await bridgeRequest("frontend/get_user_data", { key }))?.value;
    const current = await fetchValue(userDataKey());
    return normalizeRemoteSnapshot(current || (await fetchValue(legacyUserDataKey())));
  } catch (error) {
    console.warn("[DashboardModern] legacy per-user config not readable", error);
    return null;
  }
}

async function hydrateShared() {
  const response = await sharedGet();
  state.lastPullAt = Date.now();
  const local = localValues();
  const meta = readMeta();
  const pendingAt = Math.max(Number(state.dirtyAt) || 0, Number(meta.pending_at) || 0);
  const syncedRevision = Number(meta.synced_revision) || 0;
  let stored = normalizeSharedSnapshot(response?.snapshot);
  const recoverable = Array.isArray(response?.recoverable) ? response.recoverable : [];

  // First run against the shared store: adopt the per-user copy of this device
  // so an existing installation keeps its configuration.
  if (!stored || !meaningfulConfigValues(stored.values)) {
    const legacy = await readLegacyUserData();
    if (legacy && meaningfulConfigValues(legacy.values)) {
      const migrated = await sharedSet(
        {
          values: mergeLegacyMissingConfig(legacy, local).values,
          keys_revision: legacy.keys_revision,
          updated_at: legacy.updated_at || Date.now(),
        },
        { expectedRevision: stored?.revision ?? 0 },
      );
      const adopted = normalizeSharedSnapshot(migrated?.snapshot);
      if (adopted) stored = adopted;
    }
  }

  state.remoteRevision = stored?.revision || 0;
  state.remoteConfigured = Boolean(stored && meaningfulConfigValues(stored.values));
  const localConfigured = state.hydrated ? meaningfulLocal(local) : state.localWasConfigured;
  const action = sharedReconcileAction({
    snapshot: stored,
    recoverable,
    local,
    localConfigured,
    pendingAt,
    syncedRevision,
  });

  if (action === "push-local") return await pushShared();
  if (action === "restore-remote") return applySharedSnapshot(stored);
  if (action === "auto-recover") {
    console.warn("[DashboardModern] shared configuration was empty; restoring the kept revision");
    const restored = await sharedRestoreRevision(recoverable[0].revision);
    return applySharedSnapshot(restored?.snapshot);
  }
  if (action === "in-sync") {
    state.localWasConfigured = localConfigured;
    rememberSynced(stored.revision, stored.updated_at);
    /* Stessi valori ma busta vecchia: si ristampa, cosi' lo scatto porta la
     * revisione delle chiavi e la generazione correnti. */
    if (
      Number(stored.keys_revision) < CONFIG_KEYS_REVISION ||
      Number(stored.writer_generation) < WRITER_GENERATION
    )
      await pushShared();
    return false;
  }
  return false;
}

async function hydrateLegacyUserData() {
  const rawRemote = await migrateLegacyUserData(
    async (key) => (await bridgeRequest("frontend/get_user_data", { key }))?.value,
    (key, value) => bridgeRequest("frontend/set_user_data", { key, value }),
  );
  state.lastPullAt = Date.now();
  const local = localValues();
  const normalizedRemote = normalizeRemoteSnapshot(rawRemote);
  const remote = mergeLegacyMissingConfig(normalizedRemote, local);
  const meta = readMeta();
  const pendingAt = Math.max(Number(state.dirtyAt) || 0, Number(meta.pending_at) || 0);
  const localConfigured = state.hydrated ? meaningfulLocal(local) : state.localWasConfigured;
  const action = persistenceReconcileAction({ remote, localConfigured, pendingAt, local });

  if (action === "push-local") return await pushLegacyUserData();
  if (action === "restore-remote" && remote) {
    if (!restoreValues(remote.values)) return false;
    state.dirtyAt = 0;
    state.localWasConfigured = meaningfulLocal(localValues());
    writeMeta({ synced_at: Number(remote.updated_at) || Date.now(), pending_at: 0 });
    refreshRuntimeAfterRestore(remote);
    if (
      Number(remote.keys_revision) < CONFIG_KEYS_REVISION ||
      remote.migrated_from === "legacy-flat" ||
      !sameConfigValues(localValues(), remote.values)
    )
      await pushLegacyUserData();
    return true;
  }
  if (action === "in-sync" && remote) {
    state.dirtyAt = 0;
    state.localWasConfigured = localConfigured;
    writeMeta({ synced_at: Number(remote.updated_at) || Date.now(), pending_at: 0 });
    if (
      Number(remote.keys_revision) < CONFIG_KEYS_REVISION ||
      remote.migrated_from === "legacy-flat"
    )
      await pushLegacyUserData();
    return false;
  }
  if (action === "unsupported")
    console.warn("[DashboardModern] unsupported remote config snapshot retained without overwrite");
  return false;
}

function scheduleHydrateRetry(failures = state.transportFailures) {
  if (state.resetting || !hostedBridge() || state.hydrateRetryTimer) return;
  const index = Math.min(Math.max(Number(failures) || 0, 0), HYDRATE_RETRY_MS.length - 1);
  state.hydrateRetryTimer =
    root.setTimeout?.(() => {
      state.hydrateRetryTimer = 0;
      hydrateRemote({ force: true }).catch((error) =>
        root.console?.warn?.("[DashboardModern] config hydration retry failed", error),
      );
    }, HYDRATE_RETRY_MS[index]) || 0;
}

async function hydrateRemote(options = {}) {
  const force = options?.force === true;
  if (state.hydrating || state.resetting || (!force && state.hydrated) || !hostedBridge())
    return false;
  state.hydrating = true;
  const shared = sharedStoreEnabled();
  try {
    const changed = shared ? await hydrateShared() : await hydrateLegacyUserData();
    state.hydrated = true;
    state.transportFailures = 0;
    return changed;
  } catch (error) {
    // A read that never completed says nothing about the stored configuration.
    // Leaving `hydrated` false keeps this device out of the writer role and
    // retries, instead of pushing whatever it happens to hold locally.
    console.warn("[DashboardModern] config restore skipped", error);
    if (shared) {
      state.transportFailures += 1;
      scheduleHydrateRetry();
    } else {
      state.hydrated = true;
    }
    return false;
  } finally {
    state.hydrating = false;
  }
}

function scheduleRemoteRefresh(delay = 0) {
  if (state.resetting || !hostedBridge()) return;
  if (root.document?.visibilityState === "hidden") return;
  if (state.refreshTimer) return;
  const elapsed = Date.now() - (Number(state.lastPullAt) || 0);
  const wait = Math.max(Number(delay) || 0, REMOTE_REFRESH_MIN_MS - elapsed, 0);
  state.refreshTimer =
    root.setTimeout?.(() => {
      state.refreshTimer = 0;
      hydrateRemote({ force: true }).catch((error) =>
        root.console?.warn?.("[DashboardModern] cross-device refresh failed", error),
      );
    }, wait) || 0;
  if (!state.refreshTimer) hydrateRemote({ force: true });
}

function installStorageMutationBridge() {
  const storage = root.localStorage;
  if (!storage || storage.__dmPersistenceMutationBridge) return false;
  const originalSetItem = storage.setItem?.bind(storage);
  const originalRemoveItem = storage.removeItem?.bind(storage);
  if (!originalSetItem || !originalRemoveItem) return false;

  /* Le scritture di proiezione del negozio non sono gesti.
   *
   * `persist` riscrive TUTTE le chiavi legacy dalla propria serializzazione —
   * all'avvio, dopo un ripristino, a ogni transact — anche quando nessuno ha
   * toccato niente: solo la forma del testo cambia. Prendere quelle
   * riscritture per modifiche dell'utente rendeva scrittore ogni dispositivo
   * acceso: la plancia vecchia rispingeva i suoi dati, quella nuova i propri,
   * e la configurazione — le foto dell'auto per prime — oscillava da sola,
   * un rimbalzo ogni giro di aggiornamento. Un gesto vero o scrive la chiave
   * direttamente (gli editor storici), o passa dal negozio con un transact —
   * che adesso lo annuncia da se'. */
  storage.setItem = function dashboardModernPersistentSetItem(key, value) {
    const managed = CONFIG_KEYS.includes(String(key));
    const before = managed ? storage.getItem(key) : null;
    const result = originalSetItem(key, value);
    if (
      managed &&
      before !== String(value) &&
      !storage.__dashboardStoreProjecting &&
      !state.hydrating &&
      !state.resetting &&
      !root.__DASHBOARDMODERN_PERSIST_RESTORE__ &&
      !root.__DASHBOARDMODERN_CONFIG_RESETTING__
    )
      queuePendingFromStorage();
    return result;
  };
  storage.removeItem = function dashboardModernPersistentRemoveItem(key) {
    const managed = CONFIG_KEYS.includes(String(key));
    const before = managed ? storage.getItem(key) : null;
    const result = originalRemoveItem(key);
    if (
      managed &&
      before !== null &&
      !storage.__dashboardStoreProjecting &&
      !state.hydrating &&
      !state.resetting &&
      !root.__DASHBOARDMODERN_PERSIST_RESTORE__ &&
      !root.__DASHBOARDMODERN_CONFIG_RESETTING__
    )
      queuePendingFromStorage();
    return result;
  };
  storage.__dmPersistenceMutationBridge = true;
  state.mutationBridgeInstalled = true;
  return true;
}

function resetConfirmation() {
  return t(
    "Eliminare tutta la configurazione DashboardModern di questa plancia?",
    "Delete all DashboardModern configuration for this dashboard?",
  );
}

/* Svuotare la propria configurazione, non quella di Home Assistant.
 *
 * La plancia ospitata vive in una cornice `srcdoc`, che eredita l'origine della
 * pagina che la contiene: la sua memoria del browser e' la stessa di Home
 * Assistant. Svuotarla tutta — che e' quello che faceva "Elimina tutta la
 * configurazione" — cancellava anche cio' che Home Assistant ci tiene: il tema
 * scelto, la barra laterale, le preferenze. Chi lo faceva si ritrovava tutte le
 * altre plance sbiancate, col tema tornato a quello di partenza e nessuna
 * traccia di dove fosse finita la sua scelta.
 *
 * Si tolgono le chiavi nostre, riconosciute dal prefisso, e nient'altro. */
const OWN_STORAGE_PREFIXES = Object.freeze(["cd_", "dm_", "dashboardmodern"]);

export const isOwnStorageKey = (key) =>
  OWN_STORAGE_PREFIXES.some((prefix) => String(key ?? "").startsWith(prefix));

/* Elencare e togliere devono parlare la stessa lingua.
 *
 * Quando piu' plance vivono sulla stessa origine, `storage-namespace.js`
 * antepone `cd_<istanza>_` a ogni chiave nostra: chi scrive `cd_stanze` la
 * ritrova come `cd_e2e-1_cd_stanze`. Ma il giro sulle chiavi le mostra come
 * sono scritte davvero, mentre `removeItem` vuole il nome corto e ci rimette
 * lui il prefisso. Passargli il nome lungo significa cercare
 * `cd_<istanza>_cd_<istanza>_cd_stanze`, che non esiste: non si cancellava
 * nulla. Si toglie qui il prefisso prima di restituire la chiave, e le chiavi
 * di un'altra plancia restano dove sono. */
const storageNamespacePrefix = () => {
  const istanza = root.__DASHBOARDMODERN_STORAGE_NS__;
  return istanza ? `cd_${istanza}_` : "";
};

export function clearOwnStorage(storage = root.localStorage) {
  if (!storage) return false;
  const prefisso = storageNamespacePrefix();
  const nostre = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!isOwnStorageKey(key)) continue;
    if (!prefisso) {
      nostre.push(key);
      continue;
    }
    // Il prefisso lo prendono solo le chiavi `cd_`/`dm_`: le altre nostre
    // passano com'e'. Con il prefisso attivo sono nostre solo le chiavi della
    // nostra istanza, quelle delle altre plance restano dove sono.
    const nome = String(key);
    if (nome.startsWith(prefisso)) nostre.push(nome.slice(prefisso.length));
    else if (!/^(cd_|dm_)/.test(nome)) nostre.push(nome);
  }
  for (const key of nostre) storage.removeItem(key);
  return true;
}

export async function resetAllConfig({ skipConfirm = false, reload = true } = {}) {
  if (state.resetting) return false;
  if (!skipConfirm && root.confirm && !root.confirm(resetConfirmation())) return false;
  state.resetting = true;
  state.hydrated = true;
  state.localWasConfigured = false;
  root.__DASHBOARDMODERN_CONFIG_RESETTING__ = true;

  try {
    if (state.pushPromise) await state.pushPromise;
    await Promise.resolve();
  } catch (_error) {}

  try {
    clearOwnStorage();
  } catch (error) {
    state.resetting = false;
    delete root.__DASHBOARDMODERN_CONFIG_RESETTING__;
    root.console?.error?.("[DashboardModern] local reset failed", error);
    return false;
  }

  // Storage is empty, memory is not: the canonical store still holds the whole
  // plancia and projects it back onto the legacy keys on the next write, which
  // is why a reset used to leave a stray light and an empty quick action
  // behind. Empty it here, before anything can write again.
  try {
    root.DashboardModernModules?.store?.reset?.();
  } catch (_error) {}

  const empty = snapshot();
  try {
    if (sharedStoreEnabled()) {
      // An explicit reset is the one write allowed to empty the plancia. It is
      // flagged as such so the store keeps the previous revision without ever
      // restoring it behind the user's back.
      await sharedSet(empty, { reset: true });
      state.remoteConfigured = false;
      state.remoteRevision = 0;
    } else if (hostedBridge()) {
      await bridgeRequest("frontend/set_user_data", { key: userDataKey(), value: empty });
    }
  } catch (error) {
    root.console?.warn?.("[DashboardModern] remote reset deferred", error);
    state.dirtyAt = Date.now();
    writeMeta({ pending_at: state.dirtyAt });
    state.needsPush = true;
    schedulePush();
  }

  try {
    clearOwnStorage();
  } catch (_error) {}

  root.dispatchEvent?.(new CustomEvent("dashboardmodern:config-reset", { detail: empty }));
  if (reload) root.setTimeout?.(() => reloadDashboard(), 40);
  else {
    state.resetting = false;
    delete root.__DASHBOARDMODERN_CONFIG_RESETTING__;
  }
  return true;
}

function installResetOwner() {
  if (typeof root.wzResetAll !== "function" || root.wzResetAll.__dmCanonicalReset) return false;
  const canonical = function dashboardModernResetAll() {
    return resetAllConfig();
  };
  canonical.__dmCanonicalReset = true;
  canonical.__dmPrevious = root.wzResetAll;
  root.wzResetAll = canonical;
  state.resetOwnerInstalled = true;
  return true;
}

function disableLegacySyncState() {
  root.__DASHBOARDMODERN_PERSISTENCE_OWNER__ = "modern-v1";
  for (const key of LEGACY_SYNC_CONTROL_KEYS) {
    try {
      root.localStorage?.removeItem?.(key);
    } catch (_error) {}
  }
  try {
    root._cdSyncReqId = -1;
  } catch (_error) {}
}

export function installConfigPersistenceSection() {
  if (state.installed) {
    disableLegacySyncState();
    installResetOwner();
    installStorageMutationBridge();
    return;
  }
  state.installed = true;
  state.localWasConfigured = meaningfulLocal();
  const initialMeta = readMeta();
  const legacyPending = legacyPendingTimestamp();
  state.dirtyAt = Math.max(Number(initialMeta.pending_at) || 0, legacyPending);
  state.remoteRevision = Number(initialMeta.synced_revision) || 0;
  if (legacyPending) writeMeta({ pending_at: state.dirtyAt });
  disableLegacySyncState();

  // Intentionally do NOT invoke the legacy cdMarkDirty/cdSyncPush functions.
  // They used a flat payload while this owner uses {version, updated_at, values}
  // and the two writers racing on the same HA key is the root cause of devices
  // showing different configurations.
  root.cdMarkDirty = function dashboardModernMarkDirty() {
    return markPending();
  };

  root.cdSyncPush = function dashboardModernSyncPush() {
    if (!state.hydrated || state.hydrating) {
      return hydrateRemote().then(() => true);
    }
    markPending({ schedule: false });
    return schedulePush();
  };

  root.cdSyncPull = () => hydrateRemote({ force: true });
  root.dmResetAllConfig = resetAllConfig;
  installResetOwner();
  installStorageMutationBridge();

  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    disableLegacySyncState();
    installResetOwner();
    installStorageMutationBridge();
    root.setTimeout?.(() => hydrateRemote(), 0);
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    disableLegacySyncState();
    installResetOwner();
    installStorageMutationBridge();
    root.setTimeout?.(() => hydrateRemote(), 0);
  });

  /* Il gesto annunciato dal negozio: un transact che ha cambiato davvero il
   * contenuto. E' il canale con cui gli editor che passano dal negozio —
   * l'Energia, le Persone — continuano a sincronizzare, ora che le scritture
   * di proiezione tacciono. */
  root.addEventListener?.("dashboardmodern:store-user-write", () => markPending());

  root.addEventListener?.("focus", () => scheduleRemoteRefresh(40));
  root.addEventListener?.("pageshow", () => scheduleRemoteRefresh(40));
  root.addEventListener?.("storage", () => scheduleRemoteRefresh(40));
  root.document?.addEventListener?.("visibilitychange", () => {
    if (root.document?.visibilityState === "visible") scheduleRemoteRefresh(40);
  });
}

installConfigPersistenceSection();
