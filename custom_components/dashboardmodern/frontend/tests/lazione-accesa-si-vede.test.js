/* Un'azione rapida accesa si vede (#477).
 *
 * «Color the active Quick Action cards when they are active: when the "light"
 * card is active, the background could turn yellow.»
 *
 * Meta' delle azioni che uno ci mette non sono gesti, sono interruttori — la
 * luce del salone, la presa del ripetitore — e un interruttore che non dice se
 * e' acceso obbliga ad andare a vedere da un'altra parte.
 *
 * La domanda ha tre risposte e non due, ed e' quella la parte che queste prove
 * tengono ferma: acceso, spento, e «questa azione uno stato non ce l'ha». Una
 * scena non e' mai accesa — si lancia e finisce — e colorarla direbbe una cosa
 * falsa; una luce che non risponde non e' spenta, e mostrarla spenta sarebbe
 * una bugia tranquillizzante.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { azioneAccesa, entitaDelleAzioni, entitaDellAzione } from "../src/core/azione-accesa.js";

const CASA = {
  "light.salone": { state: "on" },
  "switch.presa": { state: "off" },
  "light.piano_a": { state: "off" },
  "light.piano_b": { state: "on" },
  "light.rotta": { state: "unavailable" },
  "script.buonanotte": { state: "on" },
  "cover.tapparella": { state: "open" },
};

test("un interruttore acceso dice di esserlo, uno spento pure", () => {
  assert.equal(azioneAccesa({ type: "light", entity: "light.salone" }, CASA), true);
  assert.equal(azioneAccesa({ type: "switch", entity: "switch.presa" }, CASA), false);
  assert.equal(azioneAccesa({ type: "cover", entity: "cover.tapparella" }, CASA), true);
  /* Uno script mentre gira e' acceso: e' l'unico gesto che ha una durata. */
  assert.equal(azioneAccesa({ type: "script", entity: "script.buonanotte" }, CASA), true);
});

test("una scena non e' mai accesa, e chi non risponde non e' spento", () => {
  assert.equal(azioneAccesa({ type: "scene", entity: "scene.notte" }, CASA), null);
  assert.equal(azioneAccesa({ type: "light", entity: "light.rotta" }, CASA), null);
  assert.equal(azioneAccesa({ type: "light", entity: "" }, CASA), null);
  assert.equal(azioneAccesa({ type: "builtin", builtin: "tutte_le_luci" }, CASA), null);
  assert.equal(azioneAccesa(null, CASA), null);
  assert.equal(entitaDellAzione({ type: "scene", entity: "scene.notte" }), "");
});

test("un gruppo di luci e' acceso se lo e' almeno una", () => {
  /* La stessa regola con cui la plancia conta le luci accese di una stanza, e
   * quella che uno ha in testa guardando il tasto «Piano di sopra». */
  const gruppo = { type: "luci_group", lights: ["light.piano_a", "light.piano_b"] };
  assert.equal(azioneAccesa(gruppo, CASA), true);
  assert.equal(azioneAccesa({ type: "luci_group", lights: ["light.piano_a"] }, CASA), false);
  assert.equal(azioneAccesa({ type: "luci_group", lights: [] }, CASA), null);
  /* Un gruppo di sole luci mute non e' un gruppo spento. */
  assert.equal(azioneAccesa({ type: "luci_group", lights: ["light.rotta"] }, CASA), null);
});

test("le entita' delle azioni si raccolgono senza doppioni", () => {
  const elenco = entitaDelleAzioni([
    { type: "light", entity: "light.salone" },
    { type: "luci_group", lights: ["light.piano_a", "light.piano_b"] },
    { type: "scene", entity: "scene.notte" },
    { type: "light", entity: "light.salone" },
  ]);
  assert.deepEqual(elenco, ["light.salone", "light.piano_a", "light.piano_b"]);
  assert.deepEqual(entitaDelleAzioni(null), []);
});

test("il ripiano accende i tasti e chiede le azioni al guscio", async () => {
  const fonte = await readFile(
    new URL("../src/sections/azioni-rapide-vassoio-section.js", import.meta.url),
    "utf8",
  );
  /* L'elenco delle azioni lo tiene il guscio: leggerselo per conto proprio
   * vorrebbe dire tenere un secondo elenco che un giorno diverge dal primo. */
  assert.ok(fonte.includes("root.getQuickActions?.()"), "le azioni non le chiede al guscio");
  assert.ok(fonte.includes('tasto.dataset.dmAcceso = "true"'), "nessun tasto si accende");
  assert.ok(fonte.includes('[data-dm-acceso="true"]'), "manca la regola del tasto acceso");
  /* Il colore e' quello che l'azione ha gia': una tinta nuova qui vorrebbe
   * dire due colori per la stessa azione. */
  assert.ok(
    fonte.includes("var(--dm-azione-tinta"),
    "il tasto acceso non usa la tinta dell'azione",
  );
});
