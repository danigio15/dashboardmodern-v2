/* Quello che restava a emoji, dopo i bidoni.
 *
 * «Non voglio vedere icone che non sono nostre.» I bidoni erano il posto piu'
 * evidente, ma non l'unico: le categorie delle allerte, le specie degli
 * animali, i modi dell'antifurto, i tasti del robot e gli stati di una
 * segnalazione uscivano tutti con le faccine di sistema.
 *
 * Il modo di aggiustarlo e' sempre lo stesso, ed e' quello che queste prove
 * tengono fermo: nei moduli puri ci va il NOME del disegno — un dato — e il
 * markup lo fa la sezione chiedendolo al catalogo. Cosi' il modello resta
 * puro, e la tessera, la pagina e la scheda non possono dire la stessa cosa
 * con tre disegni diversi.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { chiaveDelDisegno, disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";
import { SPECIE, specieDiSerie } from "../src/core/animali-model.js";
import { ALARM_DISARM, ALARM_MODES } from "../src/core/alarm-panel.js";
import { MOWER_ACTIONS, ROBOT_ACTIONS } from "../src/core/robot-model.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("i disegni nuovi ci sono tutti, e sono disegni veri", () => {
  const nuovi = [
    "warning",
    "globe",
    "storm",
    "flower",
    "plane",
    "train",
    "strike",
    "cat",
    "dog",
    "spiral",
    "bug",
    "chat",
    "inbox",
    "unlock",
    "sliders",
    "play",
    "pause",
    "stop",
    "robot",
    "mower",
  ];
  for (const chiave of nuovi) {
    assert.equal(chiaveDelDisegno(chiave), chiave, `manca il disegno ${chiave}`);
    const markup = disegnoDelCatalogo(chiave, 32);
    assert.ok(markup.includes('class="dm-art-panel"'), `${chiave} non ha il pannello di famiglia`);
    assert.ok(markup.includes('width="32" height="32"'), `${chiave} non esce alla misura chiesta`);
  }
});

test("i modelli portano il nome del disegno, non il markup", () => {
  /* Un modulo puro che sputa HTML e' un modulo che non si puo' piu' provare
   * senza un documento: il nome e' un dato, il markup no. */
  for (const voce of SPECIE) {
    assert.equal(chiaveDelDisegno(voce.disegno), voce.disegno, `${voce.chiave} senza disegno`);
    assert.ok(!voce.disegno.includes("<"), "nel modello e' finito del markup");
  }
  assert.equal(specieDiSerie("gatto").disegno, "cat");
  assert.equal(specieDiSerie("mai-vista").disegno, "pet");

  for (const modo of [...ALARM_MODES, ALARM_DISARM])
    assert.equal(chiaveDelDisegno(modo.disegno), modo.disegno, `${modo.mode} senza disegno`);
  assert.equal(ALARM_DISARM.disegno, "unlock");

  for (const azione of [...ROBOT_ACTIONS, ...MOWER_ACTIONS])
    assert.equal(chiaveDelDisegno(azione.disegno), azione.disegno, `${azione.act} senza disegno`);
});

test("le sezioni chiedono il disegno al catalogo", async () => {
  const posti = [
    "sections/allerte-section.js",
    "sections/allerte-editor-section.js",
    "sections/animali-section.js",
    "sections/animali-editor-section.js",
    "sections/robot-section.js",
    "sections/security-showcase-section.js",
    "sections/segnalazioni-section.js",
  ];
  for (const posto of posti) {
    const fonte = await leggi(posto);
    assert.ok(
      fonte.includes("disegnoDelCatalogo(") || fonte.includes("iconGlyphMarkup("),
      `${posto} non chiede nessun disegno`,
    );
  }
});

test("dove si vedeva la faccina adesso c'e' il disegno", async () => {
  const allerte = await leggi("sections/allerte-section.js");
  assert.ok(!allerte.includes("${categoria.icona}"), "l'allerta stampa ancora l'emoji");
  const animali = await leggi("sections/animali-section.js");
  assert.ok(!animali.includes("${vista.icona}"), "l'animale senza foto e' ancora un'emoji");
  const robot = await leggi("sections/robot-section.js");
  assert.ok(!robot.includes("${action.glyph}"), "i tasti del robot sono ancora emoji");
  assert.ok(!robot.includes('"🌱" : "🤖"'), "il robot si presenta ancora con un'emoji");
  const centrale = await leggi("sections/security-showcase-section.js");
  assert.ok(!centrale.includes("${voce.icon}"), "i tasti della centrale sono ancora emoji");
  const segnalazioni = await leggi("sections/segnalazioni-section.js");
  assert.ok(!segnalazioni.includes("${tipo.icona}"), "il tipo di segnalazione e' ancora un'emoji");
  assert.ok(!segnalazioni.includes("${colonna.icona}"), "le colonne sono ancora emoji");
});

test("il calendario non e' piu' un cronometro travestito", () => {
  assert.equal(chiaveDelDisegno("calendar"), "calendar");
  assert.ok(!disegnoDelCatalogo("calendar", 40).includes("M48 40v14l10 7"));
});
