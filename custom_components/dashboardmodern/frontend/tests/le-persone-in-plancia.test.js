/* Le persone hanno una casa in plancia, e la loro chiave viaggia.
 *
 * La sezione disegna le card in cima alla Home e l'editor scrive `cd_people`:
 * questa prova difende i fili che tengono insieme la cosa — la chiave nella
 * configurazione condivisa (con la revisione alzata, perché una chiave
 * aggiunta si travasa dai salvataggi più vecchi), la chiave sotto gli occhi
 * del cancello degli eventi (senza, il cambio zona di una persona non
 * ridisegnerebbe niente), e le due sezioni installate dal runtime.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("cd_people viaggia nella configurazione condivisa, alla revisione 5", async () => {
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION } = await import(
    "../src/sections/config-persistence-section.js"
  );
  assert.ok(CONFIG_KEYS.includes("cd_people"), "le persone devono viaggiare tra i dispositivi");
  assert.ok(CONFIG_KEYS_REVISION >= 5, "una chiave aggiunta alza la revisione");
});

test("il cancello degli eventi conosce cd_people", () => {
  const gate = leggi("core/state-event-gate.js");
  assert.match(
    gate,
    /"cd_people"/,
    "senza, i cambi di zona delle persone non arrivano alle card",
  );
});

test("il runtime installa le card e l'editor delle persone", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installPeopleSection\(\)/);
  assert.match(runtime, /installPeopleEditorSection\(\)/);
});

test("le card stanno in cima alla Home e ricadono sull'avatar se la foto è rotta", () => {
  const sezione = leggi("sections/people-section.js");
  assert.match(sezione, /dashboard-pills-row/, "l'ancora è la fila delle pillole di stato");
  assert.match(sezione, /addEventListener\("error"/, "la foto rotta non resta come icona spezzata");
  assert.match(sezione, /dashboardmodern:state-changed/, "le card seguono lo stato vivo");
});

test("l'editor usa il selettore foto condiviso e valida l'entità", () => {
  const editor = leggi("sections/people-editor-section.js");
  assert.match(editor, /pickMediaImage/, "la foto passa dallo stesso selettore dell'auto");
  assert.match(editor, /person\|device_tracker/, "solo entità che sanno dove sta una persona");
  assert.match(editor, /wzPickIcon/, "l'emoji dell'avatar si sceglie dal picker esistente");
});
