/*
 * Regenerate the i18n corpus from the source.
 *
 * Two files are written and both are generated, never hand-edited:
 *   tests/i18n-message-keys.js   the English keys every catalog must answer
 *   src/i18n/source-index.js     Italian source text -> English pivot key
 *
 * The corpus is collected from every place that authors a bilingual pair:
 *   - `t(it, en)` in `src/sections`, the section layer;
 *   - `pick(it, en)` in `src/core` and `legacy/modules-entry.js`, the layers
 *     that take the locale as an argument rather than reading it;
 *   - the `COPY_SOURCE` table in `legacy/modules-entry.js`;
 *   - the `{ it, en }` rows of every table the pure core modules export, which
 *     are data rather than call sites but reach the screen as picker labels,
 *     card titles and button captions all the same;
 *   - the `[glyph, it, en, keywords]` rows of the alert-icon table, read by
 *     pattern rather than imported: it lives in a section module that installs
 *     itself on import, and the corpus is not worth a side effect;
 *   - the bilingual data tables of the section layer, listed in
 *     `SECTION_TABLES` and read the same way and for the same reason;
 *   - `scripts/i18n-runtime-vocabulary.json`, the vocabulary of the vendored
 *     runtime, mined from its Italian and English forks — the wizard, the
 *     editors and their toasts, which no call site in this repository authors,
 *     with `scripts/i18n-runtime-repairs.json` saying what its unfinished
 *     English should have read and `scripts/i18n-runtime-extras.json` carrying
 *     the few lines the two forks agree on, which no mining can pair;
 *   - `scripts/i18n-shell-vocabulary.json`, the visible chrome of the vendored
 *     Italian shell paired with its English build by hand.
 *
 * The source index gets one extra source: `scripts/i18n-shell-aliases.json`,
 * the strings the vendored English shell gets wrong. They add no keys — each
 * one points at a key the corpus already has — but they let the DOM pass repair
 * the English build in English, and carry it into every other language.
 *
 * Anything a catalog is expected to answer has to appear in one of those, which
 * is what keeps the corpus a product of the code instead of a list beside it.
 *
 * Usage: node scripts/extract-i18n-keys.mjs [--check]
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = join(ROOT, "custom_components/dashboardmodern/frontend");
const SECTIONS = join(FRONTEND, "src/sections");
const CORE = join(FRONTEND, "src/core");
const MODULES_ENTRY = join(FRONTEND, "legacy/modules-entry.js");
const ALERT_ICONS = join(FRONTEND, "src/sections/beta11-real-device-polish-section.js");
const RUNTIME_VOCABULARY = join(ROOT, "scripts/i18n-runtime-vocabulary.json");
const RUNTIME_REPAIRS = join(ROOT, "scripts/i18n-runtime-repairs.json");
const RUNTIME_EXTRAS = join(ROOT, "scripts/i18n-runtime-extras.json");
const SHELL_VOCABULARY = join(ROOT, "scripts/i18n-shell-vocabulary.json");
const SHELL_ALIASES = join(ROOT, "scripts/i18n-shell-aliases.json");
const KEYS_OUT = join(FRONTEND, "tests/i18n-message-keys.js");
const INDEX_OUT = join(FRONTEND, "src/i18n/source-index.js");

/* `t("…", "…")` / `pick("…", "…")`, in any of the three quote styles and
 * across lines. Escaped quotes inside an arm are respected, and a third
 * argument (the explicit locale `pick` takes) is allowed after the pair. */
function callRe(name) {
  return new RegExp(
    String.raw`(?<![\w.$])${name}\(\s*(["'\`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,\s*(["'\`])((?:\\.|(?!\3)[\s\S])*?)\3\s*[,)]`,
    "g",
  );
}

/* `["glyph", "…", "…", "keywords"],` — a row of the alert-icon table. */
const TUPLE_TABLE_RE = /^\s*\["[^"]*", "((?:\\.|[^"])*)", "((?:\\.|[^"])*)", "[^"]*"\],$/gm;

/* `key: ["…", "…"],` — the shape of the `COPY_SOURCE` table. */
const PAIR_TABLE_RE = /^\s*\w+: \["((?:\\.|[^"])*)", "((?:\\.|[^"])*)"\],$/gm;

function unescape(value) {
  return value.replace(/\\(['"`\\])/g, "$1");
}

function collectCalls(source, name, pairs) {
  for (const match of source.matchAll(callRe(name))) {
    const italian = unescape(match[2]);
    const english = unescape(match[4]);
    if (english && !pairs.has(english)) pairs.set(english, italian);
  }
}

function codePairs() {
  const pairs = new Map();
  for (const name of readdirSync(SECTIONS).sort()) {
    if (name.endsWith(".js")) collectCalls(readFileSync(join(SECTIONS, name), "utf8"), "t", pairs);
  }
  for (const name of readdirSync(CORE).sort()) {
    if (name.endsWith(".js")) collectCalls(readFileSync(join(CORE, name), "utf8"), "pick", pairs);
  }
  const modules = readFileSync(MODULES_ENTRY, "utf8");
  collectCalls(modules, "pick", pairs);
  for (const match of modules.matchAll(PAIR_TABLE_RE)) {
    const italian = unescape(match[1]);
    const english = unescape(match[2]);
    if (english && !pairs.has(english)) pairs.set(english, italian);
  }
  for (const match of readFileSync(ALERT_ICONS, "utf8").matchAll(TUPLE_TABLE_RE)) {
    const italian = unescape(match[1]);
    const english = unescape(match[2]);
    if (english && !pairs.has(english)) pairs.set(english, italian);
  }
  sectionTablePairs(pairs);
  return pairs;
}

/*
 * The bilingual data tables of the section layer.
 *
 * Read from the source, not imported: a section module installs itself on
 * import, which is what keeps the core catalogues in `CATALOG_MODULES` and
 * these here.
 *
 * Each one is named, with where the two halves sit in a row, because shape
 * alone cannot tell copy from data. `["Ypsilon Electric", "Ypsilon Hybrid"]`
 * in the car catalogue and `["annual_energy", "daily_energy"]` in the Energy
 * sources have exactly the form of an it/en pair and are neither: a sweep by
 * shape would ask thirteen translators for the name of a Lancia trim.
 *
 * `rows`: `values` walks an object's values, `items` an array's elements,
 * `self` treats the literal as the single row. `at` says where the Italian and
 * the English sit — an index in a tuple, a key in a row. Two arrays under those
 * names are zipped, which is how a page carries its title and its subtitle.
 *
 * A section that grows a table and forgets to list it here is caught by
 * `tests/i18n-tables.test.js`: it fails on any `t()` in the section layer whose
 * arguments are not literals and whose module is not named below.
 */
const SECTION_TABLES = Object.freeze([
  { file: "alerts-section.js", name: "GROUPS", rows: "items", at: [2, 3] },
  /* Le parole dei ruoli della card, per dire quali caselle il collegamento a
     un'integrazione ha compilato. */
  { file: "appliance-editor-section.js", name: "ROLE_WORDS", rows: "values", at: [0, 1] },
  { file: "editor-slots-section.js", name: "FIELD_CAPTIONS", rows: "values", at: [0, 1] },
  { file: "editor-slots-section.js", name: "PLACEHOLDERS", rows: "values", at: [0, 1] },
  { file: "editor-slots-section.js", name: "GENERIC_PLACEHOLDER", rows: "self", at: [0, 1] },
  { file: "editor-slots-section.js", name: "SLOT_LABELS", rows: "values", at: [0, 1] },
  { file: "energy-guidance-section.js", name: "CLASH_LABELS", rows: "values", at: [0, 1] },
  { file: "energy-section.js", name: "TOTAL_FIELDS", rows: "items", at: [3, 4] },
  { file: "il-popup-della-lavatrice-section.js", name: "CASELLE", rows: "items", at: ["it", "en"] },
  /* Le caselle della caldaia e i loro aiuti (#253, #274): erano scritte in
     tupla e stavano fuori dai cataloghi — tredici lingue le leggevano in
     italiano. */
  { file: "impianti-termici-editor-section.js", name: "CAMPI_CALDAIA", rows: "values", at: ["it", "en"] },
  { file: "impianti-termici-editor-section.js", name: "CAMPI_CALDAIA", rows: "values", at: ["aiutoIt", "aiutoEn"] },
  { file: "lights-scene-section.js", name: "SWATCHES", rows: "items", at: ["it", "en"] },
  { file: "people-section.js", name: "ACTIVITY_LABELS", rows: "values", at: [0, 1] },
  { file: "lights-scene-section.js", name: "KELVIN_PRESETS", rows: "items", at: ["it", "en"] },
  { file: "home-widgets-section.js", name: "CASELLE_MINIPC", rows: "items", at: ["it", "en"] },
  { file: "minipc-showcase-section.js", name: "GROUPS", rows: "items", at: ["it", "en"] },
  { file: "page-masthead-section.js", name: "PAGES", rows: "items", at: ["it", "en"] },
  { file: "pool-editor-section.js", name: "CAMPI", rows: "items", at: [1, 2] },
  { file: "rooms-page-section.js", name: "BLOCK_LABELS", rows: "values", at: [0, 1] },
  { file: "unified-editors-section.js", name: "ACTION_TYPES", rows: "items", at: [2, 3] },
]);

/* The literal a `const NAME = …;` is declared with, balanced by brackets so a
 * nested table does not end it early. */
function declaredLiteral(source, name) {
  const start = source.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`${name}: not declared`);
  let depth = 0;
  let quote = "";
  for (let at = start; at < source.length; at += 1) {
    const char = source[at];
    if (quote) {
      if (char === "\\") at += 1;
      else if (char === quote) quote = "";
      continue;
    }
    /* Comments are skipped whole. A table may carry an explanation next to a
     * row, and an apostrophe inside it — «l'intestazione», «e' nato» — would
     * otherwise open a string that never closes, and the scan would run off
     * the end of the file reporting the table as unterminated. */
    if (char === "/" && source[at + 1] === "/") {
      const fine = source.indexOf("\n", at);
      at = fine < 0 ? source.length : fine;
      continue;
    }
    if (char === "/" && source[at + 1] === "*") {
      const fine = source.indexOf("*/", at + 2);
      if (fine < 0) break;
      at = fine + 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth -= 1;
    else if (char === ";" && depth === 0)
      return source.slice(source.indexOf("= ", start) + 2, at);
  }
  throw new Error(`${name}: never closed`);
}

/* The table itself. `Object.freeze` is the only call these literals make, and
 * evaluating it here costs nothing — but nothing else is allowed to run, so a
 * table that grows a computed row is a parse error rather than a silent
 * omission. */
function tableValue(source, name) {
  const literal = declaredLiteral(source, name);
  /* Strings first: `["Instant power (W)"]` is a literal, not a call. */
  const code = literal
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""')
    .replace(/Object\.freeze\s*\(/g, "(");
  if (/[A-Za-z_$][\w$]*\s*\(/.test(code)) throw new Error(`${name}: not a plain literal`);
  return new Function("Object", `return (${literal});`)(Object);
}

function sectionTablePairs(pairs) {
  const sources = new Map();
  for (const table of SECTION_TABLES) {
    if (!sources.has(table.file))
      sources.set(table.file, readFileSync(join(SECTIONS, table.file), "utf8"));
    const value = tableValue(sources.get(table.file), table.name);
    const rows =
      table.rows === "self" ? [value] : table.rows === "values" ? Object.values(value) : value;
    for (const row of rows) {
      const italian = row?.[table.at[0]];
      const english = row?.[table.at[1]];
      if (Array.isArray(italian) && Array.isArray(english)) {
        for (let at = 0; at < Math.min(italian.length, english.length); at += 1)
          if (typeof english[at] === "string" && english[at] && !pairs.has(english[at]))
            pairs.set(english[at], italian[at]);
        continue;
      }
      if (typeof italian !== "string" || typeof english !== "string" || !english) continue;
      if (!pairs.has(english)) pairs.set(english, italian);
    }
  }
}

/*
 * Pure core modules that carry bilingual data tables. They are imported rather
 * than parsed, because some tables are assembled at module load — LOAD_ICON_CATALOG
 * is derived from ROOM_CATALOG — so only the evaluated module knows the real list.
 * These three read no DOM and register nothing; a section module would install
 * itself on import, which is why none is listed here.
 */
const CATALOG_MODULES = Object.freeze([
  "src/core/personalization-catalog.js",
  "src/core/device-model.js",
  "src/core/robot-model.js",
  "src/core/cover-kind.js",
  "src/core/impianti-termici.js",
  /* Le parole delle fasi di un ciclo — Lavaggio, Risciacquo, Centrifuga — che
     la card e la finestra del dettaglio scrivono per dire cosa sta facendo
     l'apparecchio adesso. */
  "src/core/appliance-program.js",
]);

/*
 * Every `{ it, en }` row of every array those modules export.
 *
 * Two shapes are recognised: a list of rows carrying `it` and `en`, and an
 * object whose values are `[italian, english]` pairs. Deliberately not a list of
 * table names: a release that adds a section usually adds a table with it, and a
 * corpus that has to be told about each one is a corpus that quietly falls
 * behind. Anything else is ignored — without both halves it is not a pair.
 */
async function catalogPairs() {
  const pairs = new Map();
  const modules = await Promise.all(
    CATALOG_MODULES.map((path) => import(pathToFileURL(join(FRONTEND, path)).href)),
  );
  const add = (italian, english) => {
    if (typeof italian !== "string" || typeof english !== "string" || !english) return;
    if (!pairs.has(english)) pairs.set(english, italian);
  };
  for (const module of modules) {
    for (const exported of Object.values(module)) {
      if (Array.isArray(exported)) {
        /* A table of rows: `{ it, en, … }`. */
        for (const row of exported) add(row?.it, row?.en);
      } else if (exported && typeof exported === "object") {
        /* A table keyed by state: `{ docked: ["Alla base", "Docked"] }`. */
        for (const value of Object.values(exported)) {
          if (Array.isArray(value) && value.length === 2) add(value[0], value[1]);
        }
      }
    }
  }
  return pairs;
}

/*
 * The vocabulary of the vendored runtime, mined from its own two forks by
 * `scripts/mine-runtime-vocabulary.mjs`.
 *
 * This is the layer that painted the whole setup wizard, the appliance, alert
 * and light editors and every toast they raise — four hundred strings that were
 * outside the corpus while the suite was green, because nothing read a 600 kB
 * vendored build. A user with a complete catalog still met the first-run flow
 * in English.
 *
 * Its English half is also unfinished. The build was translated by
 * find-and-replace — "Potenza batteria (W)" came out "Power batteria (W)" — so
 * `i18n-runtime-repairs.json` says what each of those should have read. The
 * repaired English is the key, and both spellings reach it: the Italian one
 * because it is the pair's own source, the broken English one because it is
 * what the English build actually paints. English is repaired here by the same
 * lookup that serves Japanese, rather than by a patch to a vendored file that
 * comes back on the next sync.
 */
function runtimePairs() {
  const raw = JSON.parse(readFileSync(RUNTIME_VOCABULARY, "utf8"));
  const repairs = liveRepairs();
  const pairs = new Map();
  for (const [english, italian] of Object.entries(raw)) {
    const key = repairs.get(english) ?? english;
    if (!pairs.has(key)) pairs.set(key, italian);
  }
  return pairs;
}

/*
 * What the mining cannot reach.
 *
 * Two forks of one file are a pair table only where they disagree. Where the
 * English build simply kept the Italian — `Riconnessione...` — or where both
 * print the same word — `Standby` — the lines are identical and there is
 * nothing to read off. Those are written by hand here, and so is the rare line
 * the aligner has to skip because the two forks differ around it by more lines
 * than they share.
 */
function runtimeExtras() {
  const raw = JSON.parse(readFileSync(RUNTIME_EXTRAS, "utf8"));
  return new Map(Object.entries(raw).filter(([key]) => !key.startsWith("_")));
}

/* Broken English painted by the vendored runtime -> the English it should be.
 * Comment fields are skipped, as in the shell aliases. */
function runtimeRepairs() {
  const raw = JSON.parse(readFileSync(RUNTIME_REPAIRS, "utf8"));
  return new Map(Object.entries(raw).filter(([key]) => !key.startsWith("_")));
}

/*
 * The repairs that still have something to repair.
 *
 * The runtime is vendored and moves: a release that rewrites the alarm section
 * takes "Armamento Total" with it, and the entry that pointed at it now names
 * a key nobody authors. Those are dropped here rather than fatal — a stale
 * repair is a tidying job, not a broken build — and `tests/i18n-runtime.test.js`
 * fails on them so the tidying actually happens.
 */
function liveRepairs() {
  const mined = JSON.parse(readFileSync(RUNTIME_VOCABULARY, "utf8"));
  return new Map([...runtimeRepairs()].filter(([broken]) => broken in mined));
}

function shellPairs() {
  const raw = JSON.parse(readFileSync(SHELL_VOCABULARY, "utf8"));
  return new Map(Object.entries(raw));
}

/* Broken source text -> the key it should have had. Comment fields are skipped. */
function shellAliases() {
  const raw = JSON.parse(readFileSync(SHELL_ALIASES, "utf8"));
  return new Map(Object.entries(raw).filter(([key]) => !key.startsWith("_")));
}

async function build() {
  /*
   * Two different collections, on purpose.
   *
   * `pairs` answers "what are the keys": one entry per English string, first
   * author wins, because the key list only needs the string itself.
   *
   * `index` answers "what did the runtime just paint": many Italian strings can
   * point at the same English key, and they must all be kept. The Italian shell
   * says "Chiaro" where a section says "Luce"; both are the key "Light", and
   * dropping either leaves that text untranslatable in every language.
   */
  const pairs = new Map();
  const index = new Map();

  /*
   * Weakest first, and later wins.
   *
   * The same Italian word is not always the same English one: "Energia" is
   * Power on a card and Energy in the navigation, "Auto" is a car and also
   * automatic. The index has to pick one, and the right tie-break is what the
   * *vendored build* means by it, because the index exists for the DOM pass and
   * the DOM pass only ever sees text the vendored build painted. A section's
   * own wording never reaches it: `t()` goes straight to the catalog.
   *
   * So the vendored builds outrank the call sites — the runtime first, then the
   * shell, whose pairs a person wrote by hand against a build they read — and
   * the alias file, where a human wrote the answer down, outranks everything.
   */
  const sources = [codePairs(), await catalogPairs(), runtimePairs(), runtimeExtras(), shellPairs()];
  for (const source of sources) {
    for (const [english, italian] of source) {
      if (!pairs.has(english)) pairs.set(english, italian);
      if (!italian || italian === english) continue;
      index.set(italian, english);
    }
  }

  /* The broken spellings are sources for the index, never keys: a catalog asked
   * to answer "Power batteria (W)" would be asked to keep the mistake. */
  for (const [broken, english] of liveRepairs()) {
    if (!pairs.has(english)) throw new Error(`a repair points at a key nothing authors: ${english}`);
    pairs.delete(broken);
    index.set(broken, english);
  }

  const keys = [...pairs.keys()].sort((a, b) => a.localeCompare(b, "en"));
  const known = new Set(keys);
  for (const [source, english] of shellAliases()) {
    if (!known.has(english)) throw new Error(`alias points at a key outside the corpus: ${english}`);
    if (source !== english) index.set(source, english);
  }

  return {
    keys,
    index: [...index].sort((a, b) => a[0].localeCompare(b[0], "it")),
  };
}

function keysModule(keys) {
  return `/*
 * The canonical English message keys every catalog must answer.
 *
 * It lives with the tests rather than in \`src/i18n\`, because nothing in the
 * running dashboard needs the list: a catalog answers the keys it has and the
 * engine falls back to the English source for the rest. What the list is for is
 * the parity check — a language file that quietly stops halfway still renders,
 * so the only way that gets noticed is a test that knows the full set.
 *
 * Keys containing \`\${…}\` are interpolation patterns. They never reach \`t()\` as
 * literals, so the engine compiles them into anchored regexes and splices the
 * captured values back into the translated template in the same order.
 *
 * Generated by \`node scripts/extract-i18n-keys.mjs\`. Do not edit by hand.
 */

export const MESSAGE_KEYS = Object.freeze([
${keys.map((key) => `  ${JSON.stringify(key)},`).join("\n")}
]);

export default MESSAGE_KEYS;
`;
}

function indexModule(index) {
  return `/*
 * Italian source text -> English pivot key.
 *
 * Catalogs are keyed by the English string, but the vendored Italian shell and
 * the Italian runtime build paint Italian text straight into the DOM. The DOM
 * pass uses this index to find the pivot key for that text before translating,
 * which is what lets a single set of catalogs cover both vendored builds.
 *
 * Generated by \`node scripts/extract-i18n-keys.mjs\`. Do not edit by hand.
 */

export const SOURCE_INDEX = Object.freeze({
${index.map(([italian, english]) => `  ${JSON.stringify(italian)}: ${JSON.stringify(english)},`).join("\n")}
});

/** English pivot key for a raw Italian string, or null when it is not ours. */
export function pivotKey(text) {
  if (typeof text !== "string") return null;
  return SOURCE_INDEX[text] || null;
}

export default SOURCE_INDEX;
`;
}

const { keys, index } = await build();
const keysSource = keysModule(keys);
const indexSource = indexModule(index);

if (process.argv.includes("--check")) {
  let stale = false;
  for (const [path, expected] of [
    [KEYS_OUT, keysSource],
    [INDEX_OUT, indexSource],
  ]) {
    if (readFileSync(path, "utf8") !== expected) {
      console.error(`stale: ${path}`);
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log(`i18n corpus up to date (${keys.length} keys)`);
} else {
  writeFileSync(KEYS_OUT, keysSource);
  writeFileSync(INDEX_OUT, indexSource);
  console.log(`wrote ${keys.length} keys and ${index.length} source-index entries`);
}
