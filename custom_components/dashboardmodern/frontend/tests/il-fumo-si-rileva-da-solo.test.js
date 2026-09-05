/* Il fumo, accanto agli altri avvisi (#238).
 *
 * Chi monta un rilevatore di fumo non deve configurarlo: e' un `binary_sensor`
 * che Home Assistant dichiara `device_class: smoke`. E a differenza degli
 * allagamenti il rilevamento non si ferma al primo avvio: il registro dei
 * gia' visti (`cd_fumo_rilevato`) e' un elenco, non un interruttore, e un
 * sensore montato il mese prossimo entra da solo. Chi lo toglie lo ritrova
 * tolto: il registro se lo ricorda.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SMOKE_DEVICE_CLASSES,
  SMOKE_GROUP,
  SMOKE_SEEN_KEY,
  countAlarmed,
  isSmokeSensor,
  nomeDelRilevatore,
  smokeEntities,
  smokeIsAlarm,
} from "../src/sections/smoke-alerts-section.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

const inAllarme = { state: "on", attributes: { device_class: "smoke" } };
const tranquillo = { state: "off", attributes: { device_class: "smoke" } };

test("un rilevatore di fumo e' quello che Home Assistant dichiara tale", () => {
  assert.equal(isSmokeSensor("binary_sensor.fumo_cucina", tranquillo), true);
  // La classe la dice Home Assistant: non si indovina dal nome.
  assert.equal(isSmokeSensor("binary_sensor.fumo_garage", { attributes: {} }), false);
  // E resta un binary_sensor: un `sensor.` con la stessa classe non e' questo.
  assert.equal(isSmokeSensor("sensor.densita_fumo", inAllarme), false);
  // Le altre classi non c'entrano: una porta non e' un rilevatore di fumo.
  assert.equal(
    isSmokeSensor("binary_sensor.porta", { state: "off", attributes: { device_class: "door" } }),
    false,
  );
});

test("gas e monossido entrano nella stessa lista del fumo", () => {
  /* Dal campo: «rilevatori fumo/gas in config sicurezza». Home Assistant li
   * dichiara con lo stesso vocabolario, e la famiglia sta insieme. */
  assert.deepEqual([...SMOKE_DEVICE_CLASSES], ["smoke", "gas", "carbon_monoxide"]);
  assert.equal(
    isSmokeSensor("binary_sensor.gas_cucina", {
      state: "off",
      attributes: { device_class: "gas" },
    }),
    true,
  );
  assert.equal(
    isSmokeSensor("binary_sensor.co_taverna", {
      state: "off",
      attributes: { device_class: "carbon_monoxide" },
    }),
    true,
  );
});

test("in allarme e' `on`, come per ogni binary_sensor", () => {
  assert.equal(smokeIsAlarm(inAllarme), true);
  assert.equal(smokeIsAlarm(tranquillo), false);
  assert.equal(smokeIsAlarm(undefined), false);
});

test("il primo giro si serve da solo dai sensori dichiarati", () => {
  const states = {
    "binary_sensor.fumo_cucina": tranquillo,
    "binary_sensor.fumo_taverna": inAllarme,
    "binary_sensor.porta_ingresso": { state: "off", attributes: { device_class: "door" } },
    "light.cucina": { state: "on", attributes: {} },
  };
  const { entities, nuovi, daSegnare } = smokeEntities({}, {}, states, []);
  assert.deepEqual(entities, ["binary_sensor.fumo_cucina", "binary_sensor.fumo_taverna"]);
  assert.deepEqual(nuovi, entities, "i nuovi vanno scritti fra le aggiunte");
  assert.deepEqual(daSegnare, entities, "e tutti vanno segnati nel registro");
});

test("il rilevamento e' continuo: un sensore montato dopo entra da solo", () => {
  /* Il registro ricorda la cucina; la taverna e' arrivata stanotte. */
  const states = {
    "binary_sensor.fumo_cucina": tranquillo,
    "binary_sensor.fumo_taverna": tranquillo,
  };
  const extras = { [SMOKE_GROUP]: ["binary_sensor.fumo_cucina"] };
  const visti = ["binary_sensor.fumo_cucina"];
  const { entities, nuovi } = smokeEntities(extras, {}, states, visti);
  assert.deepEqual(entities, ["binary_sensor.fumo_cucina", "binary_sensor.fumo_taverna"]);
  assert.deepEqual(nuovi, ["binary_sensor.fumo_taverna"], "solo il nuovo si aggiunge");
});

test("quello che si toglie resta tolto, anche se il sensore c'e' ancora", () => {
  /* Il difetto classico di chi rileva di continuo: si toglie una voce e il
   * giro dopo la rimette. Il registro dei visti e' li' apposta. */
  const states = { "binary_sensor.fumo_cucina": tranquillo };
  const removed = { [SMOKE_GROUP]: ["binary_sensor.fumo_cucina"] };
  const visti = ["binary_sensor.fumo_cucina"];
  const { entities, nuovi } = smokeEntities({}, removed, states, visti);
  assert.deepEqual(entities, []);
  assert.deepEqual(nuovi, [], "un tolto non e' mai un nuovo");
});

test("un sensore tolto ma mai segnato non rientra comunque", () => {
  /* La rimozione puo' arrivare da un altro dispositivo prima del registro:
   * anche cosi' la scelta dell'utente vince, e il sensore si segna e basta. */
  const states = { "binary_sensor.fumo_cucina": tranquillo };
  const removed = { [SMOKE_GROUP]: ["binary_sensor.fumo_cucina"] };
  const { entities, nuovi, daSegnare } = smokeEntities({}, removed, states, []);
  assert.deepEqual(entities, []);
  assert.deepEqual(nuovi, []);
  assert.deepEqual(daSegnare, ["binary_sensor.fumo_cucina"], "visto va segnato lo stesso");
});

test("chi svuota la lista la ritrova vuota", () => {
  const states = { "binary_sensor.fumo_cucina": tranquillo };
  const { entities, nuovi } = smokeEntities({ [SMOKE_GROUP]: [] }, {}, states, [
    "binary_sensor.fumo_cucina",
  ]);
  assert.deepEqual(entities, [], "il registro ricorda, la lista non si ripopola");
  assert.deepEqual(nuovi, []);
});

test("senza stati non si rileva e non si segna niente", () => {
  /* La passata gira anche prima che gli stati arrivino: li' non c'e' niente
   * da vedere, e il registro non deve crescere di fantasmi. */
  const { entities, nuovi, daSegnare } = smokeEntities({}, {}, {}, []);
  assert.deepEqual(entities, []);
  assert.deepEqual(nuovi, []);
  assert.deepEqual(daSegnare, []);
});

test("lo stesso sensore scritto due volte esce una volta sola", () => {
  const { entities } = smokeEntities(
    { [SMOKE_GROUP]: ["binary_sensor.a", " binary_sensor.a ", ""] },
    {},
    {},
    [],
  );
  assert.deepEqual(entities, ["binary_sensor.a"]);
});

test("il contatore conta gli allarmi, non i configurati", () => {
  const states = { "binary_sensor.a": inAllarme, "binary_sensor.b": tranquillo };
  assert.equal(countAlarmed(["binary_sensor.a", "binary_sensor.b"], states), 1);
  assert.equal(countAlarmed([], states), 0);
  assert.equal(countAlarmed(["binary_sensor.sparito"], states), 0);
});

test("il registro dei visti e' la chiave gia' registrata in persistenza", () => {
  assert.equal(SMOKE_SEEN_KEY, "cd_fumo_rilevato");
  const persistenza = leggi("sections/config-persistence-section.js");
  assert.match(persistenza, /"cd_fumo_rilevato"/, "la chiave deve viaggiare con la configurazione");
});

test("il gruppo si sceglie dove si scelgono gli altri", () => {
  const editor = leggi("sections/alerts-section.js");
  assert.match(editor, /\["fumo", "💨"/, "la voce manca nell'editor degli avvisi");
});

test("la sezione e' installata insieme agli altri avvisi", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installSmokeAlertsSection\(\)/, "non viene installata");
  assert.match(runtime, /"smoke-alerts"/, "non e' dichiarata fra le sezioni");
  // Dopo l'allagamento, che a sua volta segue l'editor degli avvisi.
  assert.ok(
    runtime.indexOf("installSmokeAlertsSection()") > runtime.indexOf("installFloodAlertsSection()"),
    "va installata dopo gli allagamenti",
  );
});

/* Una voce che entra deve poter uscire: le righe nella configurazione col
 * cestino del runtime, che sa distinguere una voce aggiunta da una arrivata
 * da sola. E' la stessa lezione degli allagamenti. */
test("la configurazione stampa le righe del fumo", () => {
  const sezione = leggi("sections/smoke-alerts-section.js");
  assert.match(sezione, /ensureSmokeEditorRows/, "le righe non vengono stampate");
  assert.match(sezione, /data-dm-smoke-del/, "manca il cestino");
  assert.match(sezione, /edDelAvviso\?\.\(SMOKE_GROUP, id\)/, "il cestino non riusa quello vero");
});

/* Il blocco nella pagina Sicurezza: fra le Aperture e le Telecamere, col
 * calco delle porte — `insertBefore` sulla sezione delle telecamere — e senza
 * vestire i panni altrui: `.dm-entity-picker` marca i campi entita', e un
 * blocco di sole letture non deve indossarlo. */
test("il blocco della Sicurezza sta fra le Aperture e le Telecamere", () => {
  const sezione = leggi("sections/smoke-alerts-section.js");
  assert.match(sezione, /\.dm-sec-cctv/, "il posto si trova dalle telecamere");
  assert.match(sezione, /insertBefore\(block, cctv\)/, "il blocco va inserito prima di loro");
  assert.match(sezione, /renderSecurity/, "deve seguire i ridisegni della vetrina");
  assert.doesNotMatch(sezione, /dm-entity-picker/, "niente classi dei selettori di entita'");
  // Lo stato d'allarme e' rosso nativo, sul colore d'errore della plancia.
  assert.match(sezione, /is-alarm/, "manca lo stato d'allarme");
  assert.match(sezione, /--error-color/, "l'allarme deve usare il rosso della plancia");
});

/* «Nome sensore fumo e gas non esce, riporta nome entita'.»
 *
 * Nella card si leggeva «BINARY_SENSOR.S…» a lettere maiuscole. Il nome lo
 * dice Home Assistant, ma all'avvio non l'ha ancora detto: il blocco nasceva
 * con l'identificativo al posto del nome e non si rifaceva piu', perche' la
 * sua firma guardava le entita' e il nome scelto a mano — non quello che
 * finiva davvero sullo schermo. Adesso la firma e' il disegno, e
 * l'identificativo, quando proprio non c'e' altro, si legge come lo legge
 * Home Assistant.
 */
test("il rilevatore ha un nome anche quando Home Assistant non l'ha ancora detto", () => {
  const id = "binary_sensor.salotto_fumo";
  /* Il nome scelto a mano vince su tutto. */
  assert.equal(
    nomeDelRilevatore(id, { [id]: "Cucina, sopra il forno" }, {}),
    "Cucina, sopra il forno",
  );
  /* Poi quello di Home Assistant. */
  assert.equal(
    nomeDelRilevatore(id, {}, { [id]: { attributes: { friendly_name: "Fumo salotto" } } }),
    "Fumo salotto",
  );
  /* E in mancanza d'altro l'identificativo si legge come una frase, non come
   * un identificativo: e' quello che fa Home Assistant stessa. */
  assert.equal(nomeDelRilevatore(id, {}, {}), "Salotto fumo");
  assert.equal(nomeDelRilevatore("binary_sensor.co", {}, {}), "Co");
  /* Un identificativo storto non fa sparire la riga. */
  assert.equal(nomeDelRilevatore("senzapunto", {}, {}), "senzapunto");
});
