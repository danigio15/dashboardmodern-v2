/* Le zone e gli ingressi della centrale (#511).
 *
 * «Tutti i miei sensori di presenza sono riferiti alla centrale: magari
 * aprendo Sicurezza, dove leggo zone — sarebbero i sensori di presenza — e
 * dove leggo ingressi — sarebbero i varchi mappati dalla centrale.»
 *
 * La prova che conta e' la prima: una centrale che non ha dichiarato niente le
 * ha TUTTE. E' la riga che fa funzionare la segnalazione senza configurare
 * nulla — chi ha una centrale sola, che e' il caso di chi l'ha scritta, apre
 * Sicurezza e le trova li' — ed e' anche l'unica risposta onesta: un elenco
 * vuoto vuol dire «non l'ho detto», non «nessuno». Rispondere «nessuno»
 * avrebbe mostrato due riquadri vuoti a chi ha la casa piena di sensori.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CAMPO_INGRESSI,
  CAMPO_ZONE,
  ceQualcosaDaMostrare,
  conEntita,
  elencoDiEntita,
  ingressiDellaCentrale,
  ingressiScritti,
  zoneDellaCentrale,
  zoneScritte,
} from "../src/core/le-zone-della-centrale.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const sorgente = (percorso) => readFileSync(join(QUI, "..", percorso), "utf8");

const PRESENZA = [
  { entity: "binary_sensor.salotto_movimento", name: "Salotto", stato: "attivo" },
  { entity: "binary_sensor.corridoio_movimento", name: "Corridoio", stato: "libero" },
];
const VARCHI = [
  { entity: "binary_sensor.porta_ingresso", name: "Porta d'ingresso", stato: "chiuso" },
  { entity: "binary_sensor.finestra_bagno", name: "Finestra bagno", stato: "aperto" },
];

test("una centrale che non dichiara niente le ha tutte", () => {
  const centrale = { id: "centrale", nome: "Casa" };
  assert.deepEqual(zoneDellaCentrale(PRESENZA, centrale), PRESENZA);
  assert.deepEqual(ingressiDellaCentrale(VARCHI, centrale), VARCHI);
  assert.deepEqual(zoneScritte(centrale), []);
  assert.deepEqual(ingressiScritti(centrale), []);
});

test("dichiarandole, restano solo le sue", () => {
  const centrale = {
    [CAMPO_ZONE]: ["binary_sensor.salotto_movimento"],
    [CAMPO_INGRESSI]: ["binary_sensor.finestra_bagno"],
  };
  assert.deepEqual(
    zoneDellaCentrale(PRESENZA, centrale).map((riga) => riga.entity),
    ["binary_sensor.salotto_movimento"],
  );
  assert.deepEqual(
    ingressiDellaCentrale(VARCHI, centrale).map((riga) => riga.entity),
    ["binary_sensor.finestra_bagno"],
  );
});

test("un nome dichiarato che non esiste piu' non inventa una riga", () => {
  /* Un sensore tolto dalla Presenza resta scritto nell'area finche' nessuno la
   * riapre: filtrare e' la strada giusta, elencare sarebbe stato il modo di
   * disegnare una zona che non c'e'. */
  const centrale = { [CAMPO_ZONE]: ["binary_sensor.mai_esistito"] };
  assert.deepEqual(zoneDellaCentrale(PRESENZA, centrale), []);
});

test("l'elenco si legge come array e come stringa, senza vuoti ne' doppioni", () => {
  assert.deepEqual(elencoDiEntita("a.uno, a.due"), ["a.uno", "a.due"]);
  assert.deepEqual(elencoDiEntita(["a.uno", "a.uno", "", "senza-punto"]), ["a.uno"]);
});

test("aggiungere e togliere non tocca la centrale che c'era", () => {
  const prima = { id: "centrale", nome: "Casa" };
  const con = conEntita(prima, CAMPO_ZONE, "binary_sensor.salotto_movimento", true);
  assert.equal(prima[CAMPO_ZONE], undefined, "l'originale non si tocca");
  assert.deepEqual(con[CAMPO_ZONE], ["binary_sensor.salotto_movimento"]);
  /* Tolta l'ultima il campo sparisce: se restasse scritto vuoto, la centrale
   * smetterebbe di «averle tutte» pur non avendo dichiarato nulla. */
  const senza = conEntita(con, CAMPO_ZONE, "binary_sensor.salotto_movimento", false);
  assert.equal(CAMPO_ZONE in senza, false);
  assert.equal(senza.nome, "Casa");
});

test("senza righe non c'e' niente da disegnare", () => {
  assert.equal(ceQualcosaDaMostrare([], []), false);
  assert.equal(ceQualcosaDaMostrare(PRESENZA, []), true);
  assert.equal(ceQualcosaDaMostrare([], VARCHI), true);
});

test("la pagina Sicurezza legge le righe che esistono gia', e non ne fa altre", () => {
  const pagina = sorgente("src/sections/security-showcase-section.js");
  assert.match(pagina, /from "\.\.\/core\/le-zone-della-centrale\.js"/);
  /* Le righe sono quelle della Presenza e dei Varchi: un secondo elenco della
   * stessa casa sarebbe il modo di far dire due numeri diversi alle stesse
   * porte, ed e' gia' successo altrove in questa plancia. */
  assert.match(pagina, /presenzaDiCasa\(/);
  assert.match(pagina, /varchiDiCasa\(/);
  assert.match(pagina, /syncZone\(shell, labels\);/);
  /* E il riquadro sparisce quando non c'e' niente da dire. */
  assert.match(pagina, /if \(!ceQualcosaDaMostrare\(zone, ingressi\)\) \{/);
});

test("l'area salva le sue zone, e non le perde al salvataggio successivo", () => {
  const scheda = sorgente("src/sections/centrali-allarme-editor-section.js");
  assert.match(scheda, /from "\.\.\/core\/le-zone-della-centrale\.js"/);
  /* `salva` riscriveva la riga da zero con tre campi soli: un campo che non
   * conosceva se ne andava in silenzio. E' il modo in cui una scelta appena
   * fatta sparisce al salvataggio dopo. */
  assert.match(scheda, /for \(const campo of \[CAMPO_ZONE, CAMPO_INGRESSI\]\) \{\s*const elenco = elencoDiEntita\(riga\?\.\[campo\]\);/);
  /* E tutte accese si scrive lasciando vuoto, o un sensore aggiunto domani
   * resterebbe fuori da un elenco compilato oggi. */
  assert.match(scheda, /if \(accese\.length === pastiglie\.length\) return \[\];/);
});
