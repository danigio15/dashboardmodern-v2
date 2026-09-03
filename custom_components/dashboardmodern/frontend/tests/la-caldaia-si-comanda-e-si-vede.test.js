/* «La pagina caldaia non mostra le card delle entità configurate: non permette
 * accensione/spegnimento della caldaia, non mostra lo stato standby/in
 * funzione, non mostra le elettrovalvole di riciclo, richiesta di visualizzare
 * o radiatore o boiler» (#274).
 *
 * Quattro cose, e tre erano campi che il modello non aveva: la pagina non
 * poteva mostrare quello che nessuno le aveva dato da leggere. La quarta — lo
 * stato — c'era, ma compariva soltanto per chi non aveva né sonde né
 * pressione: chi aveva mappato tutto non lo vedeva mai.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CASELLE_CALDAIA,
  USCITE_CALDAIA,
  letturaCaldaia,
  normalizzaCaldaia,
} from "../src/core/impianti-termici.js";

const STATI = {
  "binary_sensor.stato": { state: "on" },
  "binary_sensor.fiamma": { state: "on" },
  "switch.caldaia": { state: "on" },
  "switch.risc": { state: "on" },
  "switch.acs": { state: "off" },
  "sensor.mandata": { state: "62" },
};

const CONFIG = {
  name: "Vaillant",
  stato: "binary_sensor.stato",
  fiamma: "binary_sensor.fiamma",
  mandata: "sensor.mandata",
  interruttore: "switch.caldaia",
  valvola: "switch.risc",
  valvola2: "switch.acs",
  uscita: "boiler",
};

test("l'interruttore e le valvole sono caselle del modello", () => {
  /* Un campo non dichiarato qui sparisce alla prima normalizzazione: è la
   * ragione per cui la pagina non aveva niente da mostrare. */
  const campi = CASELLE_CALDAIA.map(({ campo }) => campo);
  for (const atteso of ["interruttore", "valvola", "valvola2"]) assert.ok(campi.includes(atteso));
  const pulita = normalizzaCaldaia(CONFIG);
  assert.equal(pulita.interruttore, "switch.caldaia");
  assert.equal(pulita.valvola, "switch.risc");
});

test("la lettura dice se lavora, e con che cosa si comanda", () => {
  const lettura = letturaCaldaia(CONFIG, STATI);
  /* «Non mostra lo stato standby/in funzione»: adesso la lettura lo porta, e
   * la pagina lo dice sempre — prima compariva solo a chi non aveva sonde. */
  assert.equal(lettura.inFunzione, true);
  assert.equal(letturaCaldaia({ ...CONFIG, fiamma: "", stato: "" }, STATI).inFunzione, null);
  assert.equal(
    letturaCaldaia({ stato: "binary_sensor.spenta" }, { "binary_sensor.spenta": { state: "off" } })
      .inFunzione,
    false,
  );
  /* «Non permette accensione/spegnimento»: l'entità e il suo stato viaggiano
   * insieme, perché chi disegna il tasto deve sapere quale chiamare e come
   * dipingerlo. */
  assert.equal(lettura.interruttore, "switch.caldaia");
  assert.equal(lettura.interruttoreAcceso, true);
});

test("le valvole mappate ci sono, quelle non mappate non sono valvole chiuse", () => {
  const lettura = letturaCaldaia(CONFIG, STATI);
  assert.equal(lettura.valvole.length, 2);
  assert.equal(lettura.valvole[0].acceso, true);
  assert.equal(lettura.valvole[1].acceso, false);
  /* Una valvola che nessuno ha mappato non compare: non è chiusa, non c'è. */
  assert.equal(letturaCaldaia({ ...CONFIG, valvola2: "" }, STATI).valvole.length, 1);
  assert.equal(letturaCaldaia({ ...CONFIG, valvola: "", valvola2: "" }, STATI).valvole.length, 0);
});

test("all'uscita c'è quello che si è scelto, e di serie i radiatori", () => {
  /* «Richiesta di visualizzare o radiatore o boiler»: chi ha una caldaia che
   * serve solo l'accumulo ci vedeva un termosifone che non ha. */
  assert.deepEqual(USCITE_CALDAIA, ["radiatori", "boiler"]);
  assert.equal(normalizzaCaldaia(CONFIG).uscita, "boiler");
  assert.equal(normalizzaCaldaia({ name: "x" }).uscita, "radiatori");
  assert.equal(normalizzaCaldaia({ uscita: "qualcosa" }).uscita, "radiatori");
  const scena = readFileSync(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  assert.match(scena, /lettura\.uscita === "boiler"/);
  assert.match(scena, /dm-it-accumulo/);
});

test("il tasto chiama il servizio, e non ridisegna prima di sapere", () => {
  const scena = readFileSync(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  assert.match(scena, /data-dm-it-caldaia="\$\{esc\(\s*lettura\.interruttore,?\s*\)\}"/);
  assert.match(scena, /"toggle", \{ entity_id: entity \}/);
  /* Il ridisegno arriva col cambio di stato: rifarlo adesso rileggerebbe lo
   * stato vecchio e lo rimetterebbe com'era, che da fuori si legge «non ha
   * fatto niente». */
  assert.match(scena, /caldaia\.setAttribute\("aria-checked", acceso \? "false" : "true"\)/);
});

test("le parole della scheda finiscono nei cataloghi", () => {
  /* Erano scritte in tupla — `[["Stato della caldaia", "Boiler state"], …]` —
   * e l'estrattore non sa dire dove stanno l'italiano e l'inglese in una
   * tupla: tredici lingue le leggevano in italiano, e nessuno se ne accorgeva
   * perché l'inglese è anche il ripiego legittimo. */
  const corpus = readFileSync(new URL("../src/i18n/source-index.js", import.meta.url), "utf8");
  for (const parola of [
    "Stato della caldaia",
    "Temperatura di mandata",
    "Interruttore (accende e spegne)",
    "Elettrovalvola di riciclo",
  ])
    assert.ok(corpus.includes(parola), `«${parola}» è fuori dai cataloghi`);
});
