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
  CHIAVE_ARRIVO_VISTO,
  CHIAVE_CITOFONO,
  CITOFONI_MASSIMI,
  LUCE_CHE_APRE,
  arriviDaRicordare,
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
  const lettura = letturaDellaCassetta({ ...CASSETTA, ritiro: "binary_sensor.sportello" }, states);
  assert.equal(lettura.aperta, true);
});

test("col solo rilevatore la posta resta li' finché non la si prende", () => {
  /* Questo contratto è cambiato con la #536, e il cambio è la richiesta:
   * «vorrei che la gestione della posta sia gestita anche tramite sensore di
   * movimento nella cassetta». Prima, col solo rilevatore, «c'è» valeva finché
   * il rilevatore era acceso e poi tornava «non si sa» — e un PIR si spegne
   * dopo trenta secondi, quindi la posta arrivata alle nove era dimenticata
   * alle nove e un minuto. Con quella regola il rilevatore da solo non
   * gestiva proprio niente.
   *
   * Adesso l'ultimo movimento vale finché qualcuno non dice di aver preso la
   * posta: è come si comporta una cassetta vera, la posta non se ne va da
   * sola. Quello che non si fa — e non si faceva nemmeno prima — è inventare
   * un «no»: senza rilevatore, o col rilevatore muto, resta «non si sa». */
  const states = { "binary_sensor.vallhorn_motion": stato("off", 30) };
  const spenta = letturaDellaCassetta({ posta: "binary_sensor.vallhorn_motion" }, states);
  assert.equal(spenta.ce, true, "si è mosso mezz'ora fa e nessuno l'ha tolta");
  assert.equal(spenta.arrivata, ORA - 30 * 60000, "e quando si è mosso si sa");

  const accesa = letturaDellaCassetta(
    { posta: "binary_sensor.vallhorn_motion" },
    { "binary_sensor.vallhorn_motion": stato("on", 0) },
  );
  assert.equal(accesa.ce, true, "mentre si muove, qualcosa è appena entrato");

  /* Il «no» continua a non inventarsi: senza il rilevatore non si sa. */
  const senza = letturaDellaCassetta({ ritiro: "sensor.lux" }, {});
  assert.equal(senza.ce, null, "senza rilevatore non c'è niente da dire");
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

/* Il ritiro dichiarato a mano vale, e vale anche dopo che il PIR si spegne.
 *
 * Il rilevatore dice `last_changed`, cioe' l'ULTIMO cambio. Finche' e' acceso
 * quel momento e' l'arrivo; quando si spegne diventa il momento della discesa,
 * che non e' un arrivo — ma e' piu' recente del ritiro appena dichiarato, e
 * senza ricordare la salita la cassetta tornava piena da sola. Chi aveva detto
 * «l'ho presa» doveva dirlo una seconda volta, e solo dopo i trenta secondi
 * del PIR.
 *
 * La sequenza qui sotto e' quella intera, nell'ordine in cui succede in casa.
 */
test("la chiave dell'arrivo sta accanto a quella del ritiro", () => {
  assert.equal(CHIAVE_ARRIVO_VISTO, "cd_posta_arrivata");
});

test("il registro degli arrivi si scrive sulla salita e ignora la discesa", () => {
  const conf = { cassette: [{ id: "c1", posta: "binary_sensor.pir" }] };

  const acceso = arriviDaRicordare(conf, { "binary_sensor.pir": stato("on", 5) }, {});
  assert.deepEqual(acceso, { c1: ORA - 5 * 60000 }, "il rilevatore acceso e' l'arrivo");

  /* Spento: non si scrive niente, e quello che c'era resta. */
  const dopo = arriviDaRicordare(conf, { "binary_sensor.pir": stato("off", 0) }, acceso);
  assert.equal(dopo, acceso, "la discesa non tocca il registro, nemmeno la mappa");

  /* E un secondo giro sullo stesso fronte non riscrive per niente. */
  const uguale = arriviDaRicordare(conf, { "binary_sensor.pir": stato("on", 5) }, acceso);
  assert.equal(uguale, acceso, "stesso fronte, stessa mappa: niente da salvare");
});

test("«l'ho presa» vale subito, anche col rilevatore ancora acceso", () => {
  const conf = { posta: "binary_sensor.pir" };
  const states = { "binary_sensor.pir": stato("on", 1) };
  const visti = { c1: ORA - 1 * 60000 };

  const prima = letturaDellaCassetta({ id: "c1", ...conf }, states, null, visti);
  assert.equal(prima.ce, true, "si e' appena mosso e nessuno ha detto niente");

  /* Si tocca «L'ho presa» adesso: il ritiro e' piu' recente dell'arrivo. */
  const presa = letturaDellaCassetta({ id: "c1", ...conf }, states, { c1: ORA }, visti);
  assert.equal(presa.ce, false, "l'ha presa lei, i trenta secondi del PIR non contano");
});

test("e quando il rilevatore si spegne la cassetta resta vuota", () => {
  const conf = { id: "c1", posta: "binary_sensor.pir" };
  /* Il PIR e' sceso adesso: `last_changed` dice ORA, piu' recente del ritiro.
   * Senza il registro questo bastava a rimettere la posta dentro. */
  const states = { "binary_sensor.pir": stato("off", 0) };
  const visti = { c1: ORA - 1 * 60000 };
  const letta = letturaDellaCassetta(conf, states, { c1: ORA - 0.5 * 60000 }, visti);
  assert.equal(letta.arrivata, ORA - 1 * 60000, "l'arrivo e' la salita, non la discesa");
  assert.equal(letta.ce, false, "presa mezzo minuto fa, e nessuno ha portato altro");
});

test("ma un movimento nuovo dopo il ritiro riempie di nuovo la cassetta", () => {
  const conf = { id: "c1", posta: "binary_sensor.pir" };
  const states = { "binary_sensor.pir": stato("off", 0) };
  /* Ritirata un'ora fa, e mezz'ora fa e' passato di nuovo il postino. */
  const letta = letturaDellaCassetta(
    conf,
    states,
    { c1: ORA - 60 * 60000 },
    {
      c1: ORA - 30 * 60000,
    },
  );
  assert.equal(letta.ce, true, "la posta non se ne va da sola");
});

test("senza registro si legge quello che c'e', come prima del ricordo", () => {
  /* Prima volta che questa plancia guarda la cassetta: il rilevatore e' gia'
   * spento e non si e' visto niente salire. Resta il cambio buono in mancanza
   * d'altro — che e' quello che si faceva prima, e senza ritiri dichiarati non
   * sbaglia. */
  const letta = letturaDellaCassetta(
    { id: "c1", posta: "binary_sensor.pir" },
    { "binary_sensor.pir": stato("off", 30) },
    null,
    null,
  );
  assert.equal(letta.arrivata, ORA - 30 * 60000);
  assert.equal(letta.ce, true);
});

/* ── chi ha SOLO il contatto sullo sportello (#564) ────────────────────────
 *
 * «Non serve il sensore che si mette per l'apertura della cassetta della
 * posta.» Ed era vero: la sezione è nata intorno al Vallhorn — un rilevatore
 * dentro che dice «è arrivato qualcosa» e un luxmetro che dice «lo sportello è
 * stato aperto» — e il verdetto è il confronto fra i due momenti. Con un
 * contatto solo quei due momenti sono lo stesso momento, e il confronto dava
 * sempre «pari»: la card diceva «Aperta» per i pochi secondi dell'apertura e
 * «Non si sa» per tutto il resto del tempo, senza nemmeno il tasto «L'ho
 * presa». Il sensore c'era e non serviva a niente.
 *
 * Con un sensore solo l'unica cosa che si sa è che qualcuno ha aperto lo
 * sportello — il postino che infila o chi ritira, e da fuori non si
 * distinguono. Quell'apertura vale come arrivo, e a dire che è finita è la
 * persona: è come funziona una cassetta vera.
 */

const SOLO_SPORTELLO = { id: "cassetta-1", nome: "Cassetta", ritiro: "binary_sensor.sportello" };

/* L'arrivo è l'APERTURA, e la si vede solo mentre è aperto: un attimo dopo
 * `last_changed` dice quando si è RICHIUSO. Quindi la prova passa dalla stessa
 * porta della plancia — si segna l'apertura mentre si vede, e poi si legge. */
const CON_SPORTELLO = { cassette: [SOLO_SPORTELLO] };
const segnata = (minuti) =>
  arriviDaRicordare(CON_SPORTELLO, { "binary_sensor.sportello": stato("on", minuti) }, null);

test("col solo sportello, un'apertura è una notizia: c'è posta", () => {
  const visti = segnata(20);
  assert.deepEqual(visti, { "cassetta-1": Date.parse(quandoFa(20)) }, "l'apertura va segnata");
  /* Lo sportello si è richiuso: `last_changed` adesso dice quando si è chiuso,
   * e vale quello che ci si era segnati. */
  const letta = letturaDellaCassetta(
    SOLO_SPORTELLO,
    { "binary_sensor.sportello": stato("off", 19) },
    null,
    visti,
  );
  assert.equal(letta.ce, true, "lo sportello si è aperto e nessuno ha detto di aver preso niente");
  assert.equal(letta.aperta, false);
  assert.equal(letta.arrivata, Date.parse(quandoFa(20)));
  assert.equal(letta.daSportello, true, "la pagina deve scrivere «apertura», non «movimento»");
  assert.equal(letta.muta, false);
});

test("e «l'ho presa» la svuota, finché lo sportello non si riapre", () => {
  const chiuso = { "binary_sensor.sportello": stato("off", 19) };
  const presa = { "cassetta-1": Date.parse(quandoFa(5)) };
  assert.equal(letturaDellaCassetta(SOLO_SPORTELLO, chiuso, presa, segnata(20)).ce, false);
  /* Lo sportello si riapre dopo il ritiro: è posta nuova. */
  assert.equal(letturaDellaCassetta(SOLO_SPORTELLO, chiuso, presa, segnata(2)).ce, true);
});

/* ── e non si inventa un'apertura che nessuno ha visto ─────────────────────
 *
 * `last_changed` di un contatto CHIUSO dice quando si è chiuso — o, dopo un
 * riavvio di Home Assistant, semplicemente quando l'entità è rinata. Preso
 * com'è, diceva «c'è posta» a ogni riavvio.
 *
 * Col luxmetro — che è una configurazione prevista, visto che c'è la soglia —
 * era peggio: il suo stato è un numero, quindi `last_changed` si muove a OGNI
 * oscillazione della luce, e l'arrivo scavalcava il ritiro a ogni lettura. La
 * cassetta diceva «c'è posta» per sempre e il tasto «l'ho presa» non teneva.
 */
test("un riavvio non è un'apertura: senza averla vista non si sa", () => {
  const letta = letturaDellaCassetta(SOLO_SPORTELLO, {
    "binary_sensor.sportello": stato("off", 0),
  });
  assert.equal(letta.arrivata, null);
  assert.equal(letta.ce, null, "non si sa: nessuno ha visto aprire");
});

test("il luxmetro che oscilla sotto la soglia non riapre la cassetta", () => {
  const luce = { id: "cassetta-1", ritiro: "sensor.lux", soglia: 40 };
  const presa = { "cassetta-1": Date.parse(quandoFa(10)) };
  const visti = arriviDaRicordare(
    { cassette: [luce] },
    { "sensor.lux": stato("120", 30) },
    null,
  );
  assert.deepEqual(visti, { "cassetta-1": Date.parse(quandoFa(30)) }, "l'apertura vera si segna");
  /* Adesso la luce ondeggia al buio: ogni lettura muove `last_changed`, e
   * nessuna di quelle è un'apertura. */
  for (const [valore, minuti] of [["3", 4], ["5", 2], ["2", 0]]) {
    const states = { "sensor.lux": stato(valore, minuti) };
    assert.deepEqual(
      arriviDaRicordare({ cassette: [luce] }, states, visti),
      visti,
      `${valore} lux non è un'apertura`,
    );
    const letta = letturaDellaCassetta(luce, states, presa, visti);
    assert.equal(letta.arrivata, Date.parse(quandoFa(30)), `${valore} lux`);
    assert.equal(letta.ce, false, `${valore} lux: l'ho presa dieci minuti fa`);
  }
});

test("mentre lo sportello è aperto la parola è «Aperta», non un verdetto", () => {
  const letta = letturaDellaCassetta(SOLO_SPORTELLO, {
    "binary_sensor.sportello": stato("on", 0),
  });
  assert.equal(letta.aperta, true);
  assert.equal(letta.ce, false, "qualcuno ci ha le mani dentro adesso");
});

test("un contatto muto resta muto: non si inventa un arrivo", () => {
  for (const grezzo of ["unavailable", "unknown"]) {
    const letta = letturaDellaCassetta(SOLO_SPORTELLO, {
      "binary_sensor.sportello": stato(grezzo, 20),
    });
    assert.equal(letta.muta, true, grezzo);
    assert.equal(letta.ce, null, grezzo);
  }
});

test("chi ha tutti e due i sensori non si accorge di niente", () => {
  /* La regola nuova vale solo per chi ha un sensore solo: col Vallhorn il
   * rilevatore resta l'arrivo e lo sportello resta il ritiro, come sempre. */
  const vallhorn = {
    id: "cassetta-1",
    posta: "binary_sensor.vallhorn_motion",
    ritiro: "sensor.vallhorn_illuminance",
  };
  const letta = letturaDellaCassetta(vallhorn, {
    "binary_sensor.vallhorn_motion": stato("off", 30),
    "sensor.vallhorn_illuminance": stato("0", 120),
  });
  assert.equal(letta.daSportello, false);
  assert.equal(letta.ce, true, "movimento più recente dell'ultima apertura: la posta è dentro");
  /* E lo sportello aperto dopo il movimento la svuota, come prima. */
  const svuotata = letturaDellaCassetta(vallhorn, {
    "binary_sensor.vallhorn_motion": stato("off", 30),
    "sensor.vallhorn_illuminance": stato("0", 10),
  });
  assert.equal(svuotata.ce, false);
});

test("col solo rilevatore dentro non cambia niente nemmeno lì", () => {
  const soloPir = { id: "cassetta-1", posta: "binary_sensor.pir" };
  const letta = letturaDellaCassetta(soloPir, { "binary_sensor.pir": stato("on", 0) });
  assert.equal(letta.daSportello, false);
  assert.equal(letta.ce, true);
  assert.equal(letta.aperta, null, "senza sportello non si sa se è aperta");
});

test("una cassetta senza sensori non dice niente, come prima", () => {
  const vuota = letturaDellaCassetta({ id: "cassetta-1", nome: "Cassetta" }, {});
  assert.equal(vuota.ce, null);
  assert.equal(vuota.muta, false, "non è muta: non le è stato chiesto niente");
  assert.equal(vuota.daSportello, false);
});
