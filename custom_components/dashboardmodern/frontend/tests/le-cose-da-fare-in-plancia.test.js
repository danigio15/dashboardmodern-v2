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
  const { CONFIG_KEYS, CONFIG_KEYS_REVISION } = await import(
    "../src/sections/config-persistence-section.js"
  );
  assert.ok(CONFIG_KEYS.includes("cd_todo"));
  assert.ok(CONFIG_KEYS_REVISION >= 6);
});

test("il cancello degli eventi conosce cd_todo", () => {
  assert.match(leggi("core/state-event-gate.js"), /"cd_todo"/);
});

test("il runtime installa la card e l'editor delle liste", () => {
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installTodoSection\(\)/);
  assert.match(runtime, /installTodoEditorSection\(\)/);
  assert.match(runtime, /"todo"/);
});

test("le voci arrivano col return_response e si spuntano con update_item", () => {
  const sezione = leggi("sections/todo-section.js");
  assert.match(sezione, /return_response: true/);
  assert.match(sezione, /"get_items"/);
  assert.match(sezione, /"update_item"/);
  // Le liste abitano la zona dei widget «In primo piano», sotto le persone
  // quando ci sono: una parte della Home fatta per ospitare anche i widget
  // futuri, con la testata e la pastiglia del totale.
  assert.match(sezione, /id = "dm-widgets"/);
  assert.match(sezione, /dm-widgets-head/);
  assert.match(sezione, /data-dm-widgets-count/);
  assert.match(sezione, /getElementById\("dm-people"\)/);
  assert.match(sezione, /dashboard-pills-row/);
  // Si rilegge quando lo stato dell'entita' cambia: niente polling.
  assert.match(sezione, /dashboardmodern:state-changed/);
  assert.doesNotMatch(sezione, /setInterval\s*\(/);
  assert.doesNotMatch(sezione, /MutationObserver/);
});
