import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MESSAGE_KEYS } from "./i18n-message-keys.js";
import { SOURCE_INDEX } from "../src/i18n/source-index.js";
import {
  BUILT_IN_LOCALES,
  LOCALE_REGISTRY,
  loadCatalog,
  localeBridge,
  registerCatalog,
  resetCatalogs,
  resetLocale,
  supportedLocales,
  translate,
} from "../src/core/i18n.js";

const I18N_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/i18n");
const KEYS = new Set(MESSAGE_KEYS);
const PLACEHOLDER = /\$\{[^}]*\}/g;

async function catalogFiles() {
  const names = await readdir(I18N_DIR);
  return names.filter((name) => name.endsWith(".js") && name !== "source-index.js").sort();
}

async function loadCatalogModule(name) {
  const module = await import(`../src/i18n/${name}`);
  return module.default;
}

test.afterEach(() => {
  resetLocale();
  resetCatalogs();
});

test("every catalog file names a locale the registry knows", async () => {
  for (const name of await catalogFiles()) {
    const code = name.replace(/\.js$/, "");
    assert.ok(LOCALE_REGISTRY[code], `src/i18n/${name} is not a registered locale`);
    assert.ok(
      !BUILT_IN_LOCALES.includes(code),
      `${code} needs no catalog: English is the pivot and Italian is the source`,
    );
  }
});

test("every offered locale reaches a catalog, its own or a bridged one", async () => {
  const shipped = new Set((await catalogFiles()).map((name) => name.replace(/\.js$/, "")));
  /* The picker offers every registered locale. A locale with neither a catalog
   * nor a bridge to one would be offered and then render entirely in English,
   * which is worse than not offering it: the user thinks they picked wrong. */
  const stranded = supportedLocales().filter((code) => {
    if (BUILT_IN_LOCALES.includes(code) || shipped.has(code)) return false;
    const bridge = localeBridge(code);
    return !bridge || !shipped.has(bridge);
  });
  assert.deepEqual(stranded, [], `locales offered with no reachable catalog: ${stranded.join(", ")}`);
});

test("catalogs answer the whole corpus", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    const missing = MESSAGE_KEYS.filter((key) => !catalog[key]);
    assert.deepEqual(
      missing,
      [],
      `${name} is missing ${missing.length} keys, starting with: ${missing.slice(0, 5).join(" | ")}`,
    );
  }
});

test("catalogs invent no keys of their own", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    const unknown = Object.keys(catalog).filter((key) => !KEYS.has(key));
    /* A key that is no longer in the corpus is dead weight the loader still
     * ships, and usually means a `t()` call site was reworded without the
     * catalogs following. */
    assert.deepEqual(unknown, [], `${name} has keys outside the corpus: ${unknown.slice(0, 5).join(" | ")}`);
  }
});

test("a translation keeps every placeholder its key declares", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    for (const [key, value] of Object.entries(catalog)) {
      const expected = (key.match(PLACEHOLDER) || []).slice().sort();
      const actual = (value.match(PLACEHOLDER) || []).slice().sort();
      /* Order may change — languages put the number in different places — but
       * a dropped placeholder would render "unidades" with no number at all. */
      assert.deepEqual(actual, expected, `${name}: "${key}" -> "${value}" changed its placeholders`);
    }
  }
});

test("no translation is left as its English source", async () => {
  for (const name of await catalogFiles()) {
    const catalog = await loadCatalogModule(name);
    const untouched = Object.entries(catalog)
      .filter(([key, value]) => key === value)
      /* Proper nouns, units and symbols are the same word everywhere. They are
       * listed rather than pattern-matched so a lazy copy cannot hide here. */
      .filter(([key]) => !SHARED_ACROSS_LANGUAGES.has(key))
      /* …and a few words genuinely coincide with English in one language but
       * not in the next, so those exceptions are declared per locale. */
      .filter(([key]) => !(LOCALE_IDENTITIES[name.replace(/\.js$/, "")] || new Set()).has(key))
      .map(([key]) => key);
    assert.deepEqual(untouched, [], `${name} left untranslated: ${untouched.slice(0, 8).join(" | ")}`);
  }
});

/* Strings that legitimately read the same in every language we ship. */
const SHARED_ACROSS_LANGUAGES = new Set([
  ".",
  "24 h",
  "Auto",
  "Boost",
  "Config",
  "Home Assistant entity",
  "N/A",
  "Radiators",
  "Turbo",
  "kWh/day",
  "☀️ Solar",
  "📊 Report",
  "Solar",
  "Solar ΔT",
  "Recirc.",
  "Med",
  "Med-",
  "Med+",
  "Target SoC",
  "System OK",
  "of",
  "🔥 Boiler",
]);

/*
 * Words that coincide with English in one language but not the next.
 * Kept per locale so an untranslated string cannot hide behind another
 * language's legitimate coincidence.
 */
const LOCALE_IDENTITIES = {
  es: new Set(["Color", "ideal", "Total"]),
  fr: new Set([
    "Action",
    "CCTV ACTIVE",
    "CONFIGURATION",
    "Filtration",
    "Mode",
    "PAUSE",
    "Production",
    "Recirculation",
    "Saturation",
    "Session",
    "Sessions",
    "Total",
    "Type",
    "Zone",
  ]),
  de: new Set([
    "${value} offline",
    "April",
    "August",
    "Boiler",
    "DETAILS",
    "DIMMER",
    "Name",
    "Name (A–Z)",
    "November",
    "Optional",
    "PAUSE",
    "Pool",
    "STANDBY",
    "September",
    "Server",
    "Start",
    "Zone",
    "ideal",
    "💨 Wind",
  ]),
  pt: new Set(["${value} offline", "CCTV offline", "Total", "ideal"]),
  nl: new Set([
    "${open} open",
    "${value} offline",
    "${value} units",
    "1 open",
    "1 unit",
    "Alarm",
    "April",
    "Boiler",
    "DETAILS",
    "DIMMER",
    "December",
    "Effect",
    "Label",
    "November",
    "Open",
    "September",
    "Server",
    "Start",
    "Type",
    "Zone",
    "♨️ Oven",
    "💨 Wind",
    "🛡️ ALARM",
  ]),
  pl: new Set(["${value} offline", "Alarm", "Program", "Start", "🛡️ ALARM"]),
};

test("the source index points at keys the catalogs answer", () => {
  const dangling = Object.entries(SOURCE_INDEX)
    .filter(([, english]) => !KEYS.has(english))
    .map(([italian]) => italian);
  assert.deepEqual(dangling, [], `source index entries with no corpus key: ${dangling.slice(0, 5).join(" | ")}`);
});

test("the source index maps Italian onto English, not onto itself", () => {
  const identity = Object.entries(SOURCE_INDEX).filter(([italian, english]) => italian === english);
  assert.deepEqual(identity, [], "an identity mapping earns nothing and hides a missing pair");
});

test("a catalog is fetched on demand and answers through the engine", async () => {
  const code = await loadCatalog("es-MX");
  /* The regional tag resolves to `es`, which is the file that gets fetched. */
  assert.equal(code, "es");
  assert.equal(translate("Close", "es-MX"), "Cerrar");
  assert.equal(translate("Close", "es"), "Cerrar");
});

test("an unknown locale fails soft instead of throwing", async () => {
  const code = await loadCatalog("xx");
  assert.equal(code, "en");
  assert.equal(translate("Close", "xx"), "Close");
});

test("a locale needing no catalog resolves without a fetch", async () => {
  assert.equal(await loadCatalog("en"), "en");
  assert.equal(await loadCatalog("it-IT"), "it");
});

test("registering a catalog twice merges rather than replaces", () => {
  registerCatalog("fr", { Close: "Fermer" });
  registerCatalog("fr", { Save: "Enregistrer" });
  assert.equal(translate("Close", "fr"), "Fermer");
  assert.equal(translate("Save", "fr"), "Enregistrer");
});
