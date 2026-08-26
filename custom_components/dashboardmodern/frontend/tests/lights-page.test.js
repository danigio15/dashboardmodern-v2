/* La pagina Luci: la sezione intera nella barra, con il conto delle accese in
 * alto, i comandi per tutta la casa, i gruppi per stanza e una card per luce
 * costruita da quello che l'entita' dichiara — mai dal dominio. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { lightView, lightSummary } from "../src/core/light-model.js";
import {
  LIGHTS_PAGE_ID,
  LIGHTS_TAB,
  pageCardMarkup,
  pageSummaryMarkup,
  renderLightsHeroMarkup,
  renderLightsPageMarkup,
} from "../src/sections/lights-page-section.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const strip = lightView("light.strip", {
  name: "Strip TV",
  room: "Salone",
  state: {
    state: "on",
    attributes: {
      supported_color_modes: ["hs", "color_temp"],
      color_mode: "hs",
      brightness: 128,
      rgb_color: [255, 0, 0],
    },
  },
});
const spots = lightView("light.faretti", {
  name: "Faretti",
  room: "Salone",
  state: { state: "on", attributes: { supported_color_modes: ["brightness"], brightness: 255 } },
});
const relay = lightView("switch.presa", {
  name: "Lampada a rele'",
  room: "Studio",
  state: { state: "off", attributes: {} },
});
const gone = lightView("light.rotta", { name: "Rotta", room: "Studio" });

test("senza luci la pagina dice cosa manca, senza fascia ne' comandi", () => {
  const markup = renderLightsPageMarkup([]);
  assert.match(markup, /Nessuna luce configurata/);
  assert.doesNotMatch(markup, /dm-lucip-hero/);
  assert.doesNotMatch(markup, /data-dm-lucip-all/);
});

test("il conto in alto dice quante accese su quante, o tutte spente", () => {
  assert.match(pageSummaryMarkup(lightSummary([strip, spots, relay])), /<b>2\/3<\/b>/);
  // Una sola accesa parla al singolare.
  assert.match(pageSummaryMarkup(lightSummary([strip, relay])), /accesa/);
  assert.match(pageSummaryMarkup(lightSummary([relay])), /Tutte spente/);
});

test("la fascia porta i due comandi per tutta la casa", () => {
  const hero = renderLightsHeroMarkup([strip, relay]);
  assert.match(hero, /data-dm-lucip-all="on"/);
  assert.match(hero, /data-dm-lucip-all="off"/);
  assert.match(hero, /Accendi tutte/);
  assert.match(hero, /Spegni tutte/);
});

test("la card offre solo quello che la luce sa fare", () => {
  // Un dimmer ha il cursore sulla card; il colore apre la scheda controlli.
  const rgb = pageCardMarkup(strip);
  assert.match(rgb, /data-dm-lucip-brightness/);
  assert.match(rgb, /data-dm-lucip-open/);
  assert.match(rgb, /data-kind="rgb"/);

  const dimmer = pageCardMarkup(spots);
  assert.match(dimmer, /data-dm-lucip-brightness/);
  // Niente colore, niente bianco, niente effetti: niente scheda controlli.
  assert.doesNotMatch(dimmer, /data-dm-lucip-open/);

  // Una lampada dietro un rele' accende e spegne soltanto.
  const relayCard = pageCardMarkup(relay);
  assert.doesNotMatch(relayCard, /data-dm-lucip-brightness/);
  assert.doesNotMatch(relayCard, /data-dm-lucip-open/);
  assert.match(relayCard, /data-kind="switch"/);
});

test("una luce la cui entita' manca resta, segnata non disponibile", () => {
  const markup = pageCardMarkup(gone);
  assert.match(markup, /data-dm-lucip-available="false"/);
  assert.match(markup, /NON DISPONIBILE/);
});

test("ogni stanza ha il suo conto e il suo comando, che parla al contrario", () => {
  const markup = renderLightsPageMarkup([
    { room: "Salone", views: [strip, spots] },
    { room: "Studio", views: [relay] },
  ]);
  assert.match(markup, /data-dm-lucip-group="Salone"/);
  assert.match(markup, /2\/2/);
  // Nel Salone sono tutte accese: il comando offerto e' spegnere.
  assert.match(markup, /data-dm-lucip-room="off" data-dm-lucip-room-name="Salone"/);
  // Nello Studio e' tutto spento: il comando offerto e' accendere.
  assert.match(markup, /data-dm-lucip-room="on" data-dm-lucip-room-name="Studio"/);
});

test("la sezione e' installata dal runtime e la pagina ha la sua intestazione", async () => {
  const runtime = await read("../src/sections/section-runtime.js");
  assert.match(runtime, /installLightsPageSection\(\)/);
  const masthead = await read("../src/sections/page-masthead-section.js");
  assert.match(masthead, new RegExp(`id: "${LIGHTS_PAGE_ID}"`));
});

test("la voce nella barra e la pagina usano la stessa chiave delle altre", async () => {
  const section = await read("../src/sections/lights-page-section.js");
  // La voce si nasconde come tutte: la mappa di cdApplyNavVis la deve sapere.
  assert.match(section, /cdNavVisMap/);
  assert.equal(LIGHTS_TAB, "luci");
  assert.equal(LIGHTS_PAGE_ID, "page-luci");
});

test("da schermo largo il nome ci sta e le tessere riempiono la riga", async () => {
  const section = await read("../src/sections/lights-page-section.js");
  /* «Lampadario C…» e «Salone - Farett…»: il nome moriva al primo troncamento
   * perche' la card era larga 258px fissi e il titolo stava su una riga sola.
   * Adesso il titolo ha due righe, e da schermo largo le tessere crescono fino
   * a riempire la riga invece di lasciare mezzo metro di bianco a destra. */
  assert.match(section, /-webkit-line-clamp:2/);
  assert.doesNotMatch(section, /dm-lucip-title strong\{[^}]*white-space:nowrap/);
  const desktop = section.match(/@media\(min-width:900px\)\{[\s\S]*?\n      \}/);
  assert.ok(desktop, "manca il blocco da schermo largo");
  /* La card della luce non e' piu' incatenata a una pagina sola: la pagina
   * Stanze mostra le stesse, e il foglio deve valere anche li'. */
  assert.match(desktop[0], /:is\(#page-luci,#page-stanze\) \.dm-lucip-grid\{display:flex;flex-wrap:wrap\}/);
  // Il tetto serve: una stanza con una luce sola non diventa un cartellone.
  assert.match(desktop[0], /:is\(#page-luci,#page-stanze\) \.dm-lucip-card\{flex:1 1 272px;max-width:384px\}/);
  /* Il comando della stanza stava all'altro capo dello schermo, a un metro dal
   * conteggio che lo riguarda: da schermo largo torna accanto al suo. */
  assert.match(desktop[0], /\.dm-lucip-room-btn\{order:0\}/);
  assert.match(desktop[0], /\.dm-lucip-room::after\{order:1\}/);
  // E la fascia in alto smette di essere due bottoni lunghi mezzo metro.
  assert.match(desktop[0], /\.dm-lucip-bulk\{flex:0 1 560px\}/);
});
