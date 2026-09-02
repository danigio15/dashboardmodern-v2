/* Ogni voce della barra deve avere il suo interruttore, e quell'interruttore
 * deve spegnerla davvero.
 *
 * «Verifica tutta la repository e vedi dove nella sezione c'è il tasto
 * "visibile e nascondi": lo deve nascondere dalla navbar, in alcuni casi non
 * funziona.»
 *
 * Aprendo la configurazione scheda per scheda e toccando ogni fascia verde, il
 * meccanismo si è rivelato sano: la fascia scrive `cd_sections`, e chi possiede
 * la voce — il guscio per le dodici che conosce, il modulo che l'ha creata per
 * le altre — la spegne. Non funzionava dove la fascia NON C'ERA: l'Agenda e la
 * Continuità avevano una voce nella barra e nessuna scheda dove metterla, e
 * quelle due voci non si potevano nascondere in nessun modo.
 *
 * Questa prova tiene chiusa la porta da cui è entrato quel buco: chi domani
 * aggiunge una pagina alla barra deve anche dire dove si spegne, o la prova
 * glielo ricorda.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { TAB_SECTION_KEYS } from "../src/sections/config-uniformity-section.js";
import { readLegacyBundle } from "./legacy-source.js";

const sezioniDir = new URL("../src/sections/", import.meta.url);
const fonti = new Map(
  readdirSync(sezioniDir)
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => [nome, readFileSync(new URL(nome, sezioniDir), "utf8")]),
);

/* Le voci che il guscio ha già scritte nel documento: `cdApplyNavVis` le
 * accende e le spegne leggendo questa mappa, chiave della configurazione →
 * voce della barra. */
function mappaDelGuscio() {
  const bundle = readLegacyBundle("dashboard.html");
  const inizio = bundle.indexOf("function cdNavVisMap()");
  assert.notEqual(inizio, -1, "cdNavVisMap non è più nel guscio");
  const corpo = bundle.slice(inizio, bundle.indexOf("}", bundle.indexOf("return", inizio)));
  return [...corpo.matchAll(/(\w+)\s*:\s*'[\w-]+'/g)].map((riscontro) => riscontro[1]);
}

/* Le voci che i moduli aggiungono a runtime: si riconoscono dal gesto con cui
 * nascono — si cerca la barra del guscio e si scrive `dataset.tab`. */
function vociDeiModuli() {
  const voci = [];
  for (const [nome, fonte] of fonti) {
    if (!fonte.includes('querySelector("nav.tabs")')) continue;
    for (const riscontro of fonte.matchAll(/\w+\.dataset\.tab\s*=\s*(\w+);/g)) {
      const costante = riscontro[1];
      const dichiarazione = new RegExp(`\\b${costante}\\s*=\\s*"([\\w-]+)"`).exec(fonte);
      assert.ok(dichiarazione, `${nome}: non trovo cosa vale ${costante}`);
      voci.push({ nome, chiave: dichiarazione[1] });
    }
  }
  return voci;
}

/* Dove si può spegnere una sezione: la tabella che mette la fascia del guscio
 * sulle schede che da sole non ce l'hanno, e le fasce che una scheda si stampa
 * da sé chiamando il guscio con la sua chiave. */
function chiaviConInterruttore() {
  const chiavi = new Set(Object.values(TAB_SECTION_KEYS));
  for (const fonte of fonti.values())
    for (const riscontro of fonte.matchAll(/cdSecToggleHtml\?\.\("([\w-]+)"\)/g))
      chiavi.add(riscontro[1]);
  return chiavi;
}

test("ogni voce che il guscio conosce ha la sua scheda con l'interruttore", () => {
  const interruttori = chiaviConInterruttore();
  for (const chiave of mappaDelGuscio())
    assert.ok(
      interruttori.has(chiave),
      `la sezione "${chiave}" non ha nessuna scheda dove nasconderla`,
    );
});

test("ogni voce nata a runtime ha la sua scheda con l'interruttore", () => {
  const interruttori = chiaviConInterruttore();
  const voci = vociDeiModuli();
  assert.ok(voci.length >= 6, "le voci create a runtime non si trovano più");
  for (const { nome, chiave } of voci)
    assert.ok(
      interruttori.has(chiave),
      `${nome} mette "${chiave}" nella barra, ma nessuna scheda la può nascondere`,
    );
});

test("l'Agenda e la Continuità sono fra quelle che si possono nascondere", () => {
  /* Erano le due che mancavano: la prova le nomina, così togliere la loro
   * scheda non passa inosservato nemmeno se un domani i moduli cambiassero
   * forma e le due prove qui sopra smettessero di vederle. */
  const interruttori = chiaviConInterruttore();
  assert.ok(interruttori.has("calendario"), "l'Agenda non si può più nascondere");
  assert.ok(interruttori.has("ups"), "la Continuità non si può più nascondere");
  assert.equal(TAB_SECTION_KEYS.agenda, "calendario");
  assert.equal(TAB_SECTION_KEYS.ups, "ups");
});

test("una voce spenta sparisce: chi la possiede legge la stessa chiave", () => {
  /* Le voci che i moduli creano non stanno nella mappa del guscio: se le
   * governano da soli, leggendo `cd_sections` con la stessa chiave che la
   * fascia scrive. Se un modulo leggesse una chiave diversa, la fascia
   * scriverebbe una preferenza che nessuno guarda — che è esattamente il
   * modo in cui un interruttore «non funziona». */
  const delGuscio = new Set(mappaDelGuscio());
  for (const { nome, chiave } of vociDeiModuli()) {
    if (delGuscio.has(chiave)) continue;
    const fonte = fonti.get(nome);
    const insegna = fonte.includes("cdNavVisMap");
    const legge = /readJson\("cd_sections"/.test(fonte);
    assert.ok(
      insegna || legge,
      `${nome} crea la voce "${chiave}" e non la spegne nessuno: né insegna la sua chiave a cdNavVisMap, né legge cd_sections`,
    );
  }
});
