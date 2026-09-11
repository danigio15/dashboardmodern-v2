/* «Ferma» non è una cosa che la tessera dell'auto sapesse (#326).
 *
 * «L'indicazione "Ferma" presente dopo l'indicazione "E' al xx%" sta ad
 *  indicare che il motore è spento? perché se è così, quando la macchina è
 *  accesa da sempre "Ferma".»
 *
 * No: quella parola parlava della colonnina — cavo fuori, carica ferma — e
 * accanto a una percentuale sembrava dire che il motore è spento, cosa che la
 * tessera non aveva guardato. Del motore non chiedeva niente a nessuno.
 *
 * Sotto c'era un guasto più vecchio. La distinzione fra il pieno di benzina e
 * la carica la fa chi racconta la tessera, guardando se TUTTE le righe vanno a
 * carburante — ma nessuno quel campo lo scriveva sulle righe. La correzione
 * della 1.4.8 («si parla di serbatoio, non di spina») era scritta in un posto
 * dove i numeri veri non arrivavano mai: le prove dell'analisi si costruivano
 * le righe a mano, e continuavano a passare mentre in casa non succedeva.
 *
 * Perciò qui la tessera si fa disegnare davvero, e la frase si chiede a quella.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.DashboardModernModules = {
  store: { getSection: (nome) => ({ rooms: [{ id: "r1", name: "Camera" }] })[nome] },
};

const { modelliDelleTessere } = await import("../src/sections/home-widgets-section.js");
const { analisiDellaSezione } = await import("../src/core/analisi-sezione.js");
const { VERDETTI } = await import("../src/core/racconto-tessera.js");

const IT = (italiano) => italiano;
const stato = (state, attributes = {}) => ({ state, attributes });

/** La tessera Auto come la disegna il ponte, con questa vettura in casa. */
function tessera(stati, vettura) {
  magazzino.clear();
  magazzino.set("cd_ev_cars", JSON.stringify([vettura]));
  return (modelliDelleTessere(stati) || []).find((widget) => widget?.key === "ev") || null;
}

/* La Tucson della segnalazione: mild hybrid dichiarata termica, col serbatoio,
 * l'autonomia e la casella del motore che l'integrazione pubblica. */
const STATI = {
  "sensor.tucson_carburante": stato("64", { unit_of_measurement: "%" }),
  "sensor.tucson_autonomia": stato("480", { unit_of_measurement: "km" }),
  "binary_sensor.tucson_motore": stato("off", { friendly_name: "Tucson motore" }),
};
const TUCSON = {
  name: "Tucson",
  tipo: "termica",
  ov: {
    "dm.ev_carburante": "sensor.tucson_carburante",
    "dm.ev_autonomia": "sensor.tucson_autonomia",
    "dm.ev_motore": "binary_sensor.tucson_motore",
  },
};

test("ogni riga di una vettura porta il suo carburante", () => {
  const auto = tessera(STATI, TUCSON);
  assert.ok(auto.rows.length >= 3, "servono il serbatoio, l'autonomia e il motore");
  /* Tutte, non solo quella del livello: è su «tutte» che si decide se in
   * questo garage la spina voglia dire qualcosa. */
  assert.ok(auto.rows.every((riga) => riga.carburante === true));

  const elettrica = tessera(
    { "sensor.leaf_soc": stato("53", { unit_of_measurement: "%" }) },
    { name: "Leaf", ov: { "dm.ev_batteria_auto": "sensor.leaf_soc" } },
  );
  assert.ok(elettrica.rows.every((riga) => riga.carburante === false));
});

test("la casella del motore porta scritto che è il motore", () => {
  const auto = tessera(STATI, TUCSON);
  const motore = auto.rows.find((riga) => riga.ruolo === "motore");
  assert.ok(motore, "la riga del motore deve riconoscersi");
  assert.equal(motore.entity, "binary_sensor.tucson_motore");
  assert.equal(motore.on, false);
  // Le altre righe non se lo prendono in prestito.
  assert.equal(auto.rows.filter((riga) => riga.ruolo === "motore").length, 1);
});

test("col serbatoio letto si parla di serbatoio, e «ferma» non compare mai", () => {
  const esito = analisiDellaSezione(tessera(STATI, TUCSON), IT);
  assert.equal(esito.tono, VERDETTI.bene);
  assert.match(esito.frase, /serbatoio/i);
  assert.match(esito.frase, /64%/);
  assert.doesNotMatch(esito.frase, /ferma/i);
  assert.doesNotMatch(esito.frase, /attaccat|carica/i);
});

test("col motore acceso lo dice, e la tessera diventa «in corso»", () => {
  const acceso = { ...STATI, "binary_sensor.tucson_motore": stato("on") };
  const esito = analisiDellaSezione(tessera(acceso, TUCSON), IT);
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /motore acceso/i);
  assert.match(esito.frase, /64%/);
});

test("il motore spento non riempie la frase: è come sta un'auto quasi sempre", () => {
  const esito = analisiDellaSezione(tessera(STATI, TUCSON), IT);
  assert.doesNotMatch(esito.frase, /motore/i);
});

test("senza la casella del motore non si inventa niente", () => {
  const senza = { ...TUCSON, ov: { ...TUCSON.ov } };
  delete senza.ov["dm.ev_motore"];
  const esito = analisiDellaSezione(tessera(STATI, senza), IT);
  assert.doesNotMatch(esito.frase, /motore|ferma/i);
  assert.match(esito.frase, /serbatoio/i);
});

test("l'elettrica carica e staccata dice che è staccata, non che è ferma", () => {
  /* Sopra il venti per cento la frase era «E' al 64%, ferma.»: la spina non
   * c'è, ed è quello che si sa — il motore no. */
  const esito = analisiDellaSezione(
    tessera(
      { "sensor.leaf_soc": stato("64", { unit_of_measurement: "%" }) },
      { name: "Leaf", ov: { "dm.ev_batteria_auto": "sensor.leaf_soc" } },
    ),
    IT,
  );
  assert.equal(esito.tono, VERDETTI.bene);
  assert.match(esito.frase, /64%/);
  assert.match(esito.frase, /non attaccata/i);
  assert.doesNotMatch(esito.frase, /ferma/i);
});

test("e se l'elettrica ha il motore mappato e gira, lo dice anche lei", () => {
  const esito = analisiDellaSezione(
    tessera(
      {
        "sensor.leaf_soc": stato("64", { unit_of_measurement: "%" }),
        "binary_sensor.leaf_motore": stato("on"),
      },
      {
        name: "Leaf",
        ov: { "dm.ev_batteria_auto": "sensor.leaf_soc", "dm.ev_motore": "binary_sensor.leaf_motore" },
      },
    ),
    IT,
  );
  assert.equal(esito.tono, VERDETTI.corso);
  assert.match(esito.frase, /motore acceso/i);
});
