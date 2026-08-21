/*
 * End to end for the language axis: does a section actually render a third
 * language?
 *
 * The unit tests above prove the engine resolves and the DOM pass rewrites.
 * What they cannot prove is that the ~620 `t(it, en)` call sites reach the
 * catalog at all — that depends on `shared.js` routing them there, which is the
 * one change that touches every screen. So this file drives the real helpers
 * against the real catalogs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadCatalog, resetCatalogs, resetLocale, setLocale } from "../src/core/i18n.js";
import { activeLocale, english, locale, rtl, t } from "../src/sections/shared.js";
import { createApplianceViewModel } from "../src/core/appliance-view-model.js";
import { loadConfigSummary } from "../src/core/energy-loads-config.js";
import { applianceCatalogLabel } from "../src/core/device-model.js";

async function speak(code) {
  await loadCatalog(code);
  await setLocale(code, { persist: false, apply: false });
}

test.afterEach(() => {
  resetLocale();
  resetCatalogs();
});

test("t() keeps Italian for Italian and English for English", async () => {
  await speak("it");
  assert.equal(t("Chiudi", "Close"), "Chiudi");
  await speak("en");
  assert.equal(t("Chiudi", "Close"), "Close");
});

test("t() renders the third language from the shipped catalog", async () => {
  /* The whole point of the change, in one assertion: the same call site, the
   * same two arguments, a language neither of them is written in. */
  await speak("ja");
  assert.equal(t("Chiudi", "Close"), "閉じる");
  assert.equal(t("Salva modifiche", "Save changes"), "変更を保存");

  await speak("de");
  assert.equal(t("Chiudi", "Close"), "Schließen");

  await speak("ar");
  assert.equal(t("Chiudi", "Close"), "إغلاق");
});

test("a regional tag reaches the catalog of its language", async () => {
  await speak("pt-BR");
  assert.equal(activeLocale(), "pt");
  assert.equal(t("Chiudi", "Close"), "Fechar");
});

test("an interpolated call site is matched as a pattern", async () => {
  await speak("de");
  /* By the time `t` sees it the value is already spliced in, so only the
   * compiled pattern can recognise this string. */
  assert.equal(t(`3 unità`, `3 units`), "3 Einheiten");
  assert.equal(t(`12 aperte`, `12 open`), "12 offen");
});

test("a locale with no catalog degrades to English, never to Italian", async () => {
  /* Swedish is not shipped yet. The failure mode that matters is a Swede
   * reading Italian, which is what the old binary switch did. */
  await speak("sv");
  assert.equal(t("Chiudi", "Close"), "Close");
});

test("english() reports the language, and rtl() reports the direction", async () => {
  await speak("en");
  assert.equal(english(), true);
  assert.equal(rtl(), false);

  await speak("ar");
  assert.equal(english(), false);
  assert.equal(rtl(), true);

  await speak("ja");
  assert.equal(rtl(), false);
});

test("numbers are formatted for the active language", async () => {
  await speak("de");
  assert.equal(locale(), "de-DE");
  assert.equal((1234.5).toLocaleString(locale(), { minimumFractionDigits: 1 }), "1.234,5");

  await speak("ja");
  assert.equal(locale(), "ja-JP");
});

test("the core view models translate too, not just the sections", async () => {
  /* `src/core` takes the locale as an argument rather than reading it, which is
   * why it needed `pick()` rather than `t()`. Same catalog either way. */
  await loadCatalog("de");
  const model = createApplianceViewModel(
    { id: "a1", name: "Lavatrice", control_entity: "switch.washer" },
    { "switch.washer": { state: "off", attributes: {} } },
    [],
    "de",
  );
  assert.equal(model.action.label, "Einschalten");
  assert.equal(model.label, "AUS");
});

test("load summaries and catalog labels follow the locale", async () => {
  await loadCatalog("fr");
  assert.equal(loadConfigSummary({ power: "sensor.x" }, "fr"), "puissance");
  assert.equal(loadConfigSummary({}, "fr"), "pas encore d'entité");
  assert.equal(applianceCatalogLabel("lavatrice", "fr"), "Lave-linge");
});

test("every shipped catalog answers a handful of load-bearing strings", async () => {
  /* A catalog that loads but answers nothing would pass the parity test on
   * disk and still render English. This checks the path end to end, for each
   * language, on strings that appear on the first screen a user sees. */
  const probes = ["Close", "Save changes", "Energy", "Appliances", "Security"];
  for (const code of ["es", "fr", "de", "pt", "nl", "pl", "ru", "tr", "ar", "hi", "ja", "ko", "zh-Hans"]) {
    resetCatalogs();
    resetLocale();
    await speak(code);
    for (const probe of probes) {
      const rendered = t("—", probe);
      assert.notEqual(rendered, probe, `${code} rendered "${probe}" untranslated`);
      assert.ok(rendered.trim(), `${code} rendered "${probe}" as empty`);
    }
  }
});
