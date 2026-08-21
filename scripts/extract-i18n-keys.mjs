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
 *   - the `{ it, en }` rows of the room, action, load-icon and appliance
 *     catalogs, which are data rather than call sites but reach the screen as
 *     picker labels and card titles all the same;
 *   - `scripts/i18n-shell-vocabulary.json`, the visible chrome of the vendored
 *     Italian shell paired with its English build by hand.
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
const SHELL_VOCABULARY = join(ROOT, "scripts/i18n-shell-vocabulary.json");
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
  return pairs;
}

/*
 * The bilingual data tables. They are imported rather than parsed: the rows are
 * assembled at module load (LOAD_ICON_CATALOG is derived from ROOM_CATALOG),
 * so only the evaluated module knows the real list.
 */
async function catalogPairs() {
  const pairs = new Map();
  const [personalization, deviceModel] = await Promise.all([
    import(pathToFileURL(join(FRONTEND, "src/core/personalization-catalog.js")).href),
    import(pathToFileURL(join(FRONTEND, "src/core/device-model.js")).href),
  ]);
  const tables = [
    personalization.ROOM_CATALOG,
    personalization.ACTION_ICON_CATALOG,
    personalization.LOAD_ICON_CATALOG,
    deviceModel.APPLIANCE_CATALOG,
  ];
  for (const table of tables) {
    for (const row of table || []) {
      if (typeof row?.it === "string" && typeof row?.en === "string" && row.en && !pairs.has(row.en)) {
        pairs.set(row.en, row.it);
      }
    }
  }
  return pairs;
}

function shellPairs() {
  const raw = JSON.parse(readFileSync(SHELL_VOCABULARY, "utf8"));
  return new Map(Object.entries(raw));
}

async function build() {
  const pairs = codePairs();
  for (const [english, italian] of await catalogPairs())
    if (!pairs.has(english)) pairs.set(english, italian);
  for (const [english, italian] of shellPairs()) if (!pairs.has(english)) pairs.set(english, italian);
  const keys = [...pairs.keys()].sort((a, b) => a.localeCompare(b, "en"));
  const index = keys
    .filter((key) => pairs.get(key) && pairs.get(key) !== key)
    .map((key) => [pairs.get(key), key])
    .sort((a, b) => a[0].localeCompare(b[0], "it"));
  return { keys, index };
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
