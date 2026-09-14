/* «Quando uso l'app companion su cellulare vedo la mappa, se apro HA su PC mi
 *  da' un messaggio di errore 403» (#529), e da chi l'ha confermata: «oggi da
 *  me pioveva e vedevo la perturbazione ma non la mappa».
 *
 * La pioggia arriva, il fondo no. Il fondo era il server della fondazione
 * OpenStreetMap, che e' fatto per il loro sito: le regole d'uso chiedono a chi
 * ne fa un uso pesante di servirsi altrove, e chi non si adegua lo bloccano
 * guardando `Referer` e `User-Agent` — ed e' per questo che dal telefono si
 * vedeva e dal computer no. Il 403 non e' un guasto da aggirare: e' la
 * risposta prevista, e si sta altrove.
 *
 * Qui si tiene fermo quello che ne e' seguito: un fondo di serie che non e' il
 * loro, piu' di una voce in tendina perche' questa e' la seconda volta che un
 * servizio gratuito chiude la porta, la firma di chi disegna la mappa (Esri la
 * chiede), e — la parte che avrebbe evitato la segnalazione — il fondo che
 * quando non risponde lo dice.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FONDI_MAPPA,
  FONDI_RITIRATI,
  FONDO_DI_SERIE,
  attribuzioneDelFondo,
  fondoDelRadar,
  modelloDelFondo,
  urlDellaTessera,
} from "../src/core/radar-mappa.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("il fondo di serie non è più il server della fondazione OpenStreetMap", () => {
  assert.notEqual(FONDO_DI_SERIE, "osm");
  assert.ok(FONDI_MAPPA[FONDO_DI_SERIE], "quello di serie deve esistere in tendina");
  assert.doesNotMatch(modelloDelFondo({}), /tile\.openstreetmap\.org/);
  /* Chi l'aveva scelto a mano se lo tiene: non si cambia la casa di chi non ha
   * nessun problema. */
  assert.match(modelloDelFondo({ fondo: "osm" }), /tile\.openstreetmap\.org/);
});

test("più di una voce, perché questa è la seconda porta che si chiude", () => {
  /* CARTO era la prima: oggi vuole una chiave, e ha lasciato a piedi anche la
   * mappa di Home Assistant. Con una voce sola ogni chiusura è un rilascio. */
  assert.ok(Object.keys(FONDI_MAPPA).length >= 2);
  assert.equal(FONDI_MAPPA.carto, undefined);
  assert.equal(FONDI_RITIRATI.carto, FONDO_DI_SERIE);
});

test("ogni fondo dice di chi è, e la firma esce dallo stesso posto dell'indirizzo", () => {
  for (const [chiave, voce] of Object.entries(FONDI_MAPPA)) {
    assert.ok(voce.nome, `${chiave} senza nome`);
    assert.ok(voce.attribuzione, `${chiave} senza attribuzione`);
  }
  /* Una risposta sola a due domande: stampare il nome di un servizio mentre se
   * ne disegna un altro sarebbe peggio che non stamparlo. */
  for (const config of [{}, { fondo: "osm" }, { fondo: "carto" }, { fondo: "nessuna" }]) {
    const scelto = fondoDelRadar(config);
    assert.equal(modelloDelFondo(config), scelto.modello);
    assert.equal(attribuzioneDelFondo(config), scelto.attribuzione);
  }
  /* Un indirizzo scritto a mano non ha una firma che possiamo conoscere, e non
   * se ne inventa una. */
  const mio = { fondo: "modello", fondoModello: "https://mio/{z}/{x}/{y}.png" };
  assert.equal(attribuzioneDelFondo(mio), "");
  assert.equal(modelloDelFondo(mio), "https://mio/{z}/{x}/{y}.png");
  /* Niente mappa, niente firma. */
  assert.equal(attribuzioneDelFondo({ fondo: "nessuna" }), "");
});

test("l'ordine dei segnaposto lo decide il modello, non noi", () => {
  /* Esri conta prima la riga e poi la colonna: `{z}/{y}/{x}`. Un costruttore
   * che sostituisse per posizione invece che per nome pescherebbe il
   * quadratino sbagliato, e la mappa mostrerebbe un pezzo di mondo a caso. */
  const tessera = { x: 66, y: 45 };
  assert.equal(
    urlDellaTessera("https://s/{z}/{y}/{x}", tessera, 7),
    "https://s/7/45/66",
  );
  assert.equal(
    urlDellaTessera("https://s/{z}/{x}/{y}.png", tessera, 7),
    "https://s/7/66/45.png",
  );
});

test("il fondo che non risponde lo dice, invece di lasciare la pioggia sul nulla", async () => {
  const radar = await leggi("../src/sections/radar-meteo-section.js");
  /* Il verdetto del fondo è suo, separato da quello della pioggia. */
  assert.match(radar, /nodo\.dataset\.dmFondo = "muto"/);
  assert.match(radar, /nodo\.dataset\.dmFondo = "vivo"/);
  assert.match(radar, /nodo\.dataset\.dmFondo = "attesa"/);
  /* Chi il fondo non lo vuole non ha niente da lamentare. */
  assert.match(radar, /else delete nodo\.dataset\.dmFondo;/);
  /* E la frase si vede solo nel caso della segnalazione: radar vivo, fondo
   * muto. Se a mancare è la pioggia parla l'altra frase, che è la più grave. */
  assert.match(
    radar,
    /\[data-dm-radar="vivo"\]\[data-dm-fondo="muto"\] \.dm-radar-fondo-muto\{\s*display:block\}/,
  );
  /* La frase dice anche dove si cambia: senza, resta un errore da segnalare. */
  assert.match(radar, /La mappa di fondo non risponde\./);
  assert.match(radar, /Meteo e radar/);
});

test("il verdetto del fondo non sopravvive al passaggio al radar a entità", async () => {
  /* Il blocco del radar si riusa, non si rifa'. Chi aveva il radar a tessere e
   * si era visto dire «la mappa di fondo non risponde», poi passa a una
   * `camera.*` in ⚙️ → Meteo e radar: lì la mappa di fondo non esiste
   * proprio, ma il verdetto di prima resterebbe scritto addosso al nodo e la
   * frase gialla comparirebbe sopra l'immagine della telecamera — che invece
   * è arrivata benissimo. Un verdetto su una cosa che non c'è è una bugia. */
  const radar = await leggi("../src/sections/radar-meteo-section.js");
  const dentro = radar.slice(
    radar.indexOf("async function daEntita("),
    radar.indexOf("/* \u2500\u2500 il radar a tessere"),
  );
  assert.ok(dentro, "daEntita deve esistere");
  assert.match(dentro, /delete nodo\.dataset\.dmFondo;/);
  /* E la cancellazione viene PRIMA di aspettare il fotogramma: fra la domanda
   * e la risposta la frase di prima sarebbe ancora lì. */
  assert.ok(
    dentro.indexOf("delete nodo.dataset.dmFondo;") < dentro.indexOf("await loadCameraFrame"),
    "il verdetto vecchio si cancella prima di chiedere il fotogramma",
  );
});
