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

/* La chiave che governa le voci di un modulo, quando le voci sono tante e i
 * loro nomi si calcolano.
 *
 * Le sezioni che si fa l'utente (#262) sono N, e la chiave di ognuna nasce dal
 * suo id: `dataset.tab` non porta una costante da leggere. Ma la domanda che
 * questa prova fa non e' «come si chiama quella voce», e' «chi la spegne» — e
 * la risposta e' scritta lo stesso, nella riga con cui il modulo interroga
 * `cd_sections`. Quella e' la chiave che deve avere il suo interruttore. */
function chiaveDiGoverno(fonte) {
  const riscontro = /\[\s*([A-Z_][\w]*)\s*\]\s*===\s*false/.exec(fonte);
  if (!riscontro) return null;
  const dichiarazione = new RegExp(`\\b${riscontro[1]}\\s*=\\s*"([\\w-]+)"`).exec(fonte);
  return dichiarazione?.[1] || null;
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
      if (dichiarazione) {
        voci.push({ nome, chiave: dichiarazione[1] });
        continue;
      }
      /* Nome calcolato: allora deve dire chi lo spegne, o non lo spegne
       * nessuno — che e' esattamente il buco che questa prova tiene chiuso. */
      const governo = chiaveDiGoverno(fonte);
      assert.ok(
        governo,
        `${nome}: la voce nasce con un nome calcolato (${costante}) e il modulo non dice quale chiave di cd_sections la spegne`,
      );
      voci.push({ nome, chiave: governo });
    }
  }
  return voci;
}

/* L'unica voce senza interruttore, e il perché scritto qui perché non si
 * possa aggiungerne una seconda per distrazione.
 *
 * Il Cruscotto non compare a chi usa la plancia: la sua voce nasce solo per
 * chi tiene la repository — «solo a me esce il cruscotto nella navbar, ad
 * utenti normali non esce e quindi quel pulsante non ha senso». Una fascia
 * verde offre una scelta fra vedere e non vedere; qui la scelta non c'è,
 * perché la voce c'è per una persona sola e quella persona la vuole. Il
 * Cruscotto si governa da sé: appare col permesso di scrittura sulla
 * repository e sparisce quando quel permesso non c'è.
 *
 * Chi domani volesse aggiungere una riga a questa lista deve poter scrivere
 * la stessa frase per la sua voce: non «l'interruttore non ci sta», ma «per
 * questa voce l'interruttore non decide niente». */
const SENZA_INTERRUTTORE = new Map([
  ["cruscotto", "compare solo a chi tiene la repository, e si governa da sé"],
]);

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
  for (const { nome, chiave } of voci) {
    if (SENZA_INTERRUTTORE.has(chiave)) continue;
    assert.ok(
      interruttori.has(chiave),
      `${nome} mette "${chiave}" nella barra, ma nessuna scheda la può nascondere`,
    );
  }
});

test("le voci senza interruttore sono quelle dichiarate, e non una di più", () => {
  /* La lista è un permesso, non una scusa: vale solo per le voci che sono
   * ancora nella barra, e ognuna deve avere il suo perché scritto. */
  const nellaBarra = new Set(vociDeiModuli().map(({ chiave }) => chiave));
  for (const [chiave, perche] of SENZA_INTERRUTTORE) {
    assert.ok(
      nellaBarra.has(chiave),
      `"${chiave}" non è più una voce della barra: la riga qui sopra non serve più`,
    );
    assert.ok(perche.length > 20, `"${chiave}" è dichiarata senza dire perché`);
  }
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
