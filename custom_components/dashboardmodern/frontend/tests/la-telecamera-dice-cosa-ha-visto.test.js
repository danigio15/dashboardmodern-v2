/* I rilevamenti delle telecamere (#394).
 *
 * «Una notifica in home oppure tramite telefono per i rilevamenti da noi
 * impostati» — e alla domanda su cosa siano: «Io utilizzo reolink, mi
 * piacerebbe appunto una volta che io imposto persona, animale, veicolo e
 * movimento, perche' reolink ti sgancia questi sensori, che la Dashboard metta
 * l'avviso con il fotogramma e in contemporanea arriva una notifica da home
 * assistant.»
 *
 * Le prove tengono ferme cinque cose:
 *
 * 1. un sensore si riconosce dal NOME, perche' la classe non basta: Reolink
 *    pubblica persona, veicolo e animale tutti come `motion`;
 * 2. i sensori di una telecamera si trovano da soli, cosi' non si battono a
 *    macchina quattro entita' per telecamera;
 * 3. quando due scattano insieme si dice il piu' importante: «movimento» sotto
 *    una persona vera e' la notizia detta peggio;
 * 4. un sensore che non risponde non e' un no — un avviso che si accende
 *    perche' un sensore tace e' il peggiore dei falsi allarmi;
 * 5. l'automazione del telefono esce gia' scritta, con le entita' dentro e il
 *    fotogramma allegato per entita', che e' l'unico modo perche' arrivi anche
 *    da fuori casa.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  CHIAVE_RILEVAMENTI,
  TIPI_RILEVAMENTO,
  automazioneDiHomeAssistant,
  entitaSorvegliate,
  normalizzaRilevamenti,
  rilevamentiAccesi,
  sensoriDellaTelecamera,
  tipoDelSensore,
} from "../src/core/rilevamenti-telecamera.js";
import { CONFIG_KEYS, CONFIG_KEYS_REVISION } from "../src/core/chiavi-di-configurazione.js";

/* Una Reolink come la pubblica davvero: quattro binari accanto alla telecamera,
 * tutti con la stessa classe. */
const STATI = {
  "binary_sensor.ingresso_person": {
    state: "on",
    last_changed: "2026-09-11T10:00:00Z",
    attributes: { device_class: "motion", friendly_name: "Ingresso Person" },
  },
  "binary_sensor.ingresso_motion": {
    state: "on",
    last_changed: "2026-09-11T10:00:02Z",
    attributes: { device_class: "motion", friendly_name: "Ingresso Motion" },
  },
  "binary_sensor.ingresso_vehicle": {
    state: "off",
    last_changed: "2026-09-11T09:00:00Z",
    attributes: { device_class: "motion", friendly_name: "Ingresso Vehicle" },
  },
  "binary_sensor.ingresso_pet": {
    state: "unavailable",
    attributes: { device_class: "motion", friendly_name: "Ingresso Pet" },
  },
  "binary_sensor.ingresso_temperatura_alta": {
    state: "on",
    attributes: { device_class: "heat", friendly_name: "Ingresso troppo caldo" },
  },
  "camera.ingresso": { state: "idle", attributes: {} },
};

const TELECAMERE = [{ entity: "camera.ingresso", name: "Ingresso" }];

test("un rilevamento si riconosce dal nome, perche' la classe non basta", () => {
  /* Reolink li pubblica tutti come `motion`: se guardassimo solo la classe,
   * persona e veicolo sarebbero la stessa cosa. */
  assert.equal(tipoDelSensore("binary_sensor.ingresso_person", STATI["binary_sensor.ingresso_person"]), "persona");
  assert.equal(tipoDelSensore("binary_sensor.ingresso_vehicle", STATI["binary_sensor.ingresso_vehicle"]), "veicolo");
  assert.equal(tipoDelSensore("binary_sensor.ingresso_pet", STATI["binary_sensor.ingresso_pet"]), "animale");
  assert.equal(tipoDelSensore("binary_sensor.ingresso_motion", STATI["binary_sensor.ingresso_motion"]), "movimento");
  /* Anche in italiano: chi ha rinominato le entita' non resta fuori. */
  assert.equal(tipoDelSensore("binary_sensor.giardino_persona"), "persona");
  assert.equal(tipoDelSensore("binary_sensor.vialetto_veicolo"), "veicolo");
  /* Un nome che non dice niente e una classe che non c'entra non diventano un
   * rilevamento: un avviso «movimento» per la temperatura del sensore e'
   * peggio di nessun avviso. */
  assert.equal(tipoDelSensore("binary_sensor.ingresso_temperatura_alta", STATI["binary_sensor.ingresso_temperatura_alta"]), "");
  assert.equal(tipoDelSensore("sensor.ingresso_person"), "");
  assert.equal(tipoDelSensore(""), "");
  /* Senza nome utile ma con la classe giusta, e' movimento — il tipo generico. */
  assert.equal(
    tipoDelSensore("binary_sensor.ingresso_x1", { attributes: { device_class: "occupancy" } }),
    "movimento",
  );
});

test("i sensori di una telecamera si trovano da soli, per radice", () => {
  const trovati = sensoriDellaTelecamera("camera.ingresso", STATI);
  assert.deepEqual(trovati, {
    persona: "binary_sensor.ingresso_person",
    movimento: "binary_sensor.ingresso_motion",
    veicolo: "binary_sensor.ingresso_vehicle",
    animale: "binary_sensor.ingresso_pet",
  });
  /* Quello che non e' un rilevamento resta fuori anche se la radice combacia. */
  assert.ok(!Object.values(trovati).includes("binary_sensor.ingresso_temperatura_alta"));
  /* Una telecamera senza sensori accanto non se li inventa. */
  assert.deepEqual(sensoriDellaTelecamera("camera.garage", STATI), {});
  assert.deepEqual(sensoriDellaTelecamera("", STATI), {});
});

test("acceso vuol dire on: un sensore che tace non e' un rilevamento", () => {
  const config = {
    "camera.ingresso": {
      persona: "binary_sensor.ingresso_person",
      movimento: "binary_sensor.ingresso_motion",
      veicolo: "binary_sensor.ingresso_vehicle",
      animale: "binary_sensor.ingresso_pet",
    },
  };
  const righe = rilevamentiAccesi(config, STATI, TELECAMERE);
  /* Il veicolo e' `off` e l'animale `unavailable`: nessuno dei due c'e'. */
  assert.deepEqual(
    righe.map((riga) => riga.tipo),
    ["persona", "movimento"],
  );
  /* Il primo e' quello che la tessera racconta, ed e' il piu' importante —
   * non il piu' recente: il movimento e' scattato due secondi dopo. */
  assert.equal(righe[0].tipo, "persona");
  assert.equal(righe[0].nome, "Ingresso");
  assert.equal(righe[0].parola, "Persona");
  assert.equal(righe[0].entity, "binary_sensor.ingresso_person");
  assert.equal(righe[0].quando, Date.parse("2026-09-11T10:00:00Z"));
  /* A casa ferma non c'e' niente da dire. */
  assert.deepEqual(rilevamentiAccesi(config, {}, TELECAMERE), []);
  assert.deepEqual(rilevamentiAccesi({}, STATI, TELECAMERE), []);
});

test("la configurazione si ripulisce, e le entita' sorvegliate si contano una volta", () => {
  const sporca = {
    "camera.ingresso": { persona: " binary_sensor.a ", movimento: "", boh: "binary_sensor.z" },
    "non-una-entita": { persona: "binary_sensor.b" },
    "camera.vuota": { persona: "senza-punto" },
  };
  assert.deepEqual(normalizzaRilevamenti(sporca), {
    "camera.ingresso": { persona: "binary_sensor.a" },
  });
  assert.deepEqual(normalizzaRilevamenti(null), {});
  assert.deepEqual(normalizzaRilevamenti([]), {});
  /* Lo stesso sensore su due telecamere si guarda una volta sola. */
  assert.deepEqual(
    entitaSorvegliate({
      "camera.uno": { persona: "binary_sensor.a", movimento: "binary_sensor.b" },
      "camera.due": { persona: "binary_sensor.a" },
    }),
    ["binary_sensor.a", "binary_sensor.b"],
  );
});

test("l'automazione del telefono esce gia' scritta, col fotogramma per entita'", () => {
  const config = {
    "camera.ingresso": {
      persona: "binary_sensor.ingresso_person",
      movimento: "binary_sensor.ingresso_motion",
    },
  };
  const yaml = automazioneDiHomeAssistant(config, {
    telecamere: TELECAMERE,
    servizio: "notify.mobile_app_pixel",
  });
  /* Un trigger per sensore, e ognuno sa da chi arriva. */
  assert.match(yaml, /entity_id: binary_sensor\.ingresso_person/);
  assert.match(yaml, /entity_id: binary_sensor\.ingresso_motion/);
  assert.match(yaml, /id: camera\.ingresso\|persona/);
  assert.match(yaml, /to: "on"/);
  /* Il servizio e' quello passato, e il titolo e' il NOME della telecamera —
   * non il suo entity_id, che a chi legge la notifica non dice niente. */
  assert.match(yaml, /action: notify\.mobile_app_pixel/);
  assert.match(yaml, /title: Ingresso/);
  /* Il fotogramma si chiede a Home Assistant per entita': un indirizzo scritto
   * a mano non funzionerebbe da fuori casa, ed e' proprio fuori che serve. */
  assert.match(yaml, /image: \/api\/camera_proxy\/camera\.ingresso/);
  /* Senza niente da sorvegliare non si consegna un documento vuoto. */
  assert.equal(automazioneDiHomeAssistant({}, {}), "");
  /* Un nome coi due punti dentro non spezza il documento. */
  const strano = automazioneDiHomeAssistant(config, {
    telecamere: [{ entity: "camera.ingresso", name: "Ingresso: cancello" }],
  });
  assert.match(strano, /title: "Ingresso: cancello"/);
});

test("la tessera Telecamere dice cosa ha visto, e si accende solo allora", () => {
  const home = readFileSync(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  const tessera = home.slice(
    home.indexOf("function camerasModel("),
    home.indexOf("function oraDelRilevamento("),
  );
  assert.match(tessera, /rilevamentiAccesi\(\s*readJson\(CHIAVE_RILEVAMENTI, \{\}\)/);
  /* Col rilevamento il numero grande smette di contare le telecamere: «quante
   * ne ho» non e' la domanda che ci si fa con una persona in giardino. */
  assert.match(tessera, /value: primo \? primo\.parola : String\(rows\.length\)/);
  assert.match(tessera, /caption: primo \? `\$\{primo\.nome\} · \$\{oraDelRilevamento\(primo\.quando\)\}`/);
  /* Rossa solo quando c'e' qualcosa: una tessera che si accende sempre non e'
   * piu' un avviso. */
  assert.match(tessera, /accent: primo \? "#dc2626" : "#0284c7"/);
  assert.match(tessera, /alert: Boolean\(primo\)/);

  /* E tutto quello che la tessera chiama dev'essere importato davvero.
   *
   * Questa riga nasce da un rosso: `camerasModel` chiamava `activeLocale()`
   * senza che il file lo importasse. Il sorgente diceva la cosa giusta — le
   * prove che leggono il testo passavano tutte — ma in plancia la chiamata
   * sollevava un ReferenceError, e con lei se ne andava il disegno di TUTTE
   * le tessere della Home: non una tessera sbagliata, zero tessere. L'ha
   * preso l'e2e, che il codice lo esegue.
   *
   * Leggere il sorgente per sapere cosa fa una funzione va bene; per sapere
   * se quella funzione gira, no. Qui almeno si pretende che i nomi che usa
   * arrivino da qualche parte. */
  for (const nome of ["activeLocale", "rilevamentiAccesi", "readJson", "CHIAVE_RILEVAMENTI"]) {
    assert.match(
      home,
      new RegExp(`^\\s*${nome},?$`, "m"),
      `${nome} e' usato dalla tessera ma non compare fra le importazioni`,
    );
  }
});

test("la chiave viaggia con la casa, e la revisione lo dice", () => {
  assert.equal(CHIAVE_RILEVAMENTI, "cd_rilevamenti");
  /* Quali sensori guarda una telecamera e' una proprieta' della casa, non del
   * telefono da cui la si guarda: deve travasarsi come le altre. */
  assert.ok(CONFIG_KEYS.includes(CHIAVE_RILEVAMENTI));
  /* Una chiave aggiunta alza la revisione: senza, chi ha gia' travasato non
   * rifarebbe il giro e su un secondo apparecchio i rilevamenti non
   * arriverebbero mai. */
  assert.ok(CONFIG_KEYS_REVISION >= 46);
  /* E i quattro tipi sono in ordine di gravita', che e' cio' che decide quale
   * riga la tessera racconta. */
  assert.deepEqual(TIPI_RILEVAMENTO, ["persona", "animale", "veicolo", "movimento"]);
});
