/* «Nella dashboard nella sezione config possiamo mettere un tag con link
 * donazioni?» Il collegamento e' uno — quello del README e di FUNDING.yml —
 * si apre in una scheda nuova, e sta in due posti della configurazione: la
 * pastiglia in fondo alla colonna delle schede e la card in «Impostazioni». */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { LINK_DONAZIONI } from "../src/sections/sostieni-il-progetto-section.js";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

test("il collegamento e' quello del README e del tasto Sponsor, e si apre in una scheda nuova", async () => {
  assert.equal(LINK_DONAZIONI, "https://www.paypal.com/paypalme/giovannidaniello15");
  const readme = await leggi("../../../../README.md");
  assert.ok(readme.includes(LINK_DONAZIONI), "il README porta lo stesso indirizzo");
  const funding = await leggi("../../../../.github/FUNDING.yml");
  assert.ok(funding.includes(LINK_DONAZIONI), "FUNDING.yml porta lo stesso indirizzo");
  const sezione = await leggi("../src/sections/sostieni-il-progetto-section.js");
  assert.match(sezione, /target="_blank" rel="noopener noreferrer"/);
  assert.match(sezione, /export function ensurePastiglia\(\)/);
  assert.match(sezione, /export function ensureCard\(\)/);
  assert.match(sezione, /const SCHEDA_IMPOSTAZIONI = "visib";/);
  assert.equal((sezione.match(/https:\/\//g) || []).length, 1, "un indirizzo solo, scritto una volta");
});

test("il modulo e' installato dal runtime, con la lingua e le altre preferenze", async () => {
  const runtime = await leggi("../src/sections/section-runtime.js");
  assert.match(runtime, /installSostieniIlProgetto\(\);/);
  assert.match(runtime, /"sostieni-il-progetto",/);
});
