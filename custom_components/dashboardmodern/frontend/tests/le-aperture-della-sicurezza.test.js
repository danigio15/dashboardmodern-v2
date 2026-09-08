/* Le aperture della sezione Sicurezza (#195).
 *
 * Il portone del condominio e la porta di casa hanno una card fra la centrale
 * e le telecamere; il tocco chiede conferma e, con un PIN configurato, il
 * codice — un cancello locale contro le aperture accidentali, con le parole
 * della richiesta stessa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  LOCK_SUPPORT_OPEN,
  gestoDellaPorta,
  azioniDellaPorta,
  doorOpenCall,
  doorPinMatches,
  isDoorEntity,
  normalizeDoorPin,
  normalizeSecurityDoors,
} from "../src/core/security-door-model.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("solo i domini che sanno aprire diventano una porta", () => {
  for (const entity of [
    "lock.portone",
    "button.citofono",
    "input_button.apri",
    "switch.rele_cancello",
    "cover.cancello",
    "script.apri_portone",
    "scene.ingresso",
    "input_boolean.porta",
  ])
    assert.equal(isDoorEntity(entity), true, entity);
  for (const entity of ["binary_sensor.porta", "sensor.porta", "light.ingresso", "portone", ""])
    assert.equal(isDoorEntity(entity), false, entity);
});

test("ogni dominio apre col suo servizio, e la serratura distingue open da unlock", () => {
  assert.deepEqual(doorOpenCall("button.citofono"), { domain: "button", service: "press", data: {} });
  assert.deepEqual(doorOpenCall("switch.rele"), { domain: "switch", service: "turn_on", data: {} });
  assert.deepEqual(doorOpenCall("cover.cancello"), { domain: "cover", service: "open_cover", data: {} });
  assert.deepEqual(doorOpenCall("script.apri"), { domain: "script", service: "turn_on", data: {} });
  // La serratura che dichiara di sapersi APRIRE apre; le altre sbloccano.
  assert.deepEqual(
    doorOpenCall("lock.portone", { attributes: { supported_features: LOCK_SUPPORT_OPEN } }),
    { domain: "lock", service: "open", data: {} },
  );
  assert.deepEqual(doorOpenCall("lock.porta", { attributes: {} }), {
    domain: "lock",
    service: "unlock",
    data: {},
  });
  // Un dominio sconosciuto non inventa un comando.
  assert.equal(doorOpenCall("sensor.porta"), null);
});

test("il PIN e' 4-8 cifre, e una porta senza PIN si apre col solo tocco confermato", () => {
  assert.equal(normalizeDoorPin("1234"), "1234");
  assert.equal(normalizeDoorPin("12345678"), "12345678");
  assert.equal(normalizeDoorPin("123"), "");
  assert.equal(normalizeDoorPin("123456789"), "");
  assert.equal(normalizeDoorPin("12a4"), "");
  assert.equal(doorPinMatches({ pin: "1234" }, "1234"), true);
  assert.equal(doorPinMatches({ pin: "1234" }, "0000"), false);
  assert.equal(doorPinMatches({ pin: "" }, ""), true);
  assert.equal(doorPinMatches({}, "qualunque"), true);
});

test("la normalizzazione scarta le righe senza un'entita' che apre e ripulisce il PIN", () => {
  const doors = normalizeSecurityDoors([
    { name: "Portone", entity: "lock.portone", pin: "1234" },
    { name: "Vuota" },
    { name: "Sensore", entity: "binary_sensor.porta" },
    { name: "Citofono", entity: "button.citofono", pin: "non-un-pin" },
  ]);
  assert.equal(doors.length, 2);
  assert.equal(doors[0].pin, "1234");
  assert.equal(doors[1].pin, "");
  assert.equal(doors[0].icon, "🚪");
  assert.equal(normalizeSecurityDoors("non una lista").length, 0);
});

test("cd_security_doors viaggia nella configurazione condivisa, alla revisione 6", async () => {
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION } = await import(
    "../src/core/chiavi-di-configurazione.js"
  );
  assert.ok(CONFIG_KEYS.includes("cd_security_doors"));
  assert.ok(CONFIG_KEYS_REVISION >= 6);
});

test("il cancello degli eventi conosce cd_security_doors", async () => {
  /* Non piu' guardando una copia scritta a mano dentro il cancello: quella
   * copia restava indietro, ed e' stata tolta. La domanda vera e' se la chiave
   * sta nell'elenco che al cancello viene passato. */
  const { CONFIG_KEYS } = await import("../src/core/chiavi-di-configurazione.js");
  assert.ok(CONFIG_KEYS.includes("cd_security_doors"));
  assert.match(
    leggi("sections/section-runtime.js"),
    /installStateEventGate\([^)]*chiavi: CONFIG_KEYS,/s,
  );
});

test("il runtime installa le card e l'editor delle aperture", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installSecurityDoorsSection\(\)/);
  assert.match(runtime, /installSecurityDoorsEditorSection\(\)/);
  assert.match(runtime, /"security-doors"/);
});

test("il blocco sta fra la centrale e le telecamere, col tastierino della centrale", () => {
  const sezione = leggi("sections/security-doors-section.js");
  // Si inserisce prima delle telecamere, dentro lo scheletro della vetrina.
  assert.match(sezione, /\.dm-sec-cctv/);
  assert.match(sezione, /shell\.insertBefore\(block, cctv\)/);
  // Il tastierino riusa le classi del PIN della centrale, non promptPinAndSet:
  // quello e' saldato ad alarm_control_panel e non puo' aprire una porta.
  assert.match(sezione, /keypad-content/);
  assert.match(sezione, /pin-display/);
  assert.doesNotMatch(sezione, /promptPinAndSet/);
  // Il PIN si verifica prima del comando, e il comando parte solo dopo.
  assert.match(sezione, /doorPinMatches\(door, state\.typed\)/);
  // Niente polling.
  assert.doesNotMatch(sezione, /setInterval\s*\(/);
  assert.doesNotMatch(sezione, /MutationObserver/);
});

test("l'editor valida entita' e PIN prima di salvare", () => {
  const editor = leggi("sections/security-doors-editor-section.js");
  // Il salvataggio legge TUTTE le righe prima di scrivere (il tasto «Salva
  // sezione» premeva i bottoni per-riga e il primo ridisegno staccava gli
  // altri: si salvava solo la prima porta).
  assert.match(editor, /function salvaTutte\(body\)/);
  assert.match(editor, /isDoorEntity\(porta\.entity\)/);
  assert.match(editor, /normalizeDoorPin\(pin\)/);
  assert.match(editor, /cd_security_doors/);
});

/* «Ho un cancelletto che si apre tramite un sonoff mini d, ma quando cerco di
 * inserire l'entita' switch.sonoff_... non viene salvata» (#378).
 *
 * Si salvava: era il ridisegno subito dopo a cancellarla. Chi leggeva scartava
 * dalle aperture ogni entita' che comparisse anche fra le Prese, e l'editor con
 * quella regola riscriveva la lista salvata senza. Un rele' che muove un
 * cancello ed e' anche una presa e' esattamente il caso normale, non un
 * errore da correggere alle spalle di chi l'ha configurato. */
test("un rele' che e' anche una presa resta un'apertura", () => {
  const doors = [
    { id: "d1", name: "Portone", entity: "switch.portone", icon: "🚪", pin: "" },
    { id: "d2", name: "Cancelletto", entity: "switch.sonoff_100253b430_1", icon: "🚪", pin: "" },
  ];
  const salvate = normalizeSecurityDoors(doors);
  assert.deepEqual(
    salvate.map((door) => door.entity),
    ["switch.portone", "switch.sonoff_100253b430_1"],
  );
});

/* E nessuno, leggendo, ha piu' il potere di cancellare una riga configurata. */
test("nessuno scarta le aperture guardando le altre sezioni", () => {
  const sezione = leggi("sections/security-doors-section.js");
  const editor = leggi("sections/security-doors-editor-section.js");
  const modello = leggi("core/security-door-model.js");
  for (const [nome, testo] of [
    ["la sezione", sezione],
    ["l'editor", editor],
    ["il modello", modello],
  ]) {
    assert.ok(!/doorsSenzaOccupate/.test(testo), `${nome} scarta ancora per le prese`);
    assert.ok(!/entitaDellePrese/.test(testo), `${nome} guarda ancora le prese`);
  }
});


/* «Gestire con Nuki separatamente sblocca/blocca e/o apri — evita apertura
 * indesiderata se si vuole solo sblocco» (#387).
 *
 * `unlock` gira la chiave, `open` tira indietro lo scrocco e la porta si apre:
 * sono due gesti, e su una serratura che sa fare tutte e due la plancia
 * chiamava sempre il secondo. Il piu' irreversibile era l'unico disponibile.
 */
const NUKI = { attributes: { supported_features: LOCK_SUPPORT_OPEN } };
const SEMPLICE = { attributes: { supported_features: 0 } };

test("chi non ha scelto niente trova quello che ha sempre avuto", () => {
  /* Cambiare sotto i piedi il tasto del portone a chi lo usa ogni giorno
   * sarebbe un modo di avere ragione a spese sua: senza scelta, si apre. */
  assert.deepEqual(doorOpenCall("lock.portone", NUKI), {
    domain: "lock",
    service: "open",
    data: {},
  });
  assert.deepEqual(azioniDellaPorta({ entity: "lock.portone" }, NUKI), [
    { gesto: "apri", call: { domain: "lock", service: "open", data: {} } },
  ]);
});

test("scelto lo sblocco, la porta non si scrocca piu'", () => {
  assert.deepEqual(doorOpenCall("lock.portone", NUKI, "sblocca"), {
    domain: "lock",
    service: "unlock",
    data: {},
  });
  assert.deepEqual(azioniDellaPorta({ entity: "lock.portone", gesto: "sblocca" }, NUKI), [
    { gesto: "sblocca", call: { domain: "lock", service: "unlock", data: {} } },
  ]);
});

test("con tutti e due i tasti, il primo e' quello che si puo' disfare", () => {
  const azioni = azioniDellaPorta({ entity: "lock.portone", gesto: "entrambi" }, NUKI);
  assert.deepEqual(
    azioni.map((azione) => [azione.gesto, azione.call.service]),
    [
      ["sblocca", "unlock"],
      ["apri", "open"],
    ],
  );
  /* E chi puo' chiamarne una sola — la tessera in Home — chiama quella. */
  assert.equal(doorOpenCall("lock.portone", NUKI, "entrambi").service, "unlock");
});

test("una serratura che non sa aprire ha un gesto solo, qualunque cosa si scelga", () => {
  /* Offrire «apri» a chi non lo espone sarebbe un tasto che non fa niente. */
  for (const scelta of ["", "apri", "sblocca", "entrambi"]) {
    assert.deepEqual(doorOpenCall("lock.porta", SEMPLICE, scelta), {
      domain: "lock",
      service: "unlock",
      data: {},
    });
    assert.deepEqual(azioniDellaPorta({ entity: "lock.porta", gesto: scelta }, SEMPLICE), [
      { gesto: "sblocca", call: { domain: "lock", service: "unlock", data: {} } },
    ]);
  }
});

test("quello che non e' una serratura ha un gesto solo e non cambia", () => {
  for (const entity of ["button.citofono", "switch.rele", "cover.cancello", "script.apri"]) {
    const azioni = azioniDellaPorta({ entity, gesto: "entrambi" }, null);
    assert.equal(azioni.length, 1, `${entity} ha prodotto piu' di un gesto`);
    assert.equal(azioni[0].gesto, "apri");
    assert.deepEqual(azioni[0].call, doorOpenCall(entity));
  }
  /* E quello che non apre niente non offre niente. */
  assert.deepEqual(azioniDellaPorta({ entity: "sensor.porta" }, null), []);
  assert.deepEqual(azioniDellaPorta({}, null), []);
});

test("la scelta si salva solo se e' una delle tre", () => {
  assert.equal(gestoDellaPorta({ gesto: " Sblocca " }), "sblocca");
  assert.equal(gestoDellaPorta({ gesto: "fantasia" }), "");
  assert.equal(gestoDellaPorta({}), "");
  const [porta] = normalizeSecurityDoors([
    { entity: "lock.portone", gesto: "entrambi" },
  ]);
  assert.equal(porta.gesto, "entrambi");
  assert.equal(normalizeSecurityDoors([{ entity: "lock.p", gesto: "boh" }])[0].gesto, "");
});
