// DM-FIX-20260813E
import {
  ACTION_ICON_CATALOG,
  actionCatalogMatch,
  CAR_BRANDS,
  carBrandVisual,
  catalogLabel,
  directEmoji,
  LOAD_ICON_CATALOG,
  loadGlyph,
  loadCatalogMatch,
  ROOM_CATALOG,
  ROOM_GLYPHS,
  roomCatalogMatch,
  roomGlyph,
} from "../core/personalization-catalog.js";
import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { chiaviDaProvare, disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { clean, doc, esc, installStyle, root, t } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_ICON_ENGINE__";
const state = (root[KEY] ||= {
  installed: false,
  legacyBridge: null,
});

const ACTION_BUILTINS = Object.freeze({
  luci: "mdi:lightbulb",
  luci_group: "mdi:lightbulb-group",
  clima: "mdi:snowflake",
  antifurto: "mdi:shield-home",
  lavatrice: "mdi:washing-machine",
  toggle: "mdi:toggle-switch-outline",
  script: "mdi:script-text-play",
  scene: "mdi:movie-open",
  /* Un lettore fra le azioni (#269): senza la sua riga prendeva la stella di
   * ripiego, cioe' il segno di «non so cos'e' questo». */
  media: "mdi:speaker",
});

const ACTION_BUILTIN_COLORS = Object.freeze({
  luci: "#f59e0b",
  luci_group: "#f59e0b",
  clima: "#0ea5e9",
  antifurto: "#7c3aed",
  lavatrice: "#0ea5e9",
  media: "#8b5cf6",
});

function normalizeKind(value) {
  const kind = clean(value).toLowerCase();
  if (["room", "rooms", "stanza", "stanze"].includes(kind)) return "room";
  if (["car", "cars", "vehicle", "brand"].includes(kind)) return "car";
  if (["load", "loads", "carico", "carichi"].includes(kind)) return "load";
  return "action";
}

export function actionGlyph(value) {
  const token = clean(value);
  return directEmoji(token) || actionCatalogMatch(token)?.glyph || "⭐";
}

function canonicalRoomGlyph(value) {
  const token = clean(value);
  const direct = directEmoji(token);
  if (direct) return direct;
  const lower = token.toLowerCase();
  const exact = ROOM_CATALOG.find((item) => clean(item.mdi).toLowerCase() === lower);
  return ROOM_GLYPHS[exact?.id] || roomGlyph(token);
}

export function iconGlyph(kind, value) {
  const normalized = normalizeKind(kind);
  if (normalized === "room") return canonicalRoomGlyph(value);
  if (normalized === "load") return loadGlyph(value);
  if (normalized === "action") return actionGlyph(value);
  return "🚘";
}

function glyphClass(kind) {
  return normalizeKind(kind) === "room" ? "dm-beta12-room-glyph" : "dm-beta12-action-glyph";
}

/* Il disegno di casa, prima dell'emoji.
 *
 * Le stanze, le azioni e i carichi uscivano a emoji: quelle del sistema, che
 * cambiano faccia da un telefono a un altro e nella stessa schermata stavano
 * accanto alla scocca blu notte degli elettrodomestici. Tre stili in una
 * pagina sola. Adesso si guarda prima in casa: il disegno dell'elettrodomestico
 * se quella cosa e' un elettrodomestico, altrimenti quello del catalogo — che
 * e' fatto con la stessa tavolozza. L'emoji resta il ripiego per un valore che
 * non conosciamo, e nel catalogo di serie non ce n'e' piu' nessuno. */
function disegnoDiCasa(kind, token, size) {
  /* Il selettore passa il nome mdi della voce — `mdi:sofa`, `mdi:teddy-bear` —
   * e i disegni hanno il nome della voce, non quello di mdi. Si chiede al
   * catalogo di che voce si tratta, e si provano i nomi che quella voce puo'
   * avere: cosi' il nome mdi resta quello che si salva, e il disegno non deve
   * conoscerlo. */
  const voce =
    kind === "room"
      ? roomCatalogMatch(token)
      : kind === "load"
        ? loadCatalogMatch(token)
        : actionCatalogMatch(token);
  for (const chiave of chiaviDaProvare(kind, token, voce)) {
    const elettrodomestico = canonicalArtworkType(chiave);
    if (elettrodomestico) return applianceArtwork(elettrodomestico, size);
    const disegno = disegnoDelCatalogo(chiave, size);
    if (disegno) return disegno;
  }
  return "";
}

function misuraSicura(size) {
  return Math.max(18, Math.min(72, Number(size) || 38));
}

/* La firma dice, in una riga, che cosa c'e' dentro quel posto: quale famiglia,
 * quale voce, quanto grande e se e' un disegno o una lettera. La si scrive
 * addosso al glifo perche' e' il glifo a poter sparire — se il vecchio runtime
 * riscrive la scheda, la firma se ne va con lui e il motore ridisegna. */
function firmaDelGlifo(kind, token, size, disegnato) {
  return `${kind}|${token}|${misuraSicura(size)}|${disegnato ? "disegno" : "lettera"}`;
}

/* Il disegno si cerca una volta sola: serve sia per scrivere il glifo sia per
 * sapere, subito dopo, se quello gia' scritto e' ancora quello giusto. */
function glifoDaScrivere(normalized, token, size) {
  const disegno = disegnoDiCasa(normalized, token, size);
  const firma = esc(firmaDelGlifo(normalized, token, size, Boolean(disegno)));
  const testa = `<span class="dm-icon-engine-glyph ${glyphClass(normalized)}" data-dm-icon-engine-glyph="${normalized}" data-token="${esc(token)}" data-dm-firma="${firma}"`;
  if (disegno)
    return { disegnato: true, markup: `${testa} data-dm-disegno="casa">${disegno}</span>` };
  const glyph = iconGlyph(normalized, token);
  return {
    disegnato: false,
    markup: `${testa} style="font-size:${misuraSicura(size)}px"><span aria-hidden="true">${esc(glyph)}</span></span>`,
  };
}

export function iconGlyphMarkup(kind, value, { size = 38 } = {}) {
  const normalized = normalizeKind(kind);
  if (normalized === "car") return carBrandVisual(value, size);
  const token = clean(value || (normalized === "room" ? "mdi:home" : "mdi:star"));
  return glifoDaScrivere(normalized, token, size).markup;
}

/* Ridisegnare costa, e ridisegnare a vuoto costa e basta: chi guarda la scheda
 * vede una modifica, richiama il motore, e si ricomincia. Prima il confronto
 * era sul testo del glifo — con l'emoji funzionava, col disegno il testo e'
 * vuoto e il paragone non tornava mai: il motore riscriveva a ogni giro e la
 * pagina non ne usciva piu'. Adesso si confronta la firma, che vale per
 * entrambi. */
function exactGlyph(target, kind, token, size, disegnato) {
  const normalized = normalizeKind(kind);
  const child = target?.children?.length === 1 ? target.firstElementChild : null;
  return Boolean(
    child &&
      child.classList.contains("dm-icon-engine-glyph") &&
      child.classList.contains(glyphClass(normalized)) &&
      clean(child.dataset.token) === token &&
      child.dataset.dmFirma === firmaDelGlifo(normalized, token, size, disegnato),
  );
}

export function renderIconGlyph(target, kind, value, { size = 38 } = {}) {
  if (!target) return false;
  const normalized = normalizeKind(kind);
  if (normalized === "car") {
    const markup = iconGlyphMarkup("car", value, { size });
    const signature = `car|${clean(value)}|${size}`;
    if (target.dataset.dmIconEngineSignature !== signature || target.innerHTML !== markup) {
      target.innerHTML = markup;
      target.dataset.dmIconEngineSignature = signature;
    }
    target.dataset.dmIconEngineOwner = "single";
    return true;
  }
  const token = clean(value || (normalized === "room" ? "mdi:home" : "mdi:star"));
  const glyph = iconGlyph(normalized, token);
  const { markup, disegnato } = glifoDaScrivere(normalized, token, size);
  const signature = `${normalized}|${token}|${glyph}|${size}`;
  if (!exactGlyph(target, normalized, token, size, disegnato)) target.innerHTML = markup;
  target.dataset.dmIconEngineSignature = signature;
  target.dataset.dmIconEngineOwner = "single";
  target.dataset.dmIconEngineGlyphValue = glyph;
  target.style.setProperty("--dm-icon-engine-glyph-size", `${misuraSicura(size)}px`);
  target.dataset.dmSingleGlyphOwner = "true";
  target.dataset.dmBeta12Colored = "true";
  target.dataset.dmBeta12DisplayGlyph = glyph;
  return true;
}

function rowsFor(kind) {
  const normalized = normalizeKind(kind);
  if (normalized === "car") {
    return CAR_BRANDS.map((item) => ({
      value: item.name,
      label: item.name,
      search: item.name.toLowerCase(),
      visual: iconGlyphMarkup("car", item.name, { size: 48 }),
    }));
  }
  if (normalized === "room") {
    return ROOM_CATALOG.map((item) => ({
      value: item.mdi,
      label: catalogLabel(item),
      search: `${item.it} ${item.en} ${item.keywords} ${item.mdi}`.toLowerCase(),
      glyph: ROOM_GLYPHS[item.id] || canonicalRoomGlyph(item.mdi),
      size: 31,
      visual: iconGlyphMarkup("room", item.mdi, { size: 31 }),
    }));
  }
  if (normalized === "load") {
    return LOAD_ICON_CATALOG.map((item) => ({
      value: item.mdi,
      label: catalogLabel(item),
      search: `${item.it} ${item.en} ${item.keywords} ${item.id} ${item.mdi}`.toLowerCase(),
      glyph: item.glyph,
      size: 36,
      group:
        item.group === "room"
          ? t("Aree della casa", "Areas of the home")
          : t("Apparecchi e impianti", "Appliances and plants"),
      visual: iconGlyphMarkup("load", item.mdi, { size: 36 }),
    }));
  }
  return ACTION_ICON_CATALOG.map((item) => ({
    value: item.mdi,
    label: catalogLabel(item),
    search: `${item.it} ${item.en} ${item.id} ${item.mdi}`.toLowerCase(),
    glyph: item.glyph || actionGlyph(item.mdi),
    size: 36,
    visual: iconGlyphMarkup("action", item.mdi, { size: 36 }),
  }));
}

function pickerCopy(kind) {
  const normalized = normalizeKind(kind);
  if (normalized === "car") {
    return {
      icon: "🚘",
      title: t("Scegli il brand auto", "Choose car brand"),
      placeholder: t("Cerca brand…", "Search brand…"),
    };
  }
  if (normalized === "room") {
    return {
      icon: "😀",
      title: t("Scegli l'icona", "Choose icon"),
      placeholder: t("Cerca (es. acqua, porta, fuoco)…", "Search (e.g. water, door, fire)…"),
    };
  }
  if (normalized === "load") {
    return {
      icon: "🔌",
      title: t("Scegli icona del carico", "Choose load icon"),
      placeholder: t("Cerca (es. cucina, forno, garage)…", "Search (e.g. kitchen, oven, garage)…"),
    };
  }
  return {
    icon: "⚡",
    title: t("Scegli icona azione", "Choose action icon"),
    placeholder: t("Cerca…", "Search…"),
  };
}

export function closeIconPicker() {
  for (const id of [
    "dm-visual-picker",
    "dm-icon-picker",
    "dm-beta6-quick-icon-picker",
    "dm-beta9-action-picker",
    "dm-beta5-room-picker",
  ]) {
    doc?.getElementById(id)?.remove();
  }
}

function pointerCanAutofocus() {
  try {
    return Boolean(root.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches);
  } catch (_error) {
    return false;
  }
}

function optionMarkup(item, index, kind) {
  const owned =
    kind === "car"
      ? ""
      : ` data-dm-icon-engine-owner="single" data-dm-icon-engine-glyph-value="${esc(item.glyph)}" style="--dm-icon-engine-glyph-size:${item.size}px"`;
  const label = kind === "room" ? "" : `<b>${esc(item.label)}</b>`;
  return `<button type="button" class="dm-picker-option${kind === "room" ? " dm-beta17-room-option" : ""}" data-index="${index}" data-search-text="${esc(item.search)}" aria-label="${esc(item.label)}" title="${esc(item.label)}"><span class="dm-picker-visual"${owned}>${item.visual}</span>${label}</button>`;
}

/* One tile per catalogue entry, with a heading wherever the group changes: a
 * catalogue long enough to cover a whole house buries what is being looked for
 * if it is drawn as one flat grid. Catalogues without groups are unchanged. */
function gridMarkup(rows, kind) {
  const parts = [];
  let group = "";
  rows.forEach((item, index) => {
    if (item.group && item.group !== group) {
      group = item.group;
      parts.push(`<h4 class="dm-picker-group">${esc(group)}</h4>`);
    }
    parts.push(optionMarkup(item, index, kind));
  });
  return parts.join("");
}

/* A heading whose whole group was filtered out would otherwise sit above the
 * next group's tiles and mislabel them. */
function syncPickerGroups(modal) {
  const grid = modal.querySelector(".dm-picker-grid");
  if (!grid) return;
  let heading = null;
  let visible = 0;
  for (const node of [...grid.children]) {
    if (node.classList.contains("dm-picker-group")) {
      if (heading) heading.hidden = visible === 0;
      heading = node;
      visible = 0;
      continue;
    }
    if (!node.hidden) visible += 1;
  }
  if (heading) heading.hidden = visible === 0;
}

export function openIconPicker(input, kind = "action", options = {}) {
  if (!doc || !input) return false;
  const normalized = normalizeKind(kind);
  closeIconPicker();
  const rows = rowsFor(normalized);
  const copy = pickerCopy(normalized);
  const modal = doc.createElement("div");
  modal.id = "dm-visual-picker";
  modal.className = `dm-section-modal dm-visual-picker dm-icon-engine-picker dm-icon-engine-${normalized}-picker`;
  modal.dataset.kind = normalized;
  modal.dataset.dmIconEngine = "single-owner";
  modal.dataset.dmSingleGlyphOwner = "true";
  modal.dataset.dmBeta17Picker = normalized;
  modal.dataset.dmBeta12Colored = "true";
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>${copy.icon} ${copy.title}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${esc(copy.placeholder)}" data-search></div><div class="dm-picker-grid">${gridMarkup(rows, normalized)}</div></section>`;
  doc.body.append(modal);

  const close = () => modal.remove();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  const search = modal.querySelector("[data-search]");
  search?.addEventListener("input", () => {
    const query = clean(search.value).toLowerCase();
    modal.querySelectorAll(".dm-picker-option").forEach((button) => {
      button.hidden = Boolean(query) && !clean(button.dataset.searchText).includes(query);
    });
    syncPickerGroups(modal);
  });
  modal.querySelectorAll(".dm-picker-option").forEach((button) => {
    button.addEventListener("click", () => {
      const item = rows[Number(button.dataset.index)];
      if (!item) return;
      /* Di norma si scrive il nome del disegno (`mdi:…`), che tutta la
       * plancia sa dipingere. Dove il consumatore stampa la casella come
       * testo nudo si scrive il segno: la scelta resta la stessa voce del
       * catalogo, cambia solo come la si consegna. */
      input.value = options.glifo === true ? item.glyph || item.value : item.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close();
    });
  });

  const autofocus = options.autofocus === true || (options.autofocus !== false && pointerCanAutofocus());
  if (autofocus) root.requestAnimationFrame?.(() => search?.focus({ preventScroll: true }));
  return true;
}

function quickActionsFromRuntime() {
  try {
    const stored = JSON.parse(root.localStorage?.getItem("cd_quick_actions") || "[]");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch (_error) {}
  try {
    const values = root.getQuickActions?.();
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function actionBuiltinKey(action = {}) {
  return clean(action.builtin || action.type).replace(/^builtin_/, "").toLowerCase();
}

function actionToken(action = {}) {
  const configured = clean(action.icon);
  if (configured) return configured;
  return ACTION_BUILTINS[actionBuiltinKey(action)] || "mdi:star";
}

/* Il nome mdi non e' un'etichetta.
 *
 * Il guscio, in qualche riga della scheda, stampa il valore dell'icona come
 * testo: accanto al simbolo si leggeva «mdi:lightbulb-group». Si svuotano
 * quelle caselle — solo quelle che contengono esattamente un nome mdi, o il
 * valore salvato per quella riga — e mai il nome leggibile, che sta in
 * `.ed-row-main`: un'azione chiamata come la sua icona deve poter tenere il
 * suo nome. */
function nascondiIlNomeMdi(row, token) {
  row?.querySelectorAll?.("span,div,b,strong,small").forEach((node) => {
    if (node.children.length) return;
    if (node.closest?.(".ed-row-main")) return;
    const text = clean(node.textContent);
    if (/^mdi:[a-z0-9-]+$/i.test(text) || (token && text === token)) {
      node.textContent = "";
      node.classList.add("dm-beta7-hidden-mdi-text");
    }
  });
}

/* Il campo icona della scheda Azioni, dal tasto al valore che si salva.
 *
 * La casella `#ed-qa-icon` la stampa il guscio come campo di testo: ci si
 * scriveva dentro il nome dell'icona a mano. Il tasto che al suo posto apre il
 * catalogo — `.dm-beta6-qa-icon-trigger` — lo costruiva un altro modulo, che
 * pero' per aprirlo, per disegnarci dentro il segno e per ridisegnarlo a ogni
 * battuta chiamava gia' questo motore: chi costruiva il tasto e chi lo faceva
 * funzionare stavano in due file diversi. Adesso e' uno solo.
 *
 * Le due tabelle dicono, per ogni voce della tendina del tipo, che segno e che
 * nome mdi le competono: servono a rimettere il valore nella forma portatile
 * (il segno, non `mdi:...`, perche' chi lo stampa altrove lo stampa come testo
 * nudo) e a cambiare il valore di serie quando si cambia tipo, ma solo se
 * quello scritto e' ancora quello di serie di prima. */
const AZIONE_DI_SERIE = Object.freeze({
  luci_group: { glyph: "💡", mdi: "mdi:lightbulb-group" },
  builtin_luci: { glyph: "💡", mdi: "mdi:lightbulb-group" },
  builtin_clima: { glyph: "❄️", mdi: "mdi:snowflake" },
  builtin_antifurto: { glyph: "🛡️", mdi: "mdi:shield-home" },
  builtin_lavatrice: { glyph: "🧺", mdi: "mdi:washing-machine" },
  toggle: { glyph: "🔀", mdi: "mdi:toggle-switch-outline" },
  script: { glyph: "▶️", mdi: "mdi:script-text-play" },
  scene: { glyph: "🎬", mdi: "mdi:movie-open" },
});

const azioneDiSerie = (type) => AZIONE_DI_SERIE[clean(type)] || { glyph: "⭐", mdi: "mdi:star" };

function azionePortatile(value, type) {
  const token = clean(value);
  const serie = azioneDiSerie(type);
  if (!token || token === "⚡") return serie.glyph;
  if (!token.startsWith("mdi:")) return token;
  return ACTION_ICON_CATALOG.find((item) => item.mdi === token)?.glyph || serie.glyph;
}

function decoraRigaFormAzione() {
  const type = doc?.getElementById?.("ed-qa-type");
  const input = doc?.getElementById?.("ed-qa-icon");
  if (!type || !input) return false;
  const row = input.closest?.(".ed-form-row") || type.closest?.(".ed-form-row");
  if (!row) return false;
  // La forma della riga: tipo e icona sopra, nome sotto.
  row.dataset.dmBeta6QuickAction = "true";
  row.classList.add("dm-beta7-action-form-row");
  let trigger = row.querySelector(".dm-beta6-qa-icon-trigger");
  if (!trigger) {
    trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.className = "dm-beta6-qa-icon-trigger";
    trigger.setAttribute("aria-label", t("Scegli icona azione", "Choose action icon"));
    input.insertAdjacentElement("afterend", trigger);
  }
  trigger.title = t("Scegli icona", "Choose icon");
  const serie = azioneDiSerie(type.value);
  const corrente = clean(input.value);
  const portatile = azionePortatile(corrente, type.value);
  if (portatile !== corrente) input.value = portatile;
  if (!input.dataset.dmBeta7DefaultGlyph) input.dataset.dmBeta7DefaultGlyph = serie.glyph;
  input.classList.add("dm-beta6-qa-icon-value");
  if (type.dataset.dmBeta7IconBound !== "true") {
    type.dataset.dmBeta7IconBound = "true";
    type.addEventListener("change", () => {
      const precedente = clean(input.dataset.dmBeta7DefaultGlyph);
      const prossimo = azioneDiSerie(type.value);
      const scritto = clean(input.value);
      if (!scritto || scritto === precedente || scritto === "⚡") input.value = prossimo.glyph;
      input.dataset.dmBeta7DefaultGlyph = prossimo.glyph;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  renderIconGlyph(trigger, "action", input.value, { size: 32 });
  return true;
}

function actionColor(action = {}) {
  return clean(action.color) || ACTION_BUILTIN_COLORS[actionBuiltinKey(action)] || "#0ea5e9";
}

export function syncQuickActionIcons() {
  if (!doc) return false;
  const actions = quickActionsFromRuntime();
  const nodes = [...doc.querySelectorAll("#qa-grid .qa-btn .icon")];
  nodes.forEach((target, index) => {
    const action = actions[index] || {};
    const token = actionToken(action);
    const color = actionColor(action);
    renderIconGlyph(target, "action", token, { size: 42 });
    target.dataset.dmActionStyle = "icon-engine";
    target.style.setProperty("color", color, "important");
    target.style.setProperty("filter", `drop-shadow(0 6px 12px ${color}4d)`, "important");
  });
  return nodes.length > 0;
}

/* Le superfici da decorare stanno tutte dentro una scheda o una finestra di
 * modifica. Nessuna delle tre e' nel documento finche' non le si apre — il
 * runtime le crea e le toglie — quindi qui non c'e' niente da fare, e prima ci
 * si passava lo stesso a ogni giro di stati: quattro giri del documento e una
 * lettura della configurazione per non trovare mai nulla. */
function superficiDaDecorare() {
  return Boolean(
    doc?.getElementById?.("ed-body") ||
      doc?.getElementById?.("editor-modal") ||
      doc?.getElementById?.("dm-action-editor-modal") ||
      doc?.getElementById?.("dm-room-editor-modal"),
  );
}

export function syncEditorIconSurfaces() {
  if (!doc || !superficiDaDecorare()) return false;
  let changed = false;
  const actionModal = doc.getElementById("dm-action-editor-modal");
  const actionInput = actionModal?.querySelector('input[name="icon"]');
  const actionPreview = actionModal?.querySelector("[data-action-icon-preview]");
  if (actionInput && actionPreview) {
    renderIconGlyph(actionPreview, "action", actionInput.value, { size: 38 });
    changed = true;
  }
  const roomModal = doc.getElementById("dm-room-editor-modal");
  const roomInput = roomModal?.querySelector('input[name="icon"]');
  const roomPreview = roomModal?.querySelector("[data-room-icon-preview]");
  if (roomInput && roomPreview) {
    renderIconGlyph(roomPreview, "room", roomInput.value, { size: 38 });
    changed = true;
  }
  const actions = quickActionsFromRuntime();
  doc.querySelectorAll('#ed-body [data-dm-edit-kind="action"][data-dm-edit-index]').forEach((edit) => {
    const row = edit.closest(".ed-row");
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    if (!row || index < 0) return;
    let target = row.querySelector(".dm-beta7-existing-action-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-beta7-existing-action-icon";
      row.prepend(target);
    }
    /* La riga di un'azione gia' configurata ha quattro colonne — simbolo,
     * nome, matita, cestino — e la classe e' quello che le accende. La
     * metteva un altro modulo, che poi ridisegnava anche il simbolo con un
     * markup diverso da questo: due pitture sullo stesso posto. La forma
     * della riga viene qui, dove il simbolo si disegna una volta sola. */
    row.classList.add("dm-beta7-action-row");
    nascondiIlNomeMdi(row, clean(actions[index]?.icon));
    renderIconGlyph(target, "action", actionToken(actions[index] || {}), { size: 29 });
    changed = true;
  });
  let rooms = [];
  try {
    // Read-only: the shared view, so opening the editor does not deep copy the
    // rooms on every pass of the icon surfaces.
    const iconStore = root.DashboardModernModules?.store;
    rooms = (iconStore?.peekSection ? iconStore.peekSection("rooms") : iconStore?.getSection?.("rooms")) || [];
  } catch (_error) {}
  if (!Array.isArray(rooms) || !rooms.length) {
    try {
      rooms = JSON.parse(root.localStorage?.getItem("cd_stanze") || "[]");
    } catch (_error) {
      rooms = [];
    }
  }
  doc.querySelectorAll('#ed-body [data-dm-edit-kind="room"][data-dm-edit-index]').forEach((edit) => {
    const row = edit.closest(".ed-row");
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const room = index >= 0 ? rooms[index] : null;
    if (!row || !room) return;
    let target = row.querySelector(":scope > .dm-room-list-icon");
    if (!target) {
      target = doc.createElement("span");
      target.className = "dm-room-list-icon";
      row.prepend(target);
    }
    const token = clean(room.icon || room.name || "mdi:home");
    target.dataset.roomIcon = token;
    renderIconGlyph(target, "room", token, { size: 31 });
    changed = true;
  });
  doc.querySelectorAll(".dm-temperature-card[data-room-id]").forEach((card) => {
    const room = rooms.find((item) => clean(item?.id) === clean(card.dataset.roomId));
    const target = card.querySelector(".dm-temperature-card-icon");
    if (!room || !target) return;
    renderIconGlyph(target, "room", room.icon || room.name || "mdi:home", { size: 29 });
    changed = true;
  });
  if (decoraRigaFormAzione()) changed = true;
  return changed;
}

let editorSyncQueued = false;

function scheduleEditorIconSurfaces() {
  if (editorSyncQueued) return;
  editorSyncQueued = true;
  const run = () => {
    editorSyncQueued = false;
    syncEditorIconSurfaces();
  };
  if (typeof root.queueMicrotask === "function") root.queueMicrotask(run);
  else Promise.resolve().then(run);
}

function scheduleEditorSyncAfterClick(event) {
  if (!event.target?.closest?.(
    '[data-dm-edit-kind="action"],[data-dm-edit-kind="room"],#dm-action-editor-modal,#dm-room-editor-modal,.dm-beta5-room-icon-trigger,.dm-beta6-qa-icon-trigger',
  )) return;
  scheduleEditorIconSurfaces();
}

function inputForLegacyButton(button) {
  const targetId = clean(button?.dataset?.iconTarget || button?.dataset?.entityTarget);
  return (
    (targetId && doc.getElementById(targetId)) ||
    button?.closest?.(".dm-icon-field,.ed-form-row")?.querySelector?.("input.ed-icon-input,input") ||
    button?.previousElementSibling ||
    null
  );
}

function activationFor(target) {
  if (!target?.closest) return null;
  if (target.closest(".dm-beta5-room-icon-trigger")) {
    return { input: doc.getElementById("ed-room-icon"), kind: "room" };
  }
  if (target.closest(".dm-beta6-qa-icon-trigger")) {
    return { input: doc.getElementById("ed-qa-icon"), kind: "action" };
  }
  const roomPreview = target.closest("#dm-room-editor-modal [data-room-icon-preview]");
  if (roomPreview) {
    return {
      input: roomPreview.closest("#dm-room-editor-modal")?.querySelector('input[name="icon"]'),
      kind: "room",
    };
  }
  const actionPreview = target.closest("#dm-action-editor-modal [data-action-icon-preview]");
  if (actionPreview) {
    return {
      input: actionPreview.closest("#dm-action-editor-modal")?.querySelector('input[name="icon"]'),
      kind: "action",
    };
  }
  const brandPreview = target.closest("[data-brand-preview]");
  if (brandPreview) {
    return {
      input: brandPreview.closest("[data-ev-appearance]")?.querySelector("select[data-brand]"),
      kind: "car",
    };
  }
  const legacy = target.closest("button.dm-icon-picker,.dm-icon-preview-button");
  if (legacy) {
    const input = inputForLegacyButton(legacy);
    if (!input || input.id === "ed-avv-icon" || legacy.dataset.iconCategory === "alerts") return null;
    const category = clean(legacy.dataset.iconCategory || input.dataset?.iconCategory);
    const hint = `${category} ${input.id || ""} ${legacy.title || ""}`;
    // A Report entry is about an appliance, so it opens the appliance icons —
    // it used to open the quick action ones, which are a different set entirely
    // and had nothing to do with the row that was tapped.
    if (legacy.closest(".dm-report-icon,[data-energy-panel='report']") || /report/i.test(hint)) {
      return { input, kind: "load" };
    }
    return { input, kind: /room|stanza|rooms/i.test(hint) ? "room" : "action" };
  }
  return null;
}

function handleActivation(event) {
  if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
  const activation = activationFor(event.target);
  if (!activation?.input) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openIconPicker(activation.input, activation.kind, {
    autofocus: event.type === "keydown" ? true : undefined,
  });
}

function wrapAfter(name, marker, callback) {
  const current = root[name];
  if (typeof current !== "function" || current[marker]) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") result.finally(callback);
    else callback();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

/* L'icona della finestra di conferma (#320).
 *
 * «Azioni rapide: quando si utilizza la domanda nella schermata non e'
 * visibile l'icona impostata, ma solo il testo di configurazione.»
 *
 * `confermaAzione` scrive quell'icona con `setTxt`, cioe' come TESTO: quando
 * le icone erano emoji andava bene, da quando si scelgono dal catalogo il
 * valore salvato e' il nome mdi — e nella finestra ci finiva scritto
 * «mdi:gate» a caratteri cubitali, mentre la tessera della stessa azione, che
 * passa di qui, il cancello lo disegnava.
 *
 * La regola e' quella di sempre: dove si mostra un'icona la disegna il
 * motore. Le porte della Sicurezza avevano una pezza loro — sostituivano il
 * nome mdi con un'emoji generica prima di chiamare la finestra — e adesso non
 * serve piu': ognuna torna a mostrare la sua. */
function disegnaIconaDellaConferma() {
  const bersaglio = doc?.getElementById?.("confirm-icon");
  if (!bersaglio) return false;
  /* Vince sempre quello che il guscio ha appena scritto: e' l'icona di QUESTA
   * domanda. Il ricordo serve solo quando li' non c'e' testo — cioe' quando a
   * occupare il posto c'e' gia' un disegno nostro, che di testo non ne ha —
   * altrimenti alla seconda domanda si ridisegnerebbe l'icona della prima. */
  const scritto = clean(bersaglio.textContent);
  const token = scritto || clean(bersaglio.dataset.dmToken);
  if (!token) return false;
  bersaglio.dataset.dmToken = token;
  return renderIconGlyph(bersaglio, "action", token, { size: 34 });
}

function installRenderOwners() {
  wrapAfter("buildQuickActions", "__dmIconEngineQuickActions", syncQuickActionIcons);
  wrapAfter("render", "__dmIconEngineRender", syncQuickActionIcons);
  wrapAfter("editorSwitch", "__dmIconEngineEditor", scheduleEditorIconSurfaces);
  /* Cambiare tipo o salvare un'azione rifa' la riga e il suo campo icona:
   * erano due degli agganci del modulo delle regressioni, che di quella riga
   * scriveva la forma. */
  wrapAfter("edQaTypeChanged", "__dmIconEngineQaType", scheduleEditorIconSurfaces);
  wrapAfter("edAddQA", "__dmIconEngineQaSave", scheduleEditorIconSurfaces);
  wrapAfter("confermaAzione", "__dmIconEngineConferma", disegnaIconaDellaConferma);
}

/* I campi icona che il guscio si serviva da solo, e che catalogo vogliono.
 *
 * «A qualsiasi parte viene richiesta una icona deve puntare sempre ed
 * esclusivamente al nostro catalogo»: queste caselle aprivano `wzPickIcon`,
 * cioe' una griglia piatta di emoji di sistema (CD_EMOJI_SET) che col
 * catalogo di casa non c'entra niente — stanze e piani con una tavolozza,
 * il resto della plancia con un'altra. Ora ognuna apre il catalogo unico,
 * nella famiglia che le compete. */
const CAMPI_DEL_GUSCIO = Object.freeze({
  "ed-st-icon": { kind: "room" },
  "ed-st2-icon": { kind: "room" },
  "wz-st-icon": { kind: "room" },
  /* Il piano scrive il segno, non il nome mdi: le linguette dei piani in
   * Temperature stampano l'icona come testo nudo (`${fIco} ${f}`), quindi un
   * «mdi:home» ci finirebbe scritto per esteso. Il catalogo e' lo stesso, e'
   * il consumatore che sa leggere una cosa sola. */
  "ed-st2-flicon": { kind: "room", glifo: true },
  "ed-rep2-icon": { kind: "load" },
});

function installLegacyBridge() {
  const bridge = (target, category = "") => {
    const input =
      typeof target === "string" ? doc?.querySelector?.(target) : target instanceof Element ? target : null;
    if (!input) return false;
    return openIconPicker(input, normalizeKind(category || input.dataset?.iconCategory || "action"), {
      autofocus: false,
    });
  };
  bridge.__dmIconEngineBridge = true;
  state.legacyBridge = bridge;
  root.dmIconPicker = bridge;
  hijackLegacyIconPicker(bridge);
}

/** Il selettore emoji del guscio passa di qui: stessa firma, stesso punto di
 * chiamata (gli `onclick` scritti nel markup), catalogo diverso. Se il campo
 * non si trova si torna all'originale, che almeno qualcosa apre. */
function hijackLegacyIconPicker(bridge) {
  const originale = root.wzPickIcon;
  if (typeof originale === "function" && originale.__dmIconEngineLegacy) return false;
  function scegliDalCatalogo(target) {
    const input =
      typeof target === "string" ? doc?.querySelector?.(target) : target instanceof Element ? target : null;
    if (!input) {
      if (typeof originale === "function") return originale.call(this, target);
      return false;
    }
    /* La griglia emoji del guscio resta aperta se qualcuno l'ha gia' alzata:
     * due finestre sovrapposte sarebbero peggio di una sbagliata. */
    doc?.getElementById?.("cd-icon-picker")?.remove();
    const campo = CAMPI_DEL_GUSCIO[input.id];
    if (!campo) return bridge(input, input.dataset?.iconCategory || "action");
    return openIconPicker(input, campo.kind, { autofocus: false, glifo: campo.glifo === true });
  }
  scegliDalCatalogo.__dmIconEngineLegacy = true;
  scegliDalCatalogo.__dmPrevious = originale;
  root.wzPickIcon = scegliDalCatalogo;
  return true;
}

function installStyles() {
  installStyle(
    "dm-icon-engine-style",
    `
      /* Nel cerchio della conferma il disegno prende il colore della finestra,
         che il guscio scrive in --cf-rgb: senza, resterebbe del colore di
         serie mentre il cerchio intorno e' del colore dell'azione. */
      #confirm-icon{display:grid!important;place-items:center!important;width:38px!important;height:38px!important;color:rgb(var(--cf-rgb,14,165,233))!important}
      #confirm-icon .dm-icon-engine-glyph{color:inherit!important}
      .dm-icon-engine-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important}
      .dm-icon-engine-glyph>span{display:block!important;line-height:1!important}
      [data-dm-icon-engine-owner="single"][data-dm-icon-engine-glyph-value]{position:relative!important;color:initial!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"]{z-index:100040!important}
      /* Il dialogo dei picker ha TRE figli — testata, ricerca, griglia — ma il
       * guscio dei dialoghi di sezione ne prevede due (auto minmax(0,1fr)) ad
       * altezza fissa: la riga elastica finiva alla RICERCA e la griglia
       * cascava in fondo, con un vuoto enorme in mezzo — cercando, l'unica
       * icona trovata restava in basso invece di salire in testa. Qui le righe
       * giuste e l'altezza a contenuto: i risultati stanno sotto la ricerca. */
      .dm-section-modal .dm-section-dialog.dm-picker-dialog{height:auto!important;grid-template-rows:auto auto minmax(0,1fr)!important;align-content:start!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-dialog{width:min(820px,calc(100vw - 22px))!important;max-height:min(88dvh,800px)!important;overflow:hidden!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-search{padding:12px 18px 8px!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-search .ed-input{width:100%!important;box-sizing:border-box!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-grid{display:grid!important;gap:8px!important;padding:6px 16px 18px!important;max-height:60dvh!important;overflow:auto!important;overscroll-behavior:contain!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="room"] .dm-picker-grid{grid-template-columns:repeat(7,minmax(0,1fr))!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="action"] .dm-picker-grid,
      #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="load"] .dm-picker-grid,
      #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="car"] .dm-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-group{grid-column:1/-1!important;margin:10px 2px 2px!important;font-size:11px!important;font-weight:900!important;letter-spacing:1.2px!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-group:first-child{margin-top:0!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-group[hidden]{display:none!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-option{box-sizing:border-box!important;min-width:0!important;min-height:94px!important;padding:9px 6px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:15px!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--text,#0f172a)!important;transform:none!important;transition:border-color .12s ease,box-shadow .12s ease!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="room"] .dm-picker-option{min-height:54px!important;padding:5px!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-option[hidden]{display:none!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-option:focus-visible{outline:2px solid var(--primary-color,#0ea5e9)!important;outline-offset:2px!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-visual{display:grid!important;place-items:center!important;min-width:0!important;min-height:44px!important;color:initial!important}
      #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-option b{font-size:12px!important;line-height:1.15!important;text-align:center!important;white-space:normal!important}
      @media (hover:none),(pointer:coarse){
        .dm-visual-trigger,.dm-icon-preview-button,.dm-picker-option,.dm-beta6-qa-icon-trigger{transition:none!important;transform:none!important}
      }
      @media(max-width:560px){
        #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-dialog{width:calc(100vw - 12px)!important;max-height:92dvh!important}
        #dm-visual-picker[data-dm-icon-engine="single-owner"] .dm-picker-grid{padding:5px 9px 14px!important;gap:6px!important;max-height:64dvh!important}
        #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="room"] .dm-picker-option{min-height:48px!important;border-radius:12px!important}
        #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="action"] .dm-picker-option,
        #dm-visual-picker[data-dm-icon-engine="single-owner"][data-kind="load"] .dm-picker-option{min-height:92px!important;border-radius:14px!important}
      }

      /* ── Da qui in giu': fogli di moduli che se ne sono andati ──────────
       *
       * Le regole che seguono stavano in fogli separati, installati DOPO
       * questo, e alcune vincono contro quelle qui sopra per solo ordine di
       * cascata — a pari specificita' vince l'ultima. Stanno quindi in fondo,
       * e nell'ordine in cui quei fogli si installavano: prima le regressioni
       * della scheda Azioni, poi la faccia dei glifi. Spostarle piu' su
       * cambierebbe quello che si vede. */

      /* Il campo icona della scheda Azioni: la casella di testo del guscio
         sparisce e al suo posto si vede il tasto che apre il catalogo. Le
         misure qui sono quelle di ripiego — dentro #editor-modal le
         sovrascrivono, per specificita', le tre regole del blocco successivo. */
      .ed-form-row[data-dm-beta6-quick-action="true"]{display:grid!important;grid-template-columns:minmax(150px,1.25fr) 58px minmax(130px,1fr)!important;gap:8px!important;width:100%!important}
      .ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-type,.ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-name{width:100%!important;min-width:0!important;margin:0!important}
      #ed-qa-icon.dm-beta6-qa-icon-value{display:none!important}
      .dm-beta6-qa-icon-trigger{display:grid!important;place-items:center!important;width:58px!important;min-width:58px!important;max-width:58px!important;min-height:52px!important;margin:0!important;padding:8px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--card-background-color,#fff)!important;color:var(--info-color,#0284c7)!important}
      .dm-beta6-qa-icon-trigger ha-icon,#qa-grid .qa-btn .icon ha-icon{display:inline-flex!important}
      .dm-beta6-qa-icon-trigger ha-icon{--mdc-icon-size:30px!important}
      #qa-grid .qa-btn .icon ha-icon{--mdc-icon-size:30px!important}
      @media(max-width:760px){
        .ed-form-row[data-dm-beta6-quick-action="true"]{grid-template-columns:minmax(0,1fr) 56px!important}
        .ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-name{grid-column:1/-1!important}
        .dm-beta6-qa-icon-trigger{width:56px!important;min-width:56px!important;max-width:56px!important}
      }

      /* Azioni rapide della Home: il simbolo si vede anche dove l'elemento
         ha-icon non viene definito, come nella cornice di Home Assistant su
         Android. */
      #qa-grid .qa-btn .icon{display:grid!important;place-items:center!important;min-width:54px!important;min-height:54px!important;line-height:1!important;color:var(--accent,#0ea5e9)!important}
      #qa-grid .qa-btn .dm-action-glyph,.dm-beta7-existing-action-icon .dm-action-glyph,.dm-beta6-qa-icon-trigger .dm-action-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;line-height:1!important}
      #qa-grid .qa-btn .dm-action-glyph>span{display:block!important;line-height:1!important}

      /* Riga di un'azione gia' configurata: simbolo, nome, matita, cestino. */
      #editor-modal .ed-row.dm-beta7-action-row{display:grid!important;grid-template-columns:46px minmax(0,1fr) 42px 42px!important;align-items:center!important;gap:9px!important;min-height:72px!important;padding:10px 12px!important;overflow:hidden!important}
      #editor-modal .dm-beta7-existing-action-icon{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;border-radius:13px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,var(--card-background-color,#fff))!important;color:var(--accent,#0ea5e9)!important;grid-column:1!important;grid-row:1!important}
      #editor-modal .dm-beta7-action-row>.dm-beta7-existing-action-icon~:not(.ed-del):not([data-dm-edit-kind]){min-width:0!important}
      #editor-modal .dm-beta7-action-row [data-dm-edit-kind="action"]{grid-column:3!important;width:42px!important;height:42px!important;margin:0!important}
      #editor-modal .dm-beta7-action-row .ed-del:not([data-dm-edit-kind]){grid-column:4!important;width:42px!important;height:42px!important;margin:0!important}
      #editor-modal .dm-beta7-hidden-mdi-text{display:none!important}

      /* Form Azioni: tipo + icona sulla prima riga, nome a tutta larghezza. */
      #editor-modal .ed-form-row.dm-beta7-action-form-row{display:grid!important;grid-template-columns:minmax(0,1fr) 64px!important;grid-template-areas:"type icon" "name name"!important;align-items:stretch!important;gap:10px!important;width:100%!important}
      #editor-modal .dm-beta7-action-form-row #ed-qa-type{grid-area:type!important;display:block!important;width:100%!important;min-width:0!important;min-height:54px!important;margin:0!important;padding:0 14px!important;font-size:14px!important;color:var(--text,#0f172a)!important;background:var(--card-background-color,var(--card-bg,#fff))!important}
      #editor-modal .dm-beta7-action-form-row #ed-qa-name{grid-area:name!important;display:block!important;width:100%!important;min-width:0!important;min-height:54px!important;margin:0!important;padding:0 14px!important}
      #editor-modal .dm-beta7-action-form-row #ed-qa-icon{display:none!important}
      #editor-modal .dm-beta7-action-form-row .dm-beta6-qa-icon-trigger{grid-area:icon!important;display:grid!important;place-items:center!important;width:64px!important;min-width:64px!important;max-width:64px!important;height:54px!important;min-height:54px!important;margin:0!important;padding:8px!important;border-radius:16px!important;background:var(--card-background-color,var(--card-bg,#fff))!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;color:var(--accent,#0ea5e9)!important;overflow:hidden!important}
      @media(max-width:760px){
        #editor-modal .ed-row.dm-beta7-action-row{grid-template-columns:44px minmax(0,1fr) 40px 40px!important;gap:7px!important;padding:9px!important}
      }

      /* La faccia dei glifi che questo motore stampa: le due classi le scrive
         glyphClass() qui sopra, e a vestirle era il foglio di beta12. */
      .dm-beta12-room-glyph,.dm-beta12-action-glyph{
        display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
        font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-style:normal!important;font-weight:400!important;line-height:1!important;
        visibility:visible!important;opacity:1!important;color:initial!important
      }
      .dm-beta12-room-glyph>span,.dm-beta12-action-glyph>span{display:block!important;line-height:1!important;filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important}
      #qa-grid .qa-btn .dm-beta12-action-glyph{font-size:34px!important}
      #editor-modal .dm-beta7-existing-action-icon .dm-beta12-action-glyph,#editor-modal .dm-beta6-qa-icon-trigger .dm-beta12-action-glyph{font-size:29px!important}
      #editor-modal .dm-room-list-icon .dm-beta12-room-glyph{font-size:31px!important}
      .dm-temperature-card-icon .dm-beta12-room-glyph{font-size:29px!important}
      #dm-visual-picker[data-dm-beta12-colored="true"] .dm-picker-visual{
        display:grid!important;place-items:center!important;min-height:58px!important;color:initial!important
      }
      #dm-visual-picker[data-kind="room"] .dm-picker-visual .dm-beta12-room-glyph,
      #dm-visual-picker[data-kind="action"] .dm-picker-visual .dm-beta12-action-glyph{font-size:38px!important}
      #dm-visual-picker[data-dm-beta12-colored="true"] .dm-picker-option{
        background:linear-gradient(180deg,var(--card-background-color,#fff),color-mix(in srgb,var(--info-color,#0ea5e9) 3%,var(--card-background-color,#fff)))!important
      }
      #dm-room-editor-modal [data-room-icon-preview][data-dm-beta12-colored="true"] .dm-beta12-room-glyph,
      #dm-action-editor-modal [data-action-icon-preview][data-dm-beta12-colored="true"] .dm-beta12-action-glyph{font-size:38px!important}
      @media(max-width:760px){
        #dm-visual-picker[data-kind="room"] .dm-picker-visual .dm-beta12-room-glyph,#dm-visual-picker[data-kind="action"] .dm-picker-visual .dm-beta12-action-glyph{font-size:34px!important}
      }
    `,
  );
}

export function installIconEngine() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.addEventListener?.("click", scheduleEditorSyncAfterClick, true);
  root.addEventListener?.("click", handleActivation, true);
  root.addEventListener?.("keydown", handleActivation, true);
  doc.addEventListener(
    "input",
    (event) => {
      if (event.target?.matches?.("#dm-action-editor-modal input[name='icon'],#dm-room-editor-modal input[name='icon'],#ed-qa-icon")) {
        scheduleEditorIconSurfaces();
      }
    },
    true,
  );
  doc.addEventListener(
    "change",
    (event) => {
      if (event.target?.matches?.("#dm-action-editor-modal input[name='icon'],#dm-room-editor-modal input[name='icon'],#ed-qa-icon,#ed-qa-type")) {
        scheduleEditorIconSurfaces();
      }
    },
    true,
  );
  /* Il corpo della scheda rinasce anche fuori da `editorSwitch`.
   *
   * `renderCurrentEditor` lo rifa' a ogni cambio del modello, e i pannelli di
   * una linguetta possono arrivare nella coda della passata dei contratti:
   * senza questi due ascolti la forma delle righe azione e il tasto
   * dell'icona restavano persi fino al gesto successivo. Li teneva il modulo
   * delle regressioni, che di quelle righe scriveva la forma. */
  root.addEventListener?.("dashboardmodern:editor-rendered", scheduleEditorIconSurfaces);
  root.addEventListener?.("dashboardmodern:editor-contracts", scheduleEditorIconSurfaces);
  installLegacyBridge();
  installRenderOwners();
  syncQuickActionIcons();
  syncEditorIconSurfaces();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) {
    root.addEventListener?.(eventName, () => {
      installLegacyBridge();
      installRenderOwners();
      syncQuickActionIcons();
      scheduleEditorIconSurfaces();
    });
  }
}

root.DashboardModernIconEngine = Object.freeze({
  openPicker: openIconPicker,
  closePicker: closeIconPicker,
  markup: iconGlyphMarkup,
  render: renderIconGlyph,
  glyph: iconGlyph,
  syncQuickActions: syncQuickActionIcons,
  syncEditor: syncEditorIconSurfaces,
});

installIconEngine();