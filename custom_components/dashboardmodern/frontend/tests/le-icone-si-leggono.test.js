/* «Le icone sono poco leggibili, troppo chiare.»
 *
 * Erano due cose diverse con lo stesso aspetto, e queste prove tengono ferme
 * tutte e due: il foglio unico delle sfumature (senza il quale meta' dei
 * disegni resta la sola ombra) e il velo singolo sulla barra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CHIAVI_OGGETTI,
  ID_FOGLIO_OGGETTI,
  foglioDegliOggetti,
  identificatoriDelFoglio,
  oggettoWidget,
} from "../src/core/oggetti-widget.js";

test("il foglio dichiara ogni sfumatura che i disegni chiedono", () => {
  const dichiarati = new Set(identificatoriDelFoglio());
  assert.ok(dichiarati.size > 30, `poche sfumature nel foglio: ${dichiarati.size}`);
  const mancanti = new Set();
  for (const chiave of CHIAVI_OGGETTI) {
    const disegno = oggettoWidget(chiave);
    for (const [, id] of disegno.matchAll(/url\(#([^)]+)\)/g)) {
      if (!dichiarati.has(id)) mancanti.add(`${chiave} → ${id}`);
    }
  }
  assert.deepEqual(
    [...mancanti],
    [],
    "un disegno chiede una sfumatura che il foglio non dichiara: su una pagina dove il primo portatore e' nascosto, quel pezzo non verrebbe dipinto",
  );
});

test("il foglio non si nasconde con display:none, o riparerebbe niente", () => {
  const markup = foglioDegliOggetti();
  assert.ok(markup.includes(`id="${ID_FOGLIO_OGGETTI}"`));
  /* Il difetto nasce proprio da una sfumatura dentro un ramo non disegnato:
   * un foglio nascosto cosi' sarebbe lo stesso difetto con un nome nuovo. */
  assert.ok(!/display\s*:\s*none/.test(markup));
  // Largo zero e trasparente al dito: c'e' ma non occupa e non intercetta.
  assert.match(markup, /width:0/);
  assert.match(markup, /height:0/);
  assert.match(markup, /pointer-events:none/);
  assert.ok(markup.includes("aria-hidden=\"true\""));
});

test("il markup di un disegno non cambia fra due chiamate", () => {
  /* Le sezioni decidono se ridisegnare confrontando il markup appena scritto
   * con quello di prima. Identificatori diversi a ogni chiamata — la strada
   * alternativa per riparare il difetto — vorrebbero dire markup sempre
   * diverso, cioe' ridisegnare per sempre: e' il difetto che le miniature
   * delle telecamere avevano gia' avuto. */
  for (const chiave of ["luci", "clima", "energia", "temperatura"]) {
    assert.equal(oggettoWidget(chiave), oggettoWidget(chiave));
  }
});

test("la sezione mette il foglio per primo nel corpo della pagina", async () => {
  const source = await readFile(
    new URL("../src/sections/icone-leggibili-section.js", import.meta.url),
    "utf8",
  );
  /* «Per primo» e' la condizione, non un dettaglio: a un identificatore
   * ripetuto risponde il primo che lo porta in ordine di documento. */
  assert.match(source, /body\.prepend\(/);
  assert.match(source, /firstElementChild/);
});

test("la barra tiene un velo solo sulle voci a riposo", async () => {
  const source = await readFile(
    new URL("../src/sections/navigation-section.js", import.meta.url),
    "utf8",
  );
  /* I due sbiadimenti che si moltiplicavano: .78 di opacita' e sopra un
   * grayscale(.85) opacity(.72), cioe' 0,56 su una figura senza colore. */
  assert.ok(!source.includes("grayscale(.85) opacity(.72)"));
  assert.ok(!/\.tab \.icon,[^{]*\.tab \.text\{opacity:\.78/.test(source));
  assert.match(source, /grayscale\(\.28\)/);
  /* Il nome sotto il disegno: era --text-dim al 70%, che sul bianco della
   * barra fa 2,7 a uno. Questo grigio quasi pieno ne fa 7,7. */
  assert.match(source, /nav\.tabs\.bottom-nav-bar \.tab\{color:#3d4d66!important\}/);
  /* La voce aperta non deve perdere il suo bianco: la regola che la riguarda
   * resta piu' specifica di quella delle voci a riposo. */
  assert.match(
    source,
    /nav\.tabs\.bottom-nav-bar \.tab\.active \.icon,nav\.tabs\.bottom-nav-bar \.tab\.active \.text\{opacity:1!important\}/,
  );
});

test("il grigio nuovo supera la soglia di leggibilita', quello vecchio no", () => {
  /* Il conto del contrasto secondo WCAG, sul bianco della barra. Sta qui e
   * non a mente perche' e' la ragione per cui i due colori sono quelli. */
  const luminanza = ([r, g, b]) => {
    const f = (v) => {
      const n = v / 255;
      return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const suBianco = (rgb, opacita) => rgb.map((v) => v * opacita + 255 * (1 - opacita));
  const rapporto = (rgb, opacita) => 1.05 / (luminanza(suBianco(rgb, opacita)) + 0.05);

  const prima = rapporto([100, 116, 139], 0.7); // --text-dim al 70%
  const dopo = rapporto([61, 77, 102], 0.96); // #3d4d66 al 96%
  assert.ok(prima < 4.5, `il grigio vecchio passava la soglia? ${prima}`);
  assert.ok(dopo >= 4.5, `il grigio nuovo non passa la soglia: ${dopo}`);
  assert.ok(dopo > prima * 2.5);
});
