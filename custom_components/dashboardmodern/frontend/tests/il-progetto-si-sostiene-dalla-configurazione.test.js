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
  /* La pastiglia e la card non portano a PayPal: aprono la finestra che
   * racconta il progetto, e li' c'e' il tasto. */
  assert.match(sezione, /guscio\.innerHTML = portaMarkup\(\s*"dm-sostieni-pastiglia"/);
  assert.match(sezione, /\$\{portaMarkup\("dm-sostieni-tasto"/);
  assert.match(sezione, /closest\?\.\("\[data-dm-sostieni-apri\]"\)\) \{\s*event\.preventDefault\(\);\s*apri\(\);/);
  assert.match(sezione, /export function apri\(\)/);
  const finestra = sezione.slice(sezione.indexOf("function finestra()"), sezione.indexOf("export function apri()"));
  assert.match(finestra, /linkMarkup\("dm-sostieni-tasto"/, "il collegamento a PayPal sta nella finestra");
  assert.match(finestra, /TESTO_DEL_PERCHE\(\)/);
});

test("il modulo e' installato dal runtime, con la lingua e le altre preferenze", async () => {
  const runtime = await leggi("../src/sections/section-runtime.js");
  assert.match(runtime, /installSostieniIlProgetto\(\);/);
  assert.match(runtime, /"sostieni-il-progetto",/);
});
