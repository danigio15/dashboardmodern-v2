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
 * The vendored shells are authored in Italian and English. Any other locale is
 * served one of those two and needs the DOM pass to finish the job; Italian and
 * English do not, so they skip the observer entirely and pay nothing for it.
 */
function needsDomPass(locale) {
  return locale !== "it" && locale !== "en";
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
