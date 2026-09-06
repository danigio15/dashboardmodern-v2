/* La tessera Auto in Home non ripete quello che ha gia' detto, e sulla
 * ricarica dice quello che dice la pagina (#348).
 *
 * «Nel widget dell'auto mi trovo nella sezione stato cinque volte la stessa
 * entita' dello stato dell'auto con scritto spento. Poi sempre nel widget la
 * ricarica risulta scollegata, ma se entri nella pagina dedicata la vedi
 * collegata, com'e' giusto che sia.»
 *
 * Due difetti con la stessa radice: la tessera leggeva ogni profilo per
 * conto suo, e giudicava il cavo da sola. Il salvataggio dell'auto copia nel
 * profilo tutte le caselle di casa — anche quelle della colonnina — e l'auto
 * arrivata dall'integrazione, prima della 1.4.10, nasceva daccapo a ogni
 * collegamento: cinque profili uguali, cinque volte lo stesso sensore. E un
 * `binary_sensor.charging` che dice «off» a cavo attaccato diceva
 * «Scollegata», mentre la pastiglia della pagina — che chiede al nucleo con
 * il cavo e la potenza come testimoni — diceva «Collegata».
 */
import assert from "node:assert/strict";
import test from "node:test";

import { cavoDalloStato } from "../src/core/stato-della-ricarica.js";

const { lettureDelleVetture } = await import("../src/sections/home-widgets-section.js");

const stato = (state, attributes = {}) => ({ state, attributes });

/* La mappatura di un'auto come la scrive il salvataggio: le sue caselle e
 * quelle della colonnina, copiate dentro. */
const MAPPA = {
  "dm.ev_batteria_auto": "sensor.leaf_soc",
  "dm.ev_autonomia": "sensor.leaf_autonomia",
  "dm.ev_stato_ricarica": "binary_sensor.wallbox_charging",
  "dm.ev_cavo_collegato": "binary_sensor.wallbox_cavo",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
  "dm.ev_motore": "binary_sensor.leaf_motore",
};

const STATI = {
  "sensor.leaf_soc": stato("53", { unit_of_measurement: "%", friendly_name: "Leaf SoC" }),
  "sensor.leaf_autonomia": stato("180", { unit_of_measurement: "km", friendly_name: "Leaf autonomia" }),
  "binary_sensor.wallbox_charging": stato("off", { friendly_name: "Wallbox charging" }),
  "binary_sensor.wallbox_cavo": stato("on", { friendly_name: "Wallbox cavo" }),
  "sensor.wallbox_potenza": stato("0", { unit_of_measurement: "W", friendly_name: "Wallbox potenza" }),
  "binary_sensor.leaf_motore": stato("off", { friendly_name: "Leaf motore" }),
};

const auto = (nome, mappa = MAPPA) => ({ name: nome, ov: { ...mappa } });

test("cinque profili uguali sono un'auto sola", () => {
  const letture = lettureDelleVetture(
    STATI,
    [auto("Leaf"), auto("Leaf"), auto("Leaf"), auto("Leaf"), auto("Leaf")],
    new Set(),
  );
  assert.equal(letture.length, 1);
  assert.equal(letture[0].nome, "Leaf");
  assert.equal(letture[0].percentuale, 53);
  /* E le caselle acceso/spento — quelle che diventano pillole — escono una
   * volta: il motore e il cavo, non cinque motori. */
  const pillole = letture.flatMap((lettura) => lettura.altre).filter((riga) => typeof riga.on === "boolean");
  assert.deepEqual(
    pillole.map((riga) => riga.entity).sort(),
    ["binary_sensor.leaf_motore", "binary_sensor.wallbox_cavo"],
  );
});

test("due auto diverse restano due, ma la colonnina — che e' di casa — si dice una volta", () => {
  const seconda = {
    ...MAPPA,
    "dm.ev_batteria_auto": "sensor.zoe_soc",
    "dm.ev_autonomia": "sensor.zoe_autonomia",
    "dm.ev_motore": "binary_sensor.zoe_motore",
  };
  const stati = {
    ...STATI,
    "sensor.zoe_soc": stato("80", { unit_of_measurement: "%" }),
    "sensor.zoe_autonomia": stato("260", { unit_of_measurement: "km" }),
    "binary_sensor.zoe_motore": stato("off", { friendly_name: "Zoe motore" }),
  };
  const letture = lettureDelleVetture(stati, [auto("Leaf"), auto("Zoe", seconda)], new Set());
  assert.equal(letture.length, 2);
  const entita = letture.flatMap((lettura) => lettura.altre.map((riga) => riga.entity));
  /* Il cavo e la potenza della colonnina: una volta, non una per auto. */
  assert.equal(entita.filter((id) => id === "binary_sensor.wallbox_cavo").length, 1);
  assert.equal(entita.filter((id) => id === "sensor.wallbox_potenza").length, 1);
  /* Ogni auto tiene il suo motore. */
  assert.ok(entita.includes("binary_sensor.leaf_motore"));
  assert.ok(entita.includes("binary_sensor.zoe_motore"));
  /* E la riga della colonnina e' segnata come di casa: non portera' il nome
   * della prima auto davanti. */
  const cavo = letture[0].altre.find((riga) => riga.entity === "binary_sensor.wallbox_cavo");
  assert.equal(cavo.diCasa, true);
  const motore = letture[0].altre.find((riga) => riga.entity === "binary_sensor.leaf_motore");
  assert.equal(motore.diCasa, undefined);
});

test("la ricarica la decide lo stesso nucleo della pastiglia: cavo dentro, «Collegata»", () => {
  const [leaf] = lettureDelleVetture(STATI, [auto("Leaf")], new Set());
  /* `off` del sensore di carica, cavo attaccato: la lettera e' B — collegata
   * e ferma — non «scollegata». */
  assert.equal(leaf.ricarica, "B");
  /* Cavo fuori: A. */
  const staccata = lettureDelleVetture(
    { ...STATI, "binary_sensor.wallbox_cavo": stato("off") },
    [auto("Leaf")],
    new Set(),
  )[0];
  assert.equal(staccata.ricarica, "A");
  /* Sta caricando: C, anche col cavo che non parla. */
  const inCarica = lettureDelleVetture(
    { ...STATI, "binary_sensor.wallbox_charging": stato("on") },
    [auto("Leaf")],
    new Set(),
  )[0];
  assert.equal(inCarica.ricarica, "C");
  /* Senza il sensore del cavo, «off» con la potenza che passa e' collegata;
   * senza potenza e' «non in carica», che e' quello che si sa — non
   * «scollegata», che sarebbe inventato. */
  const senzaCavo = { ...MAPPA };
  delete senzaCavo["dm.ev_cavo_collegato"];
  assert.equal(
    lettureDelleVetture(
      { ...STATI, "sensor.wallbox_potenza": stato("3200") },
      [auto("Leaf", senzaCavo)],
      new Set(),
    )[0].ricarica,
    "B",
  );
  assert.equal(lettureDelleVetture(STATI, [auto("Leaf", senzaCavo)], new Set())[0].ricarica, "N");
  /* Uno stato che il nucleo non sa leggere resta com'e', per le parole di prima. */
  assert.equal(
    lettureDelleVetture(
      { ...STATI, "binary_sensor.wallbox_charging": stato("boh"), "binary_sensor.wallbox_cavo": stato("boh") },
      [auto("Leaf", senzaCavo)],
      new Set(),
    )[0].ricarica,
    "boh",
  );
});

test("il cavo lo dice il suo sensore, in un posto solo", () => {
  assert.equal(cavoDalloStato("on"), true);
  assert.equal(cavoDalloStato("connected"), true);
  assert.equal(cavoDalloStato("off"), false);
  assert.equal(cavoDalloStato("unplugged"), false);
  assert.equal(cavoDalloStato("unknown"), null);
  assert.equal(cavoDalloStato(""), null);
});
