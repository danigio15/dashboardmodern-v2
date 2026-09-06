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
import { readFile } from "node:fs/promises";

import {
  CASELLE_CALDAIA,
  GRUPPO_PELLET,
  USCITE_CALDAIA,
  accesoCaldaia,
  entitaDellaCaldaia,
  letturaCaldaia,
  letturaPellet,
  letturaVentilatore,
  normalizzaCaldaia,
  pelletScarso,
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

/* ── la caldaia a pellet (#346) ───────────────────────────────────────────
 *
 * «Nella sezione caldaia vorrei inserire: temperatura caldaia, temperatura
 * alta e bassa del boiler, temperatura fumi, comando ventilatore fumi,
 * ossigeno residuo, livello riempimento pellet, temperatura mandata
 * calcolata, ecc.» — da chi ha una Fröling PE15 letta con «Fröling Connect».
 *
 * Le caselle nuove stanno nella stessa macchina, in coda alle sue: chi ha una
 * caldaia a gas non deve accorgersi di niente, e chi ne ha una a pellet non
 * deve configurare una seconda macchina per vedere il suo fuoco.
 */

test("le caselle del pellet stanno in coda a quelle di sempre, nel loro gruppo", () => {
  const campi = CASELLE_CALDAIA.map(({ campo }) => campo);
  /* Le dieci di prima, nell'ordine di prima: qui non si riordina niente. */
  assert.deepEqual(campi.slice(0, 10), [
    "stato",
    "fiamma",
    "interruttore",
    "valvola",
    "valvola2",
    "mandata",
    "ritorno",
    "acquaCalda",
    "pressione",
    "modulazione",
  ]);
  assert.deepEqual(campi.slice(10), [
    "temperaturaCaldaia",
    "boilerAlto",
    "boilerBasso",
    "fumi",
    "ventilatoreFumi",
    "ossigeno",
    "pellet",
    "mandataCalcolata",
  ]);
  /* E si riconoscono da sole: la scheda le raccoglie sotto un titolo, e per
   * farlo chiede al modello quali sono invece di tenerne una copia. */
  for (const riga of CASELLE_CALDAIA.slice(0, 10)) assert.equal(riga.gruppo, undefined);
  for (const riga of CASELLE_CALDAIA.slice(10)) assert.equal(riga.gruppo, GRUPPO_PELLET);
});

test("la configurazione del pellet fa il giro e torna indietro intera", () => {
  const scritta = {
    name: "  Fröling PE15  ",
    stato: "sensor.caldaia_stato",
    mandata: "sensor.caldaia_mandata",
    temperaturaCaldaia: " sensor.caldaia_temperatura ",
    boilerAlto: "sensor.caldaia_boiler_alto",
    boilerBasso: "sensor.caldaia_boiler_basso",
    fumi: "sensor.caldaia_fumi",
    ventilatoreFumi: "fan.caldaia_ventilatore_fumi",
    ossigeno: "sensor.caldaia_ossigeno",
    pellet: "sensor.caldaia_pellet",
    mandataCalcolata: "sensor.caldaia_mandata_calcolata",
    uscita: "boiler",
  };
  const pulita = normalizzaCaldaia(scritta);
  assert.equal(pulita.name, "Fröling PE15");
  assert.equal(pulita.temperaturaCaldaia, "sensor.caldaia_temperatura");
  assert.equal(pulita.ventilatoreFumi, "fan.caldaia_ventilatore_fumi");
  assert.equal(pulita.uscita, "boiler");
  /* Il giro completo: quello che esce, rimesso dentro, esce uguale. */
  assert.deepEqual(normalizzaCaldaia(pulita), pulita);
  /* E le entità nuove entrano fra quelle che la pagina tiene d'occhio, o
   * nessuno si abbonerebbe ai loro cambi di stato. */
  const entita = entitaDellaCaldaia(scritta);
  for (const attesa of [
    "sensor.caldaia_fumi",
    "fan.caldaia_ventilatore_fumi",
    "sensor.caldaia_pellet",
    "sensor.caldaia_mandata_calcolata",
  ])
    assert.ok(entita.includes(attesa), attesa);
});

test("la lettura porta la combustione, il serbatoio e l'obiettivo", () => {
  const stati = {
    "sensor.temp": { state: "78.4" },
    "sensor.alto": { state: "56" },
    "sensor.basso": { state: "41.5" },
    "sensor.fumi": { state: "148" },
    "sensor.o2": { state: "8.4", attributes: { unit_of_measurement: "%" } },
    "sensor.pellet": { state: "62", attributes: { unit_of_measurement: "%" } },
    "sensor.calcolata": { state: "68" },
  };
  const lettura = letturaCaldaia(
    {
      temperaturaCaldaia: "sensor.temp",
      boilerAlto: "sensor.alto",
      boilerBasso: "sensor.basso",
      fumi: "sensor.fumi",
      ossigeno: "sensor.o2",
      pellet: "sensor.pellet",
      mandataCalcolata: "sensor.calcolata",
    },
    stati,
  );
  assert.equal(lettura.temperaturaCaldaia, 78.4);
  assert.equal(lettura.boilerAlto, 56);
  assert.equal(lettura.boilerBasso, 41.5);
  assert.equal(lettura.fumi, 148);
  assert.equal(lettura.ossigeno, 8.4);
  assert.equal(lettura.pellet, 62);
  assert.equal(lettura.mandataCalcolata, 68);
  /* Una caldaia a gas legge le stesse caselle e non trova niente: assenza,
   * non zero. Zero sarebbe «serbatoio vuoto», che è un'affermazione. */
  const gas = letturaCaldaia({ mandata: "sensor.temp" }, stati);
  for (const campo of [
    "temperaturaCaldaia",
    "boilerAlto",
    "boilerBasso",
    "fumi",
    "ossigeno",
    "pellet",
    "pelletChili",
    "mandataCalcolata",
  ])
    assert.equal(gas[campo], null, campo);
  assert.equal(gas.ventilatore, null);
});

test("il ventilatore dei fumi dice la percentuale o l'acceso, e lo decide lui", () => {
  const stati = {
    "sensor.vent": { state: "58", attributes: { unit_of_measurement: "%" } },
    "switch.vent": { state: "on" },
    "fan.vent": { state: "on", attributes: { percentage: 40 } },
    "sensor.giri": { state: "1200", attributes: { unit_of_measurement: "rpm" } },
    "binary_sensor.vent": { state: "off" },
  };
  const soffio = (entity) => letturaCaldaia({ ventilatoreFumi: entity }, stati).ventilatore;
  /* Su una Fröling è una percentuale di comando. */
  assert.deepEqual(soffio("sensor.vent"), { entity: "sensor.vent", acceso: true, percento: 58 });
  /* Chi ce l'ha come interruttore non ha una percentuale da mostrare: dire
   * «100%» sarebbe inventarsi una misura che nessuno ha dato. */
  assert.deepEqual(soffio("switch.vent"), { entity: "switch.vent", acceso: true, percento: null });
  assert.deepEqual(soffio("binary_sensor.vent"), {
    entity: "binary_sensor.vent",
    acceso: false,
    percento: null,
  });
  /* Un `fan` dice tutte e due le cose, e la velocità sta fra gli attributi. */
  assert.deepEqual(soffio("fan.vent"), { entity: "fan.vent", acceso: true, percento: 40 });
  /* I giri al minuto non sono una percentuale: valgono come acceso e basta. */
  assert.deepEqual(soffio("sensor.giri"), { entity: "sensor.giri", acceso: true, percento: null });
  /* Non mappato non è un ventilatore fermo. */
  assert.equal(soffio(""), null);
  assert.equal(letturaVentilatore("sensor.vent", stati["sensor.vent"]).percento, 58);
});

test("il pellet si legge in percentuale o in chili, e non si converte niente", () => {
  const stati = {
    "sensor.quota": { state: "62", attributes: { unit_of_measurement: "%" } },
    "sensor.chili": { state: "180", attributes: { unit_of_measurement: "kg" } },
    "sensor.nudo": { state: "45" },
  };
  const quota = letturaCaldaia({ pellet: "sensor.quota" }, stati);
  assert.equal(quota.pellet, 62);
  assert.equal(quota.pelletChili, null);
  /* Una bilancia sotto il silo parla in chili: quel numero è quello che è, e
   * un serbatoio disegnato a metà sopra una lettura in chili sarebbe
   * un'affermazione, non un dato. */
  const chili = letturaCaldaia({ pellet: "sensor.chili" }, stati);
  assert.equal(chili.pellet, null);
  assert.equal(chili.pelletChili, 180);
  /* Senza unità si assume la percentuale, che è quello che chiede la
   * segnalazione: «livello riempimento pellet». */
  assert.equal(letturaCaldaia({ pellet: "sensor.nudo" }, stati).pellet, 45);
  assert.deepEqual(letturaPellet(stati["sensor.chili"]), { pellet: null, pelletChili: 180 });
  /* La soglia sotto cui si ordina il pellet; senza quota non si sa. */
  assert.equal(pelletScarso(12), true);
  assert.equal(pelletScarso(40), false);
  assert.equal(pelletScarso(null), null);
});

test("le fasi di una caldaia a pellet sono accesa e spenta come le altre parole", () => {
  /* La centralina racconta il ciclo per fasi, e l'integrazione le passa nella
   * lingua dell'account: inglese, tedesco o italiano. */
  for (const parola of [
    "Heating",
    "Ignition",
    "Preheating",
    "Burn out",
    "burn_out",
    "Fire maintenance",
    "Heizen",
    "Anheizen",
    "Zündung",
    "Zuendung",
    "Vorwärmen",
    "Feuererhaltung",
    "Ausbrand",
    "Riscaldamento",
    "Accensione",
    "Fine combustione",
  ])
    assert.equal(accesoCaldaia(parola), true, parola);
  for (const parola of [
    "Standby",
    "stand by",
    "Off",
    "Boiler off",
    "Kessel Aus",
    "Kessel-Aus",
    "Feuer Aus",
    "Caldaia spenta",
    "Fuoco spento",
  ])
    assert.equal(accesoCaldaia(parola), false, parola);
  /* Un guasto o un autotest non sono né l'una né l'altra cosa: restano la
   * parola che sono, e la scena la scrive com'è. */
  assert.equal(accesoCaldaia("Störung"), null);
  assert.equal(accesoCaldaia("Selbsttest"), null);
  /* E le parole di sempre continuano a valere. */
  assert.equal(accesoCaldaia("on"), true);
  assert.equal(accesoCaldaia("idle"), false);
  assert.equal(accesoCaldaia("unavailable"), null);
});

test("lo stato che non sappiamo tradurre si scrive com'è", () => {
  const lettura = letturaCaldaia(
    { stato: "sensor.fase" },
    { "sensor.fase": { state: "Störung" } },
  );
  assert.equal(lettura.inFunzione, null);
  assert.equal(lettura.statoTesto, "Störung");
  const scena = readFileSync(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  /* «Stato non mappato» resta la risposta per chi non ha mappato niente, ma
   * non si dice più a chi lo stato ce l'ha e dice una fase che non
   * conosciamo. */
  assert.match(scena, /grezzo \|\| t\("Stato non mappato", "State not mapped"\)/);
  assert.match(scena, /const STATI_MUTI = new Set\(\["", "unavailable", "unknown", "none", "null"\]\)/);
});

test("la scena mostra le letture del pellet solo quando ci sono", async () => {
  const scena = await readFile(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  /* Fumi, ossigeno e ventilatore accanto alla fiamma; niente mappato, niente
   * pannello — non un pannello con tre trattini. */
  assert.match(scena, /function combustioneMarkup\(lettura\)/);
  assert.match(scena, /\.filter\(\(\[, valore\]\) => valore != null\);\s*\n\s*if \(!righe\.length\) return "";/);
  /* Il serbatoio è un riempimento, e in chili diventa una targhetta: non si
   * disegna mezzo serbatoio sopra un numero che non è una quota. */
  assert.match(scena, /function pelletMarkup\(lettura\)/);
  assert.match(scena, /if \(quota == null\)\s*\n\s*return nodoTarghetta\(/);
  assert.match(scena, /dm-it-pellet-liv" style="height:\$\{pieno\}%"/);
  assert.match(scena, /data-scarso="\$\{pelletScarso\(quota\) === true\}"/);
  /* Le due sonde stanno addosso al disegno del boiler, e ci va solo quella
   * che è stata mappata. */
  assert.match(scena, /function sondeBoilerMarkup\(lettura\)/);
  assert.match(scena, /\$\{sondeBoilerMarkup\(lettura\)\}/);
  /* La mandata calcolata sta accanto alla mandata vera, e non compare da
   * sola. */
  assert.match(scena, /lettura\.mandataCalcolata == null\s*\n\s*\? ""/);
  /* Il corpo della caldaia passa dalla targhetta di tutti, che senza numero
   * non nasce. */
  assert.match(scena, /t\("Corpo caldaia", "Boiler body"\), lettura\.temperaturaCaldaia/);
});

test("la scheda raccoglie le caselle del pellet sotto un titolo solo", async () => {
  const scheda = await readFile(
    new URL("../src/sections/impianti-termici-editor-section.js", import.meta.url),
    "utf8",
  );
  /* Ogni casella del modello ha le sue parole, o la scheda proverebbe a
   * leggere le etichette di una riga che non c'è. */
  for (const campo of CASELLE_CALDAIA.map(({ campo }) => campo))
    assert.match(scheda, new RegExp(`^  ${campo}: \\{`, "m"), campo);
  /* Il titolo compare una volta sola, alla prima casella del gruppo: chi ha
   * una caldaia a gas deve capire a colpo d'occhio che da lì in giù non c'è
   * niente di suo. */
  assert.match(scheda, /function titoloPellet\(\)/);
  assert.match(
    scheda,
    /gruppo === GRUPPO_PELLET && precedente !== gruppo \? titoloPellet\(\) : ""/,
  );
  assert.match(scheda, /t\("Combustibile solido: pellet o legna", "Solid fuel: pellet or wood"\)/);
  /* E gli esempi delle caselle nuove sono entità, non descrizioni. */
  for (const esempio of ["sensor.caldaia_fumi", "fan.caldaia_ventilatore_fumi"])
    assert.ok(scheda.includes(esempio), esempio);
});

test("le parole delle caselle nuove finiscono nei cataloghi", () => {
  const corpus = readFileSync(new URL("../src/i18n/source-index.js", import.meta.url), "utf8");
  for (const parola of [
    "Temperatura della caldaia",
    "Boiler sanitario, sonda alta",
    "Temperatura dei fumi",
    "Ventilatore dei fumi",
    "Ossigeno residuo (%)",
    "Livello del pellet",
    "Mandata calcolata",
    "Combustibile solido: pellet o legna",
    "Corpo caldaia",
  ])
    assert.ok(corpus.includes(parola), `«${parola}» è fuori dai cataloghi`);
});
