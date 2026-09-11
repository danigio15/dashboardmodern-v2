/* Un'entita' spenta fra gli Avvisi non sparisce dal Clima (#371).
 *
 * «Quando si imposta una VMC questa compare in moltissime sezioni nella
 *  configurazione delle entita'. E se la tolgo da una sezione per esempio
 *  allerte, sparisce anche da climate!»
 *
 * Il rilevamento degli Avvisi mette da solo OGNI entita' `climate.` nella
 * lista sorvegliata del Clima: la macchina della ventilazione compare li'
 * senza che nessuno ce l'abbia messa. Accanto le sta l'interruttore «nel
 * widget» — e la scheda degli Avvisi tiene sei liste sulla stessa pagina, per
 * cui quell'interruttore non sapeva di quale tessera parlasse e scriveva una
 * scelta valida per TUTTE. Spenta li', la macchina spariva anche dal Clima.
 *
 * Adesso le liste che una tessera ce l'hanno la dicono — le batterie, gli
 * allagamenti, il fumo, e ogni avviso personalizzato con il suo posto — e
 * quelle che non ce l'hanno l'interruttore non ce l'hanno piu': una promessa
 * che non si poteva mantenere.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};

const { GRUPPI_SENZA_TESSERA, MARCHIO_TESSERA, TESSERE_PER_GRUPPO, ilGruppoNonHaTessera, tesseraDelGruppo } =
  await import("../src/core/fuori-dai-widget.js");
const { gruppoDellAvviso, rigaSenzaTessera, tesseraDellaRiga } = await import(
  "../src/sections/widget-entity-choice-section.js"
);

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

/* Una riga della scheda Avvisi, ridotta a quello che conta: i comandi scritti
 * sui suoi tasti. E' da li' che si legge il gruppo, perche' e' struttura e
 * non parole — vale in italiano come in inglese. */
function riga(comandi, tessera = null) {
  const nodo = {
    querySelectorAll: (selettore) =>
      selettore === "[onclick]" ? comandi.map((c) => ({ getAttribute: () => c })) : [],
  };
  nodo.closest = (selettore) => {
    if (selettore === ".ed-row") return nodo;
    if (selettore === `[${MARCHIO_TESSERA}]`)
      return tessera ? { getAttribute: () => tessera } : null;
    return null;
  };
  return nodo;
}

test("il gruppo di un avviso si legge dal cestino, non dall'etichetta", () => {
  assert.equal(gruppoDellAvviso(riga(["edDelAvviso('batt','sensor.pila')"])), "batt");
  assert.equal(gruppoDellAvviso(riga(['edDelAvviso("clima","climate.comfoair")'])), "clima");
  // L'avviso personalizzato non e' un gruppo: ha un posto, ed e' un'altra cosa.
  assert.equal(
    gruppoDellAvviso(riga(["edEditAvvisoCustom(2)", "edDelAvvisoCustom(2)"])),
    "",
  );
  assert.equal(gruppoDellAvviso(riga([])), "");
  assert.equal(gruppoDellAvviso(null), "");
});

test("le liste che hanno una tessera la dicono", () => {
  assert.equal(tesseraDellaRiga(riga(["edDelAvviso('batt','sensor.pila')"])), "batterie");
  assert.equal(tesseraDellaRiga(riga(["edDelAvviso('allag','binary_sensor.acqua')"])), "allagamenti");
  assert.equal(tesseraDellaRiga(riga(["edDelAvviso('fumo','binary_sensor.fumo')"])), "fumo");
  assert.equal(tesseraDelGruppo("batt"), "batterie");
  assert.equal(tesseraDelGruppo("gruppo-che-non-esiste"), "");
  assert.equal(tesseraDelGruppo(null), "");
});

test("un avviso personalizzato parla della propria tessera, non di quella accanto", () => {
  /* La matita viene prima del cestino: guardare solo il primo tasto voleva
   * dire non trovare mai il numero. */
  assert.equal(
    tesseraDellaRiga(riga(["edEditAvvisoCustom(0)", "edDelAvvisoCustom(0)"])),
    "custom-0",
  );
  assert.equal(
    tesseraDellaRiga(riga(["edEditAvvisoCustom(3)", "edDelAvvisoCustom(3)"])),
    "custom-3",
  );
});

test("il marchio della scheda vince su tutto il resto", () => {
  // Gli allagamenti e il fumo marchiano la propria fisarmonica: e' quella la
  // risposta, e non si va a leggere il cestino.
  assert.equal(tesseraDellaRiga(riga(["edDelAvviso('allag','binary_sensor.acqua')"], "allagamenti")), "allagamenti");
});

test("le liste senza tessera non promettono un interruttore", () => {
  for (const gruppo of ["win", "luci", "clima", "risc"]) {
    assert.ok(ilGruppoNonHaTessera(gruppo), `${gruppo} dovrebbe essere senza tessera`);
    assert.ok(rigaSenzaTessera(riga([`edDelAvviso('${gruppo}','climate.comfoair')`])));
  }
  // Le tre che una tessera ce l'hanno l'interruttore lo tengono.
  for (const gruppo of Object.keys(TESSERE_PER_GRUPPO)) {
    assert.equal(ilGruppoNonHaTessera(gruppo), false);
    assert.equal(rigaSenzaTessera(riga([`edDelAvviso('${gruppo}','sensor.x')`])), false);
  }
  // Una riga qualunque, fuori dagli Avvisi, non e' senza tessera: e' solo una
  // riga di cui qui non si sa niente.
  assert.equal(rigaSenzaTessera(riga([])), false);
  // I due elenchi non si sovrappongono: un gruppo o ha una tessera o non ce l'ha.
  for (const gruppo of GRUPPI_SENZA_TESSERA)
    assert.equal(TESSERE_PER_GRUPPO[gruppo], undefined, `${gruppo} sta in tutte e due gli elenchi`);
});

test("le tessere nominate sono quelle che il ponte disegna davvero", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  for (const tessera of Object.values(TESSERE_PER_GRUPPO))
    assert.ok(
      ponte.includes(`widgetExcludedEntities("${tessera}")`),
      `nessuna tessera «${tessera}» nel ponte`,
    );
  // Gli avvisi personalizzati chiedono il proprio elenco col proprio posto.
  assert.match(ponte, /widgetExcludedEntities\(`custom-\$\{index\}`\)/);
});

test("la scheda degli Avvisi salta le righe che non hanno tessera", () => {
  const scelta = leggi("sections/widget-entity-choice-section.js");
  assert.match(scelta, /export function rigaSenzaTessera\(row\)/);
  assert.match(scelta, /if \(rigaSenzaTessera\(row\)\) \{/);
  // Chi l'aveva gia' se lo vede togliere, non resta un tasto che non fa piu'
  // quello che diceva.
  assert.match(
    scelta,
    /if \(rigaSenzaTessera\(row\)\) \{\n\s*row\.querySelector\(`\[\$\{CHOICE_ATTRIBUTE\}\]`\)\?\.remove\(\);/,
  );
});

test("gli allagamenti e il fumo marchiano la loro fisarmonica", () => {
  for (const [modulo, tessera] of [
    ["sections/flood-alerts-section.js", "allagamenti"],
    ["sections/smoke-alerts-section.js", "fumo"],
  ]) {
    const fonte = leggi(modulo);
    assert.match(fonte, new RegExp(`acc\\.setAttribute\\(MARCHIO_TESSERA, "${tessera}"\\)`));
    assert.match(fonte, /import \{ MARCHIO_TESSERA \} from "\.\.\/core\/fuori-dai-widget\.js"/);
  }
});
