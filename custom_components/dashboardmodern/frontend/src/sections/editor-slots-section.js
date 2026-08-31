// DM-FIX-20260817E
/* Entity slots in the editor, made readable.
 *
 * Every section tab listed the same thing: a label, a bare text field asking
 * for an entity id and a lens button next to it. Sixteen of those in a row —
 * the EV tab — read as a form to fill in by hand, when the entity is really
 * picked from a list.
 *
 * The row now shows what it is worth reading: whether the slot is mapped, the
 * friendly name of the entity behind it and its id underneath. Tapping the row
 * opens the picker the dashboard already has. The raw field stays in the DOM,
 * hidden, and comes back with "Modifica manuale" for whoever wants to type an
 * id straight in.
 *
 * Contracts preserved on purpose:
 * - the input keeps its `.ed-slot-in[data-ref]` class and its `edSetSlot`
 *   handler, so a value chosen here saves exactly like a typed one;
 * - the picker is the legacy `wzPickEntity()`, called with the input element:
 *   `cdEpChoose()` then writes the value and fires `change`, which is what the
 *   editor listens to;
 *   the legacy lens button is only hidden, never removed, so
 *   `entity-picker-guard-section.js` keeps seeing the pair it reconciles;
 * - `edSaveSezione()` still reads the same inputs from `.ed-acc-body`.
 *
 * Nothing here reads or writes Home Assistant state beyond the friendly name of
 * an entity already in `_RAW_STATES`.
 */
import { isRetiredEditorSlot } from "../core/editor-slots.js";
import { clean, doc, esc, installStyle, onEditorRedraw, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_SLOTS__";
const STYLE_ID = "dm-editor-slots-style";
const state = (root[KEY] ||= { installed: false, frame: 0, pending: 0, retries: 0 });

/* Il nome che Home Assistant conosce per un'entita', "" se non ne conosce uno.
 *
 * Si chiamava entityLabel come quello di core/device-model.js, che pero' fa
 * un'altra cosa: quello si inventa un nome leggibile dall'identificativo
 * (sensor.b10_soc -> "B10 Soc"), questo restituisce il nome vero o niente. Chi
 * importava a memoria poteva prendersi l'uno per l'altro. */
export function nomeDaHomeAssistant(entity, states = root._RAW_STATES || root.STATES || {}) {
  const id = clean(entity);
  if (!id) return "";
  const name = clean(states?.[id]?.attributes?.friendly_name);
  return name && name !== id ? name : "";
}

/** How many slots of a section are mapped, for the accordion header. */
export function slotCounts(scope) {
  const inputs = [...(scope?.querySelectorAll?.(".ed-slot-in[data-ref]") || [])];
  const mapped = inputs.filter((input) => clean(input.value)).length;
  return { total: inputs.length, mapped };
}

function isSlotRow(slot) {
  // The loads editor reuses .ed-slot for its own form; it owns its layout.
  if (slot.closest("[data-load-form]")) return false;
  return Boolean(slot.querySelector(":scope .ed-slot-in[data-ref]"));
}

function chipMarkup() {
  return `<span class="dm-slot-chip-copy"><b data-chip-name></b><small data-chip-id></small></span><span class="dm-slot-chip-go" aria-hidden="true">›</span>`;
}

function decorate(slot) {
  if (!isSlotRow(slot)) return false;
  const input = slot.querySelector(".ed-slot-in[data-ref]");
  slot.classList.add("dm-slot");
  relabelSlot(slot, input);
  let chip = slot.querySelector(":scope > .dm-slot-chip");
  if (!chip) {
    chip = doc.createElement("button");
    chip.type = "button";
    chip.className = "dm-slot-chip";
    chip.innerHTML = chipMarkup();
    // Appended at the end of the row: the lens stays the input's next sibling,
    // which is the pair the entity picker guard reconciles.
    slot.append(chip);
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        root.wzPickEntity?.(input);
      } catch (_error) {}
    });
    input.addEventListener("change", () => paint(slot));
  }
  ensureSlotClear(slot, input);
  paint(slot);
  return true;
}

/* Il cestino sulla riga, anche qui.
 *
 * Le righe che chiedono un'entita' esistono in due forme: quelle in piedi da
 * sole, che hanno la matita e il cestino scritti accanto alla scelta, e queste,
 * le righe delle sezioni, che avevano solo la pastiglia per scegliere. Su
 * Home, Energia, Solare, MiniPC e Azioni non c'era quindi alcun modo di togliere
 * un'entita' sbagliata se non riaprire il campo a mano e cancellarlo: lo stesso
 * comando c'era due passi piu' in la' e qui no.
 *
 * Svuotare il campo e battere `change` e' la scelta dell'entita' al contrario:
 * il gestore che la riga ha gia' vede il campo vuoto, toglie l'associazione e
 * salva — qui non si scrive niente da nessuna parte. Il cestino compare solo
 * quando c'e' qualcosa da togliere. */
function ensureSlotClear(slot, input) {
  if (slot.querySelector(":scope > .dm-slot-clear")) return;
  const clear = doc.createElement("button");
  clear.type = "button";
  clear.className = "dm-slot-clear";
  clear.innerHTML = `<span aria-hidden="true">🗑</span><span class="dm-slot-clear-tx">${esc(t("Elimina", "Remove"))}</span>`;
  clear.setAttribute("aria-label", t("Togli l'entità da questo campo", "Remove the entity from this field"));
  clear.hidden = !clean(input.value);
  clear.addEventListener("click", (event) => {
    event.preventDefault();
    if (!clean(input.value)) return;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    paint(slot);
  });
  slot.append(clear);
}

function paint(slot) {
  const input = slot.querySelector(".ed-slot-in[data-ref]");
  const chip = slot.querySelector(":scope > .dm-slot-chip");
  if (!input || !chip) return;
  const value = clean(input.value);
  const label = nomeDaHomeAssistant(value);
  slot.dataset.dmSlot = value ? "mapped" : "empty";
  // Non si toglie quello che non c'e'.
  const clear = slot.querySelector(":scope > .dm-slot-clear");
  if (clear) clear.hidden = !value;
  const name = chip.querySelector("[data-chip-name]");
  const id = chip.querySelector("[data-chip-id]");
  const nameText = value ? label || value : t("Scegli entità", "Choose entity");
  const idText = value && label ? value : "";
  if (name.textContent !== nameText) name.textContent = nameText;
  if (id.textContent !== idText) id.textContent = idText;
  chip.setAttribute(
    "aria-label",
    `${clean(slot.querySelector(".ed-slot-lbl input")?.value) || clean(slot.querySelector(".ed-slot-lbl")?.textContent)}: ${nameText}`,
  );
}

function decorateBody(body) {
  let count = 0;
  for (const slot of body.querySelectorAll(".ed-slot")) if (decorate(slot)) count += 1;
  if (!count) return false;
  body.classList.add("dm-slots");
  if (!body.querySelector(":scope > .dm-slots-manual")) {
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "dm-slots-manual";
    toggle.textContent = t("Modifica manuale", "Edit by hand");
    toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      const on = body.classList.toggle("dm-slots-raw");
      toggle.setAttribute("aria-pressed", String(on));
    });
    body.prepend(toggle);
  }
  const counts = slotCounts(body);
  const badge = body.closest("details")?.querySelector(".ed-acc-n");
  if (badge && counts.total) {
    const text = t(
      `${counts.mapped} su ${counts.total} mappate`,
      `${counts.mapped} of ${counts.total} mapped`,
    );
    if (badge.textContent !== text) badge.textContent = text;
  }
  return true;
}

/* Rows the configuration no longer offers, taken out of the form.
 *
 * The runtime tries to hide these two itself, with an inline `display:none`
 * that the row skin below overrides — an inline declaration cannot beat
 * `!important`, so they came back. Taking the whole row out is the one answer
 * that holds whichever owner paints last. The editor's save walks the rows that
 * are present, so a row that is gone simply stops being written, and the
 * override already stored behind it is never touched.
 *
 * Only a complete `.ed-slot` row is ever removed. A bare field with no row of
 * its own belongs to some other form and is left exactly where it is — the
 * fields this section decorates are never removed, only hidden. */
export function dropRetiredSlots(scope = doc?.getElementById("ed-body")) {
  if (!scope?.querySelectorAll) return 0;
  let dropped = 0;
  for (const input of scope.querySelectorAll(".ed-slot-in[data-ref]")) {
    if (!isRetiredEditorSlot(input.dataset.ref)) continue;
    const row = input.closest(".ed-slot");
    if (!row) continue;
    row.remove();
    dropped += 1;
  }
  return dropped;
}

/* The same readable row, on every entity field in the configuration.
 *
 * The accordions of the Sezioni tab were the only place that got it. Everywhere
 * else — Luci, Telecamere, Report, Temperature, Irrigazione — a field still
 * asked for an entity id in a text box with a lens beside it, so the same job
 * was done two different ways depending on which tab you happened to open.
 *
 * The rule for what is an entity field is not restated here: the picker guard
 * already decides that, and marks what it decides with `data-entity-input`.
 * This turns each of those into the same row: what is chosen, or an invitation
 * to choose. The field and its lens stay in the document, one tap away under
 * the pencil, because they are what the editors read when they save.
 */
const CHIP_MARKER = "dmEntityChip";

const NEVER_A_HOST =
  "#ed-body,.ed-body,.ed-list,.ed-form,.ed-shell,#editor-modal,#setup-wizard,.dm-section-dialog,form,body";

/** The lens the editors put next to an entity field, if it is there. */
function lensOf(input) {
  return input.nextElementSibling?.matches?.(".dm-entity-picker") ? input.nextElementSibling : null;
}

/* Where the row goes.
 *
 * The lens has to stay exactly where it is — it is the input's next sibling,
 * and that pair is what the picker guard and the editors' own mount step
 * reconcile; moving it makes them mount a second lens. So the row is built
 * around it: the host is the element that already holds the pair. */
/* What this field is for.
 *
 * The row replaced a box whose placeholder was the only clue about the field —
 * `switch.pompa_piscina` told you it was the pump. With the row over it that
 * clue is gone, so the row says it itself. Where the form already prints a
 * label the row stays quiet; where it does not, the field's own name comes
 * first and the placeholder is the fallback, so nothing ever says less than it
 * did before. */
const FIELD_CAPTIONS = Object.freeze({
  "ed-avv-ent": ["Entità dell'avviso", "Alert entity"],
  "wz-av-ent": ["Entità dell'avviso", "Alert entity"],
  "ed-cam-ent": ["Entità telecamera", "Camera entity"],
  "wz-cam-ent": ["Entità telecamera", "Camera entity"],
  "ed-cl-ent": ["Entità clima", "Climate entity"],
  "wz-cl-ent": ["Entità clima", "Climate entity"],
  "ed-st2-temp": ["Sensore temperatura", "Temperature sensor"],
  "ed-tp-ent": ["Entità tapparella", "Cover entity"],
  "ed-pl-temp": ["Temperatura piscina", "Pool temperature"],
  "ed-pl-ph": ["pH", "pH"],
  "ed-pl-cl": ["Cloro", "Chlorine"],
  "ed-pl-pump": ["Pompa filtrazione", "Filtration pump"],
  "ed-pl-heat": ["Riscaldamento piscina", "Pool heating"],
  "ed-pl-light": ["Luce piscina", "Pool light"],
  "ed-irr-ent": ["Valvola della zona", "Zone valve"],
  "ed-irr-rain": ["Sensore probabilità pioggia", "Rain probability sensor"],
  "ed-irr-weather": ["Meteo", "Weather"],
  "luce-add-ent": ["Entità luce", "Light entity"],
  "ed-st-temp": ["Sensore temperatura", "Temperature sensor"],
  "ed-st-hum": ["Sensore umidità", "Humidity sensor"],
  "wz-qa-ent": ["Entità da comandare", "Entity to control"],
  "ed-qa-ent": ["Entità da comandare", "Entity to control"],
  "wz-dev-sw": ["Interruttore del dispositivo", "Device switch"],
  "wz-dev-pw": ["Potenza istantanea (W)", "Instant power (W)"],
  "wz-dev-sv": ["Stato o programma", "State or programme"],
  "wz-rep-ent": ["Contatore energia (kWh)", "Energy meter (kWh)"],
  "ed-rep2-ent": ["Contatore energia (kWh)", "Energy meter (kWh)"],
  "ed-lu-ent": ["Entità luce", "Light entity"],
});

/* Un esempio deve insegnare qualcosa.
 *
 * I campi entita' suggerivano "dm.core_054 / dm.core_023 / scene.x". Quei
 * codici sono i nomi interni degli slot di questa dashboard, non entita' che
 * qualcuno abbia davvero in casa: chi configurava leggeva una sigla e non
 * poteva sapere cosa scriverci, e nel campo delle Azioni la sigla finiva anche
 * come didascalia della riga. Ogni campo dice adesso che cosa vuole, con un
 * esempio scritto come Home Assistant scrive le sue entita'. */
const PLACEHOLDERS = Object.freeze({
  "wz-qa-ent": [
    "Entità da comandare, es. switch.luce_salone",
    "Entity to control, e.g. switch.luce_salone",
  ],
  "ed-qa-ent": [
    "Interruttore, luce o scena da comandare — i popup non ne hanno bisogno",
    "Switch, light or scene to control — popups do not need one",
  ],
  "wz-dev-sw": [
    "Facoltativo: interruttore, es. switch.lavatrice",
    "Optional: switch, e.g. switch.lavatrice",
  ],
  "wz-dev-pw": [
    "Facoltativo: potenza in W, es. sensor.lavatrice_potenza",
    "Optional: power in W, e.g. sensor.lavatrice_potenza",
  ],
  "wz-dev-sv": [
    "Facoltativo: stato o programma, es. sensor.lavatrice_stato",
    "Optional: state or programme, e.g. sensor.lavatrice_stato",
  ],
  "wz-rep-ent": [
    "Contatore in kWh, es. sensor.lavatrice_energia",
    "kWh meter, e.g. sensor.lavatrice_energia",
  ],
  "ed-rep2-ent": [
    "Contatore in kWh, es. sensor.lavatrice_energia",
    "kWh meter, e.g. sensor.lavatrice_energia",
  ],
  "ed-lu-ent": ["Entità luce, es. light.salone", "Light entity, e.g. light.salone"],
});

const GENERIC_PLACEHOLDER = Object.freeze([
  "Scegli con 🔍, oppure scrivi l'entità: dominio.nome",
  "Pick with 🔍, or type the entity: domain.name",
]);

const PLACEHOLDER_SELECTOR = [
  'input[placeholder*="dm.core_"]',
  ...Object.keys(PLACEHOLDERS).map((id) => `#${id}[placeholder]`),
].join(",");

function rewritePlaceholder(input) {
  const known = PLACEHOLDERS[input.id];
  const current = input.getAttribute("placeholder") || "";
  if (!known && !current.includes("dm.core_")) return false;
  const text = known ? t(known[0], known[1]) : t(GENERIC_PLACEHOLDER[0], GENERIC_PLACEHOLDER[1]);
  if (current === text) return false;
  input.setAttribute("placeholder", text);
  return true;
}

export function clarifyEntityPlaceholders(scope = doc) {
  if (!scope?.querySelectorAll) return 0;
  let count = 0;
  for (const input of scope.querySelectorAll(PLACEHOLDER_SELECTOR)) {
    if (rewritePlaceholder(input)) count += 1;
  }
  return count;
}

/* Nomi che dicono cosa misura la sonda, non in che ordine e' stata scritta.
 *
 * Il solare termico chiedeva "Sonda temperatura 1, 2, 3" e chi configura non ha
 * modo di indovinare quale va dove. Dal disegno della pagina si sa: la prima
 * alimenta la lettura del pannello, la seconda il fondo dell'accumulo, la terza
 * la cima. Il riferimento resta quello che e', cambia solo cio' che si legge.
 */
const SLOT_LABELS = Object.freeze({
  "dm.boiler_sonda_temperatura_1": [
    "Sonda pannello solare (°C)",
    "Solar collector probe (°C)",
    "Sonda temperatura 1 (°C)",
  ],
  "dm.boiler_sonda_temperatura_2": [
    "Sonda accumulo basso (°C)",
    "Tank bottom probe (°C)",
    "Sonda temperatura 2 (°C)",
  ],
  "dm.boiler_sonda_temperatura_3": [
    "Sonda accumulo alto (°C)",
    "Tank top probe (°C)",
    "Sonda temperatura 3 (°C)",
  ],
});

/* L'etichetta di una riga che l'utente ha rinominato resta sua.
 *
 * Queste righe si possono rinominare, quindi il nome sta in un campo e non in
 * un testo: si riscrive solo finche' porta ancora il nome di fabbrica, quello
 * che il runtime stampa da se'. Chi l'ha cambiato se lo tiene. */
function relabelSlot(slot, input) {
  const known = SLOT_LABELS[clean(input?.dataset?.ref)];
  if (!known) return;
  const label = slot.querySelector(".ed-slot-lbl");
  if (!label) return;
  const text = t(known[0], known[1]);
  const field = label.querySelector("input,textarea");
  if (field) {
    if (clean(field.value) !== clean(known[2])) return;
    if (field.value !== text) field.value = text;
    return;
  }
  if (label.querySelector("select")) return;
  if (clean(label.textContent) !== text) label.textContent = text;
}

function fieldAlreadyLabelled(input) {
  if (!input) return true;
  if (
    input.closest(".ed-slot,[data-entity-field]")?.querySelector(".ed-slot-lbl,.dm-entity-label")
  ) {
    return true;
  }
  if (input.id && doc?.querySelector?.(`label[for="${CSS.escape(input.id)}"]`)) return true;
  const wrapper = input.closest("label");
  return Boolean(wrapper && clean(wrapper.querySelector("span")?.textContent));
}

/* Un esempio non e' un nome.
 *
 * Il ripiego sul segnaposto vale finche' il segnaposto e' una frase. Dove
 * invece era gia' l'entita' di esempio — `binary_sensor.finestra_x_contact`
 * negli Avvisi — la riga si intitolava con quella, e chi configurava leggeva
 * come nome del campo un'entita' che non ha. Un riferimento nudo
 * `dominio.nome` non dice cosa vuole il campo: meglio nessuna didascalia. */
const RIFERIMENTO_NUDO = /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/i;

function captionFor(input) {
  const known = FIELD_CAPTIONS[input.id];
  if (known) return t(known[0], known[1]);
  const placeholder = clean(input.getAttribute("placeholder"));
  if (!placeholder) return "";
  if (/^es\.\s/i.test(placeholder)) return "";
  if (RIFERIMENTO_NUDO.test(placeholder)) return "";
  return placeholder;
}

/* Whether a row prints its own name, said on the row itself.
 *
 * The rules that lay out a row without a name would otherwise have to ask
 * `:has()`, and a `:has()` rule over the editor is re-evaluated on every change
 * inside it — which, in the editor, is constantly. The row is already touched
 * when it is built, so saying it there costs one attribute and nothing after. */
function markCaption(host, has) {
  const value = has ? "true" : "false";
  if (host.dataset.dmChipCaption !== value) host.dataset.dmChipCaption = value;
}

/* Where the form prints the name itself, the form's label is the card. Marked
 * on that element for the same reason. */
function markCardOwner(host) {
  const slot = host.closest(".ed-slot");
  if (!slot || slot.hasAttribute("data-load-group") || slot.closest("[data-load-form]")) return;
  if (!slot.querySelector(":scope > .ed-slot-lbl")) return;
  const value = host.dataset.dmSlot === "mapped" ? "mapped" : "empty";
  if (slot.dataset.dmEntityCard !== value) slot.dataset.dmEntityCard = value;
}

function ensureFieldCaption(host, input) {
  const existing = host.querySelector(":scope > .dm-chip-caption");
  if (fieldAlreadyLabelled(input)) {
    existing?.remove();
    markCaption(host, false);
    return;
  }
  const text = captionFor(input);
  if (!text) {
    markCaption(host, Boolean(existing));
    return;
  }
  markCaption(host, true);
  const caption = existing || doc.createElement("span");
  if (!existing) {
    caption.className = "dm-chip-caption";
    host.prepend(caption);
  }
  if (caption.textContent !== text) caption.textContent = text;
  pin(caption, CAPTION_LAYOUT);
}

/* The card, written on the element itself.
 *
 * Six other modules style these same boxes, and several do it through
 * selectors carrying four ids — `#editor-modal #ed-body:has(#ed-irr-ent)
 * div:has(>#ed-irr-ent)` pins the irrigation rows to a two column grid, the
 * section dialog pins its own, the light form pins a third. A stylesheet rule
 * here loses to all of them however it is written, and the row came out as a
 * chip squeezed into the old lens column with the pencil beside it.
 *
 * An important declaration on the element outranks every stylesheet, so the
 * three boxes that make up the card state their own layout once, when the row
 * is built. Everything that is not layout — colour, radius, type — stays in
 * the stylesheet where it can be themed. */
const CARD_LAYOUT = Object.freeze([
  ["display", "flex"],
  ["flex-wrap", "wrap"],
  ["align-items", "center"],
  ["gap", "6px 8px"],
  ["grid-template-columns", "none"],
  ["box-sizing", "border-box"],
  ["width", "100%"],
  ["max-width", "100%"],
  ["min-width", "0"],
]);
const CHIP_LAYOUT = Object.freeze([
  ["order", "3"],
  ["flex", "1 1 100%"],
  ["grid-column", "1/-1"],
  ["width", "100%"],
  ["max-width", "100%"],
  ["min-width", "0"],
  ["height", "auto"],
  ["min-height", "44px"],
]);
const MANUAL_LAYOUT = Object.freeze([
  ["order", "2"],
  ["flex", "0 0 auto"],
  ["grid-column", "auto"],
  ["width", "auto"],
  ["min-width", "36px"],
  ["max-width", "none"],
  ["height", "36px"],
]);
const CAPTION_LAYOUT = Object.freeze([
  ["order", "1"],
  ["flex", "1 1 auto"],
  ["grid-column", "auto"],
  ["width", "auto"],
  ["min-width", "0"],
]);

function pin(node, declarations) {
  if (!node?.style) return;
  for (const [name, value] of declarations) {
    // The priority is part of what is being checked: another owner writes
    // `display:flex` on this same row without it, and a comparison on the value
    // alone reads that as already done — leaving the declaration beatable by
    // the four-id rules this exists to outrank.
    if (
      node.style.getPropertyValue(name) === value &&
      node.style.getPropertyPriority(name) === "important"
    ) {
      continue;
    }
    node.style.setProperty(name, value, "important");
  }
}

function chipHost(input, lens) {
  const wrapper = input.parentElement;
  if (!wrapper || wrapper.matches(NEVER_A_HOST) || !wrapper.contains(lens)) return null;
  return wrapper;
}

function paintFieldChip(host) {
  const input = host.querySelector("input[data-entity-input]");
  const chip = host.querySelector(".dm-entity-picker.dm-slot-chip");
  if (!input || !chip) return;
  const value = clean(input.value);
  const label = nomeDaHomeAssistant(value);
  // Only ever write what actually changed. The editors watch their own panels
  // for mutations and re-render when they see one, and a re-render throws away
  // the draft the open form is collecting — so a row that repaints itself with
  // identical content would quietly cost the user the value being typed.
  const mapped = value ? "mapped" : "empty";
  if (host.dataset.dmSlot !== mapped) host.dataset.dmSlot = mapped;
  // Non si toglie quello che non c'e'.
  const clearButton = host.querySelector(":scope > .dm-chip-clear");
  if (clearButton) clearButton.hidden = !value;
  const name = chip.querySelector("[data-chip-name]");
  const id = chip.querySelector("[data-chip-id]");
  if (!name || !id) return;
  const nameText = value ? label || value : t("Scegli entità", "Choose entity");
  const idText = value && label ? value : "";
  if (name.textContent !== nameText) name.textContent = nameText;
  if (id.textContent !== idText) id.textContent = idText;
  markCardOwner(host);
  const fieldName =
    clean(
      input.closest(".ed-slot,[data-entity-field]")?.querySelector(".ed-slot-lbl")?.textContent,
    ) ||
    clean(input.getAttribute("aria-label")) ||
    t("Entità", "Entity");
  chip.setAttribute("aria-label", `${fieldName}: ${nameText}`);
}

/* One entity field, made readable.
 *
 * The lens becomes the row: same button, same handler, same
 * `data-entity-target` — it simply stops being a 50px square with a magnifier
 * in it and starts saying what is chosen, or inviting a choice. The raw id
 * field goes behind the pencil next to it, which is where the Sezioni tab has
 * kept it since it got these rows. */
function decorateField(input) {
  // A slot of a section accordion belongs to the row decorator above, which
  // builds its own chip: giving it a second one leaves two rows saying the same
  // thing, and the one the editor repaints is then anyone's guess.
  if (input.closest(".dm-slot") || input.matches(".ed-slot-in[data-ref]")) return false;
  const lens = lensOf(input);
  if (!lens) return false;
  const host = chipHost(input, lens);
  if (!host) return false;
  if (host.dataset[CHIP_MARKER] === "true") {
    ensureFieldCaption(host, input);
    paintFieldChip(host);
    return false;
  }
  host.dataset[CHIP_MARKER] = "true";
  input.classList.add("dm-chip-raw");
  lens.classList.add("dm-slot-chip");
  lens.innerHTML = chipMarkup();

  /* La matita da sola non diceva a cosa serviva.
   *
   * Chi arrivava su un campo gia' compilato non aveva modo di sapere che quel
   * pulsante apre l'id da scrivere a mano, ne' come si toglie un'entita'
   * sbagliata. Adesso i due comandi sono scritti: si modifica a mano, oppure si
   * svuota il campo. Il secondo compare solo quando c'e' qualcosa da togliere. */
  const manual = doc.createElement("button");
  manual.type = "button";
  manual.className = "dm-chip-manual";
  manual.innerHTML = `<span aria-hidden="true">✏️</span><span class="dm-chip-manual-tx">${esc(t("Modifica", "Edit"))}</span>`;
  manual.setAttribute("aria-label", t("Modifica manuale", "Edit by hand"));
  manual.setAttribute("aria-pressed", "false");

  const clearField = doc.createElement("button");
  clearField.type = "button";
  clearField.className = "dm-chip-clear";
  clearField.innerHTML = `<span aria-hidden="true">🗑</span><span class="dm-chip-manual-tx">${esc(t("Elimina", "Remove"))}</span>`;
  clearField.setAttribute("aria-label", t("Togli l'entità da questo campo", "Remove the entity from this field"));
  clearField.addEventListener("click", (event) => {
    event.preventDefault();
    if (!clean(input.value)) return;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    paintFieldChip(host);
  });
  manual.addEventListener("click", (event) => {
    event.preventDefault();
    const on = host.dataset.dmEntityRaw !== "true";
    host.dataset.dmEntityRaw = on ? "true" : "false";
    manual.setAttribute("aria-pressed", String(on));
    if (on) input.focus();
  });
  // After the lens, never between the field and the lens: that pair is a
  // contract every other owner of these forms reconciles.
  lens.insertAdjacentElement("afterend", manual);
  manual.insertAdjacentElement("afterend", clearField);

  // After the form's own change handlers, never during them.
  input.addEventListener("change", () => {
    if (typeof root.requestAnimationFrame !== "function") {
      paintFieldChip(host);
      return;
    }
    root.requestAnimationFrame(() => paintFieldChip(host));
  });
  /* La riga del Report si impagina da sola: ha la sua etichetta con la matita,
   * il quadratino dell'icona e, in fondo, il pulsante che apre la voce per
   * intero. Farne una card qui significava una cornice dentro la cornice e una
   * seconda matita a capo, e siccome questa impaginazione si scrive
   * sull'elemento nessun foglio di stile poteva rimediare. La card serve dove
   * il campo e' nudo, non dove la riga lo veste gia'. */
  if (!input.closest(".dm-report-row")) {
    pin(host, CARD_LAYOUT);
    pin(lens, CHIP_LAYOUT);
  }
  /* I due comandi si misurano sul testo che portano, ovunque stiano.
   *
   * Il foglio di stile li tiene in un quadrato di 36px — era il bottone con la
   * sola matita — e l'impaginazione qui sopra li rimetteva larghi quanto il
   * loro contenuto. Nella riga del Report quell'impaginazione non si scriveva,
   * e il quadrato vinceva: «✏️ Modifica» sbordava dalla riga e finiva tagliato
   * a meta' sul bordo dello schermo. Che la riga sia una card o si impagini da
   * sola non c'entra con quanto e' largo un pulsante. */
  pin(manual, MANUAL_LAYOUT);
  pin(clearField, MANUAL_LAYOUT);
  ensureFieldCaption(host, input);
  paintFieldChip(host);
  return true;
}

/* Returns how many fields are still waiting for their row.
 *
 * The lens is mounted by the picker guard on its own frame, and the row is
 * built around the lens — so a field reached before its lens exists has to be
 * come back for, or it stays a bare id box while every other field is a row. */
export function decorateEntityFields(scope = doc?.getElementById("ed-body")) {
  if (!scope?.querySelectorAll) return 0;
  let pending = 0;
  for (const input of scope.querySelectorAll('input[data-entity-input="true"]')) {
    if (
      input.closest(".dm-slot") ||
      input.matches(".ed-slot-in[data-ref]") ||
      input.closest('[data-dm-entity-chip="true"]')
    ) {
      continue;
    }
    if (!decorateField(input)) pending += 1;
  }
  return pending;
}

/* Il campo entita' delle Azioni rapide segue il tipo scelto.
 *
 * Il guscio lo nasconde gia' per i popup nativi (`edQaTypeChanged`), ma la
 * pelle a scheda scrive `display:flex` importante sulla stessa riga quando la
 * decora — e da li' in poi «Entita' da comandare» restava a chiedere entita'
 * che i popup non vogliono: «se il popup lo fai tu in automatico non devi far
 * scegliere le entita'». La visibilita' si ristabilisce a ogni passata, con la
 * stessa priorita' con cui la pelle l'aveva scritta. */
function rispettaTipoAzione(scope) {
  const tipo = clean(scope?.querySelector?.("#ed-qa-type")?.value);
  if (!tipo) return;
  const riga =
    scope.querySelector("#ed-qa-ent-row") ||
    scope.querySelector("#ed-qa-ent")?.parentElement ||
    null;
  if (!riga) return;
  const serve = ["toggle", "script", "scene"].includes(tipo);
  riga.style.setProperty("display", serve ? "flex" : "none", "important");
}

export function decorateEditorSlots(scope = doc?.getElementById("ed-body")) {
  if (!scope) return 0;
  clarifyEntityPlaceholders();
  dropRetiredSlots(scope);
  let count = 0;
  for (const body of scope.querySelectorAll(".ed-acc-body")) if (decorateBody(body)) count += 1;
  state.pending = decorateEntityFields(scope);
  rispettaTipoAzione(scope);
  return count;
}

const MAX_RETRIES = 6;

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    let pending = 0;
    for (const scope of [
      doc?.getElementById("ed-body"),
      doc?.getElementById("editor-modal"),
      doc?.getElementById("setup-wizard"),
      ...(doc?.querySelectorAll?.(".dm-section-modal") || []),
    ].filter(Boolean)) {
      decorateEditorSlots(scope);
      pending += state.pending;
    }
    // A field whose lens has not been mounted yet gets one more frame, a
    // bounded number of times, instead of staying a bare id box for good.
    if (pending && (state.retries || 0) < MAX_RETRIES) {
      state.retries = (state.retries || 0) + 1;
      schedule();
      return;
    }
    state.retries = 0;
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
.dm-slots{display:grid!important;gap:8px!important}
.dm-slots-manual{
  justify-self:end!important;margin:0 0 2px!important;padding:6px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;
  border-radius:999px!important;background:transparent!important;color:var(--secondary-text-color,#64748b)!important;
  font-size:11.5px!important;font-weight:750!important;cursor:pointer!important
}
.dm-slots-manual[aria-pressed="true"]{
  border-color:var(--primary-color,#0ea5e9)!important;color:var(--primary-color,#0ea5e9)!important;
  background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,transparent)!important
}
.dm-slots .dm-slot{
  display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;
  margin:0!important;padding:11px 13px!important;border:1px solid var(--divider-color,#dbe4ee)!important;
  border-radius:16px!important;background:var(--card-background-color,#fff)!important
}
.dm-slots .dm-slot[data-dm-slot="mapped"]{border-color:color-mix(in srgb,#16a34a 30%,var(--divider-color,#dbe4ee))!important}
.dm-slots .dm-slot>*{grid-column:1/-1!important}
.dm-slots .dm-slot>.dm-slot-chip{grid-column:1!important}
.dm-slots .dm-slot>.dm-slot-clear{grid-column:2!important}
.dm-slots .dm-slot>.ed-slot-lbl{margin:0!important;display:flex!important;align-items:center!important;gap:8px!important}
/* Lo stesso comando della riga in piedi da sola, con lo stesso aspetto. */
.dm-slots .dm-slot>.dm-slot-clear{
  display:inline-flex!important;align-items:center!important;gap:5px!important;
  align-self:stretch!important;padding:0 10px!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:999px!important;
  background:transparent!important;color:var(--secondary-text-color,#64748b)!important;
  font-size:11.5px!important;font-weight:800!important;line-height:1!important;
  white-space:nowrap!important;cursor:pointer!important
}
.dm-slots .dm-slot>.dm-slot-clear[hidden]{display:none!important}
.dm-slots .dm-slot>.dm-slot-clear:hover{
  border-color:var(--error-color,#dc2626)!important;color:var(--error-color,#dc2626)!important
}
.dm-slots.dm-slots-raw .dm-slot>.dm-slot-clear{display:none!important}
.dm-slots .dm-slot>.ed-slot-lbl::before{
  content:"";width:7px;height:7px;border-radius:50%;flex:0 0 7px;
  background:var(--divider-color,#cbd5e1)
}
.dm-slots .dm-slot[data-dm-slot="mapped"]>.ed-slot-lbl::before{background:#16a34a}
.dm-slots .dm-slot .wz-lbl-edit{
  border:0!important;background:transparent!important;padding:0!important;width:100%!important;
  font-size:13px!important;font-weight:800!important;color:var(--text,#0f172a)!important
}
.dm-slots .dm-slot .wz-lbl-edit:focus{
  outline:2px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 45%,transparent)!important;
  outline-offset:3px!important;border-radius:6px!important
}
/* the raw field and its lens stay in the DOM: hidden until "Modifica manuale" */
.dm-slots:not(.dm-slots-raw) .dm-slot>div:has(>.ed-slot-in){display:none!important}
.dm-slots.dm-slots-raw .dm-slot>.dm-slot-chip{display:none!important}
.dm-slot-chip{
  display:flex!important;align-items:center!important;gap:10px!important;width:100%!important;
  padding:9px 11px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;
  background:var(--secondary-background-color,#f6f8fb)!important;color:var(--text,#0f172a)!important;
  font:inherit!important;text-align:left!important;cursor:pointer!important;min-width:0!important
}
.dm-slot-chip:hover{border-color:var(--primary-color,#0ea5e9)!important}
.dm-slot-chip:focus-visible{outline:2px solid var(--primary-color,#0ea5e9)!important;outline-offset:2px!important}
.dm-slot-chip-copy{display:grid!important;gap:2px!important;min-width:0!important;flex:1 1 auto!important}
.dm-slot-chip-copy b{font-size:13px!important;font-weight:750!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
.dm-slot-chip-copy small{
  font-size:10.5px!important;font-family:ui-monospace,Menlo,monospace!important;
  color:var(--secondary-text-color,#64748b)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important
}
.dm-slot[data-dm-slot="empty"] .dm-slot-chip-copy b{color:var(--secondary-text-color,#64748b)!important;font-weight:650!important}
.dm-slot-chip-go{flex:0 0 auto!important;font-size:18px!important;color:var(--secondary-text-color,#94a3b8)!important;line-height:1!important}

/* The same card the Sezioni tab gives a slot, on every other entity field.
 *
 * Home draws a slot as a card: a dot that is green once the slot is mapped, the
 * name of the field in bold, a pencil in the corner for whoever wants to type
 * an id, and the picker underneath. Every other tab drew the same three things
 * as a grey caption over a chip with a boxed pencil beside it — the same
 * information, in a different shape, so the configuration read as two products.
 * These rules give the fields outside the accordions that card. */
[data-dm-entity-chip="true"]{
  display:flex!important;flex-wrap:wrap!important;align-items:center!important;
  gap:6px 8px!important;box-sizing:border-box!important;min-width:0!important;
  margin:0 0 8px!important;padding:11px 13px!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;
  background:var(--card-background-color,#fff)!important
}
[data-dm-entity-chip="true"][data-dm-slot="mapped"]{
  border-color:color-mix(in srgb,#16a34a 30%,var(--divider-color,#dbe4ee))!important
}
[data-dm-entity-chip="true"]>.dm-chip-caption{
  order:1!important;flex:1 1 auto!important;min-width:0!important;
  display:flex!important;align-items:center!important;gap:8px!important;margin:0!important;
  font-size:13px!important;font-weight:800!important;line-height:1.25!important;
  color:var(--text,#0f172a)!important
}
[data-dm-entity-chip="true"]>.dm-chip-caption::before{
  content:"";width:7px;height:7px;border-radius:50%;flex:0 0 7px;
  background:var(--divider-color,#cbd5e1)
}
[data-dm-entity-chip="true"][data-dm-slot="mapped"]>.dm-chip-caption::before{background:#16a34a}
/* The caption this module writes follows the label the forms write: dimmer ink
   in the dark editor, the same as the label itself. */
#editor-modal[data-dm-editor-theme="dark"] .dm-chip-caption{
  color:var(--text-dim,#92a4c2)!important
}
/* I due comandi del campo, scritti. La matita da sola non diceva a cosa
   serviva, e non c'era modo di capire come si toglie un'entita' sbagliata. */
[data-dm-entity-chip="true"] .dm-chip-manual,
[data-dm-entity-chip="true"] .dm-chip-clear{
  display:inline-flex!important;align-items:center!important;gap:5px!important;
  padding:0 10px!important;border-radius:999px!important;
  font-size:11.5px!important;font-weight:800!important;line-height:1!important;
  white-space:nowrap!important;cursor:pointer!important
}
[data-dm-entity-chip="true"] .dm-chip-clear{
  order:2!important;flex:0 0 auto!important;height:36px!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;background:transparent!important;
  color:var(--secondary-text-color,#64748b)!important
}
[data-dm-entity-chip="true"] .dm-chip-clear[hidden]{display:none!important}
[data-dm-entity-chip="true"] .dm-chip-clear:hover{
  border-color:var(--error-color,#dc2626)!important;color:var(--error-color,#dc2626)!important
}
/* Il testo resta anche stretto: e' sul telefono che la matita da sola non si
   capiva, quindi nasconderlo li' sarebbe stato togliere proprio la risposta. */
@media(max-width:520px){
  [data-dm-entity-chip="true"] .dm-chip-manual,
  [data-dm-entity-chip="true"] .dm-chip-clear{padding:0 8px!important;font-size:11px!important}
}
[data-dm-entity-chip="true"] .dm-chip-manual{
  order:2!important;flex:0 0 36px!important;width:36px!important;min-width:36px!important;
  height:36px!important;padding:0!important;border:0!important;border-radius:10px!important;
  background:transparent!important;color:var(--secondary-text-color,#64748b)!important;
  font-size:15px!important;line-height:1!important;cursor:pointer!important
}
[data-dm-entity-chip="true"] .dm-chip-manual[aria-pressed="true"]{
  color:var(--primary-color,#0ea5e9)!important;
  background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important
}
[data-dm-entity-chip="true"]>.dm-entity-picker.dm-slot-chip{
  order:3!important;flex:1 1 100%!important;
  display:flex!important;align-items:center!important;gap:10px!important;
  width:100%!important;min-width:0!important;height:auto!important;min-height:44px!important;
  padding:9px 11px!important;border:1px solid var(--divider-color,#dbe4ee)!important;
  border-radius:12px!important;background:var(--secondary-background-color,#f6f8fb)!important;
  color:var(--text,#0f172a)!important;box-shadow:none!important;font:inherit!important;
  font-size:inherit!important;text-align:left!important
}
[data-dm-entity-chip="true"]>.dm-entity-picker.dm-slot-chip:hover{
  transform:none!important;filter:none!important;border-color:var(--primary-color,#0ea5e9)!important
}
/* A field whose form already prints its own label has no caption of its own:
   there the pencil shares the line with the picker instead of heading a line
   nothing else is on. */
[data-dm-entity-chip="true"][data-dm-chip-caption="false"] .dm-chip-manual{order:3!important}
[data-dm-entity-chip="true"][data-dm-chip-caption="false"]>.dm-entity-picker.dm-slot-chip{
  flex:1 1 auto!important
}
[data-dm-entity-chip="true"]:not([data-dm-entity-raw="true"])>.dm-chip-raw{display:none!important}
[data-dm-entity-chip="true"][data-dm-entity-raw="true"]>.dm-chip-raw{
  order:9!important;flex:1 1 100%!important;width:100%!important;grid-column:1/-1!important
}

/* Some forms lay their entity row out themselves — the "Aggiungi luce" form
 * pins its own two column grid and its own id'd field to display:block, which
 * outweighs the rules above and left that one row showing the raw id next to a
 * chip squeezed into a 58px column. The id is repeated so the row that carries
 * a chip is laid out by the chip's own rules wherever it is, and the raw field
 * stays behind the pencil on every tab. */
#ed-body#ed-body [data-dm-entity-chip="true"]{
  display:flex!important;flex-wrap:wrap!important;align-items:center!important;
  gap:6px 8px!important;grid-template-columns:none!important;min-width:0!important;
  margin:0 0 8px!important;padding:11px 13px!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;
  background:var(--card-background-color,#fff)!important
}
#ed-body#ed-body [data-dm-entity-chip="true"] > .dm-chip-caption{
  display:flex!important;order:1!important;flex:1 1 auto!important;grid-column:auto!important;
  width:auto!important;margin:0!important;
  font-size:13px!important;font-weight:800!important;line-height:1.25!important;
  color:var(--text,#0f172a)!important
}
#ed-body#ed-body [data-dm-entity-chip="true"]>.dm-entity-picker.dm-slot-chip{
  order:3!important;flex:1 1 100%!important;width:100%!important;min-width:0!important;
  max-width:none!important;height:auto!important;min-height:44px!important
}
#ed-body#ed-body [data-dm-entity-chip="true"] .dm-chip-manual{
  order:2!important;flex:0 0 36px!important;width:36px!important;min-width:36px!important;
  max-width:36px!important;height:36px!important;border:0!important;background:transparent!important
}
#ed-body#ed-body [data-dm-entity-chip="true"][data-dm-chip-caption="false"] .dm-chip-manual{order:3!important}
#ed-body#ed-body [data-dm-entity-chip="true"][data-dm-chip-caption="false"]>.dm-entity-picker.dm-slot-chip{
  flex:1 1 auto!important;width:auto!important
}
#ed-body#ed-body [data-dm-entity-chip="true"]:not([data-dm-entity-raw="true"])>.dm-chip-raw{display:none!important}
#ed-body#ed-body [data-dm-entity-chip="true"][data-dm-entity-raw="true"]>.dm-chip-raw{
  display:block!important;order:9!important;flex:1 1 100%!important;width:100%!important;max-width:100%!important
}

/* A form that prints its own label already has the two halves of the card —
 * the name above, the picker below — in two separate boxes. Here the label is
 * the card and the row inside it stops drawing a second one, so a field named
 * by its form and a field named by this module end up the same object. The
 * loads editor is left out: it groups its slots into coloured panels of its
 * own, and a card inside each one would be a box in a box.
 *
 * Which rows those are is written on them by markCardOwner, not asked for with
 * a :has() rule — see the note above it. */
#ed-body#ed-body .ed-slot[data-dm-entity-card]{
  display:grid!important;gap:6px!important;box-sizing:border-box!important;min-width:0!important;
  margin:0 0 8px!important;padding:11px 13px!important;
  border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;
  background:var(--card-background-color,#fff)!important
}
#ed-body#ed-body .ed-slot[data-dm-entity-card="mapped"]{
  border-color:color-mix(in srgb,#16a34a 30%,var(--divider-color,#dbe4ee))!important
}
/* The colour is deliberately absent: the label is the form's, and the dark
   editor gives it a dimmer ink than the body text. Only the shape is stated
   here. */
#ed-body#ed-body .ed-slot[data-dm-entity-card]>.ed-slot-lbl{
  display:flex!important;align-items:center!important;gap:8px!important;margin:0!important;
  font-size:13px!important;font-weight:800!important;line-height:1.25!important
}
#ed-body#ed-body .ed-slot[data-dm-entity-card]>.ed-slot-lbl::before{
  content:"";width:7px;height:7px;border-radius:50%;flex:0 0 7px;
  background:var(--divider-color,#cbd5e1)
}
#ed-body#ed-body .ed-slot[data-dm-entity-card="mapped"]>.ed-slot-lbl::before{
  background:#16a34a
}
#ed-body#ed-body .ed-slot[data-dm-entity-card]>[data-dm-entity-chip="true"]{
  margin:0!important;padding:0!important;border:0!important;background:transparent!important
}

/* The "Aggiungi luce" form pins its own children to display:block, centred and
 * full width, which broke the chip open: the name took the whole line and the
 * chevron dropped under it. The chip states its own inside layout wherever it
 * is printed. */
#ed-body#ed-body .dm-slot-chip{
  display:flex!important;flex-wrap:nowrap!important;align-items:center!important;
  gap:10px!important;text-align:left!important
}
#ed-body#ed-body .dm-slot-chip>.dm-slot-chip-copy{
  display:grid!important;flex:1 1 auto!important;width:auto!important;min-width:0!important;
  text-align:left!important
}
#ed-body#ed-body .dm-slot-chip>.dm-slot-chip-go{
  display:inline-block!important;flex:0 0 auto!important;width:auto!important
}
/* An empty slot invites, a mapped one states: same greying as the accordions,
   for the rows outside them. */
[data-dm-entity-chip="true"][data-dm-slot="empty"] .dm-slot-chip-copy b,
#ed-body#ed-body [data-dm-entity-chip="true"][data-dm-slot="empty"] .dm-slot-chip-copy b{
  color:var(--secondary-text-color,#64748b)!important;font-weight:650!important
}
#ed-body#ed-body [data-dm-entity-chip="true"] .dm-slot-chip-copy b{
  font-size:13px!important;overflow:hidden!important;text-overflow:ellipsis!important;
  white-space:nowrap!important
}
  `,
  );
}

/* The legacy entry points that print the editor.
 *
 * Attached when this module loads, and again on the ready events for the
 * opposite order — `wrapFunction` is a no-op while the legacy global is still
 * undefined, so trying twice costs nothing.
 *
 * Attaching only inside the ready handlers, as before, meant never attaching at
 * all whenever the bundle finished loading after the runtime had already
 * announced itself: the handler simply never ran. The editor then printed rows
 * that nothing scheduled a pass for, and they stayed raw entity fields until
 * the next click. `editorSwitch` carried the markers of a dozen other owners
 * and none of this one, which is what gave it away.
 *
 * Opening the editor is wrapped too, not just the tab switch: it is the moment
 * the rows appear, so it is the moment they need decorating. */
function bindLegacyEntryPoints() {
  onEditorRedraw("__dmEditorSlots_editorSwitch", schedule);
  wrapFunction("apriConfigEntita", "__dmEditorSlots_apriConfigEntita", schedule);
}

export function installEditorSlotsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  /* A panel printed after the last pass would keep the raw field and the lens:
   * the Temperatura form is drawn by its own owner and lands late on a phone.
   * Whoever notices the editor changing can ask for another pass through this,
   * so the rows follow the tab however slowly it finishes drawing. */
  root.__DASHBOARDMODERN_DECORATE_ENTITY_FIELDS__ = () => schedule();
  for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(eventName, () => {
      bindLegacyEntryPoints();
      schedule();
    });
  }
  doc.addEventListener(
    "click",
    (event) => {
      if (
        event.target?.closest?.(".ed-tab,[data-tab],.ed-acc-head,.ed-save-btn,.ed-btn-add,.ed-del")
      ) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  bindLegacyEntryPoints();
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installEditorSlotsSection, { once: true });
} else {
  installEditorSlotsSection();
}
