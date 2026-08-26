// DM-FIX-20260812B
import { canonicalClimateType } from "../core/device-model.js";
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
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

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
      [...new Set(
        ENERGY_RUNTIME_SOURCES.filter((source) => source.group === group).flatMap((source) => [
          source.totalKey,
          ...source.periodKeys,
        ]),
      )],
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
export function sanitizeEnergyModel(value = {}, states = allStates(), resolver = root.resolveEntity) {
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
    const value = (store?.peekSection ? store.peekSection(name) : store?.getSection?.(name)) ?? fallback;
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
export function roomOptionsMarkup(selected = "", vuoto = "") {
  const stanze = section("rooms", readJson("cd_stanze", [])) || [];
  const scelto = String(selected ?? "").trim();
  const righe = (Array.isArray(stanze) ? stanze : []).map((room) => {
    const valore = String(room?.id || room?.name || "").trim();
    if (!valore) return "";
    const attiva = [room?.id, room?.name]
      .map((voce) => String(voce ?? "").trim())
      .includes(scelto);
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
export function allStates() {
  const raw = lexicalGlobal("_RAW_STATES");
  const registry = raw && typeof raw === "object" ? raw : lexicalGlobal("STATES");
  const hosted = [root.__HASS__?.states, root.hass?.states].filter(
    (value) => value && typeof value === "object",
  );
  if (!hosted.length && !globalThis.__DM_SLOW_STATES__) return registry && typeof registry === "object" ? registry : {};
  const values = hosted.length ? Object.assign({}, ...hosted) : {};
  for (const name of ["_RAW_STATES", "STATES"]) {
    const lexical = lexicalGlobal(name);
    if (lexical && typeof lexical === "object") Object.assign(values, lexical);
  }
  return values;
}

export function readJson(key, fallback) {
  try {
    return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
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
  const temperature = primary
    ? clean(room.temp_name || room.temperature_name)
    : clean(entry.name);
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
  try {
    if (root.DashboardModernIconEngine?.render?.(target, kind, token, { size })) return true;
  } catch (_error) {}
  try {
    const markup = root.DashboardModernIconEngine?.markup?.(kind, token, { size });
    if (markup) {
      target.innerHTML = markup;
      return true;
    }
  } catch (_error) {}
  try {
    const legacy = root.cdIconMarkup?.(token, size);
    if (legacy && legacy !== token) {
      target.innerHTML = legacy;
      return true;
    }
  } catch (_error) {}
  target.textContent = fallback;
  return true;
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
