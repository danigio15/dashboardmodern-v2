import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/* Il Report non deve accorgersi di niente (segnalato in revisione).
 *
 * Il paniere del Recorder serviva a due domande diverse — «cosa disegna il
 * Report» e «da dove leggo i periodi del flusso» — e ne rispondeva una sola.
 * Gli apparecchi nascosti dal Report restavano senza numero nel loro cerchio.
 *
 * La correzione allarga i **valori**, che il paniere indicizza per entita', e
 * lascia `devices` — l'elenco che il Report disegna — esattamente com'era. Si
 * legge dal sorgente perche' e' una separazione, e una separazione si prova
 * dicendo cosa NON e' stato mescolato. */
test("i valori si allargano agli apparecchi nascosti, l'elenco del Report no", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/energy-section.js", import.meta.url),
    "utf8",
  );
  const inizio = sorgente.indexOf("async function loadDevicePeriod");
  const corpo = sorgente.slice(inizio, sorgente.indexOf("\n}\n", inizio));
  assert.ok(corpo.includes("dispositiviFuoriDalReport"), "i nascosti non entrano nei piani");
  /* `devices` resta quello di `canonicalDevices()`: e' l'unica riga che lo
     assegna, e i nascosti non ci finiscono. */
  assert.match(corpo, /const devices = canonicalDevices\(\);/);
  assert.ok(
    !/devices\s*=\s*\[/.test(corpo),
    "l'elenco del Report e' stato allargato: i nascosti comparirebbero nel Report",
  );

  const filtro = sorgente.slice(
    sorgente.indexOf("function dispositiviFuoriDalReport"),
    sorgente.indexOf("\n}\n", sorgente.indexOf("function dispositiviFuoriDalReport")),
  );
  assert.ok(filtro.includes("show_in_report === false"), "non prende i soli nascosti");
  /* Stessa risoluzione dell'entita' e del contatore di vita del Report:
     riscriverla accanto vorrebbe dire due regole che un giorno divergono. */
  assert.ok(filtro.includes("canonicalReportDevices"), "la risoluzione e' stata riscritta a mano");
  // E non si chiede due volte lo stesso contatore.
  assert.ok(filtro.includes("gia.has"), "un contatore gia' nel Report verrebbe chiesto due volte");
});
