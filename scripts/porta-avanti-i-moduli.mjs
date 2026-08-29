#!/usr/bin/env node
/* Dire al browser, subito, quali file gli serviranno.
 *
 * La plancia e' fatta di centosessantatre moduli, tre megabyte e mezzo, e la
 * catena degli import e' profonda dieci livelli. Un browser scopre un modulo
 * solo quando ha finito di leggere quello che lo importa: dieci livelli vuol
 * dire dieci giri di rete uno dopo l'altro prima di avere tutto. Misurato sul
 * banco, con il server in locale: il documento e' pronto a 4,2 secondi e
 * l'ultimo modulo arriva a 6,6. In quei secondi si vede la plancia com'e'
 * disegnata dal guscio — il meteo grande in mezzo alla pagina, le azioni
 * rapide senza il loro ripiano — e poi tutto si sposta sotto gli occhi. E'
 * stato segnalato cosi': «come se ci fosse una versione vecchia sotto». Non
 * c'e' niente sotto: c'e' il nuovo che deve ancora arrivare.
 *
 * Con l'elenco davanti il browser li chiede tutti insieme dal primo istante,
 * e i dieci giri diventano uno. L'elenco lo si scrive qui invece che a mano
 * perche' a mano invecchia in una settimana: si cammina sul grafo vero.
 *
 *   node scripts/porta-avanti-i-moduli.mjs           riscrive i gusci
 *   node scripts/porta-avanti-i-moduli.mjs --check   dice solo se sono a posto
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const RADICE = "custom_components/dashboardmodern/frontend";
const GUSCI = ["legacy/dashboard.html", "legacy/dashboard-en.html"];
const PARTENZE = ["legacy/modules-entry.js", "src/sections/section-runtime.js"];
const APRE = "<!-- moduli-in-anticipo:inizio -->";
const CHIUDE = "<!-- moduli-in-anticipo:fine -->";

function importsDi(percorso) {
  const testo = readFileSync(percorso, "utf8");
  return [
    ...[...testo.matchAll(/(?:^|[\s;])(?:import|export)[^'"`]*?from\s+["'](\.[^"']+)["']/g)],
    ...[...testo.matchAll(/import\s*\(\s*["'](\.[^"']+)["']\s*\)/g)],
    ...[...testo.matchAll(/(?:^|[\s;])import\s+["'](\.[^"']+)["']/g)],
  ].map((m) => resolve(dirname(percorso), m[1]));
}

function graffo() {
  const visti = new Set();
  const coda = PARTENZE.map((p) => resolve(RADICE, p));
  while (coda.length) {
    const file = coda.shift();
    if (visti.has(file)) continue;
    visti.add(file);
    let figli = [];
    try {
      figli = importsDi(file);
    } catch (_errore) {
      continue;
    }
    for (const figlio of figli) if (!visti.has(figlio)) coda.push(figlio);
  }
  return [...visti].sort();
}

/* L'ordine conta poco per il browser, ma tenerlo stabile serve a noi: un
 * elenco che cambia ordine a ogni giro riempie le differenze di rumore. */
function elenco(dalGuscio) {
  return graffo()
    .map((file) => relative(dirname(dalGuscio), file).split("\\").join("/"))
    .map((href) => `<link rel="modulepreload" href="${href.startsWith(".") ? href : `./${href}`}">`)
    .join("\n");
}

const controlla = process.argv.includes("--check");
let daSistemare = 0;
for (const nome of GUSCI) {
  const percorso = resolve(RADICE, nome);
  const testo = readFileSync(percorso, "utf8");
  const inizio = testo.indexOf(APRE);
  const fine = testo.indexOf(CHIUDE);
  if (inizio < 0 || fine < 0) {
    console.error(`${nome}: mancano i segni ${APRE} / ${CHIUDE}`);
    process.exitCode = 1;
    continue;
  }
  const dentro = `${APRE}\n${elenco(percorso)}\n${CHIUDE}`;
  const nuovo = testo.slice(0, inizio) + dentro + testo.slice(fine + CHIUDE.length);
  if (nuovo === testo) continue;
  daSistemare += 1;
  if (controlla) console.error(`${nome}: l'elenco dei moduli non e' aggiornato`);
  else writeFileSync(percorso, nuovo);
}

const quanti = graffo().length;
if (controlla && daSistemare) {
  console.error("Esegui: node scripts/porta-avanti-i-moduli.mjs");
  process.exitCode = 1;
} else if (controlla) {
  console.log(`elenco dei moduli aggiornato (${quanti} file)`);
} else {
  console.log(`scritti ${quanti} moduli in anticipo su ${GUSCI.length} gusci`);
}
