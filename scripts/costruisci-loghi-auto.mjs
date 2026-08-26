/* I loghi dei marchi auto, dentro il repository.
 *
 * Venivano scaricati da un CDN a ogni caricamento della pagina: un indirizzo
 * `https://cdn.jsdelivr.net/npm/simple-icons@…/icons/tesla.svg` costruito a
 * mano per ogni marchio. Tre cose non andavano, e tutte e tre si vedevano.
 *
 * La prima: una plancia di Home Assistant sta su una rete di casa, e molte non
 * escono su internet. Li' i loghi non arrivavano MAI — tutti, non alcuni.
 *
 * La seconda: Simple Icons ha tolto i marchi delle auto dal pacchetto per
 * ragioni di marchio registrato. Otto dei nostri indirizzi puntavano gia' a
 * file che non esistono piu', e nessuno se n'era accorto perche' un'immagine
 * che non arriva non fa rumore.
 *
 * La terza: un file che non e' nostro non si puo' ritoccare. Un logo troppo
 * chiaro sul tema scuro, uno con troppo margine, uno da rifare: con l'indirizzo
 * remoto non c'era niente da fare.
 *
 * Adesso i file stanno qui. Sono CC0 — pubblico dominio, si possono usare e
 * modificare — e questo script li estrae dal pacchetto npm, che il repository
 * non tiene come dipendenza: si scarica, si prende quello che serve, si butta.
 *
 * Uso: node scripts/costruisci-loghi-auto.mjs
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGO = join(ROOT, "custom_components/dashboardmodern/frontend/src/core/personalization-catalog.js");
const USCITA = join(ROOT, "custom_components/dashboardmodern/frontend/brands");
const PACCHETTO = "simple-icons";
const VERSIONE = "16.27.1";
/* Alfa Romeo c'era, e l'hanno tolto. Il file di allora e' CC0 come gli altri e
 * non e' invecchiato: un logo non scade. Si pesca da li' invece di rinunciarci. */
const VERSIONE_STORICA = "13.21.0";
const DA_VERSIONE_STORICA = new Set(["alfaromeo"]);

/* Sette marchi non sono mai stati nel pacchetto, e nessuna versione li ha.
 * Quelli li abbiamo disegnati noi, e questo script non li tocca: non li scarica
 * e soprattutto non li cancella facendo pulizia. Chi li vuole cambiare apre il
 * file e disegna. */
const DISEGNATI_A_MANO = new Set([
  "abarth",
  "byd",
  "cupra",
  "lancia",
  "lexus",
  "mercedes-benz",
  "xpeng",
]);

/* Le tinte dei disegnati a mano, piu' Leapmotor che ha il suo marchio dentro al
 * codice: il pacchetto non le dichiara perche' quei marchi non ce li ha. */
const TINTE_A_MANO = Object.freeze({
  abarth: "#B01B2E",
  byd: "#D0021B",
  cupra: "#95572B",
  lancia: "#003B7A",
  lexus: "#1A1A1A",
  "mercedes-benz": "#00A19B",
  xpeng: "#00A0E9",
  leapmotor: "#0B69C7",
});

/* Gli slug che il catalogo chiede, letti dal catalogo stesso: un elenco a parte
 * si sarebbe scollato al primo marchio aggiunto. */
function slugRichiesti() {
  const sorgente = readFileSync(CATALOGO, "utf8");
  const blocco = sorgente.match(/const SIMPLE_ICON_SLUGS = Object\.freeze\(\{([\s\S]*?)\}\);/);
  if (!blocco) throw new Error("SIMPLE_ICON_SLUGS: non trovato nel catalogo");
  const mappa = new Map();
  for (const riga of blocco[1].split("\n")) {
    const coppia = riga.match(/^\s*"?([a-z0-9-]+)"?\s*:\s*"([a-z0-9-]+)"/);
    if (coppia) mappa.set(coppia[1], coppia[2]);
  }
  if (!mappa.size) throw new Error("SIMPLE_ICON_SLUGS: nessuna coppia letta");
  return mappa;
}

const cartella = mkdtempSync(join(tmpdir(), "loghi-"));
try {
  console.log(`scarico ${PACCHETTO}@${VERSIONE}…`);
  execFileSync("npm", ["pack", `${PACCHETTO}@${VERSIONE}`, "--silent"], { cwd: cartella, stdio: "pipe" });
  const tgz = readdirSync(cartella).find((nome) => nome.endsWith(".tgz"));
  if (!tgz) throw new Error("il pacchetto non e' stato scaricato");
  execFileSync("tar", ["xzf", tgz], { cwd: cartella });

  const iconeDir = join(cartella, "package/icons");
  const disponibili = new Set(
    readdirSync(iconeDir).filter((nome) => nome.endsWith(".svg")).map((nome) => nome.slice(0, -4)),
  );

  /* I colori ufficiali li dichiara il pacchetto, uno per marchio. Prima erano
   * tutti neri: un logo nero su fondo scuro sparisce, e messi in fila
   * sembravano tutti la stessa cosa. */
  /* Il formato e' cambiato fra le versioni: quelle nuove danno un elenco con lo
   * slug scritto, quelle vecchie un oggetto `{ icons: [...] }` in cui lo slug
   * si ricava dal titolo. Si accettano tutte e due invece di fidarsi di una. */
  const voci = (testo) => {
    const letto = JSON.parse(testo);
    return Array.isArray(letto) ? letto : letto?.icons || [];
  };
  const slugDi = (voce) =>
    voce?.slug || String(voce?.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const colori = new Map();
  for (const voce of voci(readFileSync(join(cartella, "package/data/simple-icons.json"), "utf8")))
    if (voce?.hex) colori.set(slugDi(voce), `#${voce.hex}`);

  /* La versione storica, solo per i pochi che sono stati tolti. */
  const storicaDir = join(cartella, "storica/package/icons");
  let storiche = new Set();
  if (DA_VERSIONE_STORICA.size) {
    mkdirSync(join(cartella, "storica"), { recursive: true });
    console.log(`scarico ${PACCHETTO}@${VERSIONE_STORICA} per i marchi tolti…`);
    execFileSync("npm", ["pack", `${PACCHETTO}@${VERSIONE_STORICA}`, "--silent"], {
      cwd: join(cartella, "storica"),
      stdio: "pipe",
    });
    const vecchio = readdirSync(join(cartella, "storica")).find((nome) => nome.endsWith(".tgz"));
    execFileSync("tar", ["xzf", vecchio], { cwd: join(cartella, "storica") });
    storiche = new Set(
      readdirSync(storicaDir).filter((nome) => nome.endsWith(".svg")).map((nome) => nome.slice(0, -4)),
    );
    /* Le versioni piu' vecchie tengono i dati sotto `_data`, non `data`. */
    const datiStorici = ["storica/package/data", "storica/package/_data"]
      .map((dove) => join(cartella, dove, "simple-icons.json"))
      .find((percorso) => existsSync(percorso));
    for (const voce of datiStorici ? voci(readFileSync(datiStorici, "utf8")) : [])
      if (voce?.hex && !colori.has(slugDi(voce))) colori.set(slugDi(voce), `#${voce.hex}`);
  }

  mkdirSync(USCITA, { recursive: true });
  for (const vecchio of readdirSync(USCITA))
    if (vecchio.endsWith(".svg") && !DISEGNATI_A_MANO.has(vecchio.slice(0, -4)))
      rmSync(join(USCITA, vecchio));

  const richiesti = slugRichiesti();
  const scritti = [];
  const mancanti = [];
  const tinte = [];
  for (const [id, slug] of richiesti) {
    if (DISEGNATI_A_MANO.has(id)) {
      scritti.push(id);
      tinte.push([id, TINTE_A_MANO[id]]);
      continue;
    }
    const daStorica = !disponibili.has(slug) && storiche.has(slug);
    if (!disponibili.has(slug) && !daStorica) {
      mancanti.push([id, slug]);
      continue;
    }
    /* Il colore lo decide la plancia, non il file: `currentColor` fa seguire al
     * logo la tinta del marchio, che si scrive nel catalogo qui accanto. Simple
     * Icons li distribuisce neri pieni, e su fondo scuro sparivano. */
    const svg = readFileSync(join(daStorica ? storicaDir : iconeDir, `${slug}.svg`), "utf8").replace(
      /<svg /,
      '<svg fill="currentColor" ',
    );
    writeFileSync(join(USCITA, `${id}.svg`), svg);
    scritti.push(id);
    if (colori.has(slug)) tinte.push([id, colori.get(slug)]);
  }

  tinte.push(["leapmotor", TINTE_A_MANO.leapmotor]);

  /* Un marchio nero non prende il nero.
   *
   * Il colore ufficiale di parecchie case E' il nero — MINI, Audi, Honda — e
   * scriverlo vorrebbe dire farle sparire sul tema scuro, che e' esattamente il
   * difetto da cui si viene. Sotto una certa luminosita' la tinta non si scrive
   * affatto: il logo segue il tema, come faceva prima, e lo fa per una ragione
   * detta invece che per dimenticanza. */
  const troppoScuro = (hex) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    /* Si scarta il NERO, non il colore scuro. La luminosita' da sola bocciava
     * il rosso Tesla — `#CC0000`, che di rosso e' pieno — perche' il rosso pesa
     * poco sull'occhio. Quello che conta e' se nel colore c'e' un colore: il
     * canale piu' acceso. Sotto una certa soglia e' grigio o nero, e li' il
     * tema fa meglio di noi. */
    return Math.max(r, g, b) < 70;
  };
  const tinteVive = tinte.filter(([, hex]) => hex && !troppoScuro(hex));

  /* Le tinte finiscono nel catalogo, che e' l'unico posto che sa cosa sia un
   * marchio. Scritte da qui e non a mano: un colore copiato a occhio e' un
   * colore sbagliato che nessuno rilegge. */
  const sorgente = readFileSync(CATALOGO, "utf8");
  const blocco = [
    "const CAR_BRAND_COLORS = Object.freeze({",
    ...tinteVive.sort().map(([id, hex]) => `  "${id}": "${hex}",`),
    "});",
  ].join("\n");
  if (!/const CAR_BRAND_COLORS = Object\.freeze\(\{[\s\S]*?\}\);/.test(sorgente))
    throw new Error("CAR_BRAND_COLORS: non trovato nel catalogo");
  /* Anche l'elenco dei loghi che ci sono davvero si scrive da qui. Scritto a
   * mano si scollerebbe dalla cartella al primo marchio aggiunto, e un logo che
   * c'e' ma non e' dichiarato non compare — in silenzio. */
  const elenco = [
    "const LOGHI_IN_CASA = Object.freeze([",
    ...scritti.sort().map((id) => `  "${id}",`),
    "]);",
  ].join("\n");
  if (!/const LOGHI_IN_CASA = Object\.freeze\(\[[\s\S]*?\]\);/.test(sorgente))
    throw new Error("LOGHI_IN_CASA: non trovato nel catalogo");
  writeFileSync(
    CATALOGO,
    sorgente
      .replace(/const CAR_BRAND_COLORS = Object\.freeze\(\{[\s\S]*?\}\);/, blocco)
      .replace(/const LOGHI_IN_CASA = Object\.freeze\(\[[\s\S]*?\]\);/, elenco),
  );
  console.log(`scritte ${tinteVive.length} tinte nel catalogo (${tinte.length - tinteVive.length} troppo scure, seguono il tema)`);

  writeFileSync(
    join(USCITA, "LICENSE.txt"),
    [
      "I loghi in questa cartella vengono da Simple Icons (https://simple-icons.org),",
      `versione ${VERSIONE}, distribuiti sotto CC0 1.0 Universal: pubblico dominio.`,
      "",
      "Sono stati ritoccati in un punto solo: l'attributo `fill` e' `currentColor`,",
      "cosi' il logo prende il colore del tema invece di restare nero su fondo scuro.",
      "",
      "I marchi raffigurati appartengono ai rispettivi titolari. Compaiono qui per",
      "identificare l'auto che l'utente ha configurato, non per suggerire un legame.",
      "",
      "CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/",
    ].join("\n"),
  );

  console.log(`scritti ${scritti.length} loghi in ${USCITA}`);
  if (mancanti.length) {
    console.log(`\nnon esistono nel pacchetto (restano le iniziali disegnate):`);
    for (const [id, slug] of mancanti) console.log(`  ${id} -> ${slug}`);
  }
} finally {
  rmSync(cartella, { recursive: true, force: true });
}
