import { ACTION_ICON_CATALOG, roomVisual } from "../core/personalization-catalog.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  readJson,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA9_REAL_DEVICE_POLISH__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  storeUnsubscribe: null,
});

const ACTION_DEFAULTS = Object.freeze({
  luci: { glyph: "💡", color: "#f59e0b" },
  clima: { glyph: "❄️", color: "#0ea5e9" },
  antifurto: { glyph: "🛡️", color: "#7c3aed" },
  lavatrice: { glyph: "🧺", color: "#0ea5e9" },
});


function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

function actionCatalogItem(value) {
  const token = normalize(value).replace(/^mdi\s*/, "");
  return ACTION_ICON_CATALOG.find((item) => {
    const values = [item.id, item.mdi, item.it, item.en, item.glyph]
      .map((entry) => normalize(entry).replace(/^mdi\s*/, ""));
    return values.includes(token);
  }) || null;
}

function actionVisual(action = {}) {
  const builtin = clean(action.builtin);
  const configured = clean(action.icon);
  const item = actionCatalogItem(configured);
  const historical = ACTION_DEFAULTS[builtin];
  const glyph =
    item?.glyph ||
    (configured && !configured.toLowerCase().startsWith("mdi:") ? configured : "") ||
    historical?.glyph ||
    "⚡";
  const color = clean(action.color) || historical?.color || "#0ea5e9";
  return { glyph, color };
}

function configuredActions() {
  try {
    const values = root.getQuickActions?.();
    if (Array.isArray(values)) return values;
  } catch (_error) {}
  const values = readJson("cd_quick_actions", []);
  return Array.isArray(values) ? values : [];
}

function polishQuickActions() {
  return Boolean(root.DashboardModernIconEngine?.syncQuickActions?.());
}

function polishActionPicker() {
  const picker = doc?.querySelector?.('#dm-visual-picker[data-kind="action"][data-dm-icon-engine="single-owner"]');
  return Boolean(picker);
}

function brandName(container) {
  return clean(
    container?.dataset?.dmBeta5Brand ||
    container?.getAttribute?.("title") ||
    container?.querySelector?.("img[data-dm-brand-image]")?.alt ||
    container?.dataset?.brand,
  );
}

function readableBrandFallback(container) {
  if (!container) return false;
  const img = container.querySelector("img[data-dm-brand-image]");
  const oldFallback = container.querySelector(".dm-beta7-brand-guard-fallback,.dm-beta7-brand-fallback");
  const broken = Boolean(
    oldFallback ||
    img?.dataset?.dmBeta7Broken === "true" ||
    (img?.complete && Number(img.naturalWidth) === 0),
  );
  if (!broken) return false;
  const name = brandName(container) || "EV";
  let fallback = container.querySelector(".dm-v10-brand-wordmark");
  if (!fallback) {
    fallback = doc.createElement("span");
    fallback.className = "dm-v10-brand-wordmark";
    (img?.parentElement || container).append(fallback);
  }
  fallback.textContent = name;
  oldFallback?.remove();
  if (img) img.style.setProperty("display", "none", "important");
  container.dataset.brandSource = "readable-local-fallback";
  return true;
}

function polishBrandLogos() {
  doc?.querySelectorAll?.(".dm-car-brand").forEach((container) => {
    readableBrandFallback(container);
    container.dataset.dmLogoNormalized = "true";
  });
  return true;
}

function configuredRooms() {
  try {
    const values = dashboardStore()?.getSection?.("rooms");
    if (Array.isArray(values)) return values;
  } catch (_error) {}
  const values = readJson("cd_stanze", []);
  return Array.isArray(values) ? values : [];
}

function roomMarkup(room, size = 34) {
  const value = clean(room?.icon || room?.name || "mdi:home");
  try {
    return roomVisual(value, size) || root.cdIconMarkup?.(value, size) || esc(value);
  } catch (_error) {
    return esc(value.startsWith("mdi:") ? "🏠" : value);
  }
}

function polishRoomRows() {
  const body = doc?.getElementById("ed-body");
  const tab = clean(doc?.querySelector(".ed-tab.active")?.dataset?.tab);
  if (!body || tab !== "stanze") return false;
  const rooms = configuredRooms();
  const rows = [...body.querySelectorAll(".ed-row")];
  rows.forEach((row) => {
    const edit = row.querySelector('[data-dm-edit-kind="room"][data-dm-edit-index]');
    let index = Number.parseInt(edit?.dataset?.dmEditIndex || "-1", 10);
    if (!(index >= 0 && index < rooms.length)) {
      const label = clean(row.querySelector(".ed-row-new")?.textContent).toLowerCase();
      index = rooms.findIndex((room) => label.includes(clean(room.name).toLowerCase()));
    }
    const room = rooms[index];
    if (!room) return;
    row.classList.add("dm-room-config-row");
    let visual = row.querySelector(".dm-room-list-icon");
    if (!visual) {
      visual = doc.createElement("span");
      visual.className = "dm-room-list-icon";
      row.prepend(visual);
    }
    const token = clean(room.icon || room.name || "mdi:home");
    visual.dataset.roomIcon = token;
    if (!root.DashboardModernIconEngine?.render?.(visual, "room", token, { size: 31 })) {
      visual.innerHTML = roomMarkup(room, 34);
    }
    visual.setAttribute("title", clean(room.name));
  });
  return true;
}

function temperatureForm() {
  return doc?.querySelector("#editor-modal [data-temperature-form]") || null;
}

function isTemperatureEdit(form) {
  return /^(modifica|edit)\b/i.test(clean(form?.querySelector("[data-temperature-form-title]")?.textContent));
}

function rebuildTemperatureRoomOptions(form, select) {
  const rooms = configuredRooms();
  if (!rooms.length) return;
  const current = clean(select.value || form.dataset.dmOriginalRoom);
  const options = rooms.map((room) => {
    const id = clean(room.id || room.name);
    const icon = clean(room.icon);
    const marker = (clean(room.temp) || clean(room.hum)) && id !== current
      ? (t(" — configurata", " — configured"))
      : "";
    const labelIcon = icon && !icon.startsWith("mdi:") ? `${icon} ` : "";
    return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${labelIcon}${esc(room.name || id)}${marker}</option>`;
  }).join("");
  if (select.dataset.dmRoomOptionsSignature !== options) {
    select.innerHTML = options;
    select.dataset.dmRoomOptionsSignature = options;
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function repairTemperatureRoomSelect() {
  const form = temperatureForm();
  const select = form?.querySelector("#dm-temperature-room");
  if (!form || !select || !isTemperatureEdit(form)) return false;

  form.dataset.dmOriginalRoom ||= clean(select.value);
  select.disabled = false;
  select.removeAttribute("disabled");
  select.removeAttribute("aria-disabled");
  select.tabIndex = 0;
  select.dataset.dmTemperatureRoomEditable = "true";
  select.dataset.dmRealDeviceEditable = "true";
  select.style.setProperty("pointer-events", "auto", "important");
  select.style.setProperty("opacity", "1", "important");
  select.style.setProperty("cursor", "pointer", "important");
  select.style.setProperty("position", "relative", "important");
  select.style.setProperty("z-index", "8", "important");
  rebuildTemperatureRoomOptions(form, select);

  if (select.dataset.dmPreOpenGuard !== "true") {
    select.dataset.dmPreOpenGuard = "true";
    for (const eventName of ["pointerdown", "touchstart", "mousedown", "focus"]) {
      select.addEventListener(eventName, () => {
        select.disabled = false;
        select.removeAttribute("disabled");
        select.style.setProperty("pointer-events", "auto", "important");
      }, true);
    }
  }
  return true;
}

function polishShutters() {
  const page = doc?.getElementById("page-tapparelle");
  if (!page) return false;
  page.dataset.dmShutterDesign = "beta9-compact-real";

  const grid = page.querySelector("#tapp-grid");
  if (grid) {
    grid.style.setProperty("display", "grid", "important");
    grid.style.setProperty("grid-template-columns", "repeat(auto-fit,minmax(280px,360px))", "important");
    grid.style.setProperty("justify-content", "center", "important");
    grid.style.setProperty("align-items", "start", "important");
    grid.style.setProperty("gap", "14px", "important");
  }

  page.querySelectorAll(".tapp-card").forEach((card) => {
    card.classList.add("dm-beta9-real-shutter-card");
    card.style.setProperty("width", "100%", "important");
    card.style.setProperty("max-width", "360px", "important");
    card.style.setProperty("min-height", "0", "important");
    card.style.setProperty("padding", "14px", "important");
    card.style.setProperty("gap", "10px", "important");
    card.style.setProperty("border-radius", "20px", "important");
    card.style.setProperty("animation", "none", "important");
    card.style.setProperty("transform", "none", "important");
  });

  page.querySelectorAll(".tapp-win").forEach((windowNode) => {
    windowNode.classList.add("dm-beta9-real-shutter-window");
    windowNode.style.setProperty("height", "132px", "important");
    windowNode.style.setProperty("min-height", "132px", "important");
    windowNode.style.setProperty("max-height", "132px", "important");
    windowNode.style.setProperty("margin", "0", "important");
    windowNode.style.setProperty("animation", "none", "important");
  });

  page.querySelectorAll(".tapp-shutter").forEach((shutter) => {
    shutter.style.setProperty("transition", "height .55s cubic-bezier(.2,.8,.2,1)", "important");
    shutter.style.setProperty("filter", "none", "important");
    shutter.style.setProperty("animation", "none", "important");
  });
  page.querySelectorAll(".tapp-shutter i").forEach((slat) => {
    slat.style.setProperty("animation", "none", "important");
    slat.style.setProperty("filter", "none", "important");
    slat.style.setProperty("transform", "none", "important");
  });
  // Buttons are deliberately absent here: the shutter section skins the card
  // controls and the "open/close everything" bar at two different sizes, and an
  // inline rule would flatten both back to one.
  return true;
}

function shutterMoving() {
  const storeCovers = dashboardStore()?.getSection?.("covers") || [];
  const covers = Array.isArray(storeCovers) ? storeCovers : [];
  const states = allStates();
  return covers.some((cover) => {
    const entity = clean(cover.entity || cover.entities?.[0]);
    return ["opening", "closing"].includes(clean(states[entity]?.state).toLowerCase());
  });
}

/* What each kind of alert looks like when it is happening, matched on the
 * alert's own name and on the icon the user picked for it in the editor. A
 * door alert draws a door swinging on its hinge, a flat battery drains, a leak
 * drips: the motion says what the card says, which is the point of animating
 * it at all. Order matters — the specific readings come before the generic
 * "something is wrong" ones, and the first match wins. */
const ALERT_KINDS = Object.freeze([
  { kind: "door", words: /\bport[ae]\b|portone|ingresso|door|gate/, icons: /🚪|🔓|🔒/ },
  { kind: "window", words: /finestr|window|velux|lucernar/, icons: /🪟/ },
  { kind: "battery", words: /batter|low battery/, icons: /🔋/ },
  { kind: "leak", words: /perdit|allagament|acqua|leak|flood|water|pioggia|rain/, icons: /💧|🌊|🚰|🚿|🛁|🌧️|💦/ },
  { kind: "flame", words: /incendi|fumo|fiamm|gas|fire|smoke|calder|boiler/, icons: /🔥|🌫️|💨|🧯|♨️/ },
  { kind: "motion", words: /moviment|presenz|motion|presence|persona/, icons: /🏃|🚶|👤|🐶|🐱/ },
  { kind: "temperature", words: /temperatur|gelo|freddo|caldo|frost|heat|cold/, icons: /🌡️|❄️|🧊|☀️/ },
  { kind: "power", words: /consum|corrente|potenz|energia|power|presa|plug|rete|wifi|segnale/, icons: /🔌|⚡|📈|📉|📶|📡/ },
  { kind: "light", words: /luce|luci|light|lampad|illumin/, icons: /💡|🔆|🔦/ },
  { kind: "security", words: /antifurto|allarme|alarm|security|sicurezza|telecamer|camera/, icons: /🛡️|🚨|⚠️|🔔|📹|🎥|⏰|❗|🔴/ },
]);

function classifyAlert(card) {
  /* Il nome dell'avviso: nel Quadro stava in `.g-name`, nelle tessere del
   * ponte sta in `.dm-tile-label`. Il resto del ragionamento non cambia. */
  const name = clean(
    card.querySelector(".g-name")?.textContent ||
      card.querySelector(".dm-tile-label")?.textContent ||
      card.textContent,
  ).toLowerCase();
  /* L'avviso tapparella si muove anche da fermo.
   *
   * Il ramo "static" era per quando NESSUNA tapparella e' in movimento, ma un
   * avviso acceso — "Tapparella aperta · 1" — restava cosi' l'unico immobile
   * del quadro, mentre porta e batteria accanto animavano: sembrava un
   * dimenticato, ed e' stato segnalato come tale. Da ferma la tapparella
   * scorre piano come un telo che si riavvolge; quando una si muove davvero,
   * resta il movimento suo. */
  if (/tapparell|shutter|tenda|cover/.test(name)) return shutterMoving() ? "shutter-moving" : "shutter";
  for (const entry of ALERT_KINDS) {
    if (entry.words.test(name)) return entry.kind;
  }
  const glyph = clean(
    (card.querySelector(".g-icon-wrap") || card.querySelector(".dm-tile-chip"))
      ?.textContent,
  );
  if (glyph) {
    for (const entry of ALERT_KINDS) {
      if (entry.icons.test(glyph)) return entry.kind;
    }
  }
  /* Un avviso che non rientra nel vocabolario non resta fermo.
   *
   * Le categorie qui sopra coprono quello che si nomina di solito, ma un
   * avviso lo battezza chi lo crea: "Garage", "Cantina", "Sensori" non
   * assomigliano a niente di questo elenco e finivano immobili, mentre quello
   * accanto si muoveva. Chi guarda non sa che esiste un vocabolario: vede due
   * avvisi, uno vivo e uno spento, e pensa che le animazioni manchino.
   *
   * Da qui in avanti l'avviso che non si sa leggere prende un battito
   * discreto — non racconta cosa sta succedendo, ma dice che qualcosa sta
   * succedendo, che e' il minimo che un avviso acceso deve fare. */
  return "generic";
}

/* The motion belongs to the glyph, not to the disc it sits in: a door swinging
 * inside a spinning circle reads as neither. The runtime prints the icon as a
 * bare text node, so it is wrapped once — and wrapped again whenever the
 * runtime rewrites the card, which it does whenever the alert count changes. */
function glyphOf(icon) {
  /* La pastiglia della tessera adesso porta un oggetto disegnato al posto di
   * un simbolo scritto: non c'e' niente da avvolgere, e a svuotarla come si
   * faceva col testo il disegno sparirebbe. Il movimento se lo prende lui. */
  const oggetto = icon.querySelector(":scope > .dm-oggetto");
  if (oggetto) return oggetto;
  const existing = icon.querySelector(":scope > .dm-alert-glyph");
  if (existing && icon.childNodes.length === 1) return existing;
  const glyph = existing || doc.createElement("span");
  if (!existing) glyph.className = "dm-alert-glyph";
  const text = clean(icon.textContent);
  if (clean(glyph.textContent) !== text) glyph.textContent = text;
  icon.textContent = "";
  icon.append(glyph);
  return glyph;
}

/* Il vocabolario dei movimenti si e' trasferito con gli avvisi.
 *
 * Stava sulle card del Quadro Avvisi, che dalla Home e' uscito: le stesse
 * notizie adesso sono le tessere d'avviso del ponte, e la porta che oscilla,
 * la goccia che cade e il passo che cammina valgono li' come valevano prima.
 * Classi e fotogrammi restano gli stessi: cambia dove si va a cercarli. */
function polishAlertAnimations() {
  const bersagli = [
    ...(doc?.querySelectorAll?.("#page-home .glance-card") || []),
    ...(doc?.querySelectorAll?.('#dm-widgets .dm-tile[data-alert="true"]') || []),
  ];
  bersagli.forEach((card) => {
    const icon =
      /* Dove sta il simbolo: nel Quadro e' il disco, nella tessera del ponte
       * e' la pastiglia. `.dm-tile-ic` e `.dm-tile-ring i` erano i nomi di
       * prima, e da quando non esistono piu' questo giro non trovava niente:
       * gli avvisi del ponte restavano immobili. */
      card.querySelector(".g-icon-wrap") || card.querySelector(".dm-tile-chip");
    if (!icon) return;
    const kind = classifyAlert(card);
    // Nothing to do when the card is already animating the right way: this ran
    // on every pass and rewrote eight classes per icon each time, which is a
    // handful of mutations a second for an unchanged plancia.
    if (icon.dataset.dmAlertMotion === kind && icon.classList.contains(`dm-alert-${kind}`)) return;
    for (const name of [...icon.classList]) {
      if (name === "anim-ping" || name.startsWith("dm-alert-")) icon.classList.remove(name);
    }
    icon.classList.add(`dm-alert-${kind}`);
    if (kind !== "static") glyphOf(icon);
    icon.dataset.dmAlertMotion = kind;
  });
  return true;
}

function polishLightAddForm() {
  const form = doc?.querySelector("#ed-body .dm-light-add-form[data-light-add-form]");
  if (!form) return false;
  form.dataset.dmLightAddLayout = "beta9-real";
  const row = form.querySelector(":scope > .ed-form-row");
  if (row) row.classList.add("dm-light-add-entity-row");
  const entity = form.querySelector("#luce-add-ent");
  const search = row?.querySelector(".dm-entity-picker");
  const name = form.querySelector("#luce-add-name");
  const add = form.querySelector(".ed-btn-add");
  for (const input of [entity, name]) {
    input?.style?.setProperty("width", "100%", "important");
    input?.style?.setProperty("min-width", "0", "important");
    input?.style?.setProperty("max-width", "100%", "important");
  }
  if (search) {
    search.style.setProperty("position", "static", "important");
    search.style.setProperty("transform", "none", "important");
    search.style.setProperty("margin", "0", "important");
  }
  add?.style?.setProperty("width", "100%", "important");
  return true;
}

function ensureStyleLast() {
  const style = doc?.getElementById("dm-beta9-real-device-polish-style");
  if (style && style.parentElement === doc.head && style !== doc.head.lastElementChild) doc.head.append(style);
}

function run() {
  state.frame = 0;
  installOwners();
  ensureStyleLast();
  polishQuickActions();
  polishActionPicker();
  polishBrandLogos();
  polishRoomRows();
  repairTemperatureRoomSelect();
  polishShutters();
  polishAlertAnimations();
  polishLightAddForm();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function scheduleAfterLegacyWork() {
  schedule();
  root.setTimeout?.(schedule, 0);
  root.setTimeout?.(schedule, 70);
}

function installOwners() {
  for (const name of [
    "editorSwitch",
    "buildQuickActions",
    "renderTapparelle",
    "buildTempCards",
    "render",
    "cdFillRoomSelects",
    // The alerts the user creates live in their own wrap, redrawn by the
    // runtime whenever one of them starts or stops matching. Without this the
    // motion only reached them on the next unrelated state change.
    "cdRenderCustomAvvisi",
  ]) wrapFunction(name, "__dmBeta9RealDevicePolish", scheduleAfterLegacyWork);
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "ev", "lights", "covers", "snapshot"].includes(change?.section))
      scheduleAfterLegacyWork();
  });
}

function installStyles() {
  installStyle("dm-beta9-real-device-polish-style", `
    html body #page-home #qa-grid .qa-btn .icon{
      display:grid!important;place-items:center!important;width:58px!important;height:58px!important;
      min-width:58px!important;min-height:58px!important;padding:0!important;border-radius:0!important;
      background:transparent!important;box-shadow:none!important;line-height:1!important;overflow:visible!important
    }
    html body #page-home #qa-grid .qa-btn .icon .dm-v01525-action-glyph{
      display:block!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
      font-size:42px!important;line-height:1!important;filter:none!important
    }
    #dm-beta9-action-picker .dm-picker-visual,
    #dm-visual-picker[data-kind="action"] .dm-picker-visual{
      background:transparent!important;color:inherit!important
    }
    #dm-beta9-action-picker .dm-v01525-picker-glyph,
    #dm-visual-picker[data-kind="action"] .dm-v01525-picker-glyph{
      display:block!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
      font-size:38px!important;line-height:1!important
    }

    /* Il marchio porta il suo colore, e qui non glielo si toglie piu'.
     *
     * Queste righe sono di quando i loghi arrivavano da un CDN come immagini:
     * si normalizzava tutto a un inchiostro solo, e le figure si scolorivano a
     * forza. Da quando le figure stanno in casa e si disegnano come maschera,
     * ognuna sa gia' di che colore e' — quello vero del marchio — e chi non ne
     * ha uno leggibile su fondo scuro apposta non lo dichiara, cosi' segue il
     * tema. Una regola di colore marcata importante, qui sopra, li rimetteva
     * tutti e trentotto dello stesso grigio: esattamente cio' che era stato
     * chiesto di non fare. Della pastiglia si tiene solo il fondo bianco. */
    [data-ev-appearance] .dm-brand-preview,
    #dm-visual-picker[data-kind="car"] .dm-picker-visual{
      background:#fff!important
    }
    #dm-visual-picker[data-kind="car"] .dm-picker-option{
      min-height:116px!important;padding:12px 9px!important;overflow:hidden!important
    }
    #dm-visual-picker[data-kind="car"] .dm-picker-visual{
      width:96px!important;height:58px!important;min-width:0!important;min-height:0!important;padding:7px!important;
      border-radius:13px!important;overflow:hidden!important
    }
    #dm-visual-picker[data-kind="car"] .dm-picker-visual .dm-car-brand{
      width:82px!important;max-width:82px!important;height:44px!important;max-height:44px!important;
      padding:0!important;overflow:hidden!important
    }
    .dm-v10-brand-wordmark{
      display:grid!important;place-items:center!important;width:100%!important;height:100%!important;padding:2px 4px!important;
      color:#111827!important;font:900 clamp(9px,2.4vw,14px)/1 system-ui,sans-serif!important;
      letter-spacing:-.3px!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere!important
    }

    #ed-body .ed-row.dm-room-config-row{
      display:grid!important;grid-template-columns:48px minmax(0,1fr) 44px 44px!important;
      gap:9px!important;align-items:center!important;min-width:0!important;overflow:visible!important
    }
    #ed-body .dm-room-config-row>.dm-room-list-icon{
      display:grid!important;grid-column:1!important;place-items:center!important;width:46px!important;height:46px!important;
      min-width:46px!important;visibility:visible!important;opacity:1!important;border-radius:14px!important;
      background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important;
      color:var(--primary-color,#0ea5e9)!important;overflow:hidden!important
    }
    #ed-body .dm-room-config-row>.ed-row-main{grid-column:2!important;display:block!important;min-width:0!important}

    #editor-modal [data-temperature-form] #dm-temperature-room[data-dm-real-device-editable="true"]{
      display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;
      position:relative!important;z-index:8!important;width:100%!important;min-height:54px!important;
      cursor:pointer!important;touch-action:manipulation!important
    }

    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] #tapp-grid{
      grid-template-columns:repeat(auto-fit,minmax(280px,360px))!important;
      justify-content:center!important;align-items:start!important;gap:14px!important
    }
    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-card.dm-beta9-real-shutter-card{
      width:100%!important;max-width:360px!important;min-height:0!important;padding:14px!important;gap:10px!important;
      border-radius:20px!important;animation:none!important;transform:none!important
    }
    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-win.dm-beta9-real-shutter-window{
      height:132px!important;min-height:132px!important;max-height:132px!important;margin:0!important;
      border-radius:17px!important;animation:none!important
    }
    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-shutter.opening i,
    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-shutter.closing i,
    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-shutter i{
      animation:none!important;filter:none!important;transform:none!important
    }
    html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-shutter{
      animation:none!important;filter:none!important;transition:height .55s cubic-bezier(.2,.8,.2,1)!important
    }

    /* Alert motion. The disc holds still; the glyph inside it acts out what the
       alert is reporting.
     *
     * Un indirizzo solo per i due posti in cui un avviso puo' stare: il Quadro
     * storico e la tessera del ponte. Prima ogni regola era scritta tre volte,
     * e due di quelle tre puntavano a dm-tile-ic e dm-tile-ring, che sono
     * nomi che la tessera ha smesso di usare quando il suo simbolo e'
     * diventato la pastiglia. Nessuno se n'e' accorto perche' la terza copia
     * continuava a
     * funzionare sul Quadro: gli avvisi del ponte stavano fermi, e sembrava
     * che le animazioni fossero sparite di nuovo. */
    #page-home .g-icon-wrap[class*="dm-alert-"]{animation:none!important;transform:none!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip) :is(.dm-alert-glyph,.dm-oggetto){display:inline-block!important;line-height:1!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-static :is(.dm-alert-glyph,.dm-oggetto){animation:none!important;transform:none!important}
    /* A door swings on its hinge: wide open, a pause, and shut again. */
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-door :is(.dm-alert-glyph,.dm-oggetto){
      transform-origin:left center!important;animation:dmAlertDoor 3.2s ease-in-out infinite!important}
    /* A window sash swings the other way, and less far. */
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-window :is(.dm-alert-glyph,.dm-oggetto){
      transform-origin:right center!important;animation:dmAlertWindow 3s ease-in-out infinite!important}
    /* A flat battery empties from the top down, then refills out of sight. */
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-battery :is(.dm-alert-glyph,.dm-oggetto){
      transform-origin:center bottom!important;animation:dmAlertBattery 3.4s linear infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-leak :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertDrip 1.7s ease-in infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-flame :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertFlame 1.5s ease-in-out infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-motion :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertStep 1.1s ease-in-out infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-temperature :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertTemp 2.6s ease-in-out infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-power :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertSurge 2.1s ease-in-out infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-light :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertLight 2.2s ease-in-out infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-security :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertSecurity 1.6s ease-in-out infinite!important}
    /* L'avviso che non si sa leggere: un battito, niente di piu'. */
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-generic :is(.dm-alert-glyph,.dm-oggetto){animation:dmAlertGeneric 2.4s ease-in-out infinite!important}
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-shutter-moving .dm-alert-glyph{animation:dmAlertShutterMove 1.25s ease-in-out infinite!important}
    /* Il telo si riavvolge verso il cassonetto: scaleY dall'alto, stessa
       regola in due dimensioni di porta e finestra — niente 3D, niente clip. */
    :is(#page-home .g-icon-wrap,#dm-widgets .dm-tile[data-alert="true"] .dm-tile-chip).dm-alert-shutter :is(.dm-alert-glyph,.dm-oggetto){
      transform-origin:center top!important;animation:dmAlertShutter 2.8s ease-in-out infinite!important}
    /* The door and the window swing on their hinge with scaleX, not with a
       perspective rotateY. On screen the two are the same movement — the leaf
       narrows towards its hinge and comes back — but rotateY opens a 3D
       rendering context on every alert icon, on the one page that is always on
       screen, and WebKit was killing the page under it. */
    @keyframes dmAlertDoor{
      0%,10%{transform:scaleX(1)}
      42%,58%{transform:scaleX(.44)}
      90%,100%{transform:scaleX(1)}}
    @keyframes dmAlertWindow{
      0%,12%{transform:scaleX(1)}
      46%,60%{transform:scaleX(.74)}
      92%,100%{transform:scaleX(1)}}
    /* Every alert moves on transform and opacity alone.
     *
     * These animations never stop, and the plancia is the page that is on
     * screen almost all the time. A clip-path or a filter in a keyframe makes
     * the engine repaint the glyph on every frame, forever; transform and
     * opacity are the two the compositor can carry on its own. The battery
     * therefore drains by squashing towards its base instead of being clipped,
     * which reads the same and costs nothing per frame. */
    @keyframes dmAlertBattery{
      0%{transform:scaleY(1);opacity:1}
      52%{transform:scaleY(.44);opacity:1}
      68%{transform:scaleY(.44);opacity:.18}
      84%{transform:scaleY(1);opacity:.18}
      100%{transform:scaleY(1);opacity:1}}
    @keyframes dmAlertDrip{
      0%{transform:translateY(-3px) scaleY(.92)}
      55%{transform:translateY(4px) scaleY(1.08)}
      75%{transform:translateY(4px) scaleY(.96)}
      100%{transform:translateY(-3px) scaleY(.92)}}
    @keyframes dmAlertFlame{
      0%,100%{transform:translateY(0) scale(1);opacity:1}
      35%{transform:translateY(-2px) scale(1.07);opacity:.82}
      68%{transform:translateY(-1px) scale(.97);opacity:1}}
    @keyframes dmAlertStep{
      0%,100%{transform:translate(-3px,0)}
      25%{transform:translate(-1px,-2px)}
      50%{transform:translate(3px,0)}
      75%{transform:translate(1px,-2px)}}
    @keyframes dmAlertTemp{0%,100%{transform:translateY(2.5px)}50%{transform:translateY(-2.5px)}}
    @keyframes dmAlertSurge{
      0%,100%{transform:scale(1);opacity:1}
      14%{transform:scale(1.12);opacity:.7}
      26%{transform:scale(1);opacity:1}
      52%{transform:scale(1.06);opacity:.85}
      66%{transform:scale(1);opacity:1}}
    @keyframes dmAlertSecurity{0%,100%{transform:scale(1)}50%{transform:scale(1.075)}}
    @keyframes dmAlertLight{0%,100%{opacity:1}50%{opacity:.62}}
    @keyframes dmAlertGeneric{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.78}}
    @keyframes dmAlertShutterMove{0%,100%{transform:translateY(-2px)}50%{transform:translateY(2px)}}
    @keyframes dmAlertShutter{
      0%,14%{transform:scaleY(1)}
      44%,56%{transform:scaleY(.55)}
      86%,100%{transform:scaleY(1)}}

    #ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"]{
      display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;
      width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important
    }
    #ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"]>.dm-light-add-entity-row{
      display:grid!important;grid-template-columns:minmax(0,1fr) 58px!important;gap:9px!important;
      width:100%!important;max-width:100%!important;min-width:0!important;align-items:stretch!important
    }
    #ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"] #luce-add-ent,
    #ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"] #luce-add-name{
      display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:54px!important;margin:0!important
    }
    #ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"] .dm-light-add-entity-row>.dm-entity-picker{
      position:static!important;display:grid!important;place-items:center!important;width:58px!important;height:54px!important;
      min-width:58px!important;max-width:58px!important;margin:0!important;padding:0!important;transform:none!important
    }
    #ed-body .dm-light-add-form[data-dm-light-add-layout="beta9-real"]>.ed-btn-add{
      display:flex!important;width:100%!important;max-width:100%!important;min-height:54px!important;margin:0!important
    }

    @media(max-width:560px){
      html body #page-home #qa-grid .qa-btn .icon{width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important}
      html body #page-home #qa-grid .qa-btn .icon .dm-v01525-action-glyph{font-size:40px!important}
      #dm-visual-picker[data-kind="car"] .dm-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      #dm-visual-picker[data-kind="car"] .dm-picker-visual{width:82px!important;height:52px!important}
      #dm-visual-picker[data-kind="car"] .dm-picker-visual .dm-car-brand{width:70px!important;height:39px!important}
      html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] #tapp-grid{
        grid-template-columns:minmax(0,360px)!important;justify-content:center!important
      }
      html body #page-tapparelle[data-dm-shutter-design="beta9-compact-real"] .tapp-card.dm-beta9-real-shutter-card{
        max-width:360px!important
      }
    }
    /* Gli avvisi animati restano animati anche a movimento ridotto: il
     * movimento e' il segnale — una perdita d'acqua che gocciola, una fiamma
     * che trema — e su molti desktop quell'impostazione di sistema e' attiva
     * senza che nessuno l'abbia scelta per questa plancia. */
  `);
}

export function installBeta9RealDevicePolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installOwners();
  subscribeStore();

  for (const name of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) root.addEventListener?.(name, () => {
    installOwners();
    subscribeStore();
    scheduleAfterLegacyWork();
  });

  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    const id = clean(event?.detail?.entity_id);
    if (/^(cover|binary_sensor|sensor|light)\./.test(id)) schedule();
  });

  /* Le tessere del ponte si sono appena rifatte: i nodi sono nuovi e non
   * portano niente addosso. Aspettare il prossimo evento di stato vorrebbe
   * dire un avviso appena scattato che resta immobile chissa' per quanto. */
  root.addEventListener?.("dashboardmodern:widgets-painted", () => schedule());

  /* La card del marchio non e' piu' affar nostro: la costruisce e la comanda
   * la Personalizzazione, da sola. Restava un ascolto sul suo riquadro, e uno
   * sull'errore di caricamento di un'immagine di marchio — immagini che non
   * esistono piu', perche' i segni sono maschere. Tutti e due chiamavano un
   * giro di riparazioni che sul brand non ha piu' niente da riparare. */
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(
      '.ed-tab[data-tab="sez2"],.ed-tab[data-tab="stanze"],.ed-tab[data-tab="sez7"],.ed-tab[data-tab="luci"],.tab[data-tab="tapparelle"],.dm-beta6-qa-icon-trigger',
    )) scheduleAfterLegacyWork();
  }, true);

  scheduleAfterLegacyWork();
}

installBeta9RealDevicePolishSection();