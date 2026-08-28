#!/usr/bin/env node
/* Porta in casa le librerie e i caratteri che la plancia prendeva dalla rete.
 *
 * Fino alla 1.3.3 la testata di dashboard.html apriva quattro connessioni
 * verso l'esterno prima ancora di disegnare qualcosa: il foglio dei caratteri
 * di Google e tre script di jsdelivr, tutti e tre SENZA `defer`, cioe' tutti
 * e tre capaci di fermare la lettura della pagina finche' non arrivavano. Uno
 * dei tre — panzoom — non lo usava nemmeno nessuno.
 *
 * Home Assistant sta in casa. Molte case non hanno internet sul quadro, altre
 * ce l'hanno lento, altre hanno un DNS che risponde quando gli pare. Su
 * quelle case la plancia non era lenta: era ferma, e ripartiva soltanto
 * quando il browser si arrendeva da solo — decine di secondi dopo. E' il
 * «rallentamento atroce» e il «disegno vecchio che poi si rifa'»: la pagina
 * partiva senza foglio e senza caratteri, e si rifaceva tutta quando i pezzi
 * arrivavano.
 *
 * Adesso quei quattro pezzi stanno in `legacy/vendor/`, serviti
 * dall'integrazione insieme a tutto il resto. Questo giro li rifa': prende i
 * pacchetti dal registro npm — che e' la stessa roba che jsdelivr rigira —,
 * controlla che le impronte siano quelle firmate e li scrive dove vanno.
 *
 *     node scripts/porta-in-casa-le-librerie.mjs
 *
 * Le impronte sono quelle che stavano negli attributi `integrity` della
 * testata: se npm servisse un byte diverso il giro si ferma e non scrive
 * niente. Quello che finisce in `legacy/vendor/` e' committato, perche' HACS
 * spedisce i file cosi' come sono e l'utente non scarica mai niente da solo.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASA = path.join(RADICE, "custom_components/dashboardmodern/frontend/legacy/vendor");

/* Le tre librerie, con l'impronta che stava scritta nella testata. */
const LIBRERIE = [
  {
    pacchetto: "chart.js@4.5.1",
    dentro: "dist/chart.umd.min.js",
    nome: "chart.umd.min.js",
    impronta: "sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ",
  },
  {
    pacchetto: "hls.js@1.6.17",
    dentro: "dist/hls.min.js",
    nome: "hls.min.js",
    impronta: "sha384-A+DTEBcAPU1Pk7Lby1xo6mi1AwflNlm+ojz8+BPFLErHgB1ZIgxfykSGIG+sPtC5",
  },
];

/* I caratteri, con i pesi che la testata chiedeva a Google e gli alfabeti che
 * Google serviva per quelle famiglie. Chi non e' scritto qui — cinese,
 * giapponese, coreano, arabo, devanagari — non lo serviva nemmeno prima:
 * quelle lingue cadevano gia' sul carattere di sistema. */
const ALFABETI = ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"];
const CARATTERI = [
  { pacchetto: "@fontsource/inter@5.3.0", famiglia: "Inter", radice: "inter", pesi: [300, 400, 700, 800] },
  { pacchetto: "@fontsource/oswald@5.3.0", famiglia: "Oswald", radice: "oswald", pesi: [500, 700] },
  { pacchetto: "@fontsource/share-tech-mono@5.3.0", famiglia: "Share Tech Mono", radice: "share-tech-mono", pesi: [400] },
];

function impronta(bytes) {
  return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}

/* `npm pack` scarica il pacchetto dal registro e ne lascia il tarball qui.
 * Non serve nient'altro: e' la stessa cartella `dist/` che jsdelivr pubblica. */
function scarta(pacchetto, banco) {
  const riga = execFileSync("npm", ["pack", pacchetto, "--silent"], { cwd: banco, encoding: "utf8" });
  const tarball = riga.trim().split("\n").pop().trim();
  const dove = path.join(banco, tarball.replace(/\.tgz$/, ""));
  mkdirSync(dove, { recursive: true });
  execFileSync("tar", ["xzf", tarball, "-C", dove], { cwd: banco });
  return path.join(dove, "package");
}

const banco = mkdtempSync(path.join(tmpdir(), "dm-vendor-"));
try {
  rmSync(CASA, { recursive: true, force: true });
  mkdirSync(path.join(CASA, "fonts"), { recursive: true });

  for (const libreria of LIBRERIE) {
    const pacco = scarta(libreria.pacchetto, banco);
    const bytes = readFileSync(path.join(pacco, libreria.dentro));
    const vista = impronta(bytes);
    if (vista !== libreria.impronta) {
      throw new Error(`${libreria.pacchetto}: impronta ${vista}, attesa ${libreria.impronta}`);
    }
    writeFileSync(path.join(CASA, libreria.nome), bytes);
    console.log(`${libreria.nome.padEnd(20)} ${String(bytes.length).padStart(7)} byte  ${vista}`);
  }

  /* Il foglio dei caratteri lo scrive questo giro mettendo in fila le regole
   * che fontsource pubblica gia' divise per alfabeto: gli `unicode-range`
   * sono quelli suoi, quindi il browser continua a scaricare soltanto
   * l'alfabeto che gli serve davvero, esattamente come faceva con Google. */
  const regole = [
    "/* Scritto da scripts/porta-in-casa-le-librerie.mjs — non si corregge a mano. */",
  ];
  for (const carattere of CARATTERI) {
    const pacco = scarta(carattere.pacchetto, banco);
    for (const peso of carattere.pesi) {
      const foglio = readFileSync(path.join(pacco, `${peso}.css`), "utf8");
      for (const alfabeto of ALFABETI) {
        const file = `${carattere.radice}-${alfabeto}-${peso}-normal.woff2`;
        const blocco = foglio.match(
          new RegExp(`@font-face\\s*\\{[^}]*${file.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^}]*\\}`),
        );
        if (!blocco) continue;
        cpSync(path.join(pacco, "files", file), path.join(CASA, "fonts", file));
        regole.push(
          blocco[0]
            .replace(/\s+/g, " ")
            .replace(/url\(\.\/files\/[^)]*\.woff\) format\('woff'\), ?/, "")
            .replace(/, ?url\(\.\/files\/[^)]*\.woff\) format\('woff'\)/, "")
            .replace(/url\(\.\/files\//g, "url(./fonts/"),
        );
      }
    }
  }
  writeFileSync(path.join(CASA, "caratteri.css"), `${regole.join("\n")}\n`);
  const quanti = readdirSync(path.join(CASA, "fonts")).length;
  console.log(`caratteri.css        ${String(regole.length - 1).padStart(7)} regole, ${quanti} file`);
} finally {
  rmSync(banco, { recursive: true, force: true });
}
