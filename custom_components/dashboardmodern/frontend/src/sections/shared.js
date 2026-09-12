// DM-FIX-20260812B
import { canonicalClimateType } from "../core/device-model.js";
import { isCumulativeEnergyEntity } from "../core/period-service.js";
import {
  DEFAULT_LOCALE,
  SOURCE_LOCALE,
  getLocale,
  intlLocale,
  isRtl,
  onLocaleChange,
  translate,
} from "../core/i18n.js";

export const root = globalThis;
export const doc = root.document;

export const clean = (value) => String(value ?? "").trim();
export const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const finiteOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
/*
 * Language access for the section layer.
 *
 * `t(it, en)` keeps its two-argument shape at all ~620 call sites, but it is no
 * longer a binary switch: English is the pivot key into the catalog of the
 * active locale, so the same call renders Japanese or Arabic once that catalog
 * is loaded, and degrades to English — never to Italian — when it is not.
 */
export const activeLocale = () => getLocale();
/* Retained for call sites that branch on layout rather than on copy. */
export const english = () => getLocale() === "en";
export const locale = () => intlLocale();
export const rtl = () => isRtl();
export const t = (it, en) => {
  const code = getLocale();
  if (code === SOURCE_LOCALE) return it;
  if (code === DEFAULT_LOCALE) return en;
  return translate(en, code);
};
/* Translate a string that only exists in English (no Italian counterpart). */
export const tr = (en) => translate(en, getLocale());
export const esc = (value) =>
  clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export function readClimateUnits() {
  let values;
  try {
    const raw = root.localStorage?.getItem?.("cd_clima_units");
    if (raw !== null && raw !== undefined) values = JSON.parse(raw);
  } catch (_error) {
    values = [];
  }
  if (!Array.isArray(values)) values = root.getClimaUnits?.().slice?.() || [];
  return values.map((item) => ({ ...item, type: canonicalClimateType(item?.type) }));
}

const ENERGY_RUNTIME_SOURCES = Object.freeze([
  {
    group: "house",
    totalKey: "total_energy",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
    fallbackKeys: ["annual_energy", "daily_energy"],
  },
  {
    group: "solar",
    totalKey: "total_energy",
    periodKeys: ["annual_energy", "monthly_energy", "daily_energy"],
    fallbackKeys: ["annual_energy", "daily_energy"],
  },
  {
    group: "grid",
    totalKey: "total_import_energy",
    periodKeys: ["annual_import_energy", "monthly_import_energy", "daily_import_energy"],
    fallbackKeys: ["annual_import_energy", "daily_import_energy"],
  },
  {
    group: "grid",
    totalKey: "total_export_energy",
    periodKeys: ["annual_export_energy", "monthly_export_energy", "daily_export_energy"],
    fallbackKeys: ["annual_export_energy", "daily_export_energy"],
  },
  {
    group: "battery",
    totalKey: "total_charged_energy",
    periodKeys: ["annual_charged_energy", "monthly_charged_energy", "daily_charged_energy"],
    fallbackKeys: ["annual_charged_energy", "daily_charged_energy"],
  },
  {
    group: "battery",
    totalKey: "total_discharged_energy",
    periodKeys: [
      "annual_discharged_energy",
      "monthly_discharged_energy",
      "daily_discharged_energy",
    ],
    fallbackKeys: ["annual_discharged_energy", "daily_discharged_energy"],
  },
]);

const ENERGY_RUNTIME_FIELDS = Object.freeze(
  Object.fromEntries(
    ["house", "solar", "grid", "battery"].map((group) => [
      group,
      [
        ...new Set(
          ENERGY_RUNTIME_SOURCES.filter((source) => source.group === group).flatMap((source) => [
            source.totalKey,
            ...source.periodKeys,
          ]),
        ),
      ],
    ]),
  ),
);

function resolveConfiguredEntity(reference, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return "";
  try {
    return clean(resolver?.(original) || original);
  } catch (_error) {
    return original;
  }
}

function entityExists(reference, states = {}, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return false;
  if (original.startsWith("dm.")) return true;
  const resolved = resolveConfiguredEntity(original, resolver);
  return Boolean(states?.[original] || states?.[resolved]);
}

function cumulativeEntity(reference, states = {}, resolver = root.resolveEntity) {
  const original = clean(reference);
  if (!original) return false;
  const resolved = resolveConfiguredEntity(original, resolver);
  const current = states?.[resolved] || states?.[original];
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  return stateClass === "total" || stateClass === "total_increasing";
}

/**
 * Return a non-destructive runtime Energy projection.
 *
 * Old saved configurations may still contain entity ids that no longer exist
 * in Home Assistant. They must not block Recorder fallback, so stale refs are
 * removed only from this in-memory projection. If a dedicated lifetime meter
 * is missing, an existing annual helper is preferred as a virtual cumulative
 * Recorder source; a daily helper is the last fallback. The monthly helper is
 * deliberately never promoted to Total here, so a valid explicit monthly
 * sensor remains authoritative for the current month.
 */
export function sanitizeEnergyModel(
  value = {},
  states = allStates(),
  resolver = root.resolveEntity,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const snapshot = states && typeof states === "object" ? states : {};
  if (!Object.keys(snapshot).length) return value;

  let result = value;
  let changed = false;
  const ensureGroup = (group) => {
    if (!changed) {
      result = { ...value };
      changed = true;
    }
    if (result[group] === value[group]) result[group] = { ...(value[group] || {}) };
    else if (!result[group]) result[group] = {};
    return result[group];
  };

  for (const [group, keys] of Object.entries(ENERGY_RUNTIME_FIELDS)) {
    for (const key of keys) {
      const reference = clean(value[group]?.[key]);
      if (!reference || entityExists(reference, snapshot, resolver)) continue;
      ensureGroup(group)[key] = "";
    }
  }

  /* Il contatore totale comanda.
   *
   * Chi riempie il totale e anche giornaliera, mensile e annuale si ritrova due
   * verita' che non tornano: il totale cresce e basta, i contatori di periodo si
   * azzerano quando decide chi li ha creati, e il numero mostrato cambiava a
   * seconda di quale dei due la pagina avesse letto per primo. Con il totale
   * configurato ogni periodo si ricava da li' con il Recorder e i campi di
   * periodo restano fuori dal modello: la maschera di configurazione lo dice a
   * chiare lettere, invece di lasciare indovinare quale dei due sta vincendo. */
  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = result[source.group] || value[source.group] || {};
    const total = clean(group[source.totalKey]);
    if (!total || !entityExists(total, snapshot, resolver)) continue;
    for (const key of source.periodKeys) {
      if (!clean(group[key])) continue;
      ensureGroup(source.group)[key] = "";
    }
  }

  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = result[source.group] || value[source.group] || {};
    const total = clean(group[source.totalKey]);
    if (total && entityExists(total, snapshot, resolver)) continue;
    const fallback = source.fallbackKeys
      .map((key) => clean(group[key]))
      .find(
        (reference) =>
          entityExists(reference, snapshot, resolver) &&
          cumulativeEntity(reference, snapshot, resolver),
      );
    if (fallback) ensureGroup(source.group)[source.totalKey] = fallback;
  }

  return result;
}

/* Cosa e' stato scritto due volte.
 *
 * Il modello runtime esce gia' ripulito: i campi di periodo spariscono appena
 * c'e' un contatore totale valido. Cosi' pero' nessuno saprebbe mai che quelle
 * entita' sono state scritte e non vengono lette. Questa lettura resta sulla
 * configurazione grezza e dice, gruppo per gruppo, quali campi di periodo il
 * totale sta scavalcando, perche' la maschera di configurazione possa avvisare
 * con nome e cognome invece di far sparire i valori in silenzio. */
export function energyPeriodConflicts(
  value = {},
  states = allStates(),
  resolver = root.resolveEntity,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const snapshot = states && typeof states === "object" ? states : {};
  const conflicts = [];
  for (const source of ENERGY_RUNTIME_SOURCES) {
    const group = value[source.group] || {};
    const total = clean(group[source.totalKey]);
    if (!total || !entityExists(total, snapshot, resolver)) continue;
    const resolvedTotal = resolveConfiguredEntity(total, resolver);
    const ignored = source.periodKeys
      .map((key) => ({ key, entity: clean(group[key]) }))
      .filter(
        ({ entity }) =>
          entity &&
          entity !== total &&
          resolveConfiguredEntity(entity, resolver) !== resolvedTotal &&
          entityExists(entity, snapshot, resolver),
      );
    if (ignored.length)
      conflicts.push({ group: source.group, totalKey: source.totalKey, total, ignored });
  }
  return conflicts;
}

export function dashboardStore() {
  return root.DashboardModernModules?.store || null;
}

export function section(name, fallback) {
  try {
    // A read-only view when the store offers one: the sections only read here,
    // and a fresh deep copy per call was the busiest thing on an idle plancia.
    const store = dashboardStore();
    const value =
      (store?.peekSection ? store.peekSection(name) : store?.getSection?.(name)) ?? fallback;
    return name === "energy" ? sanitizeEnergyModel(value, allStates(), root.resolveEntity) : value;
  } catch (_error) {
    return fallback;
  }
}

/* Le stanze configurate, per una tendina che le offra.
 *
 * Ogni scheda che chiede «in che stanza sta questa cosa» ha bisogno della
 * stessa lista, scritta allo stesso modo. Dove non c'era, il campo era una
 * casella di testo: si poteva scrivere «Salone», «salone » o «Saloon», e la
 * sezione Stanze non lo trovava — l'oggetto spariva da li' senza che nessuno
 * dicesse perche'.
 *
 * Il valore e' l'id quando c'e', il nome quando l'id non c'e': una
 * configurazione scritta a mano puo' non avere id, e togliere la scelta a chi
 * ce l'ha gia' sarebbe peggio del problema. La riga scelta si riconosce
 * dall'uno o dall'altro, per lo stesso motivo. */
/* Il nome di una stanza, da qualunque cosa ci sia scritto.
 *
 * La tendina qui sotto salva l'id quando c'e' — e' l'unica cosa che regge un
 * rinominamento — ma chi disegna una card scrive quello che trova, e su una
 * configurazione recente quello che trova e' «ROOM_MT8VPZ7M». Sulle finestre
 * si leggeva quello, sotto al nome e nella riga che separa i gruppi.
 *
 * Qui l'id torna il nome; un nome resta il nome — le configurazioni vecchie
 * salvavano quello — e una stanza che non esiste piu' resta com'era scritta,
 * che e' comunque meglio di niente. */
export function roomLabel(reference) {
  const cercato = String(reference ?? "").trim();
  if (!cercato) return "";
  try {
    const stanze = section("rooms", readJson("cd_stanze", [])) || [];
    for (const room of Array.isArray(stanze) ? stanze : []) {
      const id = String(room?.id ?? "").trim();
      const nome = String(room?.name ?? "").trim();
      if ((id && id === cercato) || (nome && nome === cercato)) return nome || cercato;
    }
  } catch (_error) {}
  return cercato;
}

export function roomOptionsMarkup(selected = "", vuoto = "") {
  const stanze = section("rooms", readJson("cd_stanze", [])) || [];
  const scelto = String(selected ?? "").trim();
  const righe = (Array.isArray(stanze) ? stanze : []).map((room) => {
    const valore = String(room?.id || room?.name || "").trim();
    if (!valore) return "";
    const attiva = [room?.id, room?.name].map((voce) => String(voce ?? "").trim()).includes(scelto);
    const simbolo = String(room?.icon || "").trim();
    const glifo = simbolo && !simbolo.startsWith("mdi:") ? `${esc(simbolo)} ` : "";
    return `<option value="${esc(valore)}"${attiva ? " selected" : ""}>${glifo}${esc(room?.name || valore)}</option>`;
  });
  return [`<option value="">— ${esc(vuoto)} —</option>`, ...righe.filter(Boolean)].join("");
}

/* The vendored runtime declares its state with `const`, `let` and `var` at the
 * top level of a classic script. Only `var` lands on `window`; the others are
 * script-scope bindings that a module cannot see at all — reading `root.WIZ`
 * quietly returns undefined instead of the wizard's data. Resolving the name in
 * the runtime's own scope is the only way in, and it is the same door
 * `allStates()` has always used for `_RAW_STATES`.
 */
/* Il gettone con cui si bussa alla porta HTTP di Home Assistant.
 *
 * Sta in tre posti diversi da dove arriva: una variabile che il guscio
 * inietta, il salvataggio del collegamento, il vecchio nome. Il valore
 * `__dashboardmodern_hosted__` non e' un gettone: e' il segnale che la
 * plancia gira DENTRO Home Assistant e i cookie bastano gia'.
 *
 * Questa funzione stava copiata identica in tre sezioni — le telecamere, le
 * immagini, la mappa del robot — e ne stava per nascere una quarta per gli
 * eventi dei calendari. Adesso e' una sola: dove si va a prendere il gettone
 * e' una domanda con una risposta, non tre uguali che un giorno divergono.
 */
export function gettoneDiAccesso() {
  const valori = [
    root.DASHBOARDMODERN_AUTH_TOKEN,
    root.__DASHBOARDMODERN_REAL_TOKEN__,
    root.LONG_LIVED_TOKEN,
    root.HA_TOKEN,
  ];
  try {
    const collegamento = readJson("cd_connection", {});
    valori.push(collegamento.token, collegamento.access_token);
  } catch (_error) {}
  return (
    valori.map(clean).find((valore) => valore && valore !== "__dashboardmodern_hosted__") || ""
  );
}

/* Una domanda a Home Assistant, sulla presa che il guscio ha gia' aperto.
 *
 * Il guscio tiene la sua `ws` e la tabella `pendingWsCallbacks` in variabili
 * lessicali, non su `window`: si arriva a entrambe da `lexicalGlobal`, e la
 * risposta torna in una promessa. Serve a tutto quello che al socket chiede
 * qualcosa e non si accontenta di chiamare un servizio a fondo perduto — le
 * voci delle liste ToDo, gli eventi dei calendari, e le modifiche a quegli
 * eventi. Sta qui e non in una sezione perche' e' un attrezzo, e tre copie
 * dello stesso attrezzo sono tre occasioni di scadere in modo diverso.
 */
export function chiediAHomeAssistant(payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const socket = lexicalGlobal("ws");
    const pending = lexicalGlobal("pendingWsCallbacks");
    if (!socket || socket.readyState !== 1 || !pending) {
      reject(new Error("socket"));
      return;
    }
    let id = 0;
    try {
      id = root.eval("msgId++");
    } catch (_error) {
      reject(new Error("msgId"));
      return;
    }
    const timer = root.setTimeout?.(() => {
      delete pending[id];
      reject(new Error("timeout"));
    }, timeout);
    pending[id] = (message) => {
      root.clearTimeout?.(timer);
      /* Il messaggio di Home Assistant e' la sola spiegazione che chi guarda
       * puo' capire: «l'evento non esiste piu'» invece di «errore». */
      if (message?.success === false)
        reject(new Error(clean(message?.error?.message) || "home assistant"));
      else resolve(message?.result);
    };
    try {
      socket.send(JSON.stringify({ ...payload, id }));
    } catch (error) {
      root.clearTimeout?.(timer);
      delete pending[id];
      reject(error);
    }
  });
}

/* Che aspetto ha una lente, dovunque la si trovi.
 *
 * Quasi tutte le schede scrivono la loro col nome di casa — `.dm-entity-picker`
 * — ma due se l'erano fatta col proprio: gli animali e il robot. Chi le
 * cercava conosceva solo il primo nome, quindi su quelle righe non ne trovava
 * nessuna e ne aggiungeva una seconda. Poi la riga «Scegli entita'» si prende
 * la lente e ci si trasforma dentro — e' proprio lei a diventare la riga — ma
 * si prendeva quella appena aggiunta, e quella della scheda restava li' accanto
 * come un quadratino azzurro col 🔍 che non serviva piu' a niente. E' la
 * segnalazione: «elimina le lenti di ricerca».
 *
 * Il nome della lente si dice una volta sola, qui, e lo usano tutti e due —
 * chi la cerca per non rifarla e chi la trasforma in riga. Il piu' («aggiungi
 * comando») non e' una lente: apre un campo, non un catalogo. */
export const LENTE_SELECTOR =
  ".dm-entity-picker,.dm-animale-pick,.dm-robot-pick:not(.dm-robot-aggiungi),button[onclick*='wzPickEntity']";

export function lexicalGlobal(name) {
  try {
    const value = root.eval?.(`typeof ${name} !== "undefined" && ${name} ? ${name} : null`);
    if (value) return value;
  } catch (_error) {}
  return root[name] ?? null;
}

/* Una variabile del runtime vendorizzato, riscritta.
 *
 * Il documento storico dichiara le sue variabili con `let` in cima allo
 * script: vivono nell'ambiente lessicale globale, non su `window`, quindi da
 * un modulo non si raggiungono con `root.NOME = ...`. L'eval indiretto sta
 * proprio in quell'ambiente ed e' l'unico modo di tenerle allineate a quello
 * che i moduli disegnano — senza toccare il file vendorizzato. */
export function setLexicalGlobal(name, value) {
  if (!/^[A-Za-z_$][\w$]*$/.test(String(name || ""))) return false;
  try {
    root.eval?.(`typeof ${name} !== "undefined" && (${name} = ${JSON.stringify(value)})`);
    return true;
  } catch (_error) {
    return false;
  }
}

/* The live registry, without a copy of it.
 *
 * This used to build a fresh merged object on every call: spread the two hosted
 * maps, then `Object.assign` `_RAW_STATES` and `STATES` on top. `STATES` is a
 * Proxy whose target *is* `_RAW_STATES`, so the second assign copied the same
 * entries again — through a trap that consults the override table on every
 * key. On a house with a few thousand entities one call cost more than a
 * millisecond, and the renderers call it per card, several of them per row,
 * twice a second. That is the dashboard feeling slow.
 *
 * When the runtime is the only source — which is every hosted dashboard, since
 * `__HASS__`/`hass` live in the parent document and not in this one — the
 * registry is handed back as it is: no copy, no traps, and never one repaint
 * behind. The merge stays for the surfaces that really do expose a second map,
 * and it never merges `STATES` over its own target.
 *
 * The returned map is the runtime's own object. Callers read it; writing to it
 * would write into the mirror of Home Assistant itself.
 */
/**
 * Come si chiama un'entita' quando chi configura non le ha dato un nome.
 *
 * «TODO.LISTA_DELLA_SPESA» al posto di «Lista della spesa»: il ripiego era
 * l'entity_id crudo, che e' un indirizzo e non un nome — e nella tessera
 * finiva anche gridato in maiuscolo. Home Assistant il nome ce l'ha gia',
 * `friendly_name`, ed e' quello che l'utente ha scritto di la'. Solo se manca
 * pure quello si torna all'indirizzo, ripulito: le stanghette diventano spazi
 * e la prima lettera si alza.
 */
export function nomeDellEntita(entity, scelto, states) {
  const suo = clean(scelto);
  if (suo) return suo;
  const id = clean(entity);
  if (!id) return "";
  const mappa = states && typeof states === "object" ? states : allStates();
  const amichevole = clean(mappa?.[id]?.attributes?.friendly_name);
  if (amichevole) return amichevole;
  const coda = id.split(".").slice(1).join(".").replaceAll("_", " ").trim();
  if (!coda) return id;
  return coda.charAt(0).toUpperCase() + coda.slice(1);
}

export function allStates() {
  const raw = lexicalGlobal("_RAW_STATES");
  const registry = raw && typeof raw === "object" ? raw : lexicalGlobal("STATES");
  const hosted = [root.__HASS__?.states, root.hass?.states].filter(
    (value) => value && typeof value === "object",
  );
  if (!hosted.length && !globalThis.__DM_SLOW_STATES__)
    return registry && typeof registry === "object" ? registry : {};
  const values = hosted.length ? Object.assign({}, ...hosted) : {};
  for (const name of ["_RAW_STATES", "STATES"]) {
    const lexical = lexicalGlobal(name);
    if (lexical && typeof lexical === "object") Object.assign(values, lexical);
  }
  return values;
}

/* «E' un contatore di vita?» — una domanda sola, e gli stati dove stanno.
 *
 * La risposta canonica e' in period-service, ed e' quella su cui si regge
 * tutto il calcolo dell'energia. Il Report ne teneva due copie private, una
 * nella riga della configurazione e una nella finestra della voce, e tutte e
 * due chiedevano gli stati a `root.STATES`: ma `STATES` e `_RAW_STATES` sono
 * binding lessicali del guscio, e da un modulo `root.STATES` e' sempre
 * `undefined`. Le due copie non hanno mai letto uno `state_class` in vita
 * loro: decidevano solo dal nome dell'entita'. Cosi' un contatore vero —
 * `sensor.lavastoviglie_energia`, `total_increasing` — si prendeva
 * «l'entita' non sembra cumulativa» e la finestra rifiutava di salvarlo.
 *
 * Qui la domanda si fa una volta, e gli stati si chiedono ad `allStates()`,
 * che sa dove il guscio li tiene. */
export function isLifetimeMeter(entity) {
  return isCumulativeEnergyEntity(entity, allStates());
}

export function readJson(key, fallback) {
  try {
    return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

/* ── si dipinge per chi guarda, e solo di cio' che e' cambiato ───────────── */

/* Le pagine restano nel documento: il guscio le nasconde, non le toglie. Una
 * sezione che ridisegna a ogni mazzetto di stati — mezzo secondo, una casa
 * vera ne manda di continuo — lavora quindi anche per le otto pagine che
 * nessuno ha davanti. Con il profilatore in mano quelle passate erano la voce
 * piu' grossa del processore, ed e' il calore del mini PC segnalato dal campo.
 *
 * La regola l'avevano gia' scritta in casa loro la Home e la scena
 * dell'Energia, ognuna a modo suo. Qui e' scritta una volta: chi disegna una
 * pagina chiede se quella pagina si vede, e chi ascolta i cambi di stato
 * chiede se il mazzetto tocca roba sua. Al ritorno sulla linguetta si ridipinge
 * comunque — le sezioni si agganciano gia' al tocco, a `pageshow` e agli
 * annunci del guscio — quindi chi arriva trova quello che c'e' adesso e non
 * quello di quando se n'e' andato.
 */

/* Chi disegna una pagina sola si rimette in moto quando quella pagina arriva.
 *
 * Le sezioni gated qui sopra saltano il giro quando la loro pagina non si vede.
 * Il tocco su una linguetta e' il momento in cui torna a vedersi, e chi
 * disegna deve rifare la passata subito: aspettare il prossimo mazzetto di
 * stati vorrebbe dire arrivare su una pagina ferma a com'era quando la si era
 * lasciata. Si ascolta in cattura e si rimanda di un giro, perche' la classe
 * `active` la scrive il guscio nel suo gestore, cioe' dopo di noi. */
export function quandoSiCambiaPagina(callback) {
  doc?.addEventListener?.(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.bottom-nav-btn,.back-home-btn"))
        root.setTimeout?.(callback, 0);
    },
    true,
  );
  root.addEventListener?.("pageshow", callback);
  return true;
}

/* La plancia si vede?
 *
 * Due cose la spengono agli occhi di chi la usa, e nessuna delle due toglie
 * niente dal documento: la scheda del browser che passa in secondo piano, e il
 * parcheggio — la plancia messa da parte da chi la ospita quando si va su
 * un'altra pagina di Home Assistant. Il segno del parcheggio lo scrive
 * `src/legacy/host.js` sulla finestra, ed e' un patto fra due programmi come
 * `__DASHBOARDMODERN_HOSTED__`: il nome sta scritto in tutti e due i posti. */
const SEGNO_DEL_PARCHEGGIO = "__DASHBOARDMODERN_PARCHEGGIATA__";

export function planciaVisibile(documento = doc) {
  if (root[SEGNO_DEL_PARCHEGGIO] === true) return false;
  return documento?.visibilityState !== "hidden";
}

/**
 * La pagina di questa sezione e' quella aperta, e la plancia si vede.
 *
 * Una pagina che non c'e' conta come visibile: chi la cerca disegna altrove —
 * un guscio fatto in un altro modo, una prova — e tacere li' vorrebbe dire
 * spegnere quella sezione per sempre invece di risparmiare un giro.
 */
export function paginaVisibile(pageId, documento = doc) {
  if (!planciaVisibile(documento)) return false;
  const pagina = documento?.getElementById?.(pageId);
  return !pagina || pagina.classList.contains("active");
}

/**
 * Il mazzetto di stati tocca una delle entita' che questa sezione usa?
 *
 * Senza elenco — una sezione che non sa dire cosa legge — si dipinge, che e'
 * come si e' sempre fatto. E un avviso che non dice quali entita' porta non si
 * scarta: e' un annuncio generico, non un mazzetto.
 */
export function ilCambioTocca(event, ids) {
  const elenco =
    ids instanceof Set
      ? ids
      : new Set((Array.isArray(ids) ? ids : [ids]).map(clean).filter(Boolean));
  if (!elenco.size) return true;
  const detail = event?.detail;
  const cambiate = detail?.entity_ids || (detail?.entity_id ? [detail.entity_id] : null);
  if (!Array.isArray(cambiate) && !cambiate) return true;
  for (const id of Array.isArray(cambiate) ? cambiate : [cambiate]) {
    if (elenco.has(clean(id))) return true;
  }
  return false;
}

/* Le cose che si guardano e basta.
 *
 * «Non e' meglio oscurare il tasto accendi/spegni sulla presa del frigo?» —
 * si', ed e' il genere di domanda che ha una risposta sola per tutta la
 * plancia. La presa del frigo, quella del modem, il congelatore in garage: il
 * tasto c'e' perche' l'entita' e' un interruttore, ma premerlo non e' mai una
 * cosa che si voleva fare, e chi lo preme spesso non e' chi ha configurato la
 * plancia.
 *
 * L'elenco sta in un posto solo e si legge da qui. La regola — cosa succede a
 * un comando che parte lo stesso — sta in `lightCommand`, che e' puro e lo
 * rifiuta: un tasto grigio che poi funziona sarebbe peggio di un tasto normale.
 */
const CHIAVE_SOLO_LETTURA = "cd_solo_lettura";

export function entitaSoloLettura() {
  const mappa = readJson(CHIAVE_SOLO_LETTURA, {});
  return mappa && typeof mappa === "object" ? mappa : {};
}

/** Se questa entita' si puo' comandare. Senza entita' la risposta e' si': non
 * e' compito di questa funzione dire che manca un'entita'. */
export function siComanda(entity, bloccate = entitaSoloLettura()) {
  const id = String(entity ?? "").trim();
  if (!id) return true;
  return bloccate[id] !== true;
}

/** Mette o toglie il blocco. Torna `true` se qualcosa e' cambiato davvero. */
export function segnaSoloLettura(entity, bloccata) {
  const id = String(entity ?? "").trim();
  if (!id) return false;
  const mappa = entitaSoloLettura();
  if (bloccata) {
    if (mappa[id] === true) return false;
    mappa[id] = true;
  } else {
    if (!(id in mappa)) return false;
    delete mappa[id];
  }
  return writeJsonIfChanged(CHIAVE_SOLO_LETTURA, mappa, { sync: false });
}

/* ── salvare una riga vuol dire salvarle tutte ────────────────────────────── */

/* Le schede a righe — le entita' in evidenza, le persone, i robot, le piscine,
 * le sezioni che si fa l'utente — hanno un salvataggio per riga e, in fondo
 * alla scheda, un unico «Salva sezione» che li preme tutti uno dopo l'altro.
 *
 * Preso alla lettera, un salvataggio per riga li' non funziona: il primo
 * scrive e ridisegna la scheda, e il ridisegno stacca dal documento i bottoni
 * che non hanno ancora avuto il loro turno — i loro tocchi cadono nel vuoto — e
 * riscrive le caselle delle righe dopo con quello che c'e' in memoria, che e'
 * appunto quello che non era ancora stato salvato. Da fuori si vede cosi': «la
 * prima entita' la memorizza, dalla seconda no» (#288).
 *
 * Chi disegna le righe le legge quindi tutte prima di scrivere. Il gesto
 * diventa idempotente: il primo tocco salva tutta la scheda, e quelli dopo non
 * hanno piu' niente da aggiungere.
 *
 * `attributo` e' il `data-*` che porta la posizione della riga, `leggi(riga,
 * voce)` legge una riga sola, e `tieni(bozza, voce)` — facoltativo — dice se
 * quella bozza vale piu' di quello che c'e' gia' scritto.
 */
export function righeDelDocumento(body, attributo, lista, leggi, tieni) {
  const next = Array.isArray(lista) ? lista.slice() : [];
  for (const riga of body?.querySelectorAll?.(`[${attributo}]`) || []) {
    const posizione = Number(riga.getAttribute(attributo));
    if (!Number.isFinite(posizione) || !next[posizione]) continue;
    const bozza = leggi(riga, next[posizione], posizione);
    if (!tieni || tieni(bozza, next[posizione], posizione)) next[posizione] = bozza;
  }
  return next;
}

/* Le righe che i moduli aggiungono alla scheda ⚙️ Impostazioni, in ordine.
 *
 * Sta scritto qui e non dentro i moduli perche' «in che ordine si leggono» e'
 * una domanda sola: sparpagliata in due file, la risposta la si ricava
 * aprendoli tutti e due. Un numero nuovo si infila in mezzo senza toccare gli
 * altri — sono distanziati apposta. */
export const ORDINE_IMPOSTAZIONI = Object.freeze({ lingua: 10, chiosco: 15, assist: 20, sezioni: 30 });

/* Da dove parte il blocco delle righe aggiunte: subito sotto il tasto «salva»
 * del blocco «Generali» del guscio, che si riconosce dal gestore e non dalla
 * scritta — quella cambia con la lingua. Il blocco pero' il guscio lo disegna
 * solo a chi puo' vederlo: dove non c'e', le righe si mettono in cima. */
export const dopoIGenerali = (corpo) => corpo?.querySelector?.('[onclick*="edSaveGeneral"]') || null;

/* L'attributo che porta il posto di una riga aggiunta da un modulo. */
export const ATTRIBUTO_ORDINE = "data-dm-ordine";

/**
 * Mette una riga in una scheda dell'editor al posto che le spetta.
 *
 * Le righe che i moduli aggiungono a una scheda del guscio — la lingua e
 * Assist nelle Impostazioni — si mettevano ognuna con la propria ancora: la
 * lingua sotto il tasto «salva» dei Generali, Assist sotto la lingua. Ma
 * l'ancora di Assist e' una riga che a quel momento puo' non esserci ancora, e
 * allora Assist ricadeva in cima alla scheda: chi si installa per primo vince,
 * e l'ordine di quello che si legge diventa l'ordine in cui i moduli si
 * caricano. «Lingua non presente nella parte iniziale del config dove c'e'
 * assistenza, prima usciva li'.»
 *
 * Qui l'ordine e' un numero che la riga si porta scritto addosso, e chi arriva
 * si mette fra chi ha un numero piu' basso e chi ce l'ha piu' alto. Arrivare
 * primo o ultimo non cambia piu' niente, e una terza riga domani non deve
 * sapere di queste due: le basta il suo numero.
 *
 * `ancora(dentro)` dice da dove parte il blocco quando la riga e' la prima ad
 * arrivare — di solito un pezzo del guscio.
 */
export function inserisciInOrdine(dentro, riga, ordine, ancora) {
  if (!dentro || !riga) return null;
  const posto = finite(ordine, 0);
  riga.setAttribute(ATTRIBUTO_ORDINE, String(posto));
  const sorelle = [...(dentro.querySelectorAll?.(`[${ATTRIBUTO_ORDINE}]`) || [])].filter(
    (nodo) => nodo !== riga && nodo.parentElement === dentro,
  );
  const dopo = sorelle.find((nodo) => finite(nodo.getAttribute(ATTRIBUTO_ORDINE), 0) > posto);
  if (dopo) dentro.insertBefore(riga, dopo);
  else if (sorelle.length) sorelle[sorelle.length - 1].after(riga);
  else {
    const partenza = ancora?.(dentro);
    if (partenza) partenza.after(riga);
    else dentro.prepend(riga);
  }
  return riga;
}

export function writeJsonIfChanged(key, value, { sync = true } = {}) {
  const serialized = JSON.stringify(value);
  if (root.localStorage?.getItem(key) === serialized) return false;
  root.localStorage?.setItem(key, serialized);
  if (sync) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  return true;
}

/* Start the dashboard over.
 *
 * Hosted, the document comes from an iframe `srcdoc`, so its URL is
 * `about:srcdoc` and `location.reload()` replaces it with a blank page in the
 * Home Assistant WebView — the plancia goes white and stays white, which is
 * what resetting the configuration used to do. The host rebuilds the document
 * when asked; standalone, an ordinary reload is still an ordinary reload. */
export function reloadDashboard() {
  try {
    if (root.__DASHBOARDMODERN_RELOAD__?.()) return true;
  } catch (_error) {}
  try {
    root.location?.reload?.();
    return true;
  } catch (_error) {
    return false;
  }
}

export function installStyle(id, css) {
  if (!doc?.head || doc.getElementById(id)) return false;
  const style = doc.createElement("style");
  style.id = id;
  style.textContent = css;
  doc.head.append(style);
  return true;
}

/*
 * Rewrite a stylesheet this section already installed.
 *
 * Copy belongs in the DOM, where the catalog and the translation pass can both
 * reach it. The one exception is a label derived from a class the legacy
 * runtime toggles: writing it in `content:` avoids duplicating that logic, at
 * the price of producing no text node. Those stylesheets have to be rebuilt
 * when the language changes, which is what this is for.
 */
export function restyleOnLocaleChange(id, build) {
  return onLocaleChange(() => {
    const style = doc?.getElementById(id);
    if (!style) return;
    const css = build();
    if (style.textContent !== css) style.textContent = css;
  });
}

/* The reading, projected onto the card as numbers the stylesheet can draw with.
 *
 * Three renderers build these cards; putting the gauge in the markup would mean
 * three copies of it. Instead each updater hands the card its reading here, and
 * the sheet draws the comfort scale and the humidity bar from these variables.
 * The scale spans 10-32 °C: below or above simply pins to the ends. */
export function applyTemperatureReading(card, temperature, humidity) {
  if (!card?.style) return false;
  const hasReading = Number.isFinite(temperature);
  if (hasReading) {
    const position = Math.min(100, Math.max(0, ((temperature - 10) / 22) * 100));
    card.style.setProperty("--dm-temp-pos", position.toFixed(1));
  } else {
    card.style.removeProperty("--dm-temp-pos");
  }
  if (Number.isFinite(humidity))
    card.style.setProperty("--dm-hum", Math.min(100, Math.max(0, humidity)).toFixed(0));
  else card.style.removeProperty("--dm-hum");
  card.dataset.dmReading = hasReading ? "on" : "off";
  card.dataset.dmHumidity = Number.isFinite(humidity) ? "on" : "off";
  return true;
}

/* One rule for the small label above the reading, wherever a card is drawn.
 *
 * It used to have three writers: the renderers wrote the generic word at
 * creation, the Beta 17 repair pass wrote the room's custom name on every card
 * of that room, and the Beta 27 sync wrote it per association. They disagreed,
 * so the label flipped between "Temperatura" and the custom name on every
 * repaint — and a real install repaints on every sensor update. The custom name
 * belongs to one association: the first one takes the room's name, an extra
 * probe takes its own, and anything unnamed falls back to the plain word. */
export function temperatureCardLabels(room = {}, entry = {}) {
  const id = clean(entry.id);
  const primary = !id || id === "primary";
  const temperature = primary ? clean(room.temp_name || room.temperature_name) : clean(entry.name);
  const humidity = primary ? clean(room.hum_name || room.humidity_name) : "";
  return {
    temperature: temperature || t("Temperatura", "Temperature"),
    humidity: humidity || t("Umidità", "Humidity"),
  };
}

/* The comfort pill next to a room name is sized for a word like CALDO. The
 * unavailable state is the only label long enough to paint out of that pill and
 * over the room name beside it, so the pill carries a short form while the full
 * wording stays in `title` and `aria-label`, and `data-comfort` keeps the value
 * the badge colours key off. */
export function comfortBadgeText(label) {
  const value = clean(label);
  if (/^(non disponibile|unavailable)$/i.test(value)) return t("N/D", "N/A");
  return value;
}

/* One way to draw an icon token, wherever it is shown.
 *
 * An `mdi:` token was written as `<ha-icon>` markup, which only paints where
 * that element is defined: in this document it is not, so the box came out
 * empty — no glyph, and not even the token as text. The canonical icon engine
 * resolves the same token to the glyph the picker itself shows while choosing,
 * so what is picked is what is drawn. `<ha-icon>` stays as a fallback for the
 * surfaces that do resolve it, and the raw token is never printed as text. */
export function writeIconGlyph(target, icon, { size = 26, fallback = "🔌", kind = "action" } = {}) {
  if (!target) return false;
  const token = clean(icon) || fallback;
  if (!/^mdi:/i.test(token)) {
    if (target.textContent !== token) target.textContent = token;
    return true;
  }
  /* Il motore, quando puo', scrive lui dentro il nodo: sa cosa c'e' gia' e non
   * lo riscrive per niente. Quando non puo' — non e' ancora salito, o il nodo
   * non e' il suo — resta il markup, che e' la stessa regola vista da fuori. */
  try {
    if (root.DashboardModernIconEngine?.render?.(target, kind, token, { size })) return true;
  } catch (_error) {}
  target.innerHTML = iconGlyphHtml(token, { size, fallback, kind });
  return true;
}

/* La stessa regola, per chi il markup se lo costruisce a stringhe.
 *
 * Mezza plancia disegna scrivendo markup — un pannello della configurazione si
 * rifa' tutto in una volta — e li' `writeIconGlyph` non si puo' chiamare:
 * serve il pezzo di testo, non il nodo. Chi ne aveva bisogno se l'e' scritto
 * per conto suo, e chi se l'e' dimenticato ha stampato il token: «mdi:sofa»
 * come parola sopra il nome della stanza, che e' esattamente la cosa che il
 * commento qui sopra promette non succeda mai.
 *
 * La regola adesso sta in una funzione sola e le due facce la dividono: quella
 * che scrive nel nodo chiama questa. `esc` sul ripiego perche' un simbolo
 * scelto a mano puo' contenere qualunque cosa, e questo esce come markup. */
export function iconGlyphHtml(icon, { size = 26, fallback = "🔌", kind = "action" } = {}) {
  const token = clean(icon) || fallback;
  if (!/^mdi:/i.test(token)) return esc(token);
  try {
    const markup = root.DashboardModernIconEngine?.markup?.(kind, token, { size });
    if (markup) return markup;
  } catch (_error) {}
  try {
    const legacy = root.cdIconMarkup?.(token, size);
    if (legacy && legacy !== token) return legacy;
  } catch (_error) {}
  return esc(fallback);
}

export function afterResult(result, callback) {
  if (result && typeof result.finally === "function") return result.finally(callback);
  callback();
  return result;
}

export function wrapFunction(name, marker, callback) {
  const current = root[name];
  if (typeof current !== "function" || current[marker]) return false;
  function wrapped(...args) {
    return afterResult(current.apply(this, args), () => root.queueMicrotask?.(callback));
  }
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

/* Ogni volta che la scheda viene rifatta, non solo quando si cambia linguetta.
 *
 * Chi aggiunge qualcosa alla configurazione — la matita sulle righe salvate, le
 * caselle in piu' di un infisso, le righe degli allagamenti — si agganciava a
 * `editorSwitch`, cioe' alla navigazione fra le linguette. Ma il corpo della
 * scheda lo rifa' anche `renderCurrentEditor`, che gira a ogni cambio del
 * modello e non passa di li': si salva una tapparella, il modello cambia, la
 * scheda viene ridisegnata da capo e tutto quello che ci avevamo messo sopra
 * sparisce. Restava la riga col solo cestino — niente matita per riaprirla — e
 * le caselle della tenda e del contatto non c'erano piu'.
 *
 * Quel ridisegno lo annuncia gia': `dashboardmodern:editor-rendered`. Le due
 * cose sono lo stesso avviso — «la scheda e' nuova, rimetti la tua roba» — e
 * chiedere entrambe una per una era il modo di dimenticarne una.
 *
 * L'ascolto si registra una volta per contrassegno: `wrapFunction` si rifiuta
 * di avvolgere due volte, ma questa funzione viene richiamata a ogni giro di
 * installazione e senza il conto si impilerebbero gli ascoltatori.
 */
export function onEditorRedraw(marker, callback) {
  const avvolto = wrapFunction("editorSwitch", marker, callback);
  const gia = (root.__dmEditorRedrawMarkers ||= new Set());
  if (!gia.has(marker)) {
    gia.add(marker);
    root.addEventListener?.("dashboardmodern:editor-rendered", () => {
      try {
        callback();
      } catch (_error) {}
    });
  }
  return avvolto;
}

/**
 * Tiene un blocco aggiunto alla scheda del Config, comunque la scheda cambi.
 *
 * `onEditorRedraw` avvisa quando la scheda si rifa' per due strade — la
 * navigazione fra le linguette e `renderCurrentEditor` — e a lungo e' bastato.
 * Non basta piu': il corpo della scheda lo rifa' anche chi salva, e chi apre la
 * finestra da un tasto qualunque della plancia. Un blocco appeso li' dentro
 * sparisce e non torna, perche' nessuno gli dice che il corpo e' un altro.
 *
 * Il caso che l'ha reso una regola e' #431: «non fa inserire altri tasti oltre
 * al primo». Aggiungere il primo tasto salva, salvare ridisegna la scheda, e il
 * blocco dei tasti su misura se ne andava con lei — il secondo «＋» non c'era
 * piu' da premere. Il blocco delle modalita', che sta due righe sopra e ha lo
 * stesso problema, se l'era gia' risolto per conto suo con un osservatore. Una
 * meta' della stessa fila sapeva rimettersi in piedi e l'altra no.
 *
 * Il corpo che cambia figli e' l'unico segnale che vuol dire davvero «la scheda
 * e' nuova»: si guarda quello, e l'osservatore si riattacca al corpo di adesso
 * — la finestra si apre e si chiude, e ogni volta il corpo e' un altro.
 *
 * `disegna` deve saper uscire subito quando non c'e' niente da rifare: qui la
 * si chiama spesso.
 */
export function tieniIlBloccoNellaScheda(marker, disegna) {
  const registro = (root.__dmBlocchiDellaScheda ||= new Map());
  const richiama = () => {
    try {
      disegna();
    } catch (_errore) {}
  };
  const aggancia = () => {
    onEditorRedraw(marker, richiama);
    const corpo = doc?.getElementById?.("ed-body");
    const suo = registro.get(marker);
    if (!corpo || suo?.corpo === corpo) return;
    suo?.osservatore?.disconnect?.();
    if (typeof root.MutationObserver !== "function") {
      registro.set(marker, { corpo, osservatore: null });
      return;
    }
    const osservatore = new root.MutationObserver(() => root.queueMicrotask?.(richiama));
    osservatore.observe(corpo, { childList: true });
    registro.set(marker, { corpo, osservatore });
  };
  if (!registro.has(marker)) {
    registro.set(marker, { corpo: null, osservatore: null });
    /* Al primo clic il corpo puo' non esserci ancora, al secondo si'. Guardare
     * ogni clic costa una ricerca per id, e smette di costare appena
     * l'osservatore e' attaccato. */
    doc?.addEventListener?.(
      "click",
      () =>
        root.queueMicrotask?.(() => {
          aggancia();
          richiama();
        }),
      true,
    );
  }
  aggancia();
  richiama();
  return aggancia;
}

export function selectedPeriod() {
  const now = new Date();
  const month = Number(doc?.getElementById("ed-sel-month")?.value);
  const year = Number(doc?.getElementById("ed-sel-year")?.value);
  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: Number.isInteger(year) && year >= 2000 ? year : now.getFullYear(),
  };
}

export function formatNumber(value, digits = 1) {
  return finite(value).toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/* Riscrive un pezzo di documento solo se quello che c'e' non e' gia' quello.
 *
 * Il paragone non si puo' fare con `innerHTML`: quello che il documento
 * restituisce non e' la stringa che gli si e' data. Il browser rinormalizza —
 * `color:var(--x,#fff)` torna indietro come `color: var(--x, #fff);`, con gli
 * spazi e il punto e virgola — quindi `nodo.innerHTML !== markup` e' vero
 * anche quando non e' cambiato niente, e si riscrive a ogni giro.
 *
 * Con decine di cambi di stato al secondo, che e' la normalita' di una casa
 * vera, quelle scritte venivano distrutte e rifatte in continuazione: e' lo
 * sfarfallio che si vedeva sull'Energia, con i pezzi che sparivano e
 * ricomparivano sotto gli occhi. Misurato sulla sezione Energia: quindicimila
 * modifiche al documento in tre secondi.
 *
 * Si confronta quello che si e' scritto, tenuto da parte sul nodo stesso —
 * cosi' se il vecchio runtime riscrive quel pezzo la firma se ne va con lui e
 * al giro dopo si ridisegna davvero.
 */
export function scriviSeCambia(nodo, markup) {
  if (!nodo) return false;
  const testo = String(markup ?? "");
  rivendica(nodo);
  /* Due domande, e servono tutt'e due. La firma dice se quello da scrivere e'
   * cambiato; il testo dice se quello che avevamo scritto c'e' ancora. Senza la
   * seconda, chi passa e riscrive quel pezzo di sua iniziativa non verrebbe mai
   * corretto: la firma resterebbe la nostra, il paragone tornerebbe, e li'
   * resterebbe la roba di un altro. Il testo si puo' confrontare — quello torna
   * indietro identico — mentre il markup no. */
  if (nodo.dataset?.dmScritto === testo && nodo.textContent === nodo.dataset.dmTesto) return false;
  nodo.innerHTML = testo;
  if (nodo.dataset) {
    nodo.dataset.dmScritto = testo;
    nodo.dataset.dmTesto = nodo.textContent;
  }
  return true;
}

/* Gli stessi due, per un attributo e per una classe, stanno nel nucleo: li
 * usano anche i moduli comuni che il guscio chiama, e una regola sola non si
 * scrive in due posti. Si riesportano da qui perche' le sezioni pescano tutto
 * da questo file. */
export { attributoSeCambia, classeSeCambia } from "../core/scrivere-se-cambia.js";

/* Lo stesso, per un testo semplice. */
export function scriviTestoSeCambia(nodo, testo) {
  if (!nodo) return false;
  const valore = String(testo ?? "");
  rivendica(nodo);
  if (nodo.textContent === valore) return false;
  nodo.textContent = valore;
  return true;
}

/* «Questo pezzo lo scrivo io.»
 *
 * Il guscio vecchio riscrive gli stessi posti dei moduli, con numeri suoi presi
 * da un'altra parte: sull'Energia il guscio legge le caselle vecchie e il
 * modulo legge Recorder, e i due numeri non sono lo stesso numero. A ogni
 * cambio di stato si riscrivevano a vicenda, e quello che si vedeva erano due
 * valori che si alternavano — lo sfarfallio, con «qualcosa sotto».
 *
 * Chi passa di qui mette un cartello sul nodo, e il guscio quel nodo non lo
 * tocca piu'. Il cartello lo mette solo chi scrive davvero: se il modulo non ha
 * i dati non scrive, non rivendica niente, e il guscio continua a fare quello
 * che ha sempre fatto. */
function rivendica(nodo) {
  if (nodo.dataset && nodo.dataset.dmPadrone !== "moduli") nodo.dataset.dmPadrone = "moduli";
}

/* Un servizio di Home Assistant, chiamato dalla plancia.
 *
 * Le strade sono tre perche' tre sono i gusci in cui la plancia gira: dentro il
 * pannello c'e' `cdCallServiceJson`, la card ha `dmCallHaService`, e la plancia
 * aperta da sola ha il vecchio `callService`. Si prova quella che c'e'.
 *
 * Questa funzione stava scritta uguale in tre sezioni — robot, luci, stanze —
 * e le tre copie si erano gia' scollate: due si mangiavano il rifiuto della
 * promessa, la terza no, e li' un servizio negato da Home Assistant finiva
 * nella console del browser come «unhandled rejection». Sta qui una volta
 * sola, e il rifiuto se lo mangia sempre: chi comanda ha gia' la sua risposta
 * dallo stato che torna indietro.
 */
export function chiamaServizio(comando) {
  if (!comando) return false;
  const nomi = ["cdCallServiceJson", "dmCallHaService", "callService"];
  for (const nome of nomi) {
    if (typeof root[nome] !== "function") continue;
    try {
      root[nome](comando.domain, comando.service, comando.data)?.catch?.(() => {});
    } catch (_errore) {
      return false;
    }
    return true;
  }
  return false;
}
