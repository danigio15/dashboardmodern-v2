import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  SOURCE_LOCALE,
  detectLocale,
  getLocale,
  intlLocale,
  isRtl,
  isSupportedLocale,
  legacyShellFor,
  localeChain,
  localeInfo,
  normalizeLocaleTag,
  pick,
  registerCatalog,
  resetCatalogs,
  resetLocale,
  resolveLocale,
  setLocale,
  supportedLocales,
  textDirection,
  translate,
} from "../src/core/i18n.js";

test.afterEach(() => {
  resetLocale();
  resetCatalogs();
});

test("a locale tag is canonicalised before anything looks at it", () => {
  assert.equal(normalizeLocaleTag("pt_br"), "pt-BR");
  assert.equal(normalizeLocaleTag("  ZH_hans_cn "), "zh-Hans-CN");
  assert.equal(normalizeLocaleTag("EN"), "en");
  assert.equal(normalizeLocaleTag(""), "");
  assert.equal(normalizeLocaleTag(null), "");
  assert.equal(normalizeLocaleTag(42), "");
});

test("a regional tag resolves onto the language we ship", () => {
  /* The whole point of the resolver: nobody has to enumerate every region. */
  assert.equal(resolveLocale("pt-BR"), "pt");
  assert.equal(resolveLocale("es-MX"), "es");
  assert.equal(resolveLocale("fr-CA"), "fr");
  assert.equal(resolveLocale("de-CH"), "de");
  assert.equal(resolveLocale("it-IT"), "it");
  assert.equal(resolveLocale("en-GB"), "en");
});

test("Chinese resolves by script, not by country", () => {
  assert.equal(resolveLocale("zh"), "zh-Hans");
  assert.equal(resolveLocale("zh-CN"), "zh-Hans");
  assert.equal(resolveLocale("zh-TW"), "zh-Hant");
  assert.equal(resolveLocale("zh-HK"), "zh-Hant");
  /* Traditional bridges to Simplified before it gives up and speaks English. */
  assert.deepEqual(localeChain("zh-Hant"), ["zh-Hant", "zh-Hans", "en"]);
});

test("an unknown language lands on English rather than on nothing", () => {
  assert.equal(resolveLocale("xx-YY"), DEFAULT_LOCALE);
  assert.equal(resolveLocale(undefined), DEFAULT_LOCALE);
  assert.equal(isSupportedLocale("xx"), false);
  assert.equal(isSupportedLocale("ja"), true);
  assert.deepEqual(localeChain("ja"), ["ja", "en"]);
});

test("every registered locale carries the metadata the UI needs", () => {
  for (const code of supportedLocales()) {
    const info = localeInfo(code);
    assert.equal(info.code, code);
    assert.ok(info.nativeName, `${code} has no native name`);
    assert.ok(["ltr", "rtl"].includes(info.dir), `${code} has no direction`);
    /* The Intl tag must be one the platform actually accepts. */
    assert.doesNotThrow(() => new Intl.NumberFormat(info.intl));
    assert.match(info.legacy, /^dashboard(-en)?\.html$/);
  }
});

test("Arabic is right-to-left and everything else is not", () => {
  assert.equal(textDirection("ar"), "rtl");
  assert.equal(isRtl("ar"), true);
  assert.equal(isRtl("ar-EG"), true);
  assert.equal(isRtl("he"), false, "Hebrew has no catalog yet, so it reads as English");
  assert.equal(isRtl("en"), false);
  assert.equal(isRtl("ja"), false);
});

test("a translation falls back to the English source, never to a key", () => {
  registerCatalog("es", { Close: "Cerrar" });
  assert.equal(translate("Close", "es"), "Cerrar");
  assert.equal(translate("Save changes", "es"), "Save changes");
  assert.equal(translate("Close", "en"), "Close");
  assert.equal(translate("", "es"), "");
});

test("a catalog is reached through the fallback chain", () => {
  registerCatalog("zh-Hans", { Close: "关闭" });
  /* Nothing is registered for Traditional, so it reads the Simplified entry. */
  assert.equal(translate("Close", "zh-Hant"), "关闭");
  registerCatalog("zh-Hant", { Close: "關閉" });
  assert.equal(translate("Close", "zh-Hant"), "關閉");
  assert.equal(translate("Close", "zh-Hans"), "关闭");
});

test("an interpolated string is matched as a pattern and recomposed", () => {
  registerCatalog("fr", {
    "${value} units": "${value} unités",
    "${open} open": "${open} ouvertes",
  });
  /* The call site already substituted the value, so only a pattern can match. */
  assert.equal(translate("3 units", "fr"), "3 unités");
  assert.equal(translate("12 open", "fr"), "12 ouvertes");
  assert.equal(translate("units", "fr"), "units", "a pattern must not match an empty capture");
});

test("a longer pattern wins over a shorter one that also matches", () => {
  registerCatalog("de", {
    "${n} open": "${n} offen",
    "${n} open today": "${n} heute offen",
  });
  assert.equal(translate("4 open today", "de"), "4 heute offen");
  assert.equal(translate("4 open", "de"), "4 offen");
});

test("pick keeps Italian for Italian and translates everyone else", () => {
  registerCatalog("fr", { "Turn off": "Éteindre" });
  assert.equal(pick("Spegni", "Turn off", "it"), "Spegni");
  assert.equal(pick("Spegni", "Turn off", "en"), "Turn off");
  assert.equal(pick("Spegni", "Turn off", "fr"), "Éteindre");
  /* A locale with no catalog reads English, which is the readable fallback. */
  assert.equal(pick("Spegni", "Turn off", "ja"), "Turn off");
});

test("with no signal at all the dashboard stays in its source language", () => {
  /* Node reports navigator.language = en-US; that must not be mistaken for a
   * user preference, or every headless render would silently become English. */
  assert.equal(detectLocale(), SOURCE_LOCALE);
});

test("the document language is followed, and a later change is picked up", () => {
  const element = { lang: "", dir: "", setAttribute() {} };
  globalThis.document = { documentElement: element };
  try {
    element.lang = "en";
    assert.equal(getLocale(), "en");
    /* The legacy shells drive the language by rewriting <html lang>, so a
     * cached first read would pin the whole session to the wrong language. */
    element.lang = "fr-CA";
    assert.equal(getLocale(), "fr");
  } finally {
    delete globalThis.document;
  }
});

test("an explicit choice outranks the document", async () => {
  const element = { lang: "en", dir: "", setAttribute() {} };
  globalThis.document = { documentElement: element };
  try {
    await setLocale("ja", { persist: false });
    assert.equal(getLocale(), "ja");
    element.lang = "it";
    assert.equal(getLocale(), "ja");
  } finally {
    delete globalThis.document;
  }
});

test("the vendored shell is chosen per locale, English for anything unshipped", () => {
  assert.equal(legacyShellFor("it"), "dashboard.html");
  assert.equal(legacyShellFor("en"), "dashboard-en.html");
  assert.equal(legacyShellFor("ja"), "dashboard-en.html");
  assert.equal(legacyShellFor("ar"), "dashboard-en.html");
});

/* Il numero lo formatta Intl, e in che lingua glielo dice intlLocale: e'
 * quello il pezzo che questo motore deve garantire. Prima la prova chiamava un
 * formatNumber esportato da qui che nessuna sezione ha mai importato — i numeri
 * della plancia passano dal formatNumber di shared.js — e cosi' l'unica cosa
 * che teneva in vita quella funzione era la prova che la provava. */
test("numbers are formatted in the locale, not in one hard-coded tag", () => {
  assert.equal(intlLocale("de"), "de-DE");
  assert.equal(new Intl.NumberFormat(intlLocale("de"), { minimumFractionDigits: 1 }).format(1234.5), "1.234,5");
  assert.equal(new Intl.NumberFormat(intlLocale("en"), { minimumFractionDigits: 1 }).format(1234.5), "1,234.5");
});
