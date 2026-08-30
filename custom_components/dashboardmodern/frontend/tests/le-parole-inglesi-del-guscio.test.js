/* Il guscio inglese non parla piu' italiano.
 *
 * Il runtime vendorizzato EN porta ancora etichette italiane cablate; il
 * modulo english-runtime-strings ne e' il padrone provvisorio. Qui si
 * controlla il dizionario, la traduzione dei toast alla fonte e la guardia
 * che tiene il modulo spento sul guscio italiano.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  RUNTIME_EN,
  guscioInglese,
  installEnglishRuntimeStrings,
  traduciAlbero,
  traduciTesto,
} from "../src/sections/english-runtime-strings-section.js";

test("il dizionario traduce esattamente, e solo, le voci sue", () => {
  assert.equal(traduciTesto("ARMATO · FUORI"), "ARMED · AWAY");
  assert.equal(traduciTesto("DISARMATO"), "DISARMED");
  assert.equal(traduciTesto("Sezione salvata"), "Section saved");
  assert.equal(traduciTesto("✅ Rilevate: 3"), "✅ Detected: 3");
  /* Gli spazi intorno sopravvivono: il nodo di testo puo' averne. */
  assert.equal(traduciTesto("  IN USCITA  "), "  ARMING  ");
  /* Quello che non e' in dizionario non si tocca — nemmeno per somiglianza. */
  assert.equal(traduciTesto("Armato"), "Armato");
  assert.equal(traduciTesto("La sezione salvata ieri"), "La sezione salvata ieri");
  assert.equal(traduciTesto(""), "");
});

test("ogni voce del dizionario ha una traduzione diversa dall'originale", () => {
  for (const [it, en] of Object.entries(RUNTIME_EN)) {
    assert.ok(en.length > 0, it);
    assert.notEqual(en, it, it);
  }
});

test("un nodo di testo si traduce sul posto", () => {
  const nodo = { nodeType: 3, data: "ARMATO · NOTTE" };
  traduciAlbero(nodo, {});
  assert.equal(nodo.data, "ARMED · NIGHT");
});

test("la guardia: solo il guscio inglese", () => {
  const docIt = { documentElement: { getAttribute: () => "it" } };
  const docEn = { documentElement: { getAttribute: () => "en" } };
  assert.equal(guscioInglese(docIt), false);
  assert.equal(guscioInglese(docEn), true);

  /* Sul guscio italiano il modulo non tocca niente: nemmeno edToast. */
  const rootIt = { edToast: (m) => m };
  const primaIt = rootIt.edToast;
  installEnglishRuntimeStrings(rootIt, docIt);
  assert.equal(rootIt.edToast, primaIt);
});

test("i toast passano dalla traduzione alla fonte", () => {
  const mostrati = [];
  const root = {
    edToast: (m) => mostrati.push(m),
    addEventListener: () => {},
  };
  const doc = {
    documentElement: { getAttribute: () => "en" },
    getElementById: () => null,
    querySelector: () => null,
  };
  installEnglishRuntimeStrings(root, doc);
  root.edToast("Sezione salvata");
  root.edToast("Something else");
  assert.deepEqual(mostrati, ["Section saved", "Something else"]);
  /* L'involucro non si raddoppia a una seconda installazione. */
  const avvolto = root.edToast;
  installEnglishRuntimeStrings(root, doc);
  assert.equal(root.edToast, avvolto);
});

test("il modulo e' registrato nel runtime delle sezioni", () => {
  const runtime = readFileSync(
    fileURLToPath(new URL("../src/sections/section-runtime.js", import.meta.url)),
    "utf8",
  );
  assert.match(runtime, /english-runtime-strings-section\.js/);
  assert.match(runtime, /installEnglishRuntimeStrings\(\)/);
  assert.match(runtime, /"english-runtime-strings"/);
});

test("il dizionario copre davvero le parole rimaste nel runtime EN", () => {
  const runtime = readFileSync(
    fileURLToPath(new URL("../legacy/dashboard-runtime-en.js", import.meta.url)),
    "utf8",
  );
  for (const voce of ["ARMATO · FUORI", "DISARMATO", "Sezione salvata", "In attesa..."]) {
    assert.ok(runtime.includes(voce), `il runtime EN non contiene piu' «${voce}»?`);
    assert.ok(voce.trim() in RUNTIME_EN || voce in RUNTIME_EN, voce);
  }
});
