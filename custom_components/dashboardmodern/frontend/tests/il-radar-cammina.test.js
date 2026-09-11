/* Il radar che cammina (#393).
 *
 * «Sarebbe bello un package del meteo possibilmente dinamico da poter inserire
 * in home oppure nell'apposito spazio, dove implementarlo con un radar.»
 *
 * Il radar c'era gia' — dentro le previsioni, sopra i sette giorni — ma era
 * una fotografia: un fotogramma solo, l'ultimo misurato. Una fotografia dice
 * DOVE piove; la domanda per cui si apre un radar e' DOVE VA, e a quella
 * risponde solo il movimento.
 *
 * Le prove tengono ferme cinque cose:
 *
 * 1. i fotogrammi sono quelli MISURATI, non le previsioni: un radar che mostra
 *    un «nowcast» insieme al presente racconta come successa una cosa che non
 *    e' successa;
 * 2. l'ultimo fotogramma resta l'adesso, e senza fila e' esattamente il
 *    disegno di prima;
 * 3. la fila si chiede una volta sola, con la stessa risposta da cui si legge
 *    l'ultimo;
 * 4. l'animazione e' accesa di serie e si spegne da una casella, e spenta
 *    torna al fotogramma solo;
 * 5. chi ha chiesto meno movimento non ne riceve.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  FOTOGRAMMI_ANIMATI,
  fotogrammaRainViewer,
  fotogrammiRainViewer,
  modelliDelServizio,
  modelloDelServizio,
} from "../src/core/radar-mappa.js";

const sorgente = readFileSync(
  new URL("../src/sections/radar-meteo-section.js", import.meta.url),
  "utf8",
);

/* Un elenco come lo manda RainViewer: `past` sono i misurati, `nowcast` le
 * previsioni. Le ore sono in secondi, come le scrive lui. */
const ELENCO = {
  host: "https://tilecache.rainviewer.com/",
  radar: {
    past: [
      { time: 1_757_000_000, path: "/v2/radar/1757000000" },
      { time: 1_757_000_600, path: "/v2/radar/1757000600" },
      { time: 1_757_001_200, path: "/v2/radar/1757001200" },
    ],
    nowcast: [{ time: 1_757_001_800, path: "/v2/radar/nowcast_1757001800" }],
  },
};

test("i fotogrammi sono i misurati, in ordine, e l'ultimo e' l'adesso", () => {
  const fila = fotogrammiRainViewer(ELENCO);
  assert.equal(fila.length, 3);
  /* Dal piu' vecchio al piu' recente: un'animazione che va all'indietro
   * racconta la pioggia che torna da dove e' venuta. */
  assert.deepEqual(
    fila.map((voce) => voce.time),
    [1_757_000_000, 1_757_000_600, 1_757_001_200],
  );
  /* Niente previsioni in mezzo ai misurati. */
  assert.ok(!fila.some((voce) => voce.path.includes("nowcast")));
  /* E l'ultimo e' quello che si vedeva prima, quando il radar era fermo. */
  assert.deepEqual(fotogrammaRainViewer(ELENCO), fila[fila.length - 1]);
  /* La barra in fondo all'ospite non si somma al percorso. */
  assert.ok(fila.every((voce) => voce.host === "https://tilecache.rainviewer.com"));
});

test("si tengono sei fotogrammi: l'ultima ora, non tutta la storia", () => {
  assert.equal(FOTOGRAMMI_ANIMATI, 6);
  const lungo = {
    host: "https://x",
    radar: {
      past: Array.from({ length: 13 }, (_, indice) => ({
        time: 1_000 + indice,
        path: `/p${indice}`,
      })),
    },
  };
  const fila = fotogrammiRainViewer(lungo);
  assert.equal(fila.length, FOTOGRAMMI_ANIMATI);
  /* Sono gli ULTIMI sei: i primi sette sono storia che nessuno sta guardando,
   * e prenderli costerebbe traffico a chi guarda e al servizio. */
  assert.equal(fila[fila.length - 1].time, 1_012);
  assert.equal(fila[0].time, 1_007);
  /* Un elenco storto non diventa un fotogramma a meta'. */
  assert.deepEqual(fotogrammiRainViewer({}), []);
  assert.deepEqual(fotogrammiRainViewer({ host: "https://x" }), []);
  assert.equal(fotogrammaRainViewer({}), null);
});

test("ogni fotogramma porta il suo indirizzo, e quelli storti restano fuori", () => {
  const modelli = modelliDelServizio("rainviewer", fotogrammiRainViewer(ELENCO));
  assert.equal(modelli.length, 3);
  for (const voce of modelli) {
    assert.match(voce.modello, /\{z\}/);
    assert.ok(voce.modello.includes(voce.fotogramma.path));
  }
  /* Sono gli stessi indirizzi che darebbe il conto a fotogramma singolo: la
   * regola e' una sola, scritta una volta. */
  assert.equal(
    modelli[2].modello,
    modelloDelServizio("rainviewer", fotogrammaRainViewer(ELENCO)),
  );
  /* Un fotogramma senza ospite non da' un indirizzo, e un buco in mezzo
   * all'animazione e' un lampo di mappa vuota: resta fuori. */
  assert.deepEqual(modelliDelServizio("rainviewer", [{ path: "/p", time: 1 }]), []);
  assert.deepEqual(modelliDelServizio("boh", fotogrammiRainViewer(ELENCO)), []);
});

test("la fila si chiede insieme all'ultimo, non con una seconda richiesta", () => {
  const lettura = sorgente.slice(
    sorgente.indexOf("async function aggiornaFotogramma("),
    sorgente.indexOf("export function modelloVivo("),
  );
  /* Una `fetch` sola dentro la funzione che esce di casa. */
  assert.equal([...lettura.matchAll(/root\.fetch\(/g)].length, 1);
  assert.match(lettura, /const detto = await risposta\.json\(\);/);
  assert.match(lettura, /elenco = ELENCHI\[servizio\]\?\.\(detto\) \|\| \[\];/);
  assert.match(lettura, /\{ quando: Date\.now\(\), fotogramma, elenco \}/);
});

test("l'animazione e' accesa di serie e si spegne da una casella", () => {
  /* Il si' si scrive vuoto: `radarToccato` decide da cio' che e' scritto se
   * questa casa il radar l'ha configurato, e un valore di serie scritto dentro
   * farebbe passare per configurata una casa che non ha scelto niente. */
  assert.match(sorgente, /animato: clean\(grezzo\.animato\) !== "no"/);
  assert.match(sorgente, /campo\.type === "checkbox" \? \(campo\.checked \? "" : "no"\)/);
  assert.match(sorgente, /data-dm-radar-campo="animato"/);
  /* Spenta, si torna al fotogramma solo — un giro di quadratini invece di sei,
   * che e' la ragione per cui l'interruttore esiste. */
  assert.match(sorgente, /if \(!scelto\?\.animato\) return solo;/);
  /* E un servizio che una fila non ce l'ha non se la inventa. */
  assert.match(sorgente, /return tutti\.length > 1 \? tutti : solo;/);
});

test("si accende uno strato per volta, senza ridisegnare né riscaricare", () => {
  /* I quadratini si disegnano una volta sola, alla firma; il passo
   * dell'animazione accende e spegne, e non tocca nessuna immagine. */
  const passo = sorgente.slice(
    sorgente.indexOf("function mostraIlFotogramma("),
    sorgente.indexOf("function riarma("),
  );
  assert.doesNotMatch(passo, /createElement|\.src\s*=|urlDellaTessera/);
  assert.match(passo, /strato\.dataset\.dmVisto = "si"/);
  assert.match(passo, /delete strato\.dataset\.dmVisto/);
  /* Gli strati si spengono con l'opacita' e non con `display:none`: cosi' il
   * browser tiene le immagini decodificate e il passo non sfarfalla. */
  assert.match(sorgente, /\.dm-radar-strato\{[^}]*opacity:0/);
  assert.match(sorgente, /\.dm-radar-strato\[data-dm-visto="si"\]\{opacity:1\}/);
});

test("chi ha chiesto meno movimento vede l'adesso e basta", () => {
  assert.match(sorgente, /prefers-reduced-motion: reduce/);
  assert.match(sorgente, /function menoMovimento\(\)/);
  /* Fermi, si resta sull'ULTIMO — l'adesso — non su quello a cui l'animazione
   * era arrivata: un radar fermo su un'ora fa e' un radar che mente. */
  const regola = sorgente.slice(
    sorgente.indexOf("function regolaLAnimazione("),
    sorgente.indexOf("function ferma("),
  );
  assert.match(regola, /!finestraAperta\(\) \|\| menoMovimento\(\)/);
  assert.match(regola, /state\.posto = fila\.length - 1;/);
  /* E a finestra chiusa non gira niente: `ferma` spegne tutti e due i tempi. */
  assert.match(sorgente, /function ferma\(\) \{\s*fermaLAnimazione\(\);/);
});
