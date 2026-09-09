#!/usr/bin/env node
/* Il manuale in PDF, fatto con il browser che c'e' gia'.
 *
 * `docs/manuale/manuale.html` e' il sorgente: pagine A4 esplicite, i caratteri
 * della plancia presi dalla sua stessa cartella `vendor/fonts`, le schermate
 * prese da `docs/preview`. Questo script lo apre con Chromium e ne stampa
 * `docs/MANUALE-DASHBOARDMODERN.pdf`.
 *
 * Prima di stampare controlla che nessuna pagina trabocchi: una pagina alta
 * piu' di 297 mm verrebbe tagliata in silenzio, e il manuale direbbe meno di
 * quello che c'e' scritto. Con `--controlla` fa solo quel controllo.
 *
 *   node scripts/costruisci-il-manuale.mjs
 *   node scripts/costruisci-il-manuale.mjs --controlla
 *   node scripts/costruisci-il-manuale.mjs --anteprima 12   (png della pagina 12)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = resolve(QUI, "..");
const SORGENTE = join(RADICE, "docs", "manuale", "manuale.html");
const USCITA = join(RADICE, "docs", "MANUALE-DASHBOARDMODERN.pdf");

/* Il browser: quello di Playwright se c'e', se no uno di sistema. */
const CANDIDATI = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

function browser() {
  const scelto = process.env.CHROME || CANDIDATI.find((via) => existsSync(via));
  if (!scelto) {
    console.error("Nessun Chromium trovato. Indica il percorso con CHROME=/percorso/al/chrome");
    process.exit(1);
  }
  return scelto;
}

function corri(args, { silenzioso = true } = {}) {
  const profilo = mkdtempSync(join(tmpdir(), "manuale-"));
  try {
    return execFileSync(
      browser(),
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--user-data-dir=${profilo}`,
        "--virtual-time-budget=20000",
        ...args,
      ],
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: silenzioso ? ["ignore", "pipe", "pipe"] : "inherit" },
    );
  } finally {
    rmSync(profilo, { recursive: true, force: true });
  }
}

/** Le pagine che traboccano: il controllo che il sorgente si fa da se'. */
function controlla() {
  const dom = corri(["--dump-dom", `file://${SORGENTE}`]);
  /* Gli attributi escono nell'ordine in cui li ha scritti il browser, e non e'
   * quello: si cerca la pagina, poi il traboccamento nello stesso tag. */
  const troppo = [];
  for (const tag of dom.match(/<section[^>]*>/g) || []) {
    const pagina = /data-pagina="(\d+)"/.exec(tag);
    const avanzo = /data-troppo="(\d+)"/.exec(tag);
    if (pagina && avanzo) troppo.push({ pagina: Number(pagina[1]), avanzo: Number(avanzo[1]) });
  }
  const pagine = (dom.match(/class="pagina/g) || []).length;
  if (process.argv.includes("--riempimento")) {
    const vuote = [];
    for (const tag of dom.match(/<section[^>]*>/g) || []) {
      const numero = /data-pagina="(\d+)"/.exec(tag);
      const pieno = /data-riempimento="(\d+)"/.exec(tag);
      if (numero && pieno && Number(pieno[1]) < 78) vuote.push(`   pagina ${numero[1]}: piena al ${pieno[1]}%`);
    }
    console.log(vuote.length ? `Pagine da riempire:\n${vuote.join("\n")}` : "Tutte le pagine sono ben piene.");
  }
  if (!troppo.length) {
    console.log(`✅ ${pagine} pagine, nessuna trabocca.`);
    return true;
  }
  console.error(`⚠️  ${troppo.length} pagine traboccano su ${pagine}:`);
  for (const voce of troppo) console.error(`   pagina ${voce.pagina}: ${voce.avanzo}px di troppo`);
  return false;
}

function stampa() {
  corri([`--print-to-pdf=${USCITA}`, "--no-pdf-header-footer", `file://${SORGENTE}`], { silenzioso: true });
  const byte = readFileSync(USCITA).length;
  console.log(`📄 ${USCITA} — ${(byte / 1024 / 1024).toFixed(1)} MB`);
}

/** Una pagina sola in PNG, per guardarla senza aprire il PDF. */
function anteprima(numero) {
  const png = join(RADICE, "docs", "manuale", `anteprima-${numero}.png`);
  corri([
    "--screenshot=" + png,
    "--window-size=794,1210", // l'altezza della finestra tiene conto della cornice: il foglio e' 1123
    `--virtual-time-budget=20000`,
    `file://${SORGENTE}?pagina=${numero}`,
  ]);
  console.log(`🖼️  ${png}`);
}

const argomenti = process.argv.slice(2);
if (argomenti.includes("--controlla")) {
  process.exit(controlla() ? 0 : 1);
} else if (argomenti.includes("--anteprima")) {
  anteprima(Number(argomenti[argomenti.indexOf("--anteprima") + 1] || 1));
} else {
  if (!controlla() && !argomenti.includes("--comunque")) {
    console.error("Stampa annullata. Sistema le pagine, oppure ripeti con --comunque.");
    process.exit(1);
  }
  stampa();
}
