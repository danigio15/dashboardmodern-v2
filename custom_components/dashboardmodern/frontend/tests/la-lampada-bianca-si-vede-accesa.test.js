/* «Il box della lampada RGB quando è ON si accende per un attimo poi torna
 * tutto bianco» (#327).
 *
 * Chi l'ha segnalata ci è arrivato da solo: «ho capito l'arcano mistero, il
 * colore dell'alone è quello della lampada, quindi se la lampada è sul bianco
 * non si vede — ma in realtà c'è». Aveva ragione su tutto, ed è esattamente
 * per questo che era un difetto: l'alone c'era, ed era bianco su bianco. Una
 * lampada accesa che si vede identica a una spenta è rotta anche quando il
 * colore che mostra è quello giusto.
 *
 * Il colore vero resta dov'è informazione — la sfera dice che luce fa la
 * lampada. Quello con cui la card DICE «accesa» è un'altra cosa, e deve
 * staccarsi dal fondo qualunque lampada ci sia dietro.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { coloreDelSegno, luminanza } from "../src/core/light-model.js";

const sorgente = readFileSync(new URL("../src/sections/lights-page-section.js", import.meta.url), "utf8");

/* Sopra questa chiarezza, su una card chiara, un colore non si legge piu'. */
const SI_VEDE = 0.62;

test("un bianco senza tinta prende l'ambra di casa", () => {
  /* Il bianco puro non ha una tinta da scurire: scurirlo darebbe grigio, che
   * non dice niente. Prende il colore con cui questa plancia scrive «acceso»
   * da sempre. */
  assert.equal(coloreDelSegno("#ffffff"), "#f59e0b");
  assert.equal(coloreDelSegno("#fffbe6"), "#f59e0b");
  /* Anche un bianco appena azzurrino: sotto la soglia della tinta e' bianco. */
  assert.equal(coloreDelSegno("#e8f0ff"), "#f59e0b");
});

test("un colore che gia' si vede non si tocca", () => {
  /* Rosso, blu, l'ambra stessa: la card li mostra come sono. Cambiarli
   * sarebbe mentire su che luce fa la lampada. */
  for (const colore of ["#ff0000", "#2196f3", "#f59e0b", "#333333"])
    assert.equal(coloreDelSegno(colore), colore);
});

test("un colore troppo chiaro scende, e tiene la sua tinta", () => {
  /* Un verde acceso e un bianco caldo restano verde e caldo: si scende quanto
   * basta per vedersi, non si cambia colore. */
  for (const chiaro of ["#00ff00", "#fff4d6", "#ffe0b2"]) {
    const segno = coloreDelSegno(chiaro);
    assert.ok(luminanza(chiaro) > SI_VEDE, `${chiaro} doveva essere troppo chiaro`);
    assert.ok(luminanza(segno) <= SI_VEDE, `${segno} non si vede ancora`);
    assert.notEqual(segno, "#f59e0b", `${chiaro} una tinta ce l'ha, non deve diventare ambra`);
  }
});

test("la card dice «accesa» col colore che si vede, e mostra quello vero solo sulla lampadina", () => {
  /* Il segno si scrive dove si scrive il colore, tutte e due le volte: al
   * disegno della card e al giro che ne aggiorna i valori. */
  assert.match(sorgente, /--dm-light-segno:\$\{esc\(coloreDelSegno\(color\)\)\}/);
  assert.match(sorgente, /card\.style\.setProperty\("--dm-light-segno", coloreDelSegno\(color\)\)/);
  /* E il foglio parla col segno: il colore vero resta solo nel riempimento
   * della sfera, che e' l'unico posto dove dire «questa lampada fa luce
   * bianca» e' un'informazione e non una card spenta. */
  const foglio = sorgente.slice(sorgente.indexOf(".dm-lucip-card::after"));
  const veri = [...foglio.matchAll(/var\(--dm-light-color,#f59e0b\)/g)];
  assert.equal(veri.length, 2, "il colore vero deve restare solo nel riempimento della sfera");
  assert.match(
    foglio,
    /\.dm-lucip-orb\{border-radius:50%;background:radial-gradient\(circle at 38% 32%,color-mix\(in srgb,var\(--dm-light-color,#f59e0b\) 25%,#fff\),var\(--dm-light-color,#f59e0b\)\)/,
  );
  /* L'alone, il bordo, la levetta e la scritta: tutti col segno. */
  for (const pezzo of [".dm-lucip-glow", ".dm-lucip-led", ".dm-lucip-state", ".dm-lucip-card.is-on{"])
    assert.ok(foglio.includes(pezzo), `manca la regola di ${pezzo}`);
  assert.equal(/\.dm-lucip-glow\{opacity:1;background:radial-gradient\(120% 90% at 14% 0%,color-mix\(in srgb,var\(--dm-light-color/.test(foglio), false);
});
