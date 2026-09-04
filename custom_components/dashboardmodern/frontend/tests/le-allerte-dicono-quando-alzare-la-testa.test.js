/* Le allerte dicono quando alzare la testa (#296).
 *
 * «Presenza di allerte varie: terremoti INGV, thermal comfort zona,
 * concentrazione pollini, concentrazione fulmini zona, avvisi protezione
 * civile, Flightradar24 di zona.»
 *
 * Sei fonti che parlano sei lingue, ridotte a un livello. Queste prove tengono
 * fermi i dialetti — la riga «2; yellow; Moderate» di Meteoalarm che e' gialla
 * e non moderata, il `geo_location` che porta la distanza nello stato — e il
 * fatto che una fonte muta non e' quiete.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CATEGORIE,
  CHIAVE_ALLERTE,
  IGNOTO,
  allerteAttive,
  almeno,
  categorieConfigurate,
  entitaDelleAllerte,
  letturaAllerte,
  livelloDalColore,
  livelloMassimo,
  normalizzaAllerte,
} from "../src/core/allerte-model.js";
import { haOggettoWidget } from "../src/core/oggetti-widget.js";
import { bricioleDellaSezione, fraseDellaTessera } from "../src/core/racconto-tessera.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");
const EN = (_it, en) => en;
const ADESSO = Date.parse("2026-09-03T20:00:00Z");
const stato = (state, attributes = {}, last_changed = "2026-09-03T19:50:00Z") => ({
  state,
  attributes,
  last_changed,
});

test("la configurazione: una voce per categoria, e conta solo chi ha l'entita'", () => {
  const dato = normalizzaAllerte({
    fulmini: { entity: " sensor.fulmini ", distanza: "sensor.distanza" },
    voli: { entity: "" },
    boh: { entity: "sensor.x" },
  });
  assert.deepEqual(Object.keys(dato).sort(), CATEGORIE.map((c) => c.chiave).sort());
  assert.equal(dato.fulmini.entity, "sensor.fulmini");
  assert.deepEqual(categorieConfigurate(dato), ["fulmini"]);
  assert.deepEqual(entitaDelleAllerte(dato), ["sensor.fulmini", "sensor.distanza"]);
  assert.deepEqual(categorieConfigurate(null), []);
  assert.equal(CHIAVE_ALLERTE, "cd_allerte");
});

test("il colore della protezione civile, in tutte le lingue in cui lo scrivono", () => {
  /* La riga di Meteoalarm: il numero davanti comanda, «Moderate» qui e' giallo. */
  assert.equal(livelloDalColore("2; yellow; Moderate"), "nota");
  assert.equal(livelloDalColore("3; orange; Severe"), "attenzione");
  assert.equal(livelloDalColore("4; red; Extreme"), "allarme");
  assert.equal(livelloDalColore("1; green; Minor"), "quiete");
  /* I bollettini italiani. */
  assert.equal(livelloDalColore("gialla"), "nota");
  assert.equal(livelloDalColore("arancione"), "attenzione");
  assert.equal(livelloDalColore("rossa"), "allarme");
  assert.equal(livelloDalColore("ordinaria"), "nota");
  assert.equal(livelloDalColore("moderata"), "nota");
  assert.equal(livelloDalColore("elevata"), "allarme");
  assert.equal(livelloDalColore("verde"), "quiete");
  assert.equal(livelloDalColore("nessuna"), "quiete");
  assert.equal(livelloDalColore(""), null);
  assert.equal(livelloDalColore("boh"), null);
});

test("ogni fonte nel suo dialetto, ridotta a un livello", () => {
  const config = {
    terremoti: { entity: "geo_location.ingv_1" },
    meteo: { entity: "binary_sensor.meteoalarm" },
    fulmini: { entity: "sensor.blitz_conteggio", distanza: "sensor.blitz_distanza" },
    pollini: { entity: "sensor.pollini" },
    comfort: { entity: "sensor.percezione" },
    voli: { entity: "sensor.fr24" },
  };
  const states = {
    /* Un geo_location porta la distanza nello stato e la magnitudo dentro. */
    "geo_location.ingv_1": stato("18.4", { magnitude: 3.2, title: "Frosinone", publication_date: "2026-09-03T18:00:00Z" }),
    "binary_sensor.meteoalarm": stato("on", { awareness_level: "3; orange; Severe", event: "Temporali" }),
    "sensor.blitz_conteggio": stato("12"),
    "sensor.blitz_distanza": stato("7.5", { unit_of_measurement: "km" }),
    "sensor.pollini": stato("high"),
    "sensor.percezione": stato("quite_uncomfortable"),
    "sensor.fr24": stato("2", {
      flights: [
        { flight_number: "AZ1234", airline_short: "ITA", aircraft_model: "A320", altitude: 9000 },
        { callsign: "RYR55", airline_short: "Ryanair" },
      ],
    }),
  };
  const letture = letturaAllerte(config, states, (v) => v, ADESSO);
  const per = Object.fromEntries(letture.map((voce) => [voce.chiave, voce]));
  assert.equal(letture.length, 6);
  /* M 3.2 a 18 km: piccolo ma sotto casa, merita attenzione. */
  assert.equal(per.terremoti.livello, "attenzione");
  assert.equal(per.terremoti.magnitudo, 3.2);
  assert.equal(per.terremoti.distanza, 18.4);
  assert.equal(per.terremoti.luogo, "Frosinone");
  assert.equal(per.meteo.livello, "attenzione");
  assert.equal(per.meteo.evento, "Temporali");
  /* Dodici fulmini a sette chilometri e mezzo: attenzione, non ancora allarme. */
  assert.equal(per.fulmini.livello, "attenzione");
  assert.equal(per.fulmini.conteggio, 12);
  assert.equal(per.fulmini.distanza, 7.5);
  assert.equal(per.pollini.livello, "attenzione");
  assert.equal(per.pollini.parola, "high");
  assert.equal(per.comfort.livello, "attenzione");
  assert.equal(per.comfort.codice, "quite_uncomfortable");
  assert.equal(per.voli.livello, "nota");
  assert.equal(per.voli.conteggio, 2);
  assert.equal(per.voli.voci.length, 2);
  assert.equal(per.voli.voci[0].numero, "AZ1234");
  assert.equal(per.voli.voci[1].numero, "RYR55");
  assert.equal(livelloMassimo(letture), "attenzione");
  assert.equal(allerteAttive(letture).length, 6);
});

test("la quiete e' quiete, e i fulmini vecchi di un'ora non sono un temporale", () => {
  const config = {
    terremoti: { entity: "sensor.ingv" },
    meteo: { entity: "binary_sensor.meteoalarm" },
    fulmini: { entity: "sensor.blitz_conteggio", distanza: "sensor.blitz_distanza" },
    pollini: { entity: "sensor.pollini" },
    comfort: { entity: "sensor.percezione" },
    voli: { entity: "sensor.fr24" },
  };
  const states = {
    "sensor.ingv": stato("0"),
    /* Spento: quiete anche se gli attributi portano il colore di ieri. */
    "binary_sensor.meteoalarm": stato("off", { awareness_level: "3; orange; Severe" }),
    "sensor.blitz_conteggio": stato("40", {}, "2026-09-03T17:00:00Z"),
    "sensor.blitz_distanza": stato("3", {}, "2026-09-03T17:00:00Z"),
    "sensor.pollini": stato("1"),
    "sensor.percezione": stato("comfortable"),
    "sensor.fr24": stato("0", { flights: [] }),
  };
  const letture = letturaAllerte(config, states, (v) => v, ADESSO);
  for (const voce of letture) assert.equal(voce.livello, "quiete", voce.chiave);
  assert.equal(livelloMassimo(letture), "quiete");
  assert.deepEqual(allerteAttive(letture), []);
  /* Un contatore mosso da poco invece conta. */
  const fresco = letturaAllerte(
    { fulmini: { entity: "sensor.blitz_conteggio", distanza: "sensor.blitz_distanza" } },
    {
      "sensor.blitz_conteggio": stato("40", {}, "2026-09-03T19:58:00Z"),
      "sensor.blitz_distanza": stato("3", {}, "2026-09-03T19:58:00Z"),
    },
    (v) => v,
    ADESSO,
  );
  assert.equal(fresco[0].livello, "allarme");
});

test("una fonte muta non e' quiete: e' ignota, e non alza il livello", () => {
  const letture = letturaAllerte(
    { pollini: { entity: "sensor.pollini" }, voli: { entity: "sensor.fr24" } },
    { "sensor.pollini": stato("unavailable") },
    (v) => v,
    ADESSO,
  );
  assert.equal(letture[0].livello, IGNOTO);
  assert.equal(letture[1].livello, IGNOTO, "un'entita' assente e' muta");
  assert.equal(livelloMassimo(letture), "quiete");
  assert.deepEqual(allerteAttive(letture), []);
  assert.equal(almeno("allarme", "attenzione"), true);
  assert.equal(almeno("nota", "attenzione"), false);
  assert.equal(almeno(IGNOTO, "quiete"), false);
});

test("i pollini e il comfort, nei numeri e nelle parole", () => {
  const pollini = (state, attributes) =>
    letturaAllerte({ pollini: { entity: "s.p" } }, { "s.p": stato(state, attributes) }, (v) => v, ADESSO)[0].livello;
  assert.equal(pollini("3"), "attenzione");
  assert.equal(pollini("4"), "allarme");
  assert.equal(pollini("60", { unit_of_measurement: "%" }), "attenzione");
  assert.equal(pollini("250"), "attenzione", "una concentrazione, non un indice");
  assert.equal(pollini("molto alto"), "allarme");
  assert.equal(pollini("basso"), "quiete");
  const comfort = (state) =>
    letturaAllerte({ comfort: { entity: "s.c" } }, { "s.c": stato(state) }, (v) => v, ADESSO)[0].livello;
  assert.equal(comfort("severely_high"), "allarme");
  assert.equal(comfort("somewhat_uncomfortable"), "nota");
  assert.equal(comfort("dry"), "quiete");
  assert.equal(comfort("35"), "attenzione", "un indice di calore in gradi");
  assert.equal(comfort("-2"), "nota", "il gelo si nota");
  assert.equal(comfort("probable"), "nota", "il rischio gelo probabile");
});

test("la pagina, la scheda e la tessera sono presentate a tutti i posti che le contano", async () => {
  const sezione = await leggi("sections/allerte-section.js");
  const editor = await leggi("sections/allerte-editor-section.js");
  /* La voce si governa da se', con la chiave che la fascia scrive. */
  assert.match(sezione, /sezioni\[ALLERTE_TAB\] === false/);
  assert.match(editor, /cdSecToggleHtml\?\.\("allerte"\)/);
  /* Accanto alla Sicurezza. */
  assert.match(sezione, /\.tab\[data-tab="security"\]/);
  const runtime = await leggi("sections/section-runtime.js");
  assert.match(runtime, /installAllerte\(\);/);
  assert.match(runtime, /installAllerteEditor\(\);/);
  assert.match(await leggi("sections/page-masthead-section.js"), /id: "page-allerte"/);
  assert.match(await leggi("sections/navigation-section.js"), /allerte: "allerte",/);
  assert.match(await leggi("sections/config-uniformity-section.js"), /allerte: "allerte",/);
  assert.match(await leggi("sections/todo-editor-section.js"), /\["allerte", "⚠️"/);
  assert.match(await leggi("sections/home-widgets-section.js"), /key: "allerte",/);
  assert.match(await leggi("sections/config-persistence-section.js"), /"cd_allerte"/);
  /* Il disegno c'e': la tessera e la barra non restano col simbolo di ripiego. */
  assert.equal(haOggettoWidget("allerte"), true);
  assert.deepEqual(bricioleDellaSezione("allerte", EN), ["Earthquakes", "Weather", "Lightning"]);
});

test("la frase della tessera dice chi ha qualcosa da dire", () => {
  const righe = [
    { name: "Lightning", value: "12 strikes · 7.5 km away", livello: "attenzione" },
    { name: "Pollen", value: "Low", livello: "quiete" },
    { name: "Flights overhead", value: "The sensor is not answering", livello: "ignoto" },
  ];
  assert.equal(
    fraseDellaTessera({ key: "allerte", rows: righe }, EN),
    "Watch out: Lightning (12 strikes · 7.5 km away).",
  );
  assert.equal(
    fraseDellaTessera({ key: "allerte", rows: [righe[1]] }, EN),
    "All quiet: no source has anything to say.",
  );
  assert.equal(
    fraseDellaTessera({ key: "allerte", rows: [righe[1], righe[2]] }, EN),
    "All quiet, but one source is not answering.",
  );
  assert.equal(fraseDellaTessera({ key: "allerte", rows: [] }, EN), "Nothing configured here yet.");
});
