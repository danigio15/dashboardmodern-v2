/*
 * Universal i18n engine for DashboardModern.
 *
 * The dashboard shipped as two hard-forked builds, Italian and English, and
 * every string in the section layer was a binary `t(it, en)` ternary. This
 * module keeps that call shape working while turning the language axis into an
 * open registry: any locale with a catalog under `src/i18n/<code>.js` becomes a
 * first class language, and any locale without one degrades to English instead
 * of falling back to Italian.
 *
 * Catalogs are keyed by the English source string. English is therefore the
 * pivot language: `t(it, en)` looks the English side up, the DOM pass maps
 * Italian source text to its English key first (see `source-index.js`), and a
 * missing entry always resolves to readable English rather than to a key.
 */

/** Locale metadata. `intl` is the tag handed to `Intl.*`, `legacy` the vendored shell. */
export const LOCALE_REGISTRY = Object.freeze({
  en: Object.freeze({
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    intl: "en-US",
    legacy: "dashboard-en.html",
  }),
  it: Object.freeze({
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    dir: "ltr",
    intl: "it-IT",
    legacy: "dashboard.html",
  }),
  es: Object.freeze({
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    dir: "ltr",
    intl: "es-ES",
    legacy: "dashboard-en.html",
  }),
  fr: Object.freeze({
    code: "fr",
    name: "French",
    nativeName: "Français",
    dir: "ltr",
    intl: "fr-FR",
    legacy: "dashboard-en.html",
  }),
  de: Object.freeze({
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    dir: "ltr",
    intl: "de-DE",
    legacy: "dashboard-en.html",
  }),
  pt: Object.freeze({
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    dir: "ltr",
    intl: "pt-PT",
    legacy: "dashboard-en.html",
  }),
  nl: Object.freeze({
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
    dir: "ltr",
    intl: "nl-NL",
    legacy: "dashboard-en.html",
  }),
  pl: Object.freeze({
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
    dir: "ltr",
    intl: "pl-PL",
    legacy: "dashboard-en.html",
  }),
  ru: Object.freeze({
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    dir: "ltr",
    intl: "ru-RU",
    legacy: "dashboard-en.html",
  }),
  tr: Object.freeze({
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    dir: "ltr",
    intl: "tr-TR",
    legacy: "dashboard-en.html",
  }),
  ar: Object.freeze({
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
    intl: "ar",
    legacy: "dashboard-en.html",
  }),
  hi: Object.freeze({
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    dir: "ltr",
    intl: "hi-IN",
    legacy: "dashboard-en.html",
  }),
  ja: Object.freeze({
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    dir: "ltr",
    intl: "ja-JP",
    legacy: "dashboard-en.html",
  }),
  ko: Object.freeze({
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    dir: "ltr",
    intl: "ko-KR",
    legacy: "dashboard-en.html",
  }),
  "zh-Hans": Object.freeze({
    code: "zh-Hans",
    name: "Chinese (Simplified)",
    nativeName: "简体中文",
    dir: "ltr",
    intl: "zh-Hans",
    legacy: "dashboard-en.html",
  }),
  "zh-Hant": Object.freeze({
    code: "zh-Hant",
    name: "Chinese (Traditional)",
    nativeName: "繁體中文",
    dir: "ltr",
    intl: "zh-Hant",
    legacy: "dashboard-en.html",
  }),
});

export const DEFAULT_LOCALE = "en";
/** The language the section layer is authored in; `t(it, en)` passes it verbatim. */
export const SOURCE_LOCALE = "it";
/** Locales the engine translates without loading a catalog. */
export const BUILT_IN_LOCALES = Object.freeze([DEFAULT_LOCALE, SOURCE_LOCALE]);

/**
 * Regional and legacy tags that resolve onto a supported locale.
 * Only entries that are not already handled by plain subtag truncation.
 */
const LOCALE_ALIASES = Object.freeze({
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-my": "zh-Hans",
  "zh-hans": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  "zh-hant": "zh-Hant",
  cmn: "zh-Hans",
  yue: "zh-Hant",
  in: "id",
  iw: "he",
  ji: "yi",
  no: "nb",
  mo: "ro",
  tl: "fil",
  "pt-br": "pt",
  "es-419": "es",
});

/**
 * Last-resort bridges between related locales, applied after truncation so a
 * traditional-Chinese browser still reads Chinese rather than English.
 */
const LOCALE_FALLBACKS = Object.freeze({ "zh-Hant": "zh-Hans" });

const LOWER_TO_CODE = new Map(
  Object.keys(LOCALE_REGISTRY).map((code) => [code.toLowerCase(), code]),
);

/** Locales that can be selected, in a stable display order. */
export function supportedLocales() {
  return Object.keys(LOCALE_REGISTRY);
}

export function localeInfo(code) {
  return LOCALE_REGISTRY[resolveLocale(code)];
}

/**
 * Canonicalise a BCP 47-ish tag: `pt_br` and `PT-BR` both become `pt-BR`.
 * Invalid input collapses to an empty string so callers can fall through.
 */
export function normalizeLocaleTag(tag) {
  const raw = String(tag ?? "")
    .trim()
    .replace(/_/g, "-");
  if (!raw) return "";
  const parts = raw.split("-").filter(Boolean);
  if (!parts.length) return "";
  const out = [parts[0].toLowerCase()];
  for (const part of parts.slice(1)) {
    if (part.length === 4 && /^[A-Za-z]+$/.test(part))
      out.push(part[0].toUpperCase() + part.slice(1).toLowerCase());
    else if (part.length === 2 && /^[A-Za-z]+$/.test(part)) out.push(part.toUpperCase());
    else out.push(part.toLowerCase());
  }
  return out.join("-");
}

/**
 * Map any locale tag onto a supported locale code.
 *
 * The chain is: exact match, alias table, progressive subtag truncation, then
 * related-locale bridges. Anything unknown lands on English.
 */
export function resolveLocale(tag) {
  const normalized = normalizeLocaleTag(tag);
  if (!normalized) return DEFAULT_LOCALE;
  let candidate = normalized;
  const seen = new Set();
  while (candidate && !seen.has(candidate)) {
    seen.add(candidate);
    const lower = candidate.toLowerCase();
    if (LOWER_TO_CODE.has(lower)) return LOWER_TO_CODE.get(lower);
    if (LOCALE_ALIASES[lower]) {
      candidate = LOCALE_ALIASES[lower];
      continue;
    }
    const cut = candidate.lastIndexOf("-");
    if (cut <= 0) break;
    candidate = candidate.slice(0, cut);
  }
  return DEFAULT_LOCALE;
}

/** True when the tag maps onto a locale we ship rather than onto the default. */
export function isSupportedLocale(tag) {
  const normalized = normalizeLocaleTag(tag);
  if (!normalized) return false;
  return (
    resolveLocale(normalized) !== DEFAULT_LOCALE || normalized.toLowerCase().split("-")[0] === "en"
  );
}

/** Ordered lookup chain for a locale, always ending in English. */
export function localeChain(code) {
  const resolved = resolveLocale(code);
  const chain = [resolved];
  let bridge = LOCALE_FALLBACKS[resolved];
  while (bridge && !chain.includes(bridge)) {
    chain.push(bridge);
    bridge = LOCALE_FALLBACKS[bridge];
  }
  if (!chain.includes(DEFAULT_LOCALE)) chain.push(DEFAULT_LOCALE);
  return chain;
}

/* ------------------------------------------------------------------ */
/* Catalogs                                                            */
/* ------------------------------------------------------------------ */

/** code -> { exact: Map<string,string>, patterns: Array<{ re, template }> } */
const catalogs = new Map();
const pendingLoads = new Map();

/**
 * Interpolated call sites reach `t()` with the placeholder already replaced,
 * so `${value} units` can never match by identity. Entries that still carry a
 * `${…}` placeholder are compiled into anchored patterns whose captures are
 * spliced back into the translated template in the same order.
 */
function compilePattern(key, value) {
  const placeholders = [];
  let source = "^";
  const re = /\$\{[^}]*\}/g;
  let last = 0;
  let match;
  while ((match = re.exec(key))) {
    source += escapeRegex(key.slice(last, match.index));
    source += "([\\s\\S]+?)";
    placeholders.push(match[0]);
    last = match.index + match[0].length;
  }
  source += `${escapeRegex(key.slice(last))}$`;
  return {
    re: new RegExp(source),
    template: value,
    placeholders,
    literal: key.replace(re, "").length,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Register (or merge) a catalog of English-source -> translation entries. */
export function registerCatalog(code, entries) {
  const resolved = normalizeLocaleTag(code);
  const target = LOWER_TO_CODE.get(resolved.toLowerCase()) || resolved;
  if (!target || !entries || typeof entries !== "object") return;
  let catalog = catalogs.get(target);
  if (!catalog) {
    catalog = { exact: new Map(), patterns: [] };
    catalogs.set(target, catalog);
  }
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value !== "string" || !value) continue;
    if (key.includes("${")) catalog.patterns.push(compilePattern(key, value));
    else catalog.exact.set(key, value);
  }
  /* Longer literal bodies first: `${n} closed` must not swallow `${n} closed today`. */
  catalog.patterns.sort((a, b) => b.literal - a.literal);
  notify();
}

export function hasCatalog(code) {
  return catalogs.has(resolveLocale(code));
}

export function catalogSize(code) {
  const catalog = catalogs.get(resolveLocale(code));
  return catalog ? catalog.exact.size + catalog.patterns.length : 0;
}

/** Test seam: drop every registered catalog. */
export function resetCatalogs() {
  catalogs.clear();
  pendingLoads.clear();
}

function lookup(code, text) {
  const catalog = catalogs.get(code);
  if (!catalog) return null;
  const exact = catalog.exact.get(text);
  if (exact) return exact;
  for (const pattern of catalog.patterns) {
    const match = pattern.re.exec(text);
    if (!match) continue;
    let index = 0;
    return pattern.template.replace(/\$\{[^}]*\}/g, () => match[++index] ?? "");
  }
  return null;
}

/**
 * Translate an English source string into `locale`.
 * Unknown strings return the English source, never an empty value.
 */
export function translate(text, locale = getLocale()) {
  const source = typeof text === "string" ? text : String(text ?? "");
  if (!source) return source;
  for (const code of localeChain(locale)) {
    if (code === DEFAULT_LOCALE) break;
    const hit = lookup(code, source);
    if (hit) return hit;
  }
  return source;
}

/**
 * Pick between the two authored variants of a string.
 *
 * The core layer was written with `locale === "en" ? en : it` switches, which
 * silently served Italian to every locale that was not English. Routing the
 * choice through here keeps Italian for Italian, and otherwise translates the
 * English pivot into whatever locale is active.
 */
export function pick(it, en, locale = getLocale()) {
  const code = resolveLocale(locale);
  if (code === SOURCE_LOCALE) return it;
  if (typeof en !== "string" || !en) return it;
  return translate(en, code);
}

/* ------------------------------------------------------------------ */
/* Catalog loading                                                     */
/* ------------------------------------------------------------------ */

/**
 * Load the catalog for a locale. English needs none (it is the pivot) and
 * Italian is carried inline by every `t(it, en)` call site.
 *
 * A failed import is not fatal: the locale simply keeps rendering English.
 */
export function loadCatalog(code) {
  const target = resolveLocale(code);
  if (BUILT_IN_LOCALES.includes(target) || catalogs.has(target)) return Promise.resolve(target);
  const pending = pendingLoads.get(target);
  if (pending) return pending;
  const promise = import(`../i18n/${target}.js`)
    .then((module) => {
      registerCatalog(target, module.default || module.catalog || {});
      return target;
    })
    .catch((error) => {
      pendingLoads.delete(target);
      console.warn(`[dashboardmodern] no i18n catalog for "${target}"`, error);
      return DEFAULT_LOCALE;
    });
  pendingLoads.set(target, promise);
  return promise;
}

/* ------------------------------------------------------------------ */
/* Active locale                                                       */
/* ------------------------------------------------------------------ */

const root = globalThis;
export const LOCALE_STORAGE_KEY = "dashboardmodern_locale";
export const LOCALE_EVENT = "dashboardmodern:locale-changed";
export const LOCALE_OVERRIDE_GLOBAL = "__DASHBOARDMODERN_LOCALE__";

/*
 * `explicit` is set by `setLocale` / `initLocale` and always wins. Until then
 * the locale follows the document, which is what the legacy shells and the
 * tests drive: they set `<html lang>` and expect the very next render to speak
 * that language. Detection is therefore re-run whenever the observable signal
 * changes, and memoised while it does not — `t()` is on the render hot path.
 */
let explicit = null;
let detected = null;
let detectedSignature = null;
const listeners = new Set();

function localeSignature() {
  return `${root[LOCALE_OVERRIDE_GLOBAL] ?? ""}|${root.document?.documentElement?.lang ?? ""}`;
}

function readStoredLocale() {
  try {
    return root.localStorage?.getItem?.(LOCALE_STORAGE_KEY) || "";
  } catch (_error) {
    return "";
  }
}

function readQueryLocale() {
  try {
    const search = root.location?.search;
    if (!search) return "";
    return (
      new URLSearchParams(search).get("lang") || new URLSearchParams(search).get("locale") || ""
    );
  } catch (_error) {
    return "";
  }
}

/**
 * Detect the locale to start from.
 *
 * The host injects the Home Assistant user language into the hosted document,
 * which is why the global override wins: it is the only source that knows the
 * signed-in user's profile language rather than the document build variant.
 */
export function detectLocale() {
  const candidates = [
    root[LOCALE_OVERRIDE_GLOBAL],
    readStoredLocale(),
    readQueryLocale(),
    root.document?.documentElement?.lang,
    /dashboard-en\.html$/i.test(String(root.location?.pathname || "")) ? "en" : "",
    /dashboard\.html$/i.test(String(root.location?.pathname || "")) ? "it" : "",
  ];
  /*
   * `navigator.language` is deliberately not consulted. The dashboard follows
   * the Home Assistant profile language the host injects, not the browser or
   * operating system: the two routinely disagree, and a household where one
   * phone is set to English should not see a different dashboard from the
   * tablet beside it. It also keeps a headless environment (tests, SSR-ish
   * embeds) from being read as an English user because Node reports en-US.
   */
  for (const candidate of candidates) {
    const normalized = normalizeLocaleTag(candidate);
    if (normalized && isSupportedLocale(normalized)) return resolveLocale(normalized);
  }
  /*
   * With no signal at all we stay on the language the dashboard is authored in.
   * English is the *translation* fallback — the pivot a missing catalog entry
   * resolves to — but it is not the fallback *identity*: an environment with no
   * document and no navigator (a unit test, a bare embed) is not an English
   * user, and rendering the untranslated source there is the honest answer.
   */
  return SOURCE_LOCALE;
}

export function getLocale() {
  if (explicit !== null) return explicit;
  const signature = localeSignature();
  if (detected === null || signature !== detectedSignature) {
    detected = detectLocale();
    detectedSignature = signature;
  }
  return detected;
}

export function getLocaleInfo() {
  return LOCALE_REGISTRY[getLocale()];
}

/** BCP 47 tag for `Intl.NumberFormat` / `Intl.DateTimeFormat`. */
export function intlLocale(code = getLocale()) {
  return LOCALE_REGISTRY[resolveLocale(code)].intl;
}

export function textDirection(code = getLocale()) {
  return LOCALE_REGISTRY[resolveLocale(code)].dir;
}

export function isRtl(code = getLocale()) {
  return textDirection(code) === "rtl";
}

/** The vendored shell that best matches a locale. */
export function legacyShellFor(code = getLocale()) {
  return LOCALE_REGISTRY[resolveLocale(code)].legacy;
}

function notify() {
  const code = getLocale();
  for (const listener of [...listeners]) {
    try {
      listener(code);
    } catch (_error) {
      /* A broken listener must not stop the others from repainting. */
    }
  }
  try {
    root.dispatchEvent?.(new CustomEvent(LOCALE_EVENT, { detail: { locale: code } }));
  } catch (_error) {
    /* No CustomEvent outside a DOM; the listener set already ran. */
  }
}

/** Mirror the active locale onto `<html lang>` / `<html dir>`. */
export function applyDocumentLocale(code = getLocale(), document = root.document) {
  const info = LOCALE_REGISTRY[resolveLocale(code)];
  const element = document?.documentElement;
  if (!element) return;
  if (element.lang !== info.code) element.lang = info.code;
  if (element.dir !== info.dir) element.dir = info.dir;
  element.setAttribute?.("data-dm-locale", info.code);
}

/**
 * Switch locale, load its catalog and repaint.
 * Returns a promise that settles once the catalog is available.
 */
export function setLocale(code, { persist = true, apply = true } = {}) {
  const target = resolveLocale(code);
  const changed = target !== getLocale();
  explicit = target;
  if (persist) {
    try {
      root.localStorage?.setItem?.(LOCALE_STORAGE_KEY, target);
    } catch (_error) {
      /* Private-mode storage refuses writes; the in-memory locale still holds. */
    }
  }
  if (apply) applyDocumentLocale(target);
  if (changed) notify();
  return loadCatalog(target).then(() => {
    notify();
    return target;
  });
}

/** Load the detected locale's catalog. Safe to call more than once. */
export function initLocale(preferred) {
  const target = preferred ? resolveLocale(preferred) : detectLocale();
  explicit = target;
  applyDocumentLocale(target);
  return loadCatalog(target).then(() => {
    notify();
    return target;
  });
}

export function onLocaleChange(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: drop the explicit choice so the next read follows the document. */
export function resetLocale() {
  explicit = null;
  detected = null;
  detectedSignature = null;
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function formatNumber(value, options = {}, code = getLocale()) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  try {
    return new Intl.NumberFormat(intlLocale(code), options).format(parsed);
  } catch (_error) {
    return String(parsed);
  }
}

export function formatDate(value, options = {}, code = getLocale()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(intlLocale(code), options).format(date);
  } catch (_error) {
    return date.toISOString();
  }
}

/** Localised list of month names, used by the energy period pickers. */
export function monthNames(code = getLocale(), style = "long") {
  const formatter = new Intl.DateTimeFormat(intlLocale(code), { month: style, timeZone: "UTC" });
  return Array.from({ length: 12 }, (_unused, index) =>
    formatter.format(new Date(Date.UTC(2021, index, 15))),
  );
}
