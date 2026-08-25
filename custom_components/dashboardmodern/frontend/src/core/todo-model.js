/* Le liste ToDo di Home Assistant, in Home (#201).
 *
 * «Un widget per i ToDo in modo da avere sempre in primo piano le attivita'
 * giornaliere da spuntare»: ogni riga di `cd_todo` e' una lista — l'entita'
 * `todo.*` e il nome con cui mostrarla — e la card in Home elenca le voci da
 * fare, ciascuna spuntabile.
 *
 * Lo stato di un'entita' `todo.*` e' solo il numero delle voci aperte: le voci
 * vere arrivano dal servizio `todo.get_items` con `return_response`, e qui c'e'
 * la parte che si prova da sola — riconoscere una lista, normalizzare le righe,
 * leggere la risposta del servizio.
 */

const clean = (value) => String(value ?? "").trim();

export const TODO_ENTITY_RE = /^todo\.[a-z0-9_]+$/i;

export function isTodoEntity(value) {
  return TODO_ENTITY_RE.test(clean(value));
}

export function normalizeTodoLists(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item, index) => ({
      id: clean(item?.id) || `todo-${index + 1}`,
      entity: clean(item?.entity || item?.entity_id),
      name: clean(item?.name),
    }))
    .filter((item) => isTodoEntity(item.entity));
}

/** Le liste che Home Assistant ha gia' e la configurazione ancora no. */
export function suggestTodoLists(states = {}, existing = []) {
  const known = new Set(normalizeTodoLists(existing).map((item) => item.entity.toLowerCase()));
  return Object.entries(states)
    .filter(([entity]) => isTodoEntity(entity) && !known.has(entity.toLowerCase()))
    .map(([entity, state]) => ({
      entity,
      name: clean(state?.attributes?.friendly_name) || entity.split(".")[1].replaceAll("_", " "),
    }));
}

/* La risposta di `todo.get_items`: `response[entity].items`, ogni voce con
 * `uid`, `summary`, `status` (needs_action | completed) e forse `due`. Una
 * risposta storta — servizio mancante, entita' sbagliata — torna lista vuota,
 * mai un errore a meta' disegno. */
export function parseTodoItemsResponse(result, entity) {
  const items = result?.response?.[clean(entity)]?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      uid: clean(item?.uid),
      summary: clean(item?.summary),
      status: clean(item?.status).toLowerCase() === "completed" ? "completed" : "needs_action",
      due: clean(item?.due),
    }))
    .filter((item) => item.summary || item.uid);
}

export function pendingTodoItems(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.status !== "completed");
}
