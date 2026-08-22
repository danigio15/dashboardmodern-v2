/* Chi e' un'auto, e cosa le appartiene.
 *
 * Un profilo auto tiene il nome, la marca, il modello, le entita' mappate e le
 * sue due foto. Il runtime pero' lo risalva sostituendolo per intero: «Salva
 * attuale» cerca un profilo con lo stesso nome e ci scrive sopra un oggetto
 * nuovo di zecca, `{ name, ov, img }`. Tutto il resto se ne andava senza che
 * nessuno l'avesse chiesto — la marca scelta nella Personalizzazione, il
 * modello, la foto col cavo attaccato — e chi rimappava un'entita' si ritrovava
 * l'auto senza logo e senza la seconda foto.
 *
 * Qui si prova cosa appartiene all'auto e come si riconosce una vettura da
 * un'altra quando l'elenco viene riscritto, che e' il momento in cui le cose si
 * perdono.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAR_IDENTITY_FIELDS,
  CAR_KEY_FIELD,
  assignCarKeys,
  carIndexByKey,
  carKey,
  carSlug,
  keepCarIdentity,
  restoreCarIdentities,
} from "../src/core/vehicle-identity.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("la chiave nasce dal nome e dalla marca", () => {
  assert.equal(carSlug({ name: "Leapmotor B10", brand: "Leapmotor" }), "leapmotor-leapmotor-b10");
  // Gli accenti non entrano in una chiave: la stessa auto scritta in due modi
  // diversi non deve diventare due auto.
  assert.equal(carSlug({ name: "Citroën ë-C4" }), "citroen-e-c4");
  assert.equal(carSlug({}), "");
});

/* Una chiave si ricava, e non c'e' niente da salvare.
 *
 * Assegnarle all'avvio voleva dire riscrivere l'elenco delle auto per renderle
 * durevoli, e quella riscrittura parte da una fotografia presa quando la
 * passata e' cominciata: se nel frattempo qualcuno cambiava la marca di
 * un'auto, atterrava dopo e la riportava indietro. Si sceglieva MINI e un
 * istante dopo tornava Leapmotor. Una chiave che si ricava non ha bisogno di
 * essere salvata, quindi non puo' riportare indietro niente.
 */
test("la chiave si ricava dal profilo, senza scrivere niente", () => {
  assert.equal(carKey({ name: "Leapmotor B10", brand: "Leapmotor" }), "leapmotor-leapmotor-b10");
  assert.equal(carKey({}), "", "senza nome ne' marca non c'e' chiave da ricavare");
});

test("una chiave scritta dentro al profilo vince, e non cambia piu'", () => {
  /* Una chiave che cambia non e' una chiave. Rinominare l'auto e' un'altra
   * cosa dal cambiarla: e' sempre quella vettura. */
  const car = { name: "Ribattezzata", [CAR_KEY_FIELD]: "leapmotor-b10" };
  assert.equal(carKey(car), "leapmotor-b10");
  assert.equal(assignCarKeys([car])[0], car, "non c'era niente da assegnare");
});

test("assegnandole, sono tutte diverse", () => {
  const cars = assignCarKeys([{ name: "Tesla" }, { name: "Tesla" }, {}]);
  const chiavi = cars.map((car) => car[CAR_KEY_FIELD]);
  assert.equal(new Set(chiavi).size, 3, "due auto non possono avere la stessa chiave");
  assert.equal(chiavi[0], "tesla");
  assert.equal(chiavi[1], "tesla-2");
  assert.equal(chiavi[2], "auto-3", "senza nome ne' marca resta la posizione di allora");
});

test("niente da assegnare, stesso elenco", () => {
  assert.deepEqual(assignCarKeys([]), []);
  assert.equal(assignCarKeys(null), null);
});

test("un'auto si ritrova nell'elenco per chiave", () => {
  const cars = [{ name: "Prima" }, { name: "Seconda" }];
  assert.equal(carIndexByKey(cars, carKey(cars[1])), 1);
  assert.equal(carIndexByKey(cars, "sparita"), -1);
  assert.equal(carIndexByKey(cars, ""), -1);
});

/* Risalvare un profilo non deve cancellare l'auto. */
test("quello che appartiene all'auto le resta addosso", () => {
  const prima = {
    name: "Leapmotor B10",
    [CAR_KEY_FIELD]: "leapmotor-b10",
    brand: "leapmotor",
    model: "B10",
    imgPlugged: "/local/b10-cavo.png",
  };
  const risalvata = {
    name: "Leapmotor B10",
    ov: { "dm.ev_soc": "sensor.soc" },
    img: "/local/b10.png",
  };
  const rimessa = keepCarIdentity(risalvata, prima);
  assert.equal(rimessa.brand, "leapmotor");
  assert.equal(rimessa.model, "B10");
  assert.equal(rimessa.imgPlugged, "/local/b10-cavo.png");
  assert.equal(carKey(rimessa), "leapmotor-b10");
  // Quello che il salvataggio ha scritto davvero vince: e' il motivo per cui
  // si stava risalvando.
  assert.deepEqual(rimessa.ov, { "dm.ev_soc": "sensor.soc" });
  assert.equal(rimessa.img, "/local/b10.png");
});

test("un campo scritto adesso non viene sostituito da quello di prima", () => {
  const rimessa = keepCarIdentity({ brand: "tesla" }, { brand: "leapmotor", model: "B10" });
  assert.equal(rimessa.brand, "tesla");
  assert.equal(rimessa.model, "B10");
});

test("niente da rimettere, stesso oggetto", () => {
  const nuova = {
    name: "Sola",
    brand: "tesla",
    model: "3",
    icon: "mdi:car",
    imgPlugged: "/x.png",
    uid: "u",
  };
  assert.equal(keepCarIdentity(nuova, {}), nuova);
});

test("l'elenco risalvato ritrova le identita' di quello di prima", () => {
  const prima = [
    { name: "Prima", [CAR_KEY_FIELD]: "prima", brand: "tesla", imgPlugged: "/local/1-cavo.png" },
    { name: "Seconda", [CAR_KEY_FIELD]: "seconda", brand: "leapmotor" },
  ];
  // Il runtime ha riscritto la prima per intero e non conosce le chiavi.
  const dopo = [{ name: "Prima", ov: { a: "sensor.a" }, img: "/local/1.png" }, prima[1]];
  const rimesse = restoreCarIdentities(dopo, prima);
  assert.equal(carKey(rimesse[0]), "prima", "riconosciuta dal nome, come l'ha riconosciuta il runtime");
  assert.equal(rimesse[0].brand, "tesla");
  assert.equal(rimesse[0].imgPlugged, "/local/1-cavo.png");
  assert.equal(rimesse[0].img, "/local/1.png", "la foto appena salvata resta quella salvata");
  assert.equal(carKey(rimesse[1]), "seconda");
});

test("i campi che appartengono all'auto sono dichiarati in un posto solo", () => {
  assert.ok(CAR_IDENTITY_FIELDS.includes(CAR_KEY_FIELD));
  for (const campo of ["brand", "model", "icon", "imgPlugged"])
    assert.ok(CAR_IDENTITY_FIELDS.includes(campo), `${campo} appartiene all'auto`);
});

test("le auto viaggiano, e si portano dentro tutto", async () => {
  const { CONFIG_KEYS } = await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes("cd_ev_cars"), "le auto, con dentro ogni loro parametro");
  for (const chiave of ["cd_ev_image", "cd_ev_image_plugged"])
    assert.equal(CONFIG_KEYS.includes(chiave), false, `${chiave} non viaggia da sola`);
});

test("il runtime che risalva un profilo passa sotto il nostro giro", () => {
  const sezione = leggi("sections/ev-section.js");
  assert.match(sezione, /root\.edEvCarAdd\s*=\s*addProfile/, "il salvataggio non e' avvolto");
  assert.match(sezione, /restoreCarIdentities\(dopo, prima\)/, "non si rimette niente");
});
