/* Costruisce il set di ritratti 3D delle persone.
 *
 * I ritratti non li disegniamo noi: sono i render 3D di Fluent Emoji, di
 * Microsoft, licenza MIT. Questo script li prende, li rimpicciolisce, li
 * converte in WebP e — la parte che conta — li MISURA: dov'e' la testa in
 * ogni immagine, e dove sono gli occhi.
 *
 * Quelle due misure sono tutto il trucco della sezione:
 *
 *  - la testa serve per la fusione. I render hanno tutti la stessa
 *    telecamera, ma le teste sole sono inquadrate piu' grandi di quelle che
 *    stanno sopra un busto vestito. Sapendo bordo, centro e larghezza della
 *    testa in entrambe le immagini, si riscala la testa scelta sul corpo
 *    scelto e le due combaciano: cosi' «ricci» e «cuoco» diventano una
 *    combinazione libera invece di due ritratti separati;
 *  - gli occhi servono per il battito di ciglia. Sono render piatti, gli
 *    occhi non stanno su un livello suo: si trovano cercando le due macchie
 *    chiare e desaturate nella meta' alta della testa — la sclera e' l'unica
 *    cosa cosi' chiara e cosi' poco colorata su una faccia — e sopra ci si
 *    disegna la palpebra.
 *
 * Misurare costa: farlo a ogni caricamento della plancia, su trecento
 * immagini, sarebbe assurdo. Si fa qui, una volta, e il risultato finisce in
 * un catalogo che il runtime legge e basta.
 *
 * Uso:  node scripts/costruisci-avatar-3d.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = join(RADICE, "custom_components", "dashboardmodern", "frontend");
const USCITA = join(FRONTEND, "avatars");
const CATALOGO = join(FRONTEND, "src", "core", "avatar-catalog.js");
const SORGENTE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";
const LATO = 192;

/* ── Cosa si puo' scegliere ───────────────────────────────────────────────
 * Le chiavi sono nostre e stabili: cambiare il nome di un file a monte non
 * deve cambiare una configurazione gia' salvata. */

export const PERSONE = [
  { key: "uomo", nome: "Man", capelli: true },
  { key: "donna", nome: "Woman", capelli: true },
  { key: "neutro", nome: "Person", capelli: true },
  { key: "ragazzo", nome: "Boy", capelli: false },
  { key: "ragazza", nome: "Girl", capelli: false },
  /* A monte gli anziani per genere ci sono eccome: «Old man» e «Old woman»,
   * con tutte le carnagioni. La chiave `anziano` resta quella di sempre —
   * cambia solo il render che ci sta dietro — e `anziana` nasce accanto.
   * I vecchi file `older_person_*` restano su disco per chi ha una cache. */
  { key: "anziano", nome: "Old man", capelli: false },
  { key: "anziana", nome: "Old woman", capelli: false },
];

/* Le varianti di testa renderizzate a monte. Non sono piu' la fila «Capelli»
 * dell'editor: li' si scelgono taglio, barba e colore per conto loro, e il
 * modello (`avatar-3d.js`) traduce quella scelta nella variante nativa piu'
 * vicina — biondo su lisci e' un render vero, biondo su ricci e' una tinta
 * fatta a runtime sopra i ricci scuri. */
export const CAPELLI = [
  { key: "lisci", suffisso: "" },
  { key: "barba", suffisso: "beard" },
  { key: "ricci", suffisso: "curly hair" },
  { key: "rossi", suffisso: "red hair" },
  { key: "bianchi", suffisso: "white hair" },
  { key: "biondi", suffisso: "blonde hair" },
  { key: "calvo", suffisso: "bald" },
];

export const CARNAGIONI = [
  { key: "chiara", tono: "Light" },
  { key: "chiara2", tono: "Medium-Light" },
  { key: "media", tono: "Medium" },
  { key: "ambrata", tono: "Medium-Dark" },
  { key: "scura", tono: "Dark" },
];

/* I vestiti sono i ritratti «di mestiere»: portano il busto vestito, e la
 * testa che ci arriva sopra e' quella scelta. Fuori restano quelli che
 * portano un oggetto grosso davanti — il portatile, la lavagna — che in un
 * cerchio da novanta pixel coprirebbe la persona. */
export const VESTITI = [
  /* `ricolorabile` sta anche su due mestieri storici: il completo
   * dell'ufficio e il camice del medico sono tessuti a tinta piena, e la
   * finestra HSV del compositore li sa spostare su un altro colore. */
  { key: "ufficio", nome: "office worker", ricolorabile: true },
  { key: "medico", nome: "health worker", ricolorabile: true },
  { key: "cuoco", nome: "cook" },
  { key: "smoking", nome: "in tuxedo" },
  { key: "velo", nome: "with veil" },
  { key: "pompiere", nome: "firefighter" },
  { key: "poliziotto", nome: "police officer" },
  { key: "muratore", nome: "construction worker" },
  { key: "operaio", nome: "factory worker" },
  { key: "meccanico", nome: "mechanic" },
  { key: "contadino", nome: "farmer" },
  { key: "pilota", nome: "pilot" },
  { key: "astronauta", nome: "astronaut" },
  { key: "giudice", nome: "judge" },
  { key: "supereroe", nome: "superhero" },
  /* Il guardaroba largo: mestieri che mancavano e qualche travestimento.
   * Sono tutti ritratti «di mestiere» come gli altri — busto vestito, testa
   * libera — e hanno tutte e cinque le carnagioni a monte. */
  { key: "scienziato", nome: "scientist" },
  { key: "insegnante", nome: "teacher" },
  { key: "studente", nome: "student" },
  { key: "informatico", nome: "technologist" },
  { key: "artista", nome: "artist" },
  { key: "cantante", nome: "singer" },
  { key: "guardia", nome: "guard" },
  { key: "detective", nome: "detective" },
  { key: "turbante", nome: "wearing turban" },
  { key: "supercattivo", nome: "supervillain" },
  { key: "mago", nome: "mage" },
  { key: "fata", nome: "fairy" },
  { key: "vampiro", nome: "vampire" },
  { key: "elfo", nome: "elf" },
  /* Il guardaroba di tutti i giorni. `ricolorabile` dice al modello che
   * l'abito accetta la fila «Colore vestito»: sono i busti dove il tessuto e'
   * una tinta piena che la finestra HSV del compositore sa riconoscere.
   * `sintetico` marca gli abiti che a monte non esistono — polo e camicia si
   * dipingono a runtime sul busto della maglietta (colletto e abbottonatura),
   * quindi non hanno file loro. `nomi` limita i generi renderizzati: la
   * persona «In attesa» a monte e' solo «Pregnant woman», e per un ritratto
   * maschile il modello ricade con grazia sul busto femminile. */
  { key: "casual", nome: "tipping hand", ricolorabile: true },
  { key: "saluto", nome: "raising hand", ricolorabile: true },
  { key: "polo", sintetico: "casual", ricolorabile: true },
  { key: "camicia", sintetico: "casual", ricolorabile: true },
  { key: "attesa", nomi: { donna: "Pregnant woman" }, ricolorabile: true },
];

const nomeFile = (nome, tono) => `${nome} ${tono}`.toLowerCase().replace(/[ -]/g, "_");
const indirizzo = (nome, tono) => {
  const snake = nome.toLowerCase().replace(/ /g, "_");
  return `${SORGENTE}/${encodeURIComponent(nome)}/${encodeURIComponent(tono)}/3D/${snake}_3d_${tono.toLowerCase()}.png`;
};

/** Tutte le immagini che servono: le teste e i busti vestiti. */
export function elencoImmagini() {
  const teste = [];
  for (const persona of PERSONE) {
    if (persona.capelli)
      for (const capello of CAPELLI)
        teste.push({
          ruolo: "testa",
          nome: `${persona.nome} ${capello.suffisso}`.trim(),
          persona: persona.key,
          capelli: capello.key,
        });
    else teste.push({ ruolo: "testa", nome: persona.nome, persona: persona.key, capelli: null });
  }
  const busti = [];
  for (const vestito of VESTITI) {
    /* Gli abiti sintetici non hanno un render a monte: si dipingono a
     * runtime sul busto di un altro vestito, e qui non c'e' niente da
     * scaricare ne' da misurare. */
    if (vestito.sintetico) continue;
    for (const genere of [
      ["uomo", "Man"],
      ["donna", "Woman"],
    ]) {
      /* `nomi` dice quali generi esistono a monte, col nome intero: la
       * «Pregnant woman» non e' «Woman pregnant», ed e' sola. */
      const nome = vestito.nomi ? vestito.nomi[genere[0]] : `${genere[1]} ${vestito.nome}`;
      if (!nome) continue;
      busti.push({
        ruolo: "busto",
        nome,
        vestito: vestito.key,
        genere: genere[0],
      });
    }
  }
  const fuori = [];
  for (const voce of [...teste, ...busti])
    for (const pelle of CARNAGIONI)
      fuori.push({
        ...voce,
        carnagione: pelle.key,
        tono: pelle.tono,
        file: nomeFile(voce.nome, pelle.tono),
      });
  return fuori;
}

async function scarica(voce, cartella) {
  const destinazione = join(cartella, `${voce.file}.png`);
  if (existsSync(destinazione)) return true;
  const risposta = await fetch(indirizzo(voce.nome, voce.tono));
  if (!risposta.ok) return false;
  await writeFile(destinazione, Buffer.from(await risposta.arrayBuffer()));
  return true;
}

/* ── La misura, dentro un browser ─────────────────────────────────────────
 * Serve una canvas per leggere i pixel, e l'unica che c'e' qui e' quella di
 * Chromium: e' gia' una dipendenza di sviluppo per le prove end-to-end. */
const MISURA = ([sorgente, lato]) =>
  new Promise((risolvi) => {
    const img = new Image();
    img.onload = () => {
      const tela = document.createElement("canvas");
      tela.width = tela.height = lato;
      const pennello = tela.getContext("2d");
      pennello.drawImage(img, 0, 0, lato, lato);
      const px = pennello.getImageData(0, 0, lato, lato).data;
      const opaco = (i) => px[i * 4 + 3] > 30;

      /* La sagoma intera, e la testa: la larghezza massima nella parte alta,
       * che e' la testa sia da sola sia sopra un busto. */
      let alto = -1,
        basso = 0;
      for (let y = 0; y < lato && alto < 0; y += 1)
        for (let x = 0; x < lato; x += 1)
          if (opaco(y * lato + x)) {
            alto = y;
            break;
          }
      for (let y = lato - 1; y >= 0; y -= 1) {
        let c = false;
        for (let x = 0; x < lato; x += 1)
          if (opaco(y * lato + x)) {
            c = true;
            break;
          }
        if (c) {
          basso = y;
          break;
        }
      }
      const fino = alto + (basso - alto) * 0.45;
      let sinistra = lato,
        destra = 0;
      for (let y = alto; y <= fino; y += 1)
        for (let x = 0; x < lato; x += 1)
          if (opaco(y * lato + x)) {
            if (x < sinistra) sinistra = x;
            if (x > destra) destra = x;
          }

      /* Gli occhi: le macchie chiare e desaturate. */
      const bianco = (i) => {
        if (px[i * 4 + 3] < 200) return false;
        const r = px[i * 4],
          g = px[i * 4 + 1],
          b = px[i * 4 + 2];
        const massimo = Math.max(r, g, b);
        return massimo > 205 && massimo - Math.min(r, g, b) < 26;
      };
      const visto = new Uint8Array(lato * lato);
      const macchie = [];
      for (let y = 0; y < lato * 0.72; y += 1)
        for (let x = 0; x < lato; x += 1) {
          const i = y * lato + x;
          if (visto[i] || !bianco(i)) continue;
          let n = 0,
            sx = 0,
            sy = 0,
            x0 = lato,
            x1 = 0,
            y0 = lato,
            y1 = 0;
          const coda = [i];
          visto[i] = 1;
          while (coda.length) {
            const j = coda.pop(),
              jx = j % lato,
              jy = (j / lato) | 0;
            n += 1;
            sx += jx;
            sy += jy;
            if (jx < x0) x0 = jx;
            if (jx > x1) x1 = jx;
            if (jy < y0) y0 = jy;
            if (jy > y1) y1 = jy;
            for (const [dx, dy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const nx = jx + dx,
                ny = jy + dy;
              if (nx < 0 || ny < 0 || nx >= lato || ny >= lato) continue;
              const k = ny * lato + nx;
              if (!visto[k] && bianco(k)) {
                visto[k] = 1;
                coda.push(k);
              }
            }
          }
          if (n > 22 && n < 2400)
            macchie.push({ n, cx: sx / n, cy: sy / n, w: x1 - x0 + 1, h: y1 - y0 + 1 });
        }
      macchie.sort((a, b) => b.n - a.n);
      const buone = macchie.slice(0, 6).filter((m) => m.w / m.h < 3 && m.h > 4);
      let occhi = null;
      for (let i = 0; i < buone.length && !occhi; i += 1)
        for (let j = i + 1; j < buone.length && !occhi; j += 1)
          if (
            Math.abs(buone[i].cy - buone[j].cy) < lato * 0.05 &&
            Math.abs(buone[i].cx - buone[j].cx) > lato * 0.05
          )
            occhi = [buone[i], buone[j]].sort((a, b) => a.cx - b.cx);

      /* Il colore della palpebra si prende dalla guancia — sotto e di fianco
       * all'occhio. Sopra c'e' il sopracciglio, e una palpebra color
       * sopracciglio e' un occhio nero. */
      const guancia = (o, verso) => {
        const x = Math.min(lato - 1, Math.max(0, Math.round(o.cx + verso * o.w * 0.85)));
        const y = Math.min(lato - 1, Math.max(0, Math.round(o.cy + o.h * 1.15)));
        const i = (y * lato + x) * 4;
        return [px[i], px[i + 1], px[i + 2]];
      };
      const tondo = (v) => Math.round(v * 10) / 10;
      risolvi({
        testa: { alto, basso, cx: tondo((sinistra + destra) / 2), w: destra - sinistra },
        occhi: occhi
          ? occhi.map((o, k) => ({
              cx: tondo(o.cx),
              cy: tondo(o.cy),
              w: Math.round(o.w),
              h: Math.round(o.h),
              pelle: guancia(o, k ? 1 : -1),
            }))
          : null,
        webp: tela.toDataURL("image/webp", 0.9),
      });
    };
    img.onerror = () => risolvi(null);
    img.src = sorgente;
  });

async function principale() {
  const temporanea = join(RADICE, ".avatar-cache");
  await mkdir(temporanea, { recursive: true });
  await mkdir(USCITA, { recursive: true });

  const voci = elencoImmagini();
  process.stdout.write(`${voci.length} ritratti da preparare\n`);

  let mancanti = 0;
  for (const voce of voci)
    if (!(await scarica(voce, temporanea))) {
      voce.assente = true;
      mancanti += 1;
    }
  if (mancanti) process.stdout.write(`  ${mancanti} non esistono a monte, saltati\n`);

  const browser = await chromium.launch();
  const pagina = await browser.newPage();
  await pagina.goto("about:blank");
  const misure = {};
  let fatti = 0;
  for (const voce of voci) {
    if (voce.assente) continue;
    const png = await readFile(join(temporanea, `${voce.file}.png`));
    const misura = await pagina.evaluate(MISURA, [
      `data:image/png;base64,${png.toString("base64")}`,
      LATO,
    ]);
    if (!misura) {
      voce.assente = true;
      continue;
    }
    await writeFile(
      join(USCITA, `${voce.file}.webp`),
      Buffer.from(misura.webp.split(",")[1], "base64"),
    );
    misure[voce.file] = { testa: misura.testa, occhi: misura.occhi };
    fatti += 1;
    if (fatti % 40 === 0) process.stdout.write(`  ${fatti}/${voci.length}\n`);
  }
  await browser.close();

  const senzaOcchi = Object.values(misure).filter((m) => !m.occhi).length;
  if (senzaOcchi)
    process.stdout.write(
      `  ${senzaOcchi} ritratti senza occhi riconosciuti: li' non si batteranno le ciglia\n`,
    );

  const vivi = voci.filter((v) => !v.assente);

  /* ── La testa dei busti con la mano alzata ────────────────────────────
   * «Casual» e «saluto» portano una mano alla stessa altezza della testa —
   * nel saluto perfino piu' su — e nei render femminili tocca i capelli:
   * nessuna scansione della sagoma le separa. Per quei busti la testa si
   * ricava dagli OCCHI, che la misura trova bene anche li': la distanza fra
   * i due fa da righello, e le proporzioni — quanta testa per occhio, quanta
   * risalita fino alla cima — si prendono dal ritratto di sola testa dello
   * stesso genere e della stessa carnagione, che ha la stessa pettinatura.
   * Cosi' la testa scelta a runtime atterra con gli occhi al posto giusto. */
  const MANO_ALZATA = new Set(["casual", "saluto"]);
  const proporzioni = (file) => {
    const misura = misure[file];
    if (!misura?.occhi) return null;
    const passo = misura.occhi[1].cx - misura.occhi[0].cx;
    return {
      larghezza: misura.testa.w / passo,
      risalita: ((misura.occhi[0].cy + misura.occhi[1].cy) / 2 - misura.testa.alto) / passo,
    };
  };
  const decimi = (v) => Math.round(v * 10) / 10;
  for (const voce of vivi.filter((v) => v.ruolo === "busto" && MANO_ALZATA.has(v.vestito))) {
    const misura = misure[voce.file];
    const guida = proporzioni(nomeFile(voce.genere === "donna" ? "Woman" : "Man", voce.tono));
    if (!misura?.occhi || !guida) continue;
    const [primo, secondo] = misura.occhi;
    const passo = secondo.cx - primo.cx;
    misura.testa = {
      alto: Math.max(0, Math.round((primo.cy + secondo.cy) / 2 - guida.risalita * passo)),
      basso: misura.testa.basso,
      cx: decimi((primo.cx + secondo.cx) / 2),
      w: decimi(guida.larghezza * passo),
    };
  }

  const teste = {};
  for (const v of vivi.filter((v) => v.ruolo === "testa"))
    teste[`${v.persona}|${v.capelli ?? ""}|${v.carnagione}`] = v.file;
  const busti = {};
  for (const v of vivi.filter((v) => v.ruolo === "busto"))
    busti[`${v.vestito}|${v.genere}|${v.carnagione}`] = v.file;

  const json = (valore) => JSON.stringify(valore, null, 0);
  await writeFile(
    CATALOGO,
    `/* GENERATO da scripts/costruisci-avatar-3d.mjs — non si modifica a mano.
 *
 * I ritratti sono i render 3D di Fluent Emoji (Microsoft, licenza MIT). Qui
 * ci sono solo i nomi dei file e le misure prese in fase di build: dove sta
 * la testa in ogni immagine — serve a incollare la testa scelta sul busto
 * scelto — e dove stanno gli occhi, che servono a farli sbattere.
 */
export const AVATAR_LATO = ${LATO};
export const AVATAR_PERSONE = ${json(PERSONE.map(({ key, capelli }) => ({ key, capelli })))};
export const AVATAR_CAPELLI = ${json(CAPELLI.map(({ key }) => ({ key })))};
export const AVATAR_CARNAGIONI = ${json(CARNAGIONI.map(({ key }) => ({ key })))};
export const AVATAR_VESTITI = ${json(
    VESTITI.map(({ key, ricolorabile, sintetico }) => ({
      key,
      ...(ricolorabile ? { ricolorabile: true } : {}),
      ...(sintetico ? { sintetico } : {}),
    })),
  )};
export const AVATAR_TESTE = ${json(teste)};
export const AVATAR_BUSTI = ${json(busti)};
export const AVATAR_MISURE = ${json(misure)};
`,
    "utf8",
  );

  /* Il catalogo e' generato, ma resta un file del progetto: passa dallo stesso
   * formattatore di tutti gli altri, o il controllo di stile lo boccia. */
  const prettier = await import("prettier");
  const scritto = await readFile(CATALOGO, "utf8");
  const opzioni = (await prettier.resolveConfig(CATALOGO)) || {};
  await writeFile(CATALOGO, await prettier.format(scritto, { ...opzioni, filepath: CATALOGO }), "utf8");

  await writeFile(
    join(USCITA, "LICENSE.txt"),
    `I ritratti in questa cartella sono Fluent Emoji di Microsoft Corporation,
distribuiti con licenza MIT e ridimensionati per la plancia.

https://github.com/microsoft/fluentui-emoji

MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
    "utf8",
  );

  if (process.argv.includes("--pulisci")) await rm(temporanea, { recursive: true, force: true });
  process.stdout.write(`fatto: ${fatti} ritratti in ${USCITA}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) await principale();
