/* Le stanze sono soltanto quelle della sezione Stanze.
 *
 * Segnalato con una schermata: cancellando una stanza, quella rinasce con un
 * nome piu' lungo — `room-room-room-room-terrazzo` — e ogni cancellazione ne
 * aggiunge uno.
 *
 * Il giro era questo. L'assegnazione di una luce porta l'IDENTIFICATIVO della
 * stanza — `room-terrazzo` — non il suo nome. Cancellata la stanza, quel valore
 * resta addosso alla luce e non si risolve piu'; chi riadottava la stanza lo
 * prendeva per un nome e ne faceva un identificativo nuovo, mettendogli davanti
 * un altro `room-`.
 *
 * La prima correzione insegnava all'adozione a distinguere un nome da un
 * identificativo. Curava il sintomo. La regola vera e' un'altra, ed e' quella
 * che questa prova sorveglia: **l'elenco delle stanze ha un padrone solo, ed e'
 * la sezione Stanze**. Nessun altro pezzo della plancia puo' aggiungerne una,
 * per nessuna ragione — nemmeno per rimediare a un'assegnazione rimasta
 * orfana. Una luce che punta a una stanza che non c'e' piu' semplicemente non
 * ha una stanza: finisce fra le altre zone, dove si vede, e la si riassegna a
 * mano. Perdere un'assegnazione si risolve in due tocchi; una stanza inventata
 * che si allunga a ogni giro non si risolve affatto, perche' chi la guarda non
 * sa da dove venga.
 *
 * La prova legge i sorgenti invece di aprire un browser perche' la regola e'
 * strutturale: non «oggi non succede», ma «non c'e' il codice per farlo
 * succedere».
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const MODULI = join(QUI, "..", "src", "sections");

/* Chi puo' riscrivere l'elenco delle stanze, e perche'.
 *
 * Un elenco di eccezioni senza le ragioni marcisce: fra sei mesi nessuno sa
 * piu' se una voce e' ancora giusta, e si aggiunge la settima senza pensarci.
 * Quindi ognuna porta il suo motivo, e i motivi sono di due tipi soltanto —
 * «dietro c'e' una persona che ha appena premuto qualcosa» e «e' la stessa
 * sezione, dal suo deposito vecchio». Qualunque altro motivo e' un secondo
 * padrone travestito. */
const PADRONI = new Map([
  // La scheda Stanze e chi la salva: qui la persona sta scrivendo l'elenco.
  ["rooms-order-editor-section.js", "e' la scheda Stanze"],
  ["unified-editors-section.js", "e' la scheda Stanze"],
  ["editor-crud-section.js", "salva quello che la scheda ha scritto"],
  ["save-engine-section.js", "salva quello che la scheda ha scritto"],
  ["config-persistence-section.js", "porta dentro un backup, che e' un elenco scelto"],
  ["beta24-energy-recovery-section.js", "ripara un deposito danneggiato, non ne inventa uno"],
  // Riconciliazione col deposito vecchio della stessa sezione: e' la sezione
  // Stanze che si rilegge da dove stava prima, non un altro che ne aggiunge.
  ["beta14-real-device-hotfix-section.js", "riconcilia cd_stanze, il deposito vecchio della sezione"],
  // Riassegnazione di una sonda dalla scheda Temperatura: modifica le stanze
  // che ci sono, non ne aggiunge nessuna — e dietro c'e' una persona.
  ["temperature-section.js", "modifica stanze esistenti, non ne aggiunge"],
]);

function moduli() {
  return readdirSync(MODULI)
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => ({ nome, testo: readFileSync(join(MODULI, nome), "utf8") }));
}

test("nessuno aggiunge stanze all'elenco fuori dalla sezione Stanze", () => {
  const colpevoli = [];
  for (const { nome, testo } of moduli()) {
    if (PADRONI.has(nome)) continue;
    /* Scrivere la sezione «rooms» e' il gesto da sorvegliare: chi la
     * sostituisce decide quali stanze esistono. */
    const righe = testo.split("\n");
    righe.forEach((riga, indice) => {
      if (/replaceSection\?\.\(\s*["']rooms["']|replaceSection\(\s*["']rooms["']/.test(riga))
        colpevoli.push(`${nome}:${indice + 1}`);
    });
  }
  assert.deepEqual(
    colpevoli,
    [],
    "questi moduli riscrivono l'elenco delle stanze senza essere la sezione " +
      `Stanze: l'elenco avrebbe due padroni.\n  ${colpevoli.join("\n  ")}`,
  );
});

test("l'adozione di una stanza da un'assegnazione non esiste piu'", () => {
  const testo = readFileSync(join(MODULI, "data-contracts-section.js"), "utf8");
  assert.doesNotMatch(
    testo,
    /adopted/,
    "l'adozione era il secondo padrone dell'elenco, ed e' da li' che nasceva il nome che si allungava",
  );
  /* Quello che deve restare: un'assegnazione che non si risolve si toglie. */
  assert.match(
    testo,
    /delete assignments\[entity\]/,
    "una luce che punta a una stanza che non c'e' piu' deve perdere l'assegnazione",
  );
});
