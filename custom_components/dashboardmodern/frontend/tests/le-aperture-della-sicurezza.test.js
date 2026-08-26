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
    "../src/sections/config-persistence-section.js"
  );
  assert.ok(CONFIG_KEYS.includes("cd_security_doors"));
  assert.ok(CONFIG_KEYS_REVISION >= 6);
});

test("il cancello degli eventi conosce cd_security_doors", () => {
  assert.match(leggi("core/state-event-gate.js"), /"cd_security_doors"/);
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
  assert.match(editor, /isDoorEntity\(next\[index\]\.entity\)/);
  assert.match(editor, /normalizeDoorPin\(pin\)/);
  assert.match(editor, /cd_security_doors/);
});
