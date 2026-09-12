/* «Si potrebbero inserire le entità personalizzate nelle stanze tipo
 * Automazioni? E una sezione automazioni?» (#504).
 *
 * Le due metà della richiesta hanno risposte diverse, e nessuna delle due è una
 * sezione nuova.
 *
 * La prima. La scheda «Entità mie» la stanza la chiedeva già — c'è la sua
 * tendina accanto all'entità — ma quella scelta non arrivava fino alla pagina
 * Stanze: lì si leggevano solo le assegnazioni fatte con la tendina sparsa
 * nelle altre schede. Un'automazione messa in cucina restava scritta in
 * configurazione e non compariva in nessuna stanza.
 *
 * La seconda. Una sezione tutta sua un'automazione ce l'ha già: «Sezioni mie»
 * fa esattamente questo, e fra i domini che accetta l'automazione c'è da
 * sempre. Quello che non c'era è che funzionasse: il tocco chiamava
 * `automation.toggle`, che non fa partire niente — DISABILITA l'automazione.
 * Chi si era fatto la sua sezione toccava il tasto, non succedeva niente, e
 * intanto si era spenta un'automazione di casa senza saperlo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { comandoDelDispositivo, genereDelComando } from "../src/core/comandi-accanto.js";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const { assignedItems } = await import("../src/sections/rooms-page-section.js");

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const STATI = {
  "automation.luci_sera": {
    state: "on",
    attributes: { friendly_name: "Automazione luci sera" },
  },
  "sensor.pressione": { state: "1013", attributes: { friendly_name: "Pressione" } },
};

function scrivi(chiave, valore) {
  magazzino.set(chiave, JSON.stringify(valore));
}

test("un'entità mia con la sua stanza arriva nella stanza", () => {
  magazzino.clear();
  scrivi("cd_entita_mie", [
    { entity: "automation.luci_sera", nome: "Luci sera", icona: "🌙", room_id: "r-cucina" },
    /* Senza stanza non va in nessuna stanza: è una scelta, non una mancanza. */
    { entity: "sensor.pressione", nome: "Pressione" },
  ]);
  const voci = assignedItems({}, STATI);
  assert.deepEqual(
    voci.map((voce) => voce.entity),
    ["automation.luci_sera"],
  );
  /* Il nome e l'icona sono quelli che le ha dato chi l'ha aggiunta: sono suoi,
   * e valgono più di quelli di Home Assistant. */
  assert.equal(voci[0].name, "Luci sera");
  assert.equal(voci[0].icon, "🌙");
  assert.equal(voci[0].room_id, "r-cucina");
});

test("l'assegnazione a mano resta, e comanda lei sui doppioni", () => {
  magazzino.clear();
  scrivi("cd_entita_mie", [{ entity: "automation.luci_sera", room_id: "r-cucina" }]);
  const voci = assignedItems({ "automation.luci_sera": "r-salone" }, STATI);
  /* Una riga sola, non due: due righe per la stessa entità sarebbero due volte
   * la stessa cosa nella stessa pagina. */
  assert.equal(voci.length, 1);
  /* E vince la tendina della sua riga, che è la più esplicita delle due. */
  assert.equal(voci[0].room_id, "r-salone");
});

test("chi non ha scritto niente non si ritrova niente", () => {
  magazzino.clear();
  assert.deepEqual(assignedItems({}, STATI), []);
  assert.deepEqual(assignedItems(null, STATI), []);
  /* Una configurazione storta non fa cadere la pagina delle stanze. */
  scrivi("cd_entita_mie", "non una lista");
  assert.deepEqual(assignedItems({}, STATI), []);
});

/* ── e quello che si fa partire, parte ───────────────────────────────── */

test("un'automazione si fa PARTIRE, non si disabilita", () => {
  /* Il verbo lo sa un posto solo, ed è quello che sbagliava chi lo riscriveva
   * a mano. `automation.toggle` non esegue: spegne. */
  assert.equal(genereDelComando("automation.luci_sera"), "tasto");
  assert.deepEqual(comandoDelDispositivo({ entity: "automation.luci_sera" }), {
    domain: "automation",
    service: "trigger",
    data: { entity_id: "automation.luci_sera" },
  });
});

test("le sezioni mie chiedono il verbo a chi lo sa, invece di riscriverlo", () => {
  const sorgente = leggi("sections/sezioni-mie-section.js");
  assert.match(sorgente, /const comando = comandoDelDispositivo\(\{ entity \}\) \|\| \{/);
  assert.match(sorgente, /chiamaHa\(comando\.domain, comando\.service, comando\.data\);/);
  /* La regola scritta a mano non c'è più: era lei a mandare le automazioni nel
   * «tutto il resto si inverte». */
  assert.doesNotMatch(sorgente, /dominio === "scene" \|\| dominio === "script" \? "turn_on"/);
  /* E quello che `comandi-accanto` non conosce — una luce, una sirena — resta
   * roba che si accende e si spegne: non si è tolto niente a nessuno. */
  assert.match(sorgente, /service: "toggle",/);
});

test("nella stanza quello che si fa partire ha il suo tasto", () => {
  const sorgente = leggi("sections/rooms-page-section.js");
  /* Prima una riga così portava in Home, cioè da nessuna parte utile: un
   * interruttore ce l'avevano solo luci, prese, ventole e booleani. */
  assert.match(sorgente, /function siPuoAvviare\(entity\) \{\n\s*return genereDelComando\(entity\) === "tasto" && siComanda\(entity\);/);
  assert.match(sorgente, /data-dm-stanza-avvia="\$\{esc\(entity\)\}"/);
  /* Il tocco è del tasto, non della riga: senza, far partire un'automazione
   * cambierebbe pagina — è lo stesso inciampo dell'interruttore (#467). */
  assert.match(
    sorgente,
    /const avvia = event\.target\?\.closest\?\.\("\[data-dm-stanza-avvia\]"\);[\s\S]{0,400}?event\.stopPropagation\(\);/,
  );
  /* E il comando lo costruisce chi sa i verbi. */
  assert.match(sorgente, /comandoDelDispositivo\(\{ entity \}\) : null;/);
  /* Il divieto «si vede ma non si comanda» vale anche qui. */
  assert.match(sorgente, /entity && siComanda\(entity\) \? comandoDelDispositivo/);
});
