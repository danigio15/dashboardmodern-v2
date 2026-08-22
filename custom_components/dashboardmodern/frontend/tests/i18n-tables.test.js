/*
 * Il corpus non deve poter restare indietro di nascosto.
 *
 * `scripts/extract-i18n-keys.mjs` legge le coppie scritte a mano — `t("…",
 * "…")` — e le tabelle di dati che elenca in `SECTION_TABLES`. Fra le due c'e'
 * un buco: una sezione che scrive `t(riga[0], riga[1])` su una tabella che
 * nessuno ha elencato non da' errore, non fallisce nessuna prova, e semplicemente
 * quelle stringhe non entrano in nessun catalogo. Chi non parla inglese le legge
 * in inglese e nessuno se ne accorge, perche' l'inglese e' anche il ripiego
 * legittimo.
 *
 * E' successo davvero: le didascalie dei campi dell'editor, i nomi dei colori,
 * i sottotitoli delle pagine — un'ottantina di stringhe visibili — erano fuori
 * dal corpus perche' vivevano in tabelle invece che ai punti di chiamata.
 *
 * Questa prova chiude il buco dalla parte giusta: non elenca le tabelle, elenca
 * le *indirezioni*. Ogni `t()` del livello sezioni i cui argomenti non sono
 * stringhe scritte li' deve venire da un modulo che l'estrattore sa leggere.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SECTIONS = join(HERE, "../src/sections");
const EXTRACTOR = join(HERE, "../../../../scripts/extract-i18n-keys.mjs");

/* `t(` seguito da qualcosa che non e' una virgoletta: l'argomento e' calcolato. */
const INDIRECT_CALL = /(?<![\w.$])t\(\s*(?!["'`])[A-Za-z_$]/g;

/*
 * I moduli le cui coppie l'estrattore raggiunge per altra strada.
 *
 * - `shared.js` e' dove `t` e' definita: il suo `t(it, en)` e' la definizione.
 * - `beta11-…` tiene la tabella delle icone di avviso, letta per pattern.
 * - `robot-section.js` disegna `ROBOT_ACTIONS`, che sta in `src/core` ed e' gia'
 *   fra i cataloghi importati.
 */
const REACHED_OTHERWISE = new Set([
  "shared.js",
  "beta11-real-device-polish-section.js",
  "robot-section.js",
]);

/* L'elenco si legge dal sorgente, non si importa: l'estrattore riscrive i file
 * generati appena viene caricato, e una prova non deve rigenerare niente. */
function declaredTables() {
  const source = readFileSync(EXTRACTOR, "utf8");
  const start = source.indexOf("const SECTION_TABLES");
  const block = source.slice(start, source.indexOf("]);", start));
  return [...block.matchAll(/file: "([^"]+)", name: "([^"]+)"/g)].map((match) => ({
    file: match[1],
    name: match[2],
  }));
}

test("ogni tabella bilingue del livello sezioni e' dentro il corpus", () => {
  const known = new Set([...declaredTables().map((table) => table.file), ...REACHED_OTHERWISE]);
  const scoperti = [];
  for (const name of readdirSync(SECTIONS).sort()) {
    if (!name.endsWith(".js") || known.has(name)) continue;
    const source = readFileSync(join(SECTIONS, name), "utf8");
    if (INDIRECT_CALL.test(source)) scoperti.push(name);
    INDIRECT_CALL.lastIndex = 0;
  }
  assert.deepEqual(
    scoperti,
    [],
    `t() su valori calcolati in moduli che l'estrattore non legge: ${scoperti.join(", ")}. ` +
      "Aggiungi la tabella a SECTION_TABLES in scripts/extract-i18n-keys.mjs.",
  );
});

test("ogni tabella elencata esiste ancora", () => {
  const tables = declaredTables();
  assert.ok(tables.length > 0, "nessuna tabella elencata");
  for (const table of tables) {
    const source = readFileSync(join(SECTIONS, table.file), "utf8");
    assert.ok(
      source.includes(`const ${table.name} = `),
      `${table.file}: ${table.name} non c'e' piu'`,
    );
  }
});
