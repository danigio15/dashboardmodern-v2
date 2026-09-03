/* Le liste ToDo in Home (#201).
 *
 * Le attivita' giornaliere sempre in primo piano: ogni lista `todo.*`
 * configurata ha la sua card sotto le persone di casa, le voci arrivano da
 * `todo.get_items` con `return_response`, e spuntarle chiama
 * `todo.update_item`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  isTodoEntity,
  normalizeTodoLists,
  parseTodoItemsResponse,
  pendingTodoItems,
  suggestTodoLists,
} from "../src/core/todo-model.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("solo un'entita' todo.* e' una lista", () => {
  assert.equal(isTodoEntity("todo.spesa"), true);
  assert.equal(isTodoEntity("todo.attivita_di_casa"), true);
  assert.equal(isTodoEntity("sensor.spesa"), false);
  assert.equal(isTodoEntity("todo."), false);
  assert.equal(isTodoEntity(""), false);
});

test("la normalizzazione scarta le righe senza lista e conserva il nome scelto", () => {
  const lists = normalizeTodoLists([
    { id: "a", name: "Spesa", entity: "todo.spesa" },
    { name: "", entity: "todo.lavori" },
    { name: "Vuota" },
    { name: "Sbagliata", entity: "light.cucina" },
  ]);
  assert.equal(lists.length, 2);
  assert.equal(lists[0].name, "Spesa");
  assert.equal(lists[1].entity, "todo.lavori");
  assert.equal(normalizeTodoLists(null).length, 0);
});

test("«Rileva da Home Assistant» propone le liste che mancano, non quelle gia' scelte", () => {
  const states = {
    "todo.spesa": { state: "3", attributes: { friendly_name: "Spesa" } },
    "todo.lavori_di_casa": { state: "0", attributes: {} },
    "sensor.spesa": { state: "1", attributes: {} },
  };
  const found = suggestTodoLists(states, [{ entity: "todo.spesa" }]);
  assert.equal(found.length, 1);
  assert.equal(found[0].entity, "todo.lavori_di_casa");
  assert.equal(found[0].name, "lavori di casa");
});

test("la risposta di get_items si legge intera e una risposta storta e' una lista vuota", () => {
  const result = {
    response: {
      "todo.spesa": {
        items: [
          { uid: "1", summary: "Latte", status: "needs_action" },
          { uid: "2", summary: "Pane", status: "completed" },
          { summary: "Senza uid", status: "needs_action", due: "2026-08-25" },
          { uid: "", summary: "" },
        ],
      },
    },
  };
  const items = parseTodoItemsResponse(result, "todo.spesa");
  assert.equal(items.length, 3);
  assert.equal(items[0].summary, "Latte");
  assert.equal(items[1].status, "completed");
  assert.equal(items[2].due, "2026-08-25");
  assert.equal(pendingTodoItems(items).length, 2);
  assert.deepEqual(parseTodoItemsResponse(null, "todo.spesa"), []);
  assert.deepEqual(parseTodoItemsResponse({ response: {} }, "todo.spesa"), []);
});

test("cd_todo viaggia nella configurazione condivisa, alla revisione 6", async () => {
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION } =
    await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes("cd_todo"));
  assert.ok(CONFIG_KEYS_REVISION >= 6);
});

test("il cancello degli eventi conosce cd_todo", () => {
  assert.match(leggi("core/state-event-gate.js"), /"cd_todo"/);
});

test("il runtime installa il ponte dei widget e l'editor delle liste", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installHomeWidgetsSection\(\)/);
  assert.match(runtime, /installTodoEditorSection\(\)/);
  assert.match(runtime, /"home-widgets"/);
  assert.match(runtime, /"todo-editor"/);
});

test("le voci arrivano col return_response e si spuntano con update_item", () => {
  const sezione = leggi("sections/home-widgets-section.js");
  assert.match(sezione, /return_response: true/);
  assert.match(sezione, /"get_items"/);
  assert.match(sezione, /"update_item"/);
  // Le liste abitano il ponte dei widget «In primo piano», sotto le persone
  // quando ci sono: una parte della Home con una tessera per sezione, che al
  // tocco si espande nel dettaglio vivo.
  assert.match(sezione, /id = "dm-widgets"/);
  assert.match(sezione, /dm-widgets-title/);
  /* «Widget» si scrive come «Azioni rapide»: solo la parola. Il simbolo che
   * c'era davanti faceva di quella scritta un'altra cosa dalle sue sorelle. */
  assert.doesNotMatch(sezione, /dm-widgets-title::before/);
  assert.match(sezione, /data-dm-widget=/);
  assert.match(sezione, /data-dm-widget-detail=/);
  assert.match(sezione, /getElementById\("dm-people"\)/);
  assert.match(sezione, /dashboard-pills-row/);
  // Si rilegge quando lo stato dell'entita' cambia: niente polling.
  assert.match(sezione, /dashboardmodern:state-changed/);
  assert.doesNotMatch(sezione, /setInterval\s*\(/);
  assert.doesNotMatch(sezione, /MutationObserver/);
});

test("una tessera per sezione, e ognuna legge la configurazione che c'e' gia'", () => {
  const sezione = leggi("sections/home-widgets-section.js");
  for (const modello of [
    "todoModel",
    "lightsModel",
    "climateModel",
    "coversModel",
    "securityModel",
    "energyModel",
    "appliancesModel",
    "temperatureModel",
  ])
    assert.match(sezione, new RegExp(`function ${modello}`), modello);
  // Il markup si rifa' solo quando cambia la struttura: i valori si scrivono
  // al loro posto, cosi' l'apertura di una tessera non riparte da sola.
  assert.match(sezione, /function structureSignature/);
  assert.match(sezione, /state\.signature !== signature/);
});

test("il ponte ha preso il posto del Quadro Avvisi, con le sue stesse liste e regole", async () => {
  const sezione = leggi("sections/home-widgets-section.js");
  // Le liste sorvegliate sono quelle del runtime, non una copia.
  assert.match(sezione, /GRUPPI_MONITORAGGIO/);
  for (const modello of ["batteriesModel", "floodModel", "customAlertModels"])
    assert.match(sezione, new RegExp(`function ${modello}`), modello);
  /* Le aperture avevano la loro e non ce l'hanno piu': «viene gia' gestito da
   * Finestre, se li si mette il sensore finestra dice quale e' aperto, quindi
   * e' un duplicato». */
  assert.doesNotMatch(sezione, /function openingsModel/);
  // Il Quadro non si nasconde piu' a disegno fatto: dal documento e' uscito,
  // percio' qui non c'e' piu' niente da assorbire.
  assert.doesNotMatch(sezione, /assorbiQuadroAvvisi|dm-assorbito/);
  for (const variante of ["dashboard.html", "dashboard-en.html"]) {
    const pagina = readFileSync(join(SRC, "..", "legacy", variante), "utf8");
    assert.doesNotMatch(pagina, /Quadro Avvisi/, variante);
    assert.doesNotMatch(pagina, /id="glance-grid"/, variante);
  }
  // Le batterie contano come il runtime: scarica vuol dire ≤ 20.
  assert.match(sezione, /level <= 20/);

  // Le preferenze: nascoste fuori, ordine scelto prima, custom insieme.
  const { applyWidgetPreferences } = await import("../src/sections/home-widgets-section.js");
  const models = [{ key: "todo" }, { key: "luci" }, { key: "custom-0" }, { key: "custom-1" }];
  const sistemati = applyWidgetPreferences(models, { hidden: ["luci", "custom"], order: ["todo"] });
  assert.deepEqual(
    sistemati.map((widget) => widget.key),
    ["todo"],
  );
  const ordinati = applyWidgetPreferences(models, { hidden: [], order: ["custom", "todo"] });
  assert.deepEqual(
    ordinati.map((widget) => widget.key),
    ["custom-0", "custom-1", "todo", "luci"],
  );
});

test("i dettagli comandano davvero, con le icone di cio' che raccontano", () => {
  const sezione = leggi("sections/home-widgets-section.js");
  // L'antifurto si arma e si disarma dalla tessera, passando dallo stesso
  // tastierino PIN della pagina Sicurezza.
  assert.match(sezione, /data-dm-w-alarm/);
  assert.match(sezione, /promptPinAndSet/);
  assert.match(sezione, /"alarm_arm_away"/);
  assert.match(sezione, /"alarm_arm_night"/);
  assert.match(sezione, /"alarm_disarm"/);
  // Ogni riga porta l'icona di cio' che descrive: la lavatrice ha il suo
  // disegno vero, la luce la lampadina, il clima fiamma o fiocco.
  assert.match(sezione, /cdApplianceIcon/);
  assert.match(sezione, /function climateGlyph/);
  assert.match(sezione, /🪫/);
  // Niente piu' pallini anonimi nelle righe dei dettagli.
  assert.doesNotMatch(sezione, /dm-w-dot/);
});

test("le miniature delle telecamere hanno il loro timer, con la disciplina del muro", () => {
  const sezione = leggi("sections/home-widgets-section.js");
  assert.match(sezione, /function camerasModel/);
  // La stessa strada del muro della Sicurezza, ma con un registro degli
  // object URL tutto suo: revocare i blob dell'altro e' un rettangolo grigio.
  assert.match(sezione, /loadCameraFrame\(/);
  assert.match(sezione, /state\.cameraUrls/);
  // Dieci secondi, e solo con la tessera aperta su una Home visibile.
  assert.match(sezione, /CAMERA_WIDGET_REFRESH_MS = 10000/);
  assert.match(sezione, /function cameraWidgetOnScreen/);
  assert.match(sezione, /state\.expanded === "telecamere" && homeVisible\(\)/);
  // Chiusa la tessera: timer fermo e object URL restituiti.
  assert.match(sezione, /revokeObjectURL/);
});

test("cd_widgets viaggia nella configurazione condivisa, alla revisione 7", async () => {
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION } =
    await import("../src/sections/config-persistence-section.js");
  assert.ok(CONFIG_KEYS.includes("cd_widgets"));
  assert.ok(CONFIG_KEYS_REVISION >= 7);
});
