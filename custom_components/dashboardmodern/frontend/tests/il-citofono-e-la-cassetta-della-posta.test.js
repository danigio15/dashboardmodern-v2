/* «Avendo un intercom ho un button.cancello per aprire, inoltre volevo chiedere
 * una sezione per la cassetta della posta: all'interno c'è un Vallhorn di IKEA
 * che espone un pir per segnalare la presenza posta e un sensore luminosità
 * che, quando rileva luce (apertura cassetta), segnala il ritiro.» (#449)
 *
 * Gli entity_id qui sotto sono quelli veri: il `button.cancello` della
 * segnalazione e le due entità che l'integrazione IKEA pubblica per un Vallhorn.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPI_DELLA_CASSETTA,
  CAMPI_DEL_CITOFONO,
  CASSETTE_MASSIME,
  CHIAVE_CITOFONO,
  CITOFONI_MASSIMI,
  LUCE_CHE_APRE,
  comandoDiApertura,
  entitaDellIngresso,
  letturaDelCitofono,
  letturaDellaCassetta,
  lettureDellIngresso,
  normalizzaCassette,
  normalizzaCitofoni,
  puoAprire,
  riassuntoDellIngresso,
} from "../src/core/citofono-e-posta.js";

const ORA = Date.parse("2026-09-10T18:00:00Z");
const quandoFa = (minuti) => new Date(ORA - minuti * 60000).toISOString();

const stato = (state, minuti = 0, attributes = {}) => ({
  state,
  attributes,
  last_changed: quandoFa(minuti),
});

test("la chiave della configurazione è quella dell'alberatura", () => {
  assert.equal(CHIAVE_CITOFONO, "cd_citofono");
});

/* ── il citofono ──────────────────────────────────────────────────────── */

test("il button della segnalazione apre premendo, che è il verbo del suo dominio", () => {
  assert.equal(puoAprire("button.cancello"), true);
  assert.deepEqual(comandoDiApertura("button.cancello"), {
    domain: "button",
    service: "press",
    data: { entity_id: "button.cancello" },
  });
});

test("ogni dominio che apre ha il suo verbo, e nessuno è inventato", () => {
  const verbi = {
    "script.apri_cancello": "turn_on",
    "scene.cancello": "turn_on",
    "automation.apri_cancello": "trigger",
    "switch.cancello": "turn_on",
    "cover.cancello_carraio": "open_cover",
  };
  for (const [entity, service] of Object.entries(verbi))
    assert.equal(comandoDiApertura(entity)?.service, service, entity);
  assert.equal(comandoDiApertura("sensor.cancello"), null, "un sensore non apre niente");
  assert.equal(puoAprire("sensor.cancello"), false);
});

test("una serratura scatta se sa scattare, altrimenti si limita ad aprirsi", () => {
  /* `lock.open` è lo scatto del citofono; una serratura che non lo dichiara
   * riceverebbe un servizio che Home Assistant rifiuta. */
  const states = {
    "lock.portone": stato("locked", 30, { supported_features: 1 }),
    "lock.ingresso": stato("locked", 30, { supported_features: 0 }),
  };
  assert.equal(comandoDiApertura("lock.portone", states).service, "open");
  assert.equal(comandoDiApertura("lock.ingresso", states).service, "unlock");
});

test("il citofono dice chi apre, chi suona e cosa si vede", () => {
  const states = {
    "button.cancello": stato("unknown", 500),
    "binary_sensor.citofono_ding": stato("on", 0),
  };
  const lettura = letturaDelCitofono(
    {
      nome: "Cancello",
      apri: "button.cancello",
      campanello: "binary_sensor.citofono_ding",
      telecamera: "camera.citofono",
    },
    states,
  );
  assert.equal(lettura.nome, "Cancello");
  /* Un tasto mai premuto sta su «unknown», ed è un tasto che funziona. */
  assert.equal(lettura.puoAprire, true);
  assert.equal(lettura.suona, true);
  assert.equal(lettura.telecamera, "camera.citofono");
  assert.equal(lettura.squillo, ORA);
});

test("un citofono che Home Assistant non raggiunge non promette di aprire", () => {
  const states = { "button.cancello": stato("unavailable", 5) };
  assert.equal(letturaDelCitofono({ apri: "button.cancello" }, states).puoAprire, false);
});

test("senza campanello non si dice né che suona né che tace", () => {
  const lettura = letturaDelCitofono({ apri: "button.cancello" }, {});
  assert.equal(lettura.suona, null, "un campanello che non c'è non è un campanello muto");
});

/* ── la cassetta ──────────────────────────────────────────────────────── */

const CASSETTA = {
  nome: "Cassetta",
  posta: "binary_sensor.vallhorn_motion",
  ritiro: "sensor.vallhorn_illuminance",
};

test("posta arrivata dopo l'ultima apertura vuol dire posta ancora dentro", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("off", 30),
    "sensor.vallhorn_illuminance": stato("0", 600),
  };
  const lettura = letturaDellaCassetta(CASSETTA, states);
  assert.equal(lettura.ce, true);
  assert.equal(lettura.arrivata, ORA - 30 * 60000);
  assert.equal(lettura.aperta, false);
});

test("una cassetta aperta dopo l'ultimo movimento è una cassetta svuotata", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("off", 600),
    "sensor.vallhorn_illuminance": stato("0", 30),
  };
  assert.equal(letturaDellaCassetta(CASSETTA, states).ce, false);
});

test("con lo sportello aperto adesso la posta la stai prendendo tu", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("off", 600),
    "sensor.vallhorn_illuminance": stato("140", 0),
  };
  const lettura = letturaDellaCassetta(CASSETTA, states);
  assert.equal(lettura.aperta, true);
  assert.equal(lettura.ce, false);
});

test("la soglia della luce si può alzare, e sotto soglia la cassetta è chiusa", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("off", 600),
    "sensor.vallhorn_illuminance": stato("30", 0),
  };
  assert.equal(letturaDellaCassetta(CASSETTA, states).aperta, true);
  assert.equal(
    letturaDellaCassetta({ ...CASSETTA, soglia: 100 }, states).aperta,
    false,
    "trenta lux non aprono una cassetta la cui soglia è cento",
  );
  assert.equal(normalizzaCassette([CASSETTA])[0].soglia, LUCE_CHE_APRE);
});

test("un contatto al posto del luxmetro dice la stessa cosa senza soglia da tarare", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("off", 600),
    "binary_sensor.sportello": stato("on", 0),
  };
  const lettura = letturaDellaCassetta(
    { ...CASSETTA, ritiro: "binary_sensor.sportello" },
    states,
  );
  assert.equal(lettura.aperta, true);
});

test("col solo rilevatore non si inventa un «no»", () => {
  const states = { "binary_sensor.vallhorn_motion": stato("off", 30) };
  const spenta = letturaDellaCassetta({ posta: "binary_sensor.vallhorn_motion" }, states);
  assert.equal(spenta.ce, null, "senza sapere dei ritiri, «non c'è posta» sarebbe una bugia");
  assert.equal(spenta.arrivata, ORA - 30 * 60000, "ma quando si è mosso si sa");

  const accesa = letturaDellaCassetta(
    { posta: "binary_sensor.vallhorn_motion" },
    { "binary_sensor.vallhorn_motion": stato("on", 0) },
  );
  assert.equal(accesa.ce, true, "mentre si muove, qualcosa è appena entrato");
});

test("un rilevatore che non risponde non è una cassetta vuota", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("unavailable", 5),
    "sensor.vallhorn_illuminance": stato("0", 600),
  };
  const lettura = letturaDellaCassetta(CASSETTA, states);
  assert.equal(lettura.muta, true);
  assert.equal(lettura.ce, null);
});

test("il contatore delle lettere, se c'è, si legge com'è", () => {
  const states = {
    "binary_sensor.vallhorn_motion": stato("off", 30),
    "sensor.vallhorn_illuminance": stato("0", 600),
    "counter.lettere": stato("3", 30),
  };
  const lettura = letturaDellaCassetta({ ...CASSETTA, contatore: "counter.lettere" }, states);
  assert.equal(lettura.contatore, 3);
});

/* ── l'elenco e il riassunto ──────────────────────────────────────────── */

test("gli elenchi hanno un tetto, e una voce appena aggiunta ci resta", () => {
  const tanti = Array.from({ length: 9 }, (_, i) => ({ apri: `button.cancello_${i}` }));
  assert.equal(normalizzaCitofoni(tanti).length, CITOFONI_MASSIMI);
  const tante = Array.from({ length: 9 }, (_, i) => ({ posta: `binary_sensor.posta_${i}` }));
  assert.equal(normalizzaCassette(tante).length, CASSETTE_MASSIME);

  const vuote = normalizzaCitofoni([{}, {}]);
  assert.equal(vuote.length, 2, "due righe vuote restano due righe: si stanno riempiendo");
});

test("le entità da guardare sono tutte quelle configurate, una volta sola", () => {
  const entita = entitaDellIngresso({
    citofoni: [{ apri: "button.cancello", campanello: "binary_sensor.citofono_ding" }],
    cassette: [CASSETTA, { posta: "binary_sensor.vallhorn_motion" }],
  });
  assert.deepEqual(entita, [
    "button.cancello",
    "binary_sensor.citofono_ding",
    "binary_sensor.vallhorn_motion",
    "sensor.vallhorn_illuminance",
  ]);
  assert.deepEqual(CAMPI_DEL_CITOFONO, ["apri", "campanello", "telecamera"]);
  assert.deepEqual(CAMPI_DELLA_CASSETTA, ["posta", "ritiro", "contatore"]);
});

test("il riassunto è quello che la tessera racconta in tre parole", () => {
  const states = {
    "button.cancello": stato("unknown", 500),
    "binary_sensor.citofono_ding": stato("on", 0),
    "binary_sensor.vallhorn_motion": stato("off", 30),
    "sensor.vallhorn_illuminance": stato("0", 600),
  };
  const letture = lettureDellIngresso(
    {
      citofoni: [{ apri: "button.cancello", campanello: "binary_sensor.citofono_ding" }],
      cassette: [CASSETTA],
    },
    states,
  );
  const riassunto = riassuntoDellIngresso(letture);
  assert.equal(riassunto.suona, true);
  assert.equal(riassunto.conPosta, 1);
  assert.equal(riassunto.citofoni, 1);
  assert.equal(riassunto.cassette, 1);
  assert.equal(riassunto.arrivata, ORA - 30 * 60000);
});
