/* «Ho modificato a mano l'entità e salvato. Purtroppo a schermo compaiono
 *  ancora i km residui dell'AdBlue ma se clicco sopra prende il grafico
 *  corretto dei km residui del carburante» (#444).
 *
 * Le caselle di una vettura vivono in due posti, e per disegno: nel profilo,
 * che è il loro padrone, e nella mappa di casa, che è quella che il guscio
 * legge con `resolveEntity`. Correggere una casella a mano scriveva solo la
 * seconda, e i due posti si contraddicevano sullo stesso schermo: la card
 * diceva AdBlue, il grafico che si apre toccandola diceva gasolio.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { conLeCaselleScritte, laVetturaDelleCaselle } from "../src/core/vehicle-model.js";
import { eDellaWallbox, eTargetDiCasa } from "../src/core/wallbox-device-binding.js";
import { letturaTermica } from "../src/core/auto-termica.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const diCasa = (ref, valore) => eDellaWallbox(ref) || eTargetDiCasa(ref, valore);

const KODIAQ = Object.freeze([
  Object.freeze({
    uid: "auto1",
    name: "Kodiaq",
    tipo: "termica",
    ov: Object.freeze({
      "dm.ev_autonomia": "sensor.kodiaq_adblue_range",
      "dm.ev_carburante": "sensor.kodiaq_fuel_level",
    }),
  }),
]);

test("la casella corretta entra nel profilo dell'auto", () => {
  const { cars: dopo, cambiato } = conLeCaselleScritte(
    KODIAQ,
    "auto1",
    { "dm.ev_autonomia": "sensor.kodiaq_range" },
    diCasa,
  );
  assert.equal(cambiato, true);
  assert.equal(dopo[0].ov["dm.ev_autonomia"], "sensor.kodiaq_range");
  /* Le altre caselle non si toccano: si stava correggendo una. */
  assert.equal(dopo[0].ov["dm.ev_carburante"], "sensor.kodiaq_fuel_level");
  /* E l'auto resta la stessa auto: nome, motore e identità non si riscrivono. */
  assert.equal(dopo[0].uid, "auto1");
  assert.equal(dopo[0].name, "Kodiaq");
  assert.equal(dopo[0].tipo, "termica");
});

test("una casella che non c'è non vuol dire «cancellala»", () => {
  /* Il gesto parlava dell'autonomia. Il carburante non era nel mucchio, e
   * sparire dal profilo sarebbe stato il difetto opposto di questo. */
  const { cars: dopo } = conLeCaselleScritte(KODIAQ, "auto1", { "dm.ev_autonomia": "sensor.x" }, diCasa);
  assert.equal(dopo[0].ov["dm.ev_carburante"], "sensor.kodiaq_fuel_level");
  /* Nemmeno un valore vuoto cancella: da una mappa di casa un campo svuotato
   * arriva come chiave assente, e distinguere «mai mappata» da «appena
   * svuotata» da una fotografia non si può. */
  assert.equal(
    conLeCaselleScritte(KODIAQ, "auto1", { "dm.ev_autonomia": "  " }, diCasa).cambiato,
    false,
  );
});

test("la colonnina e il limite comandabile restano della casa", () => {
  const { cars: dopo } = conLeCaselleScritte(
    KODIAQ,
    "auto1",
    {
      "dm.ev_potenza_wallbox": "sensor.evcc_power",
      "dm.ev_target_soc": "number.evcc_limit_soc",
      "dm.ev_autonomia": "sensor.kodiaq_range",
    },
    diCasa,
  );
  assert.equal(dopo[0].ov["dm.ev_potenza_wallbox"], undefined);
  assert.equal(dopo[0].ov["dm.ev_target_soc"], undefined);
  /* Un target che è una LETTURA è dell'auto, e quello entra. */
  const { cars: lettura } = conLeCaselleScritte(
    KODIAQ,
    "auto1",
    { "dm.ev_target_soc": "sensor.kodiaq_target" },
    diCasa,
  );
  assert.equal(lettura[0].ov["dm.ev_target_soc"], "sensor.kodiaq_target");
});

test("quello che non è di un'auto non entra in un'auto", () => {
  assert.equal(
    conLeCaselleScritte(
      KODIAQ,
      "auto1",
      { "light.salone": "light.lampadario", "switch.caldaia": "switch.x" },
      diCasa,
    ).cambiato,
    false,
  );
});

test("senza un'auto da correggere non si corregge niente", () => {
  assert.equal(
    conLeCaselleScritte(KODIAQ, "", { "dm.ev_autonomia": "sensor.x" }, diCasa).cambiato,
    false,
  );
  assert.equal(
    conLeCaselleScritte(KODIAQ, "auto-che-non-ce", { "dm.ev_autonomia": "sensor.x" }, diCasa)
      .cambiato,
    false,
  );
  assert.deepEqual(conLeCaselleScritte([], "auto1", { "dm.ev_autonomia": "sensor.x" }), {
    cars: [],
    cambiato: false,
  });
});

test("con due auto si corregge quella indicata e non l'altra", () => {
  const due = [
    { uid: "auto1", name: "Kodiaq", ov: { "dm.ev_autonomia": "sensor.kodiaq_adblue_range" } },
    { uid: "auto2", name: "Zoe", ov: { "dm.ev_autonomia": "sensor.zoe_range" } },
  ];
  const { cars: dopo } = conLeCaselleScritte(
    due,
    "auto1",
    { "dm.ev_autonomia": "sensor.kodiaq_range" },
    diCasa,
  );
  assert.equal(dopo[0].ov["dm.ev_autonomia"], "sensor.kodiaq_range");
  assert.equal(dopo[1].ov["dm.ev_autonomia"], "sensor.zoe_range");
});

test("dopo la correzione la card e il grafico dicono la stessa entità", () => {
  const states = {
    "sensor.kodiaq_adblue_range": { state: "4200", attributes: { unit_of_measurement: "km" } },
    "sensor.kodiaq_range": { state: "610", attributes: { unit_of_measurement: "km" } },
  };
  /* La mappa di casa è quella che il guscio legge: `resolveEntity` la usa, e
   * il grafico passa da lì. */
  const casa = { "dm.ev_autonomia": "sensor.kodiaq_range" };
  const resolve = (ref) => casa[ref] || ref;

  /* Prima: il profilo porta ancora l'AdBlue e vince sulla mappa di casa. */
  const prima = letturaTermica(KODIAQ[0].ov, states, resolve);
  assert.equal(prima.autonomia, 4200);

  /* Dopo: il profilo ha la correzione, e i due posti dicono 610. */
  const { cars: dopo } = conLeCaselleScritte(KODIAQ, "auto1", casa, diCasa);
  const quadro = letturaTermica(dopo[0].ov, states, resolve);
  assert.equal(quadro.autonomia, 610);
  assert.equal(resolve("dm.ev_autonomia"), "sensor.kodiaq_range");
});

test("la correzione arriva a destinazione dal salvataggio, non dal singolo campo", async () => {
  const sezione = await leggi("../src/sections/ev-section.js");
  /* Il bottone verde prende le caselle tutte: «salva la sezione» vuol dire
   * quello, ed è il momento in cui si SA di chi sono. */
  assert.match(sezione, /prendiLeCaselle\(root\.cdEvCaptureProfile\?\.\(\)\?\.ov \|\| \{\}\)/);
  /* E NON dal `change` del singolo campo, che è la porta da cui ci ho provato
   * la prima volta: mentre una casella cambia non si sa di quale auto sia.
   * Comporre un'auto nuova usa gli stessi campi — prima le entità, poi il
   * nome — e la prima auto si prendeva la batteria della seconda prima che la
   * seconda esistesse. Se quel gancio torna, torna anche quel difetto. */
  assert.doesNotMatch(sezione, /edSetSlot/);

  const regola = sezione.slice(
    sezione.indexOf("function prendiLeCaselle(scritte)"),
    sezione.indexOf("/* «SALVA SEZIONE» salva anche le foto."),
  );
  assert.ok(regola, "prendiLeCaselle non si trova più dove questa prova lo cerca");
  /* Di chi sono le caselle non lo decide più la sezione: è logica pura, sta nel
   * modello e si prova coi numeri qui sotto. Alla sezione resta il gesto —
   * l'elenco, la matita, il nome scritto, l'auto in uso — e la scrittura. */
  assert.match(regola, /laVetturaDelleCaselle\(\{/);
  assert.match(regola, /getElementById\("ed-evcar-name"\)/);
  assert.match(regola, /inUso: activeVehicle\(elenco\)/);
  /* E si scrive dall'unico posto da cui si scrivono le auto. */
  assert.match(regola, /salvaAuto\(cars\)/);
  /* Un rifiuto non è più muto: era il motivo per cui un salvataggio che non
   * arrivava nel profilo si vedeva solo da fuori, come lo schermo che dice
   * AdBlue e il grafico che dice gasolio. */
  assert.match(regola, /spiegaIlRifiuto\(/);
});

/* ── di chi sono le caselle: la regola, coi numeri (#444) ─────────────────── */

const ZOE = { uid: "zoe", name: "Zoe", ov: {} };
const TESLA = { uid: "tesla", name: "Tesla", ov: {} };

test("la matita apre una vettura, e le caselle sono di quella", () => {
  const { auto, motivo } = laVetturaDelleCaselle({
    elenco: [ZOE, TESLA],
    chiave: "tesla",
    inUso: ZOE,
  });
  assert.equal(auto, TESLA, "comanda la matita, non l'auto in uso");
  assert.equal(motivo, "");
});

test("«＋ Nuova auto» non versa le caselle in nessuno", () => {
  const { auto, motivo } = laVetturaDelleCaselle({ elenco: [ZOE], chiave: "", inUso: ZOE });
  assert.equal(auto, null);
  assert.equal(motivo, "auto-che-nasce");
});

/* È il caso che ha fatto nascere questa funzione: se non si sa più di chi sono,
 * la correzione NON si butta. Chi ha premuto «Salva sezione» ha fatto un gesto
 * esplicito, e l'unica domanda aperta è su quale auto: quella che ha davanti. */
test("una chiave che nomina un'auto sparita non fa perdere la correzione", () => {
  const { auto, motivo } = laVetturaDelleCaselle({
    elenco: [ZOE, TESLA],
    chiave: "auto-cancellata",
    inUso: TESLA,
  });
  assert.equal(auto, TESLA, "si ripiega sull'auto in uso invece di rifiutare in silenzio");
  assert.equal(motivo, "chiave-sparita", "e lo dice, invece di tacere");
});

test("un nome già in elenco sceglie l'auto che lo porta", () => {
  const { auto } = laVetturaDelleCaselle({
    elenco: [ZOE, TESLA],
    nomeScritto: "  Tesla  ",
    inUso: ZOE,
  });
  assert.equal(auto, TESLA);
});

/* Il difetto che questa regola esiste per non rifare: si mappa la Zoe, si
 * salva, si rimappa per la Tesla che ancora non c'è, e la Zoe si prendeva la
 * batteria della Tesla. */
test("un nome nuovo è una vettura che nasce, e le sue caselle aspettano", () => {
  const { auto, motivo } = laVetturaDelleCaselle({
    elenco: [ZOE],
    nomeScritto: "Tesla",
    inUso: ZOE,
  });
  assert.equal(auto, null, "la Zoe non si prende le caselle di una vettura che non esiste");
  assert.equal(motivo, "nome-nuovo");
});

test("senza chiave e senza nome comanda l'auto in uso", () => {
  const { auto, motivo } = laVetturaDelleCaselle({ elenco: [ZOE, TESLA], inUso: TESLA });
  assert.equal(auto, TESLA);
  assert.equal(motivo, "");
});

test("un garage vuoto non ha caselle di nessuno, e lo dice", () => {
  const { auto, motivo } = laVetturaDelleCaselle({ elenco: [], chiave: "zoe" });
  assert.equal(auto, null);
  assert.equal(motivo, "nessuna-auto");
});
