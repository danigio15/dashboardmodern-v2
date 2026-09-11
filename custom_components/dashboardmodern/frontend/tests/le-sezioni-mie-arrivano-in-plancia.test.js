/* «Ho motore acqua e valvole apertura chiusura acqua, come le gestisco?» —
 * e poi, con le entità davanti: «ho un recipiente sul tetto del palazzo, una
 * valvola aqara apre e fa riempire il recipiente, l'altra fa scendere l'acqua
 * in casa» (#473).
 *
 * La risposta c'era già a metà. Le sezioni che si fa l'utente (#262) esistono
 * da un pezzo, e un serbatoio con due valvole e due batterie è esattamente
 * quello per cui sono nate: entità scelte a mano sotto un titolo, con
 * l'interruttore dove c'è qualcosa da accendere.
 *
 * Quello che mancava è dove uno le guarda. Una sezione propria nasceva con la
 * sua voce nella barra e la sua pagina, e si fermava lì: in Home non arrivava
 * mai. Ma la Home è il posto da cui si guarda la casa senza aprire niente, e
 * chi ha due valvole sul tetto vuole vedere da lì se sono aperte.
 *
 * Adesso ogni sezione propria ha la sua tessera, col titolo e il disegno che
 * le ha dato chi l'ha fatta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { CHIAVE_SEZIONI_MIE, sezioniDaMostrare } from "../src/core/sezioni-mie.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");
const TESSERE = leggi("sections/home-widgets-section.js");
const EDITOR = leggi("sections/todo-editor-section.js");

const SERBATOIO = {
  id: "acqua",
  titolo: "Serbatoio",
  icona: "💧",
  voci: [
    { id: "v1", entity: "switch.aqara_valvola_salita", nome: "Salita" },
    { id: "v2", entity: "switch.aqara_valvola_discesa", nome: "Discesa" },
    { id: "b1", entity: "sensor.aqara_valvola_salita_batteria", nome: "Batteria salita" },
  ],
};

test("la chiave del magazzino sta nel nucleo, e la legge anche la tessera", () => {
  /* Prima stava nella sezione: a leggerla adesso sono in due — la pagina che
   * le disegna e la tessera che le porta in Home — e una costante duplicata è
   * il modo più rapido di farle divergere. */
  assert.equal(CHIAVE_SEZIONI_MIE, "cd_sezioni_mie");
  assert.match(TESSERE, /import \{ CHIAVE_SEZIONI_MIE, sezioniDaMostrare \} from "\.\.\/core\/sezioni-mie\.js"/);
});

test("una sezione con dentro qualcosa si mostra, una vuota no", () => {
  assert.equal(sezioniDaMostrare([SERBATOIO]).length, 1);
  assert.equal(sezioniDaMostrare([{ ...SERBATOIO, voci: [] }]).length, 0);
  /* E chi l'ha spenta dalla barra non se la ritrova in Home. */
  assert.equal(sezioniDaMostrare([{ ...SERBATOIO, mostra: false }]).length, 0);
});

test("ogni sezione ha la sua tessera, col suo titolo e il suo disegno", () => {
  const blocco = TESSERE.slice(TESSERE.indexOf("export function sezioniMieModels"));
  const dentro = blocco.slice(0, 2200);
  assert.match(dentro, /const chiave = `mia-\$\{sezione\.id\}`/);
  assert.match(dentro, /key: chiave,/);
  assert.match(dentro, /label: sezione\.titolo/);
  assert.match(dentro, /icon: sezione\.icona \|\| "⭐"/);
  /* Le righe si leggono con lo stesso verbo delle evidenze: un secondo modo di
   * leggere un'entità per una tessera sarebbe un secondo modo di sbagliarla. */
  assert.match(dentro, /rigaInEvidenza\(/);
});

test("si spostano e si spengono tutte insieme, sotto una voce sola", () => {
  /* Sono tante quante uno se ne fa: una riga a testa nel catalogo lo
   * riempirebbe di voci diverse da una casa all'altra. */
  assert.match(TESSERE, /widget\.key\.startsWith\("mia-"\)\s*\n?\s*\?\s*"mie"/);
  const catalogo = EDITOR.slice(
    EDITOR.indexOf("function catalogoTessere"),
    EDITOR.indexOf("function tessereOrdinate"),
  );
  assert.match(catalogo, /\["mie", "🧰", t\("Sezioni mie", "My sections"\)\]/);
});

test("la finestra le disegna a caselle, come le evidenze", () => {
  const blocco = TESSERE.slice(TESSERE.indexOf("function carteDalleRighe"));
  assert.match(blocco.slice(0, 700), /grezza\.startsWith\("evidenza-"\) \|\| grezza\.startsWith\("mia-"\)/);
});

test("entrano in Home accanto alle evidenze", () => {
  const blocco = TESSERE.slice(TESSERE.indexOf("export function modelliDelleTessere"));
  assert.match(blocco.slice(0, 1200), /\.\.\.sezioniMieModels\(states\)/);
});
