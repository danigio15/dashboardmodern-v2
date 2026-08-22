/* «Ho due auto configurate: prima si apre quella giusta, poi quella dell'altra.»
 *
 * Un profilo auto si e' sempre indicato con la sua posizione nell'elenco.
 * Finche' le auto sono una sola la posizione e' un'identita' accettabile; da due
 * in su non lo e' piu', perche' cambia sotto i piedi: si cancella la prima e la
 * seconda diventa la prima, e chi si era segnato «la seconda» adesso indica
 * un'altra vettura. E quel numero viaggia nella configurazione condivisa: la
 * riga scelta su un dispositivo arriva su un altro e li' indica quello che
 * capita.
 *
 * Da qui la cosa segnalata: la plancia si apriva sull'auto giusta — l'aveva
 * scelta chi stava davanti — e un istante dopo passava all'altra, quando
 * arrivava la configurazione condivisa.
 *
 * Adesso ogni vettura ha una chiave sua, che nasce dal nome e dalla marca e non
 * cambia piu'; tutto quello che si configura per quell'auto sta dentro al suo
 * profilo e ci si arriva per chiave, mai per posizione.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACTIVE_CAR_KEY,
  CAR_IDENTITY_FIELDS,
  CAR_KEY_FIELD,
  assignCarKeys,
  carIndexByKey,
  carKey,
  carSlug,
  keepCarIdentity,
  resolveActiveIndex,
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

test("ogni auto senza chiave se ne prende una, e sono tutte diverse", () => {
  const cars = assignCarKeys([{ name: "Tesla" }, { name: "Tesla" }, {}]);
  const chiavi = cars.map(carKey);
  assert.equal(new Set(chiavi).size, 3, "due auto non possono avere la stessa chiave");
  assert.equal(chiavi[0], "tesla");
  assert.equal(chiavi[1], "tesla-2");
  assert.equal(chiavi[2], "auto-3", "senza nome ne' marca resta la posizione di allora");
});

test("una chiave gia' assegnata non si tocca piu'", () => {
  /* Una chiave che cambia non e' una chiave. Rinominare l'auto e' un'altra
   * cosa dal cambiarla: e' sempre quella vettura. */
  const cars = [{ name: "Ribattezzata", [CAR_KEY_FIELD]: "leapmotor-b10" }];
  assert.equal(assignCarKeys(cars), cars, "non c'era niente da assegnare");
  assert.equal(carKey(assignCarKeys(cars)[0]), "leapmotor-b10");
});

test("niente da assegnare, stesso elenco", () => {
  assert.deepEqual(assignCarKeys([]), []);
  assert.equal(assignCarKeys(null), null);
});

test("l'auto scelta si ritrova per chiave anche dopo una cancellazione", () => {
  const cars = assignCarKeys([{ name: "Prima" }, { name: "Seconda" }]);
  const seconda = carKey(cars[1]);
  assert.equal(resolveActiveIndex(cars, seconda, 1), 1);
  // Cancellata la prima, la riga salvata indicherebbe un'altra vettura; la
  // chiave no.
  const rimaste = cars.slice(1);
  assert.equal(carIndexByKey(rimaste, seconda), 0);
  assert.equal(resolveActiveIndex(rimaste, seconda, 1), 0, "il numero avrebbe sforato");
});

test("senza chiave si ripiega sul numero, e senza numero sulla prima", () => {
  const cars = assignCarKeys([{ name: "Prima" }, { name: "Seconda" }]);
  assert.equal(resolveActiveIndex(cars, "", 1), 1, "chi arriva da prima delle chiavi");
  assert.equal(resolveActiveIndex(cars, "sparita", -1), 0, "una plancia mostra sempre un'auto");
  assert.equal(resolveActiveIndex([], "qualunque", 0), -1, "senza auto non c'e' niente da mostrare");
});

/* Risalvare un profilo non deve cancellare l'auto.
 *
 * `edEvCarAdd` cerca un profilo con lo stesso nome e, trovandolo, ci scrive
 * sopra un oggetto nuovo: `{ name, ov, img }`. Tutto il resto se ne andava —
 * la marca scelta nella Personalizzazione, il modello, la foto col cavo
 * attaccato, e adesso la chiave. Chi rimappava un'entita' si ritrovava l'auto
 * senza logo e senza la seconda foto.
 */
test("quello che appartiene all'auto le resta addosso", () => {
  const prima = {
    name: "Leapmotor B10",
    [CAR_KEY_FIELD]: "leapmotor-b10",
    brand: "leapmotor",
    model: "B10",
    imgPlugged: "/local/b10-cavo.png",
  };
  const risalvata = { name: "Leapmotor B10", ov: { "dm.ev_soc": "sensor.soc" }, img: "/local/b10.png" };
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
  const nuova = { name: "Sola", brand: "tesla", model: "3", icon: "mdi:car", imgPlugged: "/x.png", uid: "u" };
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

test("un'auto appena aggiunta si prende una chiave nuova", () => {
  const prima = [{ name: "Prima", [CAR_KEY_FIELD]: "prima" }];
  const rimesse = restoreCarIdentities([prima[0], { name: "Nuova" }], prima);
  assert.equal(carKey(rimesse[1]), "nuova");
});

test("i campi che appartengono all'auto sono dichiarati in un posto solo", () => {
  assert.ok(CAR_IDENTITY_FIELDS.includes(CAR_KEY_FIELD));
  for (const campo of ["brand", "model", "icon", "imgPlugged"])
    assert.ok(CAR_IDENTITY_FIELDS.includes(campo), `${campo} appartiene all'auto`);
});

/* E chi la chiave la deve usare la usa davvero. */
test("chi chiede quale auto e' attiva passa dalla chiave", () => {
  for (const modulo of [
    "sections/ev-section.js",
    "sections/personalization-section.js",
    "sections/beta11-real-device-polish-section.js",
    "sections/beta-compat-section.js",
  ]) {
    const sorgente = leggi(modulo);
    assert.match(sorgente, /resolveActiveIndex/, `${modulo} risolve ancora per posizione`);
    assert.match(sorgente, /ACTIVE_CAR_KEY/, `${modulo} non guarda la chiave`);
  }
});

test("la chiave dell'auto scelta viaggia con la configurazione", async () => {
  const { CONFIG_KEYS } = await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes(ACTIVE_CAR_KEY), "senza questa ogni dispositivo resta per conto suo");
  assert.ok(CONFIG_KEYS.includes("cd_ev_cars"), "e le auto, con dentro tutto il resto");
});

test("il runtime che risalva un profilo passa sotto il nostro giro", () => {
  const sezione = leggi("sections/ev-section.js");
  assert.match(sezione, /root\.edEvCarAdd\s*=\s*addProfile/, "il salvataggio non e' avvolto");
  assert.match(sezione, /restoreCarIdentities\(dopo, prima\)/, "non si rimette niente");
  assert.match(sezione, /root\.cdEvCarBtn\s*=\s*carButton/, "la cancellazione non e' avvolta");
});
