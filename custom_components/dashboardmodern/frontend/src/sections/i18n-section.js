/*
 * Language bootstrap for the hosted dashboard.
 *
 * Installed before every other section, because a section that renders first
 * and asks for its copy later would paint the shell's language for one frame.
 * It does three things and nothing else: settle the active locale, mirror it
 * onto the document, and keep the vendored runtime's own text translated.
 */

import {
  LOCALE_EVENT,
  applyDocumentLocale,
  detectLocale,
  getLocale,
  initLocale,
  isRtl,
  loadCatalog,
  localeInfo,
  setLocale,
  supportedLocales,
} from "../core/i18n.js";
import { observeTranslations, stopTranslations } from "../core/i18n-dom.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_I18N_SECTION__";
const state = (root[KEY] ||= { installed: false, stop: null });

/**
 * The vendored shells are authored in Italian and English — but the English
 * one is not fully English: dashboard-en.html and the EN runtime still carry
 * Italian markup (the energy sub-tabs «Istantanea / Giornaliera / Mensile»,
 * the flow nodes «Solare / Casa / Batteria», the solar-thermal page, the EV
 * popup). English is the pivot language, so the DOM pass resolves those via
 * the source index without fetching any catalog — which is why English runs
 * it too. Only Italian, the language the shells are truly written in, skips
 * the observer: for it the pass would be a no-op walk.
 */
function needsDomPass(locale) {
  return locale !== "it";
}

function applyDirection(locale) {
  if (!doc?.documentElement) return;
  /* A right-to-left language flips the whole shell, not just the text, so the
   * flag is also exposed as a class for the stylesheets that cannot rely on
   * `:dir()` in every supported WebView. */
  doc.documentElement.classList.toggle("dm-rtl", isRtl(locale));
}

function syncDocument(locale) {
  applyDocumentLocale(locale, doc);
  applyDirection(locale);
}

export function installI18nSection() {
  if (state.installed) return state;
  state.installed = true;

  const initial = detectLocale();
  syncDocument(initial);

  /* Public switch, so the settings page (and a browser console) can change
   * language without a reload. The promise settles once the catalog is in. */
  root.dashboardModernSetLocale = (code) =>
    setLocale(code).then((resolved) => {
      syncDocument(resolved);
      startDomPass(resolved);
      return resolved;
    });
  root.dashboardModernLocales = () =>
    supportedLocales().map((code) => ({ ...localeInfo(code) }));

  root.addEventListener?.(LOCALE_EVENT, (event) => {
    const locale = event?.detail?.locale || getLocale();
    syncDocument(locale);
  });

  /* The catalog is fetched, so it cannot be there on the first paint. The DOM
   * pass is what makes that invisible: it re-reads the rendered text once the
   * catalog lands and translates whatever was painted in the meantime. */
  initLocale(initial).then((locale) => {
    syncDocument(locale);
    startDomPass(locale);
  });

  return state;
}

function startDomPass(locale) {
  if (!needsDomPass(locale)) {
    state.stop?.();
    state.stop = null;
    return;
  }
  state.stop?.();
  state.stop = observeTranslations(doc?.body);
}

/** Test seam: unhook the observer and forget the installation. */
export function uninstallI18nSection() {
  stopTranslations();
  state.stop = null;
  state.installed = false;
}

export { loadCatalog };
