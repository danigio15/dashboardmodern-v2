/* Gli animali di casa (#358).
 *
 * «Sarebbe utile ed interessante avere una nuova sezione per chi ha animali
 * domestici, magari in grado di collegarsi a varie integrazioni come ad
 * esempio PetKit, in modo da tenere sotto controllo cio' che li riguarda:
 * lettiera, livello del distributore di cibo e cosi' via.»
 *
 * Le due domande a cui il modello deve rispondere sono queste: dato un
 * dispositivo di Home Assistant, quale sua entita' e' il livello del cibo e
 * quale l'ultima pulizia della lettiera; e, dati gli stati, c'e' qualcosa da
 * dire adesso. Si provano a secco, perche' il modello non tocca il documento e
 * non guarda l'orologio da se': l'istante glielo si passa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CAMPI,
  CHIAVE_ANIMALI,
  MASSIMO_ANIMALI,
  SOGLIE_DI_SERIE,
  animaliDisegnabili,
  collegaAnimaleAlDispositivo,
  dentroOFuori,
  minutiDa,
  normalizzaAnimali,
  pressioneDellAzione,
  proponiCaselle,
  specieDalNome,
  vistaAnimale,
} from "../src/core/animali-model.js";

const ent = (entity_id, name, extra = {}) => ({
  entity_id,
  name,
  device_class: "",
  category: "",
  disabled: false,
  ...extra,
});

/* Un distributore PetKit come lo pubblica l'integrazione: il livello del cibo,
 * l'ultima erogazione, le porzioni del giorno, e in mezzo le impostazioni del
 * dispositivo, che con l'animale non c'entrano. */
const PETKIT = [
  ent("sensor.petkit_fresh_element_food_level", "Food level", {
    unit: "%",
  }),
  ent("sensor.petkit_fresh_element_last_feed", "Last feed"),
  ent("sensor.petkit_fresh_element_portions_today", "Portions dispensed today"),
  ent("number.petkit_fresh_element_volume", "Volume", { category: "config" }),
  ent("sensor.petkit_fresh_element_rssi", "Signal strength", { category: "diagnostic" }),
];

test("dal distributore PetKit escono la ciotola e le sue tre caselle", () => {
  const proposta = proponiCaselle(PETKIT, {});
  assert.equal(proposta.cibo_livello, "sensor.petkit_fresh_element_food_level");
  assert.equal(proposta.cibo_ultima, "sensor.petkit_fresh_element_last_feed");
  assert.equal(proposta.cibo_porzioni, "sensor.petkit_fresh_element_portions_today");
});

test("le impostazioni del dispositivo non diventano cose dell'animale", () => {
  const proposta = proponiCaselle(PETKIT, {});
  const prese = Object.values(proposta);
  assert.ok(!prese.includes("number.petkit_fresh_element_volume"), "il volume non e' dell'animale");
  assert.ok(!prese.includes("sensor.petkit_fresh_element_rssi"), "il wifi non e' dell'animale");
});

test("un'entita' serve una casella sola", () => {
  const proposta = proponiCaselle(PETKIT, {});
  const prese = Object.values(proposta);
  assert.equal(prese.length, new Set(prese).size, "la stessa entita' riempie due caselle");
});

test("la lettiera, la fontanella, la porta e il collare si riconoscono", () => {
  const proposta = proponiCaselle(
    [
      ent("sensor.litter_robot_waste_drawer_level", "Waste drawer level", { unit: "%" }),
      ent("sensor.litter_robot_last_seen_clean", "Last clean cycle"),
      ent("sensor.litter_robot_uses_today", "Uses today"),
      ent("sensor.fontanella_livello_acqua", "Livello acqua", { unit: "%" }),
      ent("sensor.fontanella_filtro", "Filtro", { unit: "%" }),
      ent("binary_sensor.sureflap_micio_inside", "Micio inside"),
      ent("sensor.tractive_micio_battery", "Battery", { device_class: "battery" }),
      ent("device_tracker.tractive_micio", "Micio"),
      ent("sensor.micio_weight", "Weight", { device_class: "weight" }),
    ],
    {},
  );
  assert.equal(proposta.lettiera_riempimento, "sensor.litter_robot_waste_drawer_level");
  assert.equal(proposta.lettiera_ultima, "sensor.litter_robot_last_seen_clean");
  assert.equal(proposta.lettiera_visite, "sensor.litter_robot_uses_today");
  assert.equal(proposta.acqua_livello, "sensor.fontanella_livello_acqua");
  assert.equal(proposta.acqua_filtro, "sensor.fontanella_filtro");
  assert.equal(proposta.porta, "binary_sensor.sureflap_micio_inside");
  assert.equal(proposta.collare_batteria, "sensor.tractive_micio_battery");
  assert.equal(proposta.collare_posizione, "device_tracker.tractive_micio");
  assert.equal(proposta.peso, "sensor.micio_weight");
});

test("un dispositivo che di animali non parla non riempie niente", () => {
  const proposta = proponiCaselle(
    [ent("climate.termostato_salone", "Termostato"), ent("sensor.termostato_temperatura", "Temp")],
    {},
  );
  assert.deepEqual(Object.keys(proposta), []);
});

/* ── il legame col dispositivo ──────────────────────────────────────────── */

test("collegare un dispositivo riempie le caselle e non ne scrive il nome sopra il proprio", () => {
  const { animale, riempite } = collegaAnimaleAlDispositivo({
    device: { id: "pk-1", name: "Fresh Element", integration: "petkit" },
    entities: PETKIT,
    precedente: { nome: "Micio", cibo_livello: "sensor.mia_ciotola" },
  });
  assert.equal(animale.nome, "Micio", "il nome scritto a mano e' stato sostituito");
  assert.equal(animale.cibo_livello, "sensor.mia_ciotola", "la casella piena e' stata riscritta");
  assert.equal(animale.cibo_ultima, "sensor.petkit_fresh_element_last_feed");
  assert.ok(!riempite.includes("cibo_livello"), "una casella gia' piena non conta come riempita");
});

test("un secondo dispositivo si somma al primo invece di sostituirlo", () => {
  const primo = collegaAnimaleAlDispositivo({
    device: { id: "pk-1", name: "Fresh Element", integration: "petkit" },
    entities: PETKIT,
  }).animale;
  const secondo = collegaAnimaleAlDispositivo({
    device: { id: "lr-1", name: "Litter-Robot 4", integration: "litterrobot" },
    entities: [
      ent("sensor.litter_robot_waste_drawer_level", "Waste drawer level"),
      ent("sensor.litter_robot_last_clean", "Last clean"),
    ],
    precedente: primo,
  }).animale;
  assert.equal(secondo.cibo_livello, "sensor.petkit_fresh_element_food_level", "la ciotola e' andata persa");
  assert.equal(secondo.lettiera_riempimento, "sensor.litter_robot_waste_drawer_level");
  assert.deepEqual(
    secondo.dispositivi.map((voce) => voce.id),
    ["pk-1", "lr-1"],
  );
});

test("lo stesso dispositivo collegato due volte resta uno", () => {
  const uno = collegaAnimaleAlDispositivo({
    device: { id: "pk-1", name: "Fresh Element", integration: "petkit" },
    entities: PETKIT,
  }).animale;
  const due = collegaAnimaleAlDispositivo({
    device: { id: "pk-1", name: "Fresh Element", integration: "petkit" },
    entities: PETKIT,
    precedente: uno,
  }).animale;
  assert.equal(due.dispositivi.length, 1);
});

test("la specie si legge da come si chiama il dispositivo", () => {
  assert.equal(specieDalNome("PetKit Fresh Element cat feeder"), "gatto");
  assert.equal(specieDalNome("Tractive DOG 4"), "cane");
  assert.equal(specieDalNome("Fontanella"), "altro");
});

/* ── la configurazione ─────────────────────────────────────────────────── */

test("la chiave e' quella che l'editor scrive", () => {
  assert.equal(CHIAVE_ANIMALI, "cd_animali");
});

test("due animali non tengono lo stesso identificativo", () => {
  const elenco = normalizzaAnimali([
    { id: "animale-1", nome: "Micio" },
    { id: "animale-1", nome: "Fido" },
  ]);
  assert.equal(elenco.length, 2);
  assert.notEqual(elenco[0].id, elenco[1].id);
});

test("l'elenco non cresce oltre il tetto", () => {
  const troppi = Array.from({ length: MASSIMO_ANIMALI + 5 }, (_voce, indice) => ({
    nome: `Bestia ${indice}`,
  }));
  assert.equal(normalizzaAnimali(troppi).length, MASSIMO_ANIMALI);
});

test("un animale appena aggiunto non si butta via, uno vuoto non si disegna", () => {
  const elenco = normalizzaAnimali([{ nome: "" }, { nome: "Micio" }]);
  assert.equal(elenco.length, 2, "premere «Aggiungi» deve fare qualcosa");
  assert.deepEqual(
    animaliDisegnabili(elenco).map((voce) => voce.nome),
    ["Micio"],
  );
});

test("le soglie vuote valgono quelle di serie, quelle scritte valgono le scritte", () => {
  const [animale] = normalizzaAnimali([{ nome: "Micio", soglie: { cibo: "35", filtro: "" } }]);
  assert.equal(animale.soglie.cibo, 35);
  assert.equal(animale.soglie.filtro, SOGLIE_DI_SERIE.filtro);
  assert.equal(animale.soglie.lettiera_ore, SOGLIE_DI_SERIE.lettiera_ore);
});

/* ── quello che la scheda dice a colpo d'occhio ────────────────────────── */

const ORA = Date.parse("2026-03-01T12:00:00Z");
const stato = (state, attributes = {}) => ({ state, attributes });

test("il cibo sotto soglia si dice, e mezzo sotto si dice piu' forte", () => {
  const letture = {
    "sensor.cibo": stato("18", { unit_of_measurement: "%" }),
    "sensor.cibo_agli_sgoccioli": stato("4", { unit_of_measurement: "%" }),
  };
  const poco = vistaAnimale({ nome: "Micio", cibo_livello: "sensor.cibo" }, letture, ORA);
  assert.deepEqual(poco.avvisi, [{ chiave: "cibo_scarso", gravita: "attenzione" }]);
  const pochissimo = vistaAnimale(
    { nome: "Micio", cibo_livello: "sensor.cibo_agli_sgoccioli" },
    letture,
    ORA,
  );
  assert.equal(pochissimo.avvisi[0].gravita, "urgente");
  assert.equal(pochissimo.gravita, "urgente");
});

test("un distributore che dice «Low» invece di un numero vale lo stesso", () => {
  const vista = vistaAnimale(
    { nome: "Micio", cibo_livello: "sensor.cibo" },
    { "sensor.cibo": stato("Low") },
    ORA,
  );
  assert.deepEqual(
    vista.avvisi.map((voce) => voce.chiave),
    ["cibo_scarso"],
  );
});

test("un distributore pieno non allarma, e uno muto nemmeno", () => {
  const pieno = vistaAnimale(
    { nome: "Micio", cibo_livello: "sensor.cibo" },
    { "sensor.cibo": stato("Full") },
    ORA,
  );
  assert.deepEqual(pieno.avvisi, []);
  const muto = vistaAnimale(
    { nome: "Micio", cibo_livello: "sensor.cibo" },
    { "sensor.cibo": stato("unavailable") },
    ORA,
  );
  assert.deepEqual(muto.avvisi, [], "chi non sa non allarma");
  assert.equal(muto.gravita, "quiete");
});

test("il filtro a fine corsa si dice", () => {
  const vista = vistaAnimale(
    { nome: "Micio", acqua_filtro: "sensor.filtro" },
    { "sensor.filtro": stato("6", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.deepEqual(
    vista.avvisi.map((voce) => voce.chiave),
    ["filtro_finito"],
  );
});

test("il cassetto dei rifiuti e' l'unica quota che allarma da sopra", () => {
  /* Pieno e' il guaio, vuoto e' come dev'essere: e' l'unico numero della
   * scheda che vuol dire il contrario di tutti gli altri. */
  const piena = vistaAnimale(
    { nome: "Micio", lettiera_riempimento: "sensor.waste_drawer" },
    { "sensor.waste_drawer": stato("88", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.deepEqual(
    piena.avvisi.map((voce) => voce.chiave),
    ["lettiera_piena"],
  );
  /* Un cassetto pesato in chili non ha un ottanta per cento: leggerlo come
   * quota vorrebbe dire allarmare per un valore che non e' una percentuale. */
  const pesata = vistaAnimale(
    { nome: "Micio", lettiera_riempimento: "sensor.waste_drawer" },
    { "sensor.waste_drawer": stato("88", { unit_of_measurement: "kg" }) },
    ORA,
  );
  assert.deepEqual(pesata.avvisi, []);
});

test("la sabbia invece resta, e allarma quando sta per finire", () => {
  /* «L'avviso della lettiera deve essere quando questa scende sotto una
   * percentuale, attualmente e' sopra: petkit espone un sensor con una
   * percentuale, se questa scende sotto un valore stabilito dall'utente allora
   * puo' mandare l'avviso che la lettiera sta per finire» (#373). */
  const tanta = vistaAnimale(
    { nome: "Micio", lettiera_sabbia: "sensor.litter_level" },
    { "sensor.litter_level": stato("88", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.deepEqual(tanta.avvisi, [], "piena di sabbia non e' un guaio");
  const poca = vistaAnimale(
    { nome: "Micio", lettiera_sabbia: "sensor.litter_level" },
    { "sensor.litter_level": stato("12", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.deepEqual(
    poca.avvisi.map((voce) => voce.chiave),
    ["sabbia_scarsa"],
  );
  // Sotto meta' soglia si alza la voce, come per il cibo e per l'acqua.
  const finita = vistaAnimale(
    { nome: "Micio", lettiera_sabbia: "sensor.litter_level" },
    { "sensor.litter_level": stato("4", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.equal(finita.avvisi[0].gravita, "urgente");
});

test("chi aveva la sabbia nella casella del cassetto se la ritrova al posto suo", () => {
  /* Fino a ieri erano una casella sola, e su un Petkit ci finiva la sabbia
   * rimasta: la soglia allarmava «piena» quando invece stava per finire. Il
   * verso lo dice l'entita' stessa. */
  const spostata = vistaAnimale(
    { nome: "Micio", lettiera_riempimento: "sensor.petkit_litter_level" },
    { "sensor.petkit_litter_level": stato("12", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.deepEqual(
    spostata.avvisi.map((voce) => voce.chiave),
    ["sabbia_scarsa"],
  );
  assert.equal(spostata.letture.lettiera_sabbia?.entita, "sensor.petkit_litter_level");
  assert.equal(spostata.letture.lettiera_riempimento, undefined);
  /* Un cassetto dei rifiuti non si sposta: il suo nome lo dice, e li' l'avviso
   * da sopra e' quello giusto. */
  const restata = vistaAnimale(
    { nome: "Micio", lettiera_riempimento: "sensor.waste_drawer_level" },
    { "sensor.waste_drawer_level": stato("88", { unit_of_measurement: "%" }) },
    ORA,
  );
  assert.deepEqual(
    restata.avvisi.map((voce) => voce.chiave),
    ["lettiera_piena"],
  );
});

test("la lettiera non pulita da un giorno si dice, da due si dice piu' forte", () => {
  const dopo = (ore) =>
    vistaAnimale(
      { nome: "Micio", lettiera_ultima: "sensor.pulizia" },
      { "sensor.pulizia": stato(new Date(ORA - ore * 3600000).toISOString()) },
      ORA,
    ).avvisi;
  assert.deepEqual(dopo(3), []);
  assert.deepEqual(dopo(26), [{ chiave: "lettiera_da_pulire", gravita: "attenzione" }]);
  assert.equal(dopo(50)[0].gravita, "urgente");
});

test("dentro o fuori lo dice la porta col microchip, e se tace lo dice il collare", () => {
  const conPorta = vistaAnimale(
    { nome: "Micio", porta: "binary_sensor.micio", collare_posizione: "device_tracker.micio" },
    {
      "binary_sensor.micio": stato("off"),
      "device_tracker.micio": stato("home"),
    },
    ORA,
  );
  assert.equal(conPorta.dentro, false, "la porta vale piu' del collare");
  const soloCollare = vistaAnimale(
    { nome: "Micio", collare_posizione: "device_tracker.micio" },
    { "device_tracker.micio": stato("not_home") },
    ORA,
  );
  assert.equal(soloCollare.dentro, false);
  const nessuno = vistaAnimale({ nome: "Micio" }, {}, ORA);
  assert.equal(nessuno.dentro, null);
});

test("le parole con cui si dice dentro e fuori", () => {
  for (const parola of ["on", "home", "inside", "true"])
    assert.equal(dentroOFuori(stato(parola)), true, parola);
  for (const parola of ["off", "not_home", "outside", "false"])
    assert.equal(dentroOFuori(stato(parola)), false, parola);
  assert.equal(dentroOFuori(stato("unknown")), null);
});

test("«da quanto» si legge in tre dialetti", () => {
  assert.equal(minutiDa(stato("2026-03-01T10:00:00Z"), ORA), 120, "data ISO");
  assert.equal(minutiDa(stato(String(ORA / 1000 - 3600)), ORA), 60, "secondi dall'epoca");
  assert.equal(minutiDa(stato("45"), ORA), 45, "minuti gia' contati");
  assert.equal(minutiDa(stato("unknown"), ORA), null);
});

/* ── il modulo resta a secco ───────────────────────────────────────────── */

test("il modello non tocca il documento, la memoria del browser ne' l'orologio", () => {
  const testo = readFileSync(new URL("../src/core/animali-model.js", import.meta.url), "utf8");
  for (const proibito of ["document", "localStorage", "window", "Date.now(", "new Date("])
    assert.ok(!testo.includes(proibito), `il nucleo degli animali usa ${proibito}`);
});

test("ogni casella ha una famiglia e almeno un dominio dove cercarla", () => {
  for (const campo of CAMPI) {
    assert.ok(campo.chiave, "una casella senza nome");
    assert.ok(campo.gruppo, `${campo.chiave} non sta in nessuna famiglia`);
    assert.ok(campo.domini.length, `${campo.chiave} non dice dove cercare`);
    assert.ok(campo.deve instanceof RegExp, `${campo.chiave} non dice come riconoscersi`);
  }
});

/* ── quello che Petkit espone, e che serve avere sotto le dita (#373) ────── */

test("le entità di un Petkit finiscono ognuna al posto suo", () => {
  /* Tutte le entità nominate nella segnalazione, in una volta sola: se una
   * finisce nella casella sbagliata la scheda dice il falso o offre un tasto
   * che fa un'altra cosa. */
  const proposta = proponiCaselle(
    [
      { entity_id: "sensor.petkit_litter_level", name: "Litter level" },
      { entity_id: "sensor.petkit_waste_drawer_level", name: "Waste drawer level" },
      { entity_id: "sensor.petkit_deodorant_days", name: "Deodorant days left" },
      { entity_id: "sensor.petkit_desiccant_days", name: "Desiccant days left" },
      { entity_id: "binary_sensor.petkit_waste_bin", name: "Waste bin" },
      { entity_id: "button.petkit_manual_feed", name: "Manual feed" },
      { entity_id: "button.petkit_reset_desiccant", name: "Reset desiccant", category: "config" },
      { entity_id: "button.petkit_start_cleaning", name: "Start cleaning" },
      { entity_id: "button.petkit_start_leveling", name: "Start leveling" },
      { entity_id: "button.petkit_start_maintenance", name: "Start maintenance" },
      { entity_id: "button.petkit_exit_maintenance", name: "Exit maintenance" },
      { entity_id: "button.petkit_reset_deodorant", name: "Reset deodorant", category: "config" },
    ],
    {},
  );
  assert.equal(proposta.lettiera_sabbia, "sensor.petkit_litter_level");
  assert.equal(proposta.lettiera_riempimento, "sensor.petkit_waste_drawer_level");
  assert.equal(proposta.lettiera_deodorante, "sensor.petkit_deodorant_days");
  assert.equal(proposta.cibo_essiccante, "sensor.petkit_desiccant_days");
  assert.equal(proposta.lettiera_cestino, "binary_sensor.petkit_waste_bin");
  assert.equal(proposta.cibo_eroga, "button.petkit_manual_feed");
  assert.equal(proposta.cibo_essiccante_reset, "button.petkit_reset_desiccant");
  assert.equal(proposta.lettiera_pulisci, "button.petkit_start_cleaning");
  assert.equal(proposta.lettiera_livella, "button.petkit_start_leveling");
  assert.equal(proposta.lettiera_manutenzione_avvia, "button.petkit_start_maintenance");
  assert.equal(proposta.lettiera_manutenzione_esci, "button.petkit_exit_maintenance");
  assert.equal(proposta.lettiera_deodorante_reset, "button.petkit_reset_deodorant");
});

test("un tasto che non risponde non si offre", () => {
  /* Un tasto che si preme e non fa niente è peggio di un tasto che non c'è. */
  const acceso = vistaAnimale(
    { nome: "Micio", lettiera_pulisci: "button.pulisci" },
    { "button.pulisci": stato("2026-09-07T10:00:00+00:00") },
    ORA,
  );
  assert.deepEqual(
    acceso.azioni.map((voce) => voce.chiave),
    ["lettiera_pulisci"],
  );
  assert.equal(acceso.azioni[0].gruppo, "lettiera");
  const muto = vistaAnimale(
    { nome: "Micio", lettiera_pulisci: "button.pulisci" },
    { "button.pulisci": stato("unavailable") },
    ORA,
  );
  assert.deepEqual(muto.azioni, []);
  const assente = vistaAnimale({ nome: "Micio", lettiera_pulisci: "button.pulisci" }, {}, ORA);
  assert.deepEqual(assente.azioni, []);
});

test("la pressione si descrive, e ogni dominio ha il suo servizio", () => {
  assert.deepEqual(pressioneDellAzione("button.pulisci"), {
    dominio: "button",
    servizio: "press",
    dati: { entity_id: "button.pulisci" },
  });
  assert.equal(pressioneDellAzione("script.pulisci").servizio, "turn_on");
  assert.equal(pressioneDellAzione("switch.pulisci").servizio, "turn_on");
  assert.equal(pressioneDellAzione("input_button.pulisci").servizio, "press");
  // Un sensore non si preme: dirlo è meglio che chiamare un servizio inventato.
  assert.equal(pressioneDellAzione("sensor.pulisci"), null);
  assert.equal(pressioneDellAzione("non-un-id"), null);
});

test("i consumabili contati in giorni avvisano prima di finire", () => {
  /* «Petkit espone un sensore che dice quanti giorni restano e un button per
   * resettare il valore una volta sostituito.» */
  const conGiorni = (quanti) =>
    vistaAnimale(
      { nome: "Micio", cibo_essiccante: "sensor.essiccante", lettiera_deodorante: "sensor.deodorante" },
      {
        "sensor.essiccante": stato(String(quanti), { unit_of_measurement: "d" }),
        "sensor.deodorante": stato(String(quanti), { unit_of_measurement: "d" }),
      },
      ORA,
    ).avvisi;
  assert.deepEqual(conGiorni(30), [], "un mese davanti non è una notizia");
  assert.deepEqual(
    conGiorni(5).map((voce) => voce.chiave),
    ["essiccante_finito", "deodorante_finito"],
  );
  assert.equal(conGiorni(0)[0].gravita, "urgente", "a zero si sostituisce, non si ordina");
});

test("il cestino della lettiera dice se vuole attenzione", () => {
  /* Un binary_sensor di guasto dice `on` quando il problema c'è: è la
   * convenzione di Home Assistant, e la scheda la segue. */
  const guasto = vistaAnimale(
    { nome: "Micio", lettiera_cestino: "binary_sensor.cestino" },
    { "binary_sensor.cestino": stato("on") },
    ORA,
  );
  assert.deepEqual(
    guasto.avvisi.map((voce) => voce.chiave),
    ["cestino_pieno"],
  );
  assert.equal(guasto.letture.lettiera_cestino.acceso, true);
  const aPosto = vistaAnimale(
    { nome: "Micio", lettiera_cestino: "binary_sensor.cestino" },
    { "binary_sensor.cestino": stato("off") },
    ORA,
  );
  assert.deepEqual(aPosto.avvisi, []);
  assert.equal(aPosto.letture.lettiera_cestino.acceso, false);
});
