import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/* Ogni tessera del ponte ha la sua riga nell'elenco ordina/accendi.
 *
 * Le tessere nascono in home-widgets-section.js, ma chi decide quali vedere e
 * in che ordine passa dal catalogo di todo-editor-section.js: una tessera che
 * sta nel primo file e non nel secondo esiste in Home ma non si puo' ne'
 * spostare ne' spegnere — e' successo alle Prese e agli aspirapolvere, nati
 * dopo il catalogo e mai iscritti. I due elenchi vivono in file diversi e
 * niente li teneva insieme: da qui in poi li tiene insieme questa prova. */

const read = (file) => readFile(new URL(`../src/sections/${file}`, import.meta.url), "utf8");

test("ogni chiave di tessera ha una riga nel catalogo dell'editor", async () => {
  const tessere = await read("home-widgets-section.js");
  const editor = await read("todo-editor-section.js");

  const chiavi = [...tessere.matchAll(/^\s*key: "([a-z]+)"/gm)].map((match) => match[1]);
  assert.ok(chiavi.length >= 15, "le tessere non si trovano piu' dove questa prova le cerca");

  const catalogo = editor.slice(
    editor.indexOf("function catalogoTessere"),
    editor.indexOf("function tessereOrdinate"),
  );
  const iscritte = new Set([...catalogo.matchAll(/\["([a-z]+)",/g)].map((match) => match[1]));
  // Gli avvisi personalizzati (`custom-0`, `custom-1`, ...) si governano
  // insieme sotto la voce unica `custom`, che nel catalogo c'e' gia'.
  assert.ok(iscritte.has("custom"), "la voce unica degli avvisi personalizzati e' sparita");

  for (const chiave of new Set(chiavi))
    assert.ok(
      iscritte.has(chiave),
      `la tessera "${chiave}" esiste in Home ma manca dal catalogo ordina/accendi`,
    );
});
