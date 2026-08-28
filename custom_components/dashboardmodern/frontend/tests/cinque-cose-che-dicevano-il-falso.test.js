/* Cinque punti in cui la plancia diceva una cosa per un'altra.
 *
 * Non sono cinque bug della stessa famiglia: sono cinque posti diversi in cui
 * il codice guardava un dato e ne raccontava un altro. Li tiene insieme il
 * fatto che nessuno di loro rompe niente — la pagina si disegna, i tasti
 * funzionano — e proprio per questo passano inosservati finche' qualcuno non
 * ci va a sbattere con la sua casa vera.
 *
 *   1. l'auto risultava attaccata alla presa leggendo «not_charging»;
 *   2. i conflitti dei periodi si contavano sul primo impianto e si
 *      svuotavano su quello aperto;
 *   3. la finestra del Clima non sapeva aprire un'unita' tolta dalla Home;
 *   4. il solare termico si diceva «Attivo» con la pompa ferma;
 *   5. la piscina annunciava «pH —» dove il pH non era mai stato mappato.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("il cavo staccato non accende la tessera dell'auto", async () => {
  const { autoAllaPresa } = await import("../src/sections/home-widgets-section.js");

  // Quello che dicono le integrazioni quando il cavo c'e'.
  for (const attaccata of [
    "charging",
    "Charging",
    "plugged_in",
    "connected",
    "in carica",
    "collegato",
    "Ricarica in corso",
  ])
    assert.equal(autoAllaPresa(attaccata), true, `${attaccata} e' col cavo attaccato`);

  // E quello che dicono quando non c'e'. Sono le parole che facevano il
  // danno: contengono tutte quella giusta, e dicono il contrario.
  for (const staccata of [
    "not_charging",
    "disconnected",
    "unplugged",
    "non in carica",
    "non collegato",
    "scollegato",
    "staccato",
    "idle",
    "ready",
    "unknown",
    "",
    null,
    undefined,
  ])
    assert.equal(autoAllaPresa(staccata), false, `${staccata} e' col cavo staccato`);

  // Le lettere della norma, che evcc pubblica cosi': A nessun veicolo, B
  // collegato, C e D in carica, E ed F guasto.
  assert.equal(autoAllaPresa("A"), false);
  assert.equal(autoAllaPresa("B"), true);
  assert.equal(autoAllaPresa("C"), true);
  assert.equal(autoAllaPresa("D"), true);
  assert.equal(autoAllaPresa("E"), false);
  assert.equal(autoAllaPresa("F"), false);

  // E la tessera legge da li', non da un giro di parole scritto in linea.
  const ponte = leggi("sections/home-widgets-section.js");
  assert.match(ponte, /attiva: letture\.some\(\(lettura\) => autoAllaPresa\(lettura\.ricarica\)\)/);
});

test("i conflitti dei periodi si leggono nell'impianto che si sta guardando", () => {
  const guida = leggi("sections/energy-guidance-section.js");
  // Chi legge passa dallo stesso posatore di chi scrive: `plantModel` per la
  // lettura, `scriviNellImpianto` per la scrittura, e in mezzo lo stesso
  // impianto scelto. Prima la lettura si fermava al primo livello.
  assert.match(guida, /import \{ plantModel \} from "\.\.\/core\/energy-plants\.js"/);
  assert.match(guida, /return plantModel\(grezzo, impiantoScelto\(\)\)/);
  assert.match(guida, /scriviNellImpianto\(/);
});

test("la finestra del Clima apre anche l'unita' tolta dalla Home", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  // La riga si costruisce da sola, senza il filtro della tessera...
  assert.match(ponte, /function rigaClima\(states, unit\) \{/);
  // ...e il filtro resta dov'e' di casa: nel modello della tessera.
  assert.match(ponte, /\.map\(\(unit\) => rigaClima\(states, unit\)\)/);
  assert.match(ponte, /\.filter\(\(riga\) => riga && widgetIncludes\(riga\.entity, fuori\)\)/);
  // Il pannello della finestra cerca fra le unita' configurate, non fra le
  // righe rimaste in Home.
  const pannello = ponte.slice(ponte.indexOf("export function climatePanelMarkup"));
  assert.doesNotMatch(pannello.slice(0, 900), /climateModel\(/);
  assert.match(pannello.slice(0, 900), /readClimateUnits\(\)/);
});

test("il solare termico non si dice attivo con la pompa ferma", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  const solare = ponte.slice(
    ponte.indexOf("function solarThermalModel"),
    ponte.indexOf("function poolModel"),
  );
  assert.ok(solare.length > 0, "il modello del solare esiste ancora");
  // Senza sonda parla la pompa, e «Attivo» a prescindere non c'e' piu'.
  assert.doesNotMatch(solare, /primaSonda == null \? t\("Attivo"/);
  assert.match(solare, /const inGrande =/);
  assert.match(solare, /pompa != null/);
  assert.match(solare, /t\("Spento", "Off"\)/);
});

test("la piscina senza sonda del pH non annuncia il pH", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  const piscina = ponte.slice(ponte.indexOf("function poolModel"));
  // La didascalia non ha piu' il trattino di riserva: o c'e' una riga da
  // mostrare, o non si scrive niente.
  assert.doesNotMatch(piscina.slice(0, 3000), /`pH \$\{[^}]*\} \|\| "—"/);
  assert.match(piscina, /const compagna =/);
  assert.match(piscina, /caption: compagna \? `\$\{compagna\.name\} \$\{compagna\.value\}` : ""/);
});
