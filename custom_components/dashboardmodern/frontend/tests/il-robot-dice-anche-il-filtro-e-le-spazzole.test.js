/* «Sarebbe possibile aggiungere più valori tra quelli che mostra?» (#468)
 *
 * E poi, nello stesso filo: «in più io ho due mappe e mi visualizza solo una».
 *
 * Chi ha segnalato ha un Ecovacs, e ha mandato l'elenco delle entità che
 * l'integrazione gli espone. È quello l'elenco che sta qui sotto, com'è
 * arrivato: la durata del filtro, quella delle due spazzole, l'area pulita, le
 * pulizie fatte, il mocio attaccato — e in mezzo l'indirizzo IP, l'SSID e la
 * potenza del wi-fi, che nessuno vuole in mezzo ai metri quadri puliti.
 *
 * La scheda del robot chiedeva quattro cose: il robot, la mappa, la batteria,
 * la stanza. Tutto il resto che l'integrazione pubblica non si vedeva. Adesso
 * chi configura sceglie le sue letture, e quelle che hanno quasi tutti si
 * riconoscono da sole.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  disegnoDellaLettura,
  durataLeggibile,
  elencoLetture,
  LETTURE_MASSIME,
  letturaDelDispositivo,
  lettureRiconosciute,
  lettureDelDispositivo,
  lettureVicine,
} from "../src/core/letture-accanto.js";
import {
  bindRobotToDevice,
  elencoMappe,
  mappeDelRobot,
  MAPPE_MASSIME,
  mappeSuggerite,
  normalizeRobot,
  robotView,
} from "../src/core/robot-model.js";

const stato = (state, attributes = {}) => ({ state, attributes });

/* L'Ecovacs di chi ha segnalato, com'è arrivato nel commento. */
const CASA = {
  "vacuum.pippo": stato("docked", { friendly_name: "Pippo", battery_level: 100 }),
  "binary_sensor.pippo_mop_attached": stato("on", { friendly_name: "Pippo Mop attached" }),
  "image.pippo_mappa": stato("2026-09-10", {
    friendly_name: "Pippo Mappa",
    entity_picture: "/api/image_proxy/image.pippo_mappa?token=a",
  }),
  "number.pippo_clean_count": stato("2", { friendly_name: "Pippo Clean count" }),
  "select.pippo_active_map": stato("Piano terra", {
    friendly_name: "Pippo Active map",
    options: ["Piano terra", "Primo piano"],
  }),
  "sensor.pippo_area_pulita": stato("23.4", {
    friendly_name: "Pippo Area pulita",
    unit_of_measurement: "m²",
  }),
  "sensor.pippo_batteria": stato("100", {
    friendly_name: "Pippo Batteria",
    unit_of_measurement: "%",
    device_class: "battery",
  }),
  "sensor.pippo_durata_filtro": stato("8100", {
    friendly_name: "Pippo Durata filtro",
    unit_of_measurement: "min",
  }),
  "sensor.pippo_durata_pulizia": stato("45", {
    friendly_name: "Pippo Durata pulizia",
    unit_of_measurement: "min",
  }),
  "sensor.pippo_durata_spazzola_laterale": stato("6000", {
    friendly_name: "Pippo Durata spazzola laterale",
    unit_of_measurement: "min",
  }),
  "sensor.pippo_durata_spazzola_principale": stato("9000", {
    friendly_name: "Pippo Durata spazzola principale",
    unit_of_measurement: "min",
  }),
  "sensor.pippo_errore": stato("no_error", { friendly_name: "Pippo Errore" }),
  "sensor.pippo_indirizzo_ip": stato("192.168.1.42", { friendly_name: "Pippo Indirizzo IP" }),
  "sensor.pippo_ssid_wi_fi": stato("CasaMia", { friendly_name: "Pippo SSID Wi-Fi" }),
  "sensor.pippo_total_area_cleaned": stato("1240", {
    friendly_name: "Pippo Total area cleaned",
    unit_of_measurement: "m²",
  }),
  "sensor.pippo_total_cleaning_duration": stato("5400", {
    friendly_name: "Pippo Total cleaning duration",
    unit_of_measurement: "min",
  }),
  "sensor.pippo_total_cleanings": stato("137", { friendly_name: "Pippo Total cleanings" }),
  "sensor.pippo_wi_fi_rssi": stato("-52", {
    friendly_name: "Pippo Wi-Fi RSSI",
    unit_of_measurement: "dBm",
  }),
};

const PIPPO = { entity: "vacuum.pippo", battery: "sensor.pippo_batteria", mappe: ["image.pippo_mappa"] };

test("le letture che tutti hanno si riconoscono da sole, la diagnostica no", () => {
  const consigliate = lettureRiconosciute(PIPPO, CASA);
  /* Le sei che il robot pubblica e che a chi guarda la scheda servono. */
  for (const attesa of [
    "sensor.pippo_durata_filtro",
    "sensor.pippo_durata_spazzola_principale",
    "sensor.pippo_durata_spazzola_laterale",
    "sensor.pippo_area_pulita",
    "sensor.pippo_total_cleanings",
  ])
    assert.ok(consigliate.includes(attesa), `manca ${attesa}`);
  /* L'indirizzo IP e il wi-fi restano fuori: stanno accanto al robot come
   * tutto il resto, ma non sono cose che si guardano su una scheda. */
  for (const fuori of [
    "sensor.pippo_indirizzo_ip",
    "sensor.pippo_ssid_wi_fi",
    "sensor.pippo_wi_fi_rssi",
  ])
    assert.ok(!consigliate.includes(fuori), `${fuori} non doveva entrare da solo`);
  /* Nemmeno la batteria e l'errore: hanno già il loro posto sulla scheda, e
   * scriverli due volte sarebbe la stessa cosa detta due volte. */
  assert.ok(!consigliate.includes("sensor.pippo_batteria"));
  assert.ok(!consigliate.includes("sensor.pippo_errore"));
});

test("scegliendole a mano c'è tutto, con la diagnostica in fondo", () => {
  /* Le proposte non nascondono niente — chi vuole la potenza del wi-fi se la
   * prende — ma l'ordine dice cosa viene prima. */
  const proposte = lettureVicine(PIPPO, CASA);
  assert.ok(proposte.includes("sensor.pippo_indirizzo_ip"));
  assert.ok(
    proposte.indexOf("sensor.pippo_durata_filtro") < proposte.indexOf("sensor.pippo_indirizzo_ip"),
    "la diagnostica sta in fondo, non in mezzo",
  );
  /* Un tasto non è una lettura: quello è un comando, e ha già la sua riga. */
  assert.ok(!proposte.includes("select.pippo_active_map"));
  /* E niente di quello che la scheda mostra già altrove. */
  assert.ok(!proposte.includes("sensor.pippo_batteria"));
  assert.ok(!proposte.includes("image.pippo_mappa"));
});

test("un filtro che dura 8100 minuti si legge in ore, 45 minuti restano minuti", () => {
  /* Nessuno pensa in minuti a centotrentacinque ore di distanza; e nessuno
   * pensa in ore per tre quarti d'ora. La soglia è due ore. */
  assert.equal(durataLeggibile(8100, "min", "it"), "135 h");
  assert.equal(durataLeggibile(45, "min", "it"), "45 min");
  assert.equal(durataLeggibile(3600, "s", "it"), "60 min");
  /* Una misura che non è un tempo non diventa un tempo. */
  assert.equal(durataLeggibile(23.4, "m²", "it"), null);
  assert.equal(durataLeggibile(52, "", "it"), null);
});

test("ogni lettura si scrive col suo numero, la sua unità e il suo nome", () => {
  const robot = { ...PIPPO, letture: lettureRiconosciute(PIPPO, CASA) };
  const lette = Object.fromEntries(
    lettureDelDispositivo(robot, CASA, "it").map((voce) => [voce.entity, voce]),
  );
  /* Il nome è quello dell'entità senza il nome del robot davanti: su una
   * scheda che porta già «Pippo» in testa, «Pippo Durata filtro» ripete. */
  assert.equal(lette["sensor.pippo_durata_filtro"].name, "Durata filtro");
  assert.equal(lette["sensor.pippo_durata_filtro"].testo, "135 h");
  assert.equal(lette["sensor.pippo_area_pulita"].testo, "23,4 m²");
  assert.equal(lette["sensor.pippo_total_cleanings"].testo, "137");
  /* Un binary_sensor dice sì o no: «on» non è una risposta. */
  assert.equal(lette["binary_sensor.pippo_mop_attached"].testo, "Sì");
  /* E ognuna porta il disegno della sua famiglia, dal nostro catalogo. */
  assert.equal(disegnoDellaLettura("sensor.pippo_durata_filtro", CASA), "wind");
  assert.equal(disegnoDellaLettura("sensor.pippo_durata_spazzola_principale", CASA), "broom");
  assert.equal(disegnoDellaLettura("binary_sensor.pippo_mop_attached", CASA), "water");
  /* Un sensore che non si riconosce non ne ha uno inventato. */
  assert.equal(disegnoDellaLettura("sensor.pippo_ssid_wi_fi", CASA), "");
});

test("un sensore che non risponde scrive il trattino, non uno zero", () => {
  const stati = {
    "sensor.x": stato("unavailable", { unit_of_measurement: "min" }),
    "sensor.y": stato("unknown", {}),
  };
  assert.equal(letturaDelDispositivo("sensor.x", {}, stati, "it").testo, "—");
  assert.equal(letturaDelDispositivo("sensor.x", {}, stati, "it").available, false);
  assert.equal(letturaDelDispositivo("sensor.y", {}, stati, "it").testo, "—");
  /* Un sensore che non c'è proprio: idem, senza inventare. */
  assert.equal(letturaDelDispositivo("sensor.mai_vista", {}, stati, "it").testo, "—");
});

test("l'elenco tiene dieci letture, una volta sola, e solo cose che si leggono", () => {
  const troppe = Array.from({ length: 14 }, (_, i) => `sensor.robot_${i}`);
  assert.equal(elencoLetture(troppe).length, LETTURE_MASSIME);
  assert.deepEqual(elencoLetture(["sensor.a", "sensor.a"]), ["sensor.a"]);
  assert.deepEqual(elencoLetture(["button.premi", "sensor.a", "vacuum.pippo"]), ["sensor.a"]);
  /* Anche scritte tutte in una riga, come le legge l'editor. */
  assert.deepEqual(elencoLetture("sensor.a, sensor.b"), ["sensor.a", "sensor.b"]);
});

test("le letture scelte sopravvivono al salvataggio, come i comandi", () => {
  /* Il difetto di sempre: un campo che il modello non nomina sparisce al primo
   * salvataggio. Le letture sono nell'elenco, quindi restano. */
  const robot = normalizeRobot({
    entity: "vacuum.pippo",
    letture: ["sensor.pippo_durata_filtro", "sensor.pippo_area_pulita"],
  });
  assert.deepEqual(normalizeRobot(robot).letture, [
    "sensor.pippo_durata_filtro",
    "sensor.pippo_area_pulita",
  ]);
});

/* ── le due mappe (#468) ─────────────────────────────────────────────────── */

test("un robot può avere più mappe, e la prima è quella di sempre", () => {
  const robot = normalizeRobot({
    entity: "vacuum.pippo",
    mappe: ["image.pippo_piano_terra", "image.pippo_primo_piano"],
  });
  assert.deepEqual(robot.mappe, ["image.pippo_piano_terra", "image.pippo_primo_piano"]);
  /* `mapEntity` non è sparito: è la mappa in cima, e chi legge solo quello —
   * il resto della plancia — continua a leggere una mappa vera. */
  assert.equal(robot.mapEntity, "image.pippo_piano_terra");
});

test("una configurazione scritta prima di oggi diventa un elenco di una", () => {
  /* Chi ha una mappa sola l'ha salvata come `mapEntity`, e non deve
   * riscrivere niente perché il campo nuovo esista. */
  const vecchio = normalizeRobot({ entity: "vacuum.pippo", mapEntity: "camera.pippo_map" });
  assert.deepEqual(vecchio.mappe, ["camera.pippo_map"]);
  assert.equal(vecchio.mapEntity, "camera.pippo_map");
  /* E chi non ne ha nessuna resta senza, senza che compaia una riga vuota. */
  assert.deepEqual(normalizeRobot({ entity: "vacuum.pippo" }).mappe, []);
  assert.equal(normalizeRobot({ entity: "vacuum.pippo" }).mapEntity, "");
});

test("l'elenco delle mappe accetta solo telecamere e immagini, fino a quattro", () => {
  assert.deepEqual(elencoMappe(["sensor.x", "camera.a", "image.b"]), ["camera.a", "image.b"]);
  assert.deepEqual(elencoMappe(["camera.a", "camera.a"]), ["camera.a"]);
  assert.equal(
    elencoMappe(Array.from({ length: 9 }, (_, i) => `image.p_${i}`)).length,
    MAPPE_MASSIME,
  );
});

test("dall'integrazione entrano tutte le mappe, non solo la prima", () => {
  /* Il caso segnalato: due piani, due immagini, e ne compariva una. */
  const entities = [
    { entity_id: "vacuum.pippo" },
    { entity_id: "image.pippo_ultima_pulizia", name: "Ultima pulizia" },
    { entity_id: "image.pippo_mappa_piano_terra", name: "Mappa piano terra" },
    { entity_id: "image.pippo_mappa_primo_piano", name: "Mappa primo piano" },
    { entity_id: "sensor.pippo_durata_filtro", name: "Durata filtro" },
  ];
  const nato = bindRobotToDevice({ device: { name: "Pippo" }, entities, states: CASA, index: 0 });
  assert.equal(nato.mappe.length, 3);
  /* Davanti quelle che dicono di essere una mappa: un robot pubblica anche la
   * fotografia dell'ultima pulizia, e la prima proposta dev'essere la mappa. */
  assert.equal(nato.mapEntity, "image.pippo_mappa_piano_terra");
  assert.ok(nato.mappe.includes("image.pippo_mappa_primo_piano"));
});

test("il robot nato dall'integrazione porta già le sue letture", () => {
  const entities = Object.keys(CASA).map((entity_id) => ({ entity_id }));
  const nato = bindRobotToDevice({ device: { name: "Pippo" }, entities, states: CASA, index: 0 });
  assert.ok(nato.letture.includes("sensor.pippo_durata_filtro"));
  assert.ok(nato.letture.includes("sensor.pippo_area_pulita"));
  assert.ok(!nato.letture.includes("sensor.pippo_indirizzo_ip"));
});

test("la vista del robot porta le mappe col loro disegno e le letture già scritte", () => {
  const robot = normalizeRobot({
    ...PIPPO,
    mappe: ["image.pippo_mappa"],
    letture: ["sensor.pippo_durata_filtro"],
  });
  const view = robotView(robot, CASA);
  assert.equal(view.mappe.length, 1);
  assert.equal(view.mappe[0].name, "Mappa");
  assert.match(view.mappe[0].picture, /image_proxy/);
  /* E `mapPicture` resta quello della prima: chi lo legge legge una mappa. */
  assert.equal(view.mapPicture, view.mappe[0].picture);
  assert.equal(view.letture[0].testo, "135 h");
  /* `mappeDelRobot` legge anche un robot vecchio, con la sola `mapEntity`. */
  assert.equal(mappeDelRobot({ mapEntity: "image.pippo_mappa" }, CASA)[0].entity, "image.pippo_mappa");
});

test("le mappe accanto al robot si propongono, con quelle vere davanti", () => {
  const proposte = mappeSuggerite({ entity: "vacuum.pippo" }, CASA);
  assert.deepEqual(proposte, ["image.pippo_mappa"]);
  /* Quella già scelta non si ripropone. */
  assert.deepEqual(mappeSuggerite(PIPPO, CASA), []);
});

/* ── quello che si vede sulla scheda ─────────────────────────────────────── */

test("la scheda scrive le letture e mette le linguette solo con più di una mappa", async () => {
  const sezione = await readFile(
    new URL("../src/sections/robot-section.js", import.meta.url),
    "utf8",
  );
  /* Le letture stanno sulla card, e il numero si aggiorna sul posto senza
   * rifarla — come la batteria. */
  assert.match(sezione, /data-dm-robot-letture/);
  assert.match(sezione, /data-dm-lettura-valore/);
  assert.match(sezione, /\(view\.letture \|\| \[\]\)/);
  /* Le linguette: con una mappa sola non compaiono, che sarebbe una scelta
   * fra una cosa. */
  assert.match(sezione, /if \(mappe\.length < 2\) return "";/);
  assert.match(sezione, /data-dm-robot-mappa=/);
  /* Il riquadro prende le proporzioni del disegno: «non me la mette intera». */
  assert.match(sezione, /function adattaIlRiquadro\(host, image\)/);
  assert.match(sezione, /host\.style\.setProperty\("aspect-ratio"/);
});

test("l'editor chiede le mappe e le letture con la stessa riga dei comandi", async () => {
  const editor = await readFile(
    new URL("../src/sections/robot-editor-section.js", import.meta.url),
    "utf8",
  );
  for (const tipo of ["mappe", "comandi", "letture"])
    assert.match(editor, new RegExp(`listaMarkup\\("${tipo}", robot, index\\)`));
  /* Una riga sola, scritta una volta: le tre liste passano dallo stesso
   * sportello, o il tetto tornerebbe muto in due posti nuovi (#403). */
  assert.equal(editor.match(/function listaMarkup\(/g).length, 1);
  /* E la casella di testo della mappa singola non c'è più: sarebbe la stessa
   * cosa chiesta due volte, in due posti che possono discordare. */
  assert.doesNotMatch(editor, /data-robot-field="mapEntity"/);
});
