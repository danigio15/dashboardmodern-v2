/* Le ultime schede della configurazione uscivano fuori misura.
 *
 * Da telefono tenuto in piedi la colonna delle schede si stringe al solo
 * simbolo: il nome lo nasconde il modulo che quel pezzo lo crea, dividendo la
 * linguetta in un simbolo e un nome. Ma chi non era nella tabella dei simboli
 * usciva subito, senza dividere niente: la parola restava attaccata al simbolo
 * dentro una colonna larga quanto un dito. Succedeva a ogni scheda aggiunta
 * dopo che quella tabella e' stata scritta — cioe' sempre alle ultime.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");
const rifiniture = leggi("sections/beta4-mobile-polish-section.js");

test("le schede nate dopo la tabella sono nella tabella", () => {
  for (const scheda of ["todo", "backup", "people", "robot", "doors"])
    assert.match(rifiniture, new RegExp(`\\n  ${scheda}: "`), scheda);
});

test("e chi non c'e' tiene il simbolo che si scrive da solo", () => {
  assert.match(rifiniture, /function primoSimbolo\(button\)/);
  assert.match(rifiniture, /TAB_ICONS\[tab\] \|\| primoSimbolo\(button\)/);
});

test("il simbolo in tabella e' quello che la scheda si scrive", () => {
  /* Due simboli diversi per la stessa scheda sarebbero due padroni: qui si
   * controlla che chi disegna la linguetta e chi la stringe dicano lo stesso. */
  const scritti = {
    backup: ["sections/backup-editor-section.js", "💾"],
    people: ["sections/people-editor-section.js", "👥"],
    robot: ["sections/robot-editor-section.js", "🤖"],
    doors: ["sections/security-doors-editor-section.js", "🚪"],
    todo: ["sections/todo-editor-section.js", "🧩"],
  };
  for (const [scheda, [file, simbolo]] of Object.entries(scritti)) {
    assert.match(leggi(file), new RegExp(`tab\\.textContent = \`${simbolo} `), file);
    assert.match(rifiniture, new RegExp(`\\n  ${scheda}: "${simbolo}"`), scheda);
  }
});
