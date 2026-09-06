/* «Nella dashboard nella sezione config possiamo mettere un tag con link
 * donazioni?» Il collegamento e' uno — quello del README e di FUNDING.yml — e
 * si apre in una scheda nuova.
 *
 * «Mi sposti il pulsante donazioni qua sotto ad assistenza invece che dentro
 * configurazione»: la porta non sta piu' dentro l'editor delle entita' — dove
 * ci si va per lavorare — ma e' una tessera della pagina Configurazione, in
 * fondo, sotto Segnalazioni e Assistenza. */
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
  assert.equal((sezione.match(/https:\/\//g) || []).length, 1, "un indirizzo solo, scritto una volta");
  /* La tessera non porta a PayPal: apre la finestra che racconta il progetto,
   * e li' c'e' il tasto. */
  assert.match(sezione, /closest\?\.\("\[data-dm-sostieni-apri\]"\)\) \{\s*event\.preventDefault\(\);\s*apri\(\);/);
  assert.match(sezione, /export function apri\(\)/);
  const finestra = sezione.slice(sezione.indexOf("function finestra()"), sezione.indexOf("export function apri()"));
  assert.match(finestra, /linkMarkup\("dm-sostieni-tasto"/, "il collegamento a PayPal sta nella finestra");
  assert.match(finestra, /TESTO_DEL_PERCHE\(\)/);
});

test("la porta e' una tessera della pagina Configurazione, l'ultima della griglia", async () => {
  const sezione = await leggi("../src/sections/sostieni-il-progetto-section.js");
  /* Stessa griglia e stessa veste delle altre due tessere che parlano col
   * progetto invece che con la casa. */
  assert.match(sezione, /doc\?\.querySelector\?\.\("#page-config \.cfg-grid"\)/);
  assert.match(sezione, /tessera\.className = "cfg-card dm-sostieni-tessera"/);
  for (const pezzo of ["cfg-card-ico", "cfg-card-nm", "cfg-card-ds", "cfg-card-arrow"])
    assert.ok(sezione.includes(pezzo), pezzo);
  /* In fondo si rimette a ogni giro: Segnalazioni e Assistenza si aggiungono
   * in coda quando arrivano, e chi nasce prima resterebbe sopra. */
  assert.match(sezione, /if \(griglia\.lastElementChild !== tessera\) griglia\.append\(tessera\);/);
  /* E dentro l'editor non c'e' piu' niente: niente pastiglia nella colonna
   * delle linguette, niente card in «Impostazioni», niente agganci ai suoi
   * ridisegni. */
  for (const morto of [
    "ensurePastiglia",
    "ensureCard",
    "dm-sostieni-pastiglia",
    "SCHEDA_IMPOSTAZIONI",
    "onEditorRedraw",
    "wrapFunction",
    "#ed-body",
    "#editor-modal",
  ])
    assert.equal(sezione.includes(morto), false, morto);
});

test("il modulo e' installato dal runtime, con la lingua e le altre preferenze", async () => {
  const runtime = await leggi("../src/sections/section-runtime.js");
  assert.match(runtime, /installSostieniIlProgetto\(\);/);
  assert.match(runtime, /"sostieni-il-progetto",/);
});
