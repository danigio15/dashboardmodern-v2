/*
 * Mine the bilingual vocabulary of the vendored runtime.
 *
 * The dashboard's visible text comes from three layers. Two of them the corpus
 * already reads: this codebase's own `t()` and `pick()` call sites, and the two
 * vendored HTML shells. The third is `legacy/dashboard-runtime-{it,en}.js`, 600 kB
 * of vendored build that paints the whole setup wizard, the appliance, alert and
 * light editors, and every toast they raise — and nothing read it. A French user
 * with a complete French catalog still ran the entire first-run flow in English,
 * and the suite stayed green, because a string nobody collected is a string no
 * test can miss.
 *
 * There is no `t()` to read here: the runtime ships as two forks, one per
 * language. But two forks of the same file are themselves the pair table. The
 * files are the same code — 8794 lines against 8848 — so lining them up and
 * reading off what differs recovers the vocabulary the vendor already
 * translated, in the vendor's own words.
 *
 * The output is generated, never hand-edited: `--check` fails when the vendored
 * runtime moves and this was not re-run, the same way the corpus does.
 *
 * Usage: node scripts/mine-runtime-vocabulary.mjs [--check]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEGACY = join(ROOT, "custom_components/dashboardmodern/frontend/legacy");
const OUT = join(ROOT, "scripts/i18n-runtime-vocabulary.json");

/*
 * Line up two files by the lines that can only mean one thing.
 *
 * A line that appears exactly once in each file and reads identically is the
 * same line — there is nothing else it could be. Those are the anchors; between
 * two of them each file has a span, and when the spans are the same length the
 * lines inside pair up positionally. When they are not, that span is skipped:
 * an alignment that guesses would pair an Italian button with an English
 * heading and put the wrong word in thirteen catalogs.
 */
function alignByAnchors(left, right) {
  const tally = (lines) => {
    const seen = new Map();
    for (const line of lines) seen.set(line, (seen.get(line) || 0) + 1);
    return seen;
  };
  const leftCount = tally(left);
  const rightCount = tally(right);
  const rightAt = new Map();
  right.forEach((line, at) => {
    if (rightCount.get(line) === 1) rightAt.set(line, at);
  });

  /* Anchors have to advance in both files, or the spans between them overlap. */
  const anchors = [];
  left.forEach((line, at) => {
    if (leftCount.get(line) !== 1 || !rightAt.has(line)) return;
    const there = rightAt.get(line);
    while (anchors.length && anchors[anchors.length - 1][1] >= there) anchors.pop();
    anchors.push([at, there]);
  });

  const rows = [];
  let leftAt = 0;
  let rightAtIndex = 0;
  for (const [leftAnchor, rightAnchor] of [...anchors, [left.length, right.length]]) {
    const leftSpan = left.slice(leftAt, leftAnchor);
    const rightSpan = right.slice(rightAtIndex, rightAnchor);
    if (leftSpan.length === rightSpan.length)
      for (let step = 0; step < leftSpan.length; step += 1)
        rows.push([leftSpan[step], rightSpan[step]]);
    leftAt = leftAnchor + 1;
    rightAtIndex = rightAnchor + 1;
  }
  return rows;
}

/*
 * What a line of this runtime puts on the screen.
 *
 * Three shapes, each read separately so the two sides of a pair can be checked
 * to be of the same kind: text between tags, the attributes a person reads, and
 * whole string literals for the lines that raise a toast rather than build
 * markup. A fragment carrying `${`, a backtick or a brace is a template being
 * assembled and is left alone — half of it is a value, and a catalog keyed on
 * half a sentence answers nothing.
 */
function readableParts(line) {
  const parts = [];
  for (const match of line.matchAll(/>([^<>{}$`]+)</g)) parts.push(["text", match[1]]);
  for (const match of line.matchAll(/\b(placeholder|title|aria-label|alt)\s*=\s*"([^"{}$`]+)"/g))
    parts.push([match[1], match[2]]);
  for (const match of line.matchAll(/'((?:\\.|[^'\\{}$`])+)'|"((?:\\.|[^"\\{}$`])+)"/g))
    parts.push(["string", match[1] ?? match[2]]);
  return parts
    .map(([kind, raw]) => [kind, decode(raw).replace(/[ \t]+/g, " ").trim()])
    .filter(([kind, value]) => isCopy(value) && (kind !== "string" || looksWritten(value)));
}

/*
 * Copy, as opposed to code that happens to sit in quotes.
 *
 * The runtime is not minified and splices its templates by hand, so a naive
 * sweep picks up `'+(editing?'💾 Save changes':'＋ Add appliance')+'` and
 * `edToast('…'); cdSyncPush && cdSyncPush();` — expressions, not sentences.
 * It also picks up the entity examples in the editor's own placeholders
 * (`sensor.oven_power (W) or switch.oven`), which the section layer already
 * rewrites with copy of its own: collecting them here would ask thirteen
 * translators to translate an entity id.
 *
 * The last catch is that this runtime names things in Italian in the code too:
 * its editor tabs are `'sost'` and `'testi'`, its sections `'luci'` and
 * `'clima'`, and the English fork renamed some of them. Those pair up exactly
 * like copy does and are not copy — translating `'sost'` puts a Japanese word
 * where a `data-tab` value has to be. A bare lowercase word in quotes is an
 * identifier here far more often than a sentence, so string literals have to
 * earn it: a capital, a space or a mark of punctuation. Text between tags and
 * attributes are exempt — `<b>edit</b>` inside a sentence is a sentence.
 */
const SPLICE = /'\s*\+|\+\s*'|\?\s*'|\);|&&|=>|\bfunction\b|\blocalStorage\b|\bJSON\.\w/;
const ENTITY_REFERENCE = /^[a-z_]+\.[a-z_0-9]+/;

/* The escapes are the source file's, not the screen's: a toast written
 * `'Done\\u2026\\nReload'` reaches the DOM as a character and a line break, and
 * markup written `dell&#39;editor` reaches it as an apostrophe. A key still
 * carrying either spelling matches nothing the pass ever walks. */
const ENTITIES = Object.freeze({
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": "\u00a0",
});

function decode(raw) {
  let value = raw;
  try {
    value = JSON.parse(`"${raw.replace(/"/g, '\\"').replace(/\\'/g, "'")}"`);
  } catch {
    /* Not a well-formed literal on its own — read it as written. */
  }
  return value.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match]);
}

/* Half a template: the runtime splices values in by concatenation, so a literal
 * that ends on an open bracket is the front of a sentence, not a sentence. */
const DANGLING = /[([{]\s*$|^\s*[)\]}]|\s\/\s*$/;

/*
 * The handful this build offers that no rule can tell from copy: the sample
 * room names its detection writes (`Room1`), the label stub `Room -` it
 * completes at runtime, and an attribute name that survived a template.
 * Listed rather than pattern-matched, because a pattern wide enough to catch
 * them takes real copy with it.
 */
const NOT_COPY = new Set(["Room1", "Room2", "Room -", "title=", "Camera da Letto"]);

/* A quoted literal that reads as something written rather than named. */
const NAMED = /^[a-zà-ÿ]+$/;

const looksWritten = (value) => !NAMED.test(value);

function isCopy(value) {
  if (!value || value.length > 200) return false;
  if (!/[A-Za-zÀ-ÿ]{3}/.test(value)) return false;
  if (/[<>]/.test(value)) return false;
  if (SPLICE.test(value)) return false;
  if (ENTITY_REFERENCE.test(value)) return false;
  if (DANGLING.test(value)) return false;
  if (NOT_COPY.has(value)) return false;
  return true;
}

function mine() {
  const italian = readFileSync(join(LEGACY, "dashboard-runtime-it.js"), "utf8").split("\n");
  const english = readFileSync(join(LEGACY, "dashboard-runtime-en.js"), "utf8").split("\n");
  const pairs = new Map();
  let skipped = 0;
  for (const [lineIt, lineEn] of alignByAnchors(italian, english)) {
    if (lineIt === lineEn) continue;
    const there = readableParts(lineIt);
    const here = readableParts(lineEn);
    const shapeThere = there.map(([kind]) => kind).join(",");
    const shapeHere = here.map(([kind]) => kind).join(",");
    if (there.length !== here.length || shapeThere !== shapeHere) {
      skipped += 1;
      continue;
    }
    for (let step = 0; step < there.length; step += 1) {
      const [, source] = there[step];
      const [, key] = here[step];
      if (source === key) continue;
      if (!pairs.has(key)) pairs.set(key, source);
    }
  }
  return { pairs, skipped };
}

const { pairs, skipped } = mine();
const rows = [...pairs].sort((left, right) => left[0].localeCompare(right[0], "en"));
const body = `${JSON.stringify(Object.fromEntries(rows), null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== body) {
    console.error(`stale: ${OUT} — run node scripts/mine-runtime-vocabulary.mjs`);
    process.exit(1);
  }
  console.log(`runtime vocabulary up to date (${rows.length} pairs)`);
} else {
  writeFileSync(OUT, body);
  console.log(`wrote ${rows.length} pairs (${skipped} unaligned lines skipped)`);
}
