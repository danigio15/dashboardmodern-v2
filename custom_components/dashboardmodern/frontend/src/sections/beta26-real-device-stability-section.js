// Beta 27 real-device stability: deterministic temperature room tabs, automatic
// section visibility after configuration saves, and a hierarchical Energy load
// editor that projects directly to the existing flow/subload runtime contracts.
import { applianceArtwork } from "../core/appliance-artwork.js";
import { TAB_SECTION_KEYS, activeTab as schedaAttiva } from "./config-uniformity-section.js";
import { canonicalApplianceVisualKey } from "../core/device-model.js";
import {
  contenutoDelleSezioni,
  sezioniGovernate,
} from "../core/contenuto-delle-sezioni.js";
import { sectionForEditorSlot } from "../core/editor-slots.js";
import {
  renderBeta25TemperatureCards,
  temperatureEntries,
} from "./beta25-real-device-fixes-section.js";
import {
  allStates,
  applyTemperatureReading,
  clean,
  comfortBadgeText,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  readJson,
  root,
  section,
  t,
  temperatureCardLabels,
  writeIconGlyph,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA26_REAL_DEVICE_STABILITY__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  temperatureSignature: "",
  activeTemperatureRoom: "all",
  temperatureGridObserver: null,
  temperatureGridObserved: null,
  temperatureFilterReentrant: false,
  visibilityTimer: 0,
  loadsRendering: false,
  editingChild: null,
  popupGroup: "",
  managedRuntimeGroups: new Set(),
});
state.managedRuntimeGroups ||= new Set();

const FLOW_NODE_DEFAULTS = Object.freeze({
  lav: Object.freeze({
    label: "Carico 1",
    name: "Lavanderia",
    icon: "🧺",
    group: "lavanderia",
    color: "#0ea5e9",
    nodeId: "n-lav",
    lineId: "line-home-lav",
  }),
  cuc: Object.freeze({
    label: "Carico 2",
    name: "Cucina",
    icon: "🍳",
    group: "cucina",
    color: "#f97316",
    nodeId: "n-cuc",
    lineId: "line-home-cuc",
  }),
  boiler: Object.freeze({
    label: "Boiler",
    name: "Boiler",
    icon: "🌞",
    group: "",
    color: "#ea580c",
    nodeId: "n-boiler",
    lineId: "line-home-boiler",
  }),
  wb: Object.freeze({
    label: "Wallbox",
    name: "Wallbox",
    icon: "🚗",
    group: "",
    color: "#2563eb",
    nodeId: "n-wb",
    lineId: "line-home-wb",
  }),
  clima: Object.freeze({
    label: "Clima",
    name: "Clima",
    icon: "❄️",
    group: "",
    color: "#06b6d4",
    nodeId: "n-clima",
    lineId: "line-home-clima",
  }),
});

const BUILTIN_LOAD_GROUPS = Object.freeze([
  Object.freeze({ id: "cucina", name: "Cucina", icon: "🍳", color: "#f97316", builtin: true }),
  Object.freeze({
    id: "lavanderia",
    name: "Lavanderia",
    icon: "🧺",
    color: "#0ea5e9",
    builtin: true,
  }),
]);

function rooms() {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
}

function humidityEntity(entry = {}) {
  const explicit = clean(entry.hum);
  if (explicit) return explicit;
  return clean(entry.temp).replace("_temperature", "_humidity");
}

function numericState(entity) {
  const value = Number.parseFloat(allStates()[clean(entity)]?.state);
  return Number.isFinite(value) ? value : null;
}

function comfortLabel(value) {
  if (value == null) return t("Non disponibile", "Unavailable");
  if (value < 18) return t("Freddo", "Cold");
  if (value > 26) return t("Caldo", "Hot");
  return "Comfort";
}

function temperatureRecords(roomValues = rooms()) {
  return roomValues.flatMap((room) =>
    temperatureEntries(room)
      .filter((entry) => clean(entry.temp) || clean(entry.hum))
      .map((entry) => ({ room, entry })),
  );
}

function temperatureRecordKey(roomId, temperatureId) {
  return `${clean(roomId)}::${clean(temperatureId) || "primary"}`;
}

function temperatureSignature(roomValues = rooms()) {
  return temperatureRecords(roomValues)
    .map(({ room, entry }) =>
      [
        clean(room.id),
        clean(room.name),
        clean(room.icon),
        clean(entry.id),
        clean(entry.name),
        clean(entry.temp),
        clean(entry.hum),
        clean(room.temp_name),
        clean(room.hum_name),
      ].join("|"),
    )
    .join(";");
}

export function temperatureRoomTabsModel(roomValues = rooms()) {
  const configured = roomValues.filter((room) => temperatureEntries(room).length > 0);
  return [
    {
      id: "all",
      name: t("Tutte", "All"),
      icon: "🏠",
      count: configured.reduce((total, room) => total + temperatureEntries(room).length, 0),
    },
    ...configured.map((room) => ({
      id: clean(room.id),
      name: clean(room.name) || (t("Stanza", "Room")),
      icon: clean(room.icon) || "🏠",
      count: temperatureEntries(room).length,
    })),
  ];
}

function cardLabels(card, room) {
  const associationId = clean(card?.dataset?.temperatureId);
  const entry =
    temperatureEntries(room).find((item) => clean(item.id) === associationId) ||
    (associationId && associationId !== "primary" ? { id: associationId } : {});
  return temperatureCardLabels(room, entry);
}

export function installCanonicalApplianceArtworkBridge() {
  const current = root.cdApplianceIcon;
  if (typeof current !== "function") return false;
  if (current.__dmBeta26CanonicalArtwork === true) return true;

  function canonicalApplianceIcon(type, size = 96) {
    const visualKey = canonicalApplianceVisualKey(type) || clean(type) || "generico";
    return applianceArtwork(visualKey, size) || current(type, size);
  }
  canonicalApplianceIcon.__dmBeta26CanonicalArtwork = true;
  canonicalApplianceIcon.__dmPrevious = current;
  root.cdApplianceIcon = canonicalApplianceIcon;
  return true;
}

export function syncBeta26TemperatureLabels() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const byId = new Map(rooms().map((room) => [clean(room?.id), room]));
  let synced = false;

  grid.querySelectorAll(".temp-card[data-room-id]").forEach((card) => {
    const room = byId.get(clean(card.dataset.roomId));
    if (!room) return;
    const labels = cardLabels(card, room);
    const temperature = card.querySelector(".cp-temp-current-lbl");
    const humidity = card.querySelector(".cp-temp-target .lbl");
    const humidityText = `💧 ${labels.humidity}`;

    if (temperature && temperature.textContent !== labels.temperature)
      temperature.textContent = labels.temperature;
    if (temperature && temperature.title !== labels.temperature)
      temperature.title = labels.temperature;
    if (humidity && humidity.textContent !== humidityText) humidity.textContent = humidityText;
    if (humidity && humidity.title !== labels.humidity) humidity.title = labels.humidity;

    card.dataset.dmBeta26TemperatureLabels = "stable";
    synced = true;
  });
  return synced;
}

function updateStableTemperatureValues() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const records = new Map(
    temperatureRecords().map((record) => [
      temperatureRecordKey(record.room.id, record.entry.id),
      record,
    ]),
  );

  grid.querySelectorAll(".temp-card[data-room-id]").forEach((card) => {
    const record = records.get(
      temperatureRecordKey(card.dataset.roomId, card.dataset.temperatureId),
    );
    if (!record) return;
    const value = numericState(record.entry.temp);
    const humidity = numericState(humidityEntity(record.entry));
    const temperatureValue = card.querySelector(".temp-value");
    const humidityValue = card.querySelector(".temp-hum-val");
    const comfort = card.querySelector(".temp-comfort-badge");
    if (temperatureValue)
      temperatureValue.textContent = value == null ? "—" : value.toFixed(1);
    if (humidityValue)
      humidityValue.textContent = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
    applyTemperatureReading(card, value, humidity);
    if (comfort) {
      const label = comfortLabel(value);
      comfort.textContent = comfortBadgeText(label);
      comfort.title = label;
      comfort.setAttribute("aria-label", label);
      comfort.dataset.comfort = label.toLowerCase().replaceAll(" ", "-");
    }
  });
  syncBeta26TemperatureLabels();
  return true;
}

function applyTemperatureRoomFilter() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const tabs = temperatureRoomTabsModel();
  if (!tabs.some((tab) => tab.id === state.activeTemperatureRoom))
    state.activeTemperatureRoom = "all";

  grid.querySelectorAll(".temp-card[data-room-id]").forEach((card) => {
    const visible =
      state.activeTemperatureRoom === "all" ||
      clean(card.dataset.roomId) === state.activeTemperatureRoom;
    card.hidden = !visible;
    // The card layout owners declare `display:grid!important`, so the hidden
    // attribute alone is one cascade tweak away from being outranked. The
    // inline important declaration keeps the filter authoritative.
    if (visible) card.style?.removeProperty?.("display");
    else card.style?.setProperty?.("display", "none", "important");
    card.dataset.dmBeta27Filtered = visible ? "visible" : "hidden";
  });

  doc?.querySelectorAll?.("#dm-beta16-temperature-tabs [data-room-filter]").forEach(
    (button) => {
      const active = button.dataset.roomFilter === state.activeTemperatureRoom;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    },
  );
  return true;
}

/* Several layers can rebuild #temp-grid (this owner, the canonical temperature
 * section, the legacy runtime). Every rebuild drops the per-card filter state,
 * so watch the grid and restore the active room instead of trusting each
 * renderer to remember it. */
function observeTemperatureGrid() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid || typeof root.MutationObserver !== "function") return false;
  if (state.temperatureGridObserved === grid) return true;
  state.temperatureGridObserver?.disconnect?.();
  const observer = new root.MutationObserver(() => {
    if (state.temperatureFilterReentrant) return;
    state.temperatureFilterReentrant = true;
    try {
      applyTemperatureRoomFilter();
    } finally {
      state.temperatureFilterReentrant = false;
    }
  });
  observer.observe(grid, { childList: true });
  state.temperatureGridObserver = observer;
  state.temperatureGridObserved = grid;
  return true;
}

function ensureTemperatureRoomTabs() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid?.parentElement) return false;
  const tabs = temperatureRoomTabsModel();
  let host = doc.getElementById("dm-beta16-temperature-tabs");
  if (!host) {
    host = doc.createElement("nav");
    host.id = "dm-beta16-temperature-tabs";
    host.className = "dm-temperature-room-tabs dm-beta27-temperature-tabs";
    host.setAttribute("aria-label", t("Stanze temperatura", "Temperature rooms"));
    grid.before(host);
  }
  const signature = tabs.map((tab) => `${tab.id}|${tab.name}|${tab.icon}|${tab.count}`).join(";");
  if (host.dataset.signature !== signature) {
    host.dataset.signature = signature;
    host.replaceChildren(
      ...tabs.map((tab) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "sub-tab-btn dm-beta27-temperature-tab";
        button.dataset.roomFilter = tab.id;
        button.dataset.beta27TemperatureRoom = tab.id;
        button.innerHTML = `<span class="dm-beta27-temperature-tab-icon"></span><span>${esc(tab.name)}</span>${tab.count > 1 ? `<small>${tab.count}</small>` : ""}`;
        // Same painter as the load icons: an `mdi:` token goes through the icon
        // engine instead of being written as `ha-icon` markup this document
        // cannot resolve, and an emoji stays text.
        writeIconGlyph(button.querySelector(".dm-beta27-temperature-tab-icon"), tab.icon, {
          size: 22,
          fallback: "🏠",
          kind: "room",
        });
        button.addEventListener("click", () => {
          state.activeTemperatureRoom = tab.id;
          applyTemperatureRoomFilter();
        });
        return button;
      }),
    );
  }
  // Only the "all" entry means no room owns a sensor yet: nothing to filter.
  host.hidden = tabs.length <= 1;
  observeTemperatureGrid();
  applyTemperatureRoomFilter();
  return true;
}

export function renderStableBeta27Temperature() {
  const grid = doc?.getElementById?.("temp-grid");
  if (!grid) return false;
  const records = temperatureRecords();
  const signature = temperatureSignature();
  const cards = grid.querySelectorAll(".temp-card[data-room-id]");
  const needsStructure =
    signature !== state.temperatureSignature || cards.length !== records.length;

  if (needsStructure) {
    state.temperatureSignature = signature;
    renderBeta25TemperatureCards();
  }
  // The stable owner replaces the compatibility wrapper on slower WebKit
  // boots, so restore the long-standing canonical marker in the same render
  // turn instead of relying on a later scheduled reconciliation.
  if (records.length) {
    grid.dataset.beta25TemperatureRenderer = "multi";
    grid.dataset.dmTemperatureRenderer = "canonical";
  }
  ensureTemperatureRoomTabs();
  updateStableTemperatureValues();
  return records.length > 0;
}

function installStableTemperatureOwners() {
  let installed = false;
  for (const name of ["buildTempCards", "renderTemperature"]) {
    const current = root[name];
    if (current?.__dmBeta27StableTemperatureOwner) continue;
    function stableTemperatureOwner() {
      return renderStableBeta27Temperature();
    }
    stableTemperatureOwner.__dmBeta27StableTemperatureOwner = true;
    stableTemperatureOwner.__dmPrevious = current;
    root[name] = stableTemperatureOwner;
    installed = true;
  }
  return installed;
}

/* Nascosta a mano vuol dire nascosta.
 *
 * Nella mappa delle visibilita' un `false` puo' voler dire due cose opposte:
 * "questa sezione non l'ho ancora configurata", che ci scrive la procedura
 * iniziale, oppure "questa sezione non la voglio vedere", che ci scrive chi
 * preme il pulsante. La passata che accende le sezioni configurate le
 * trattava allo stesso modo e riscriveva tutti e due: chi nascondeva il MiniPC
 * — o qualunque altra sezione con delle entita' mappate — se lo ritrovava
 * acceso poco dopo, ogni volta, senza capire perche'.
 *
 * Qui si tiene da parte la sola cosa che distingue i due casi: su quali
 * sezioni la persona si e' espressa di persona. Su quelle non si torna. */
const MANUAL_VISIBILITY_KEY = "cd_sections_manual";

export function manualVisibilityChoices() {
  const value = readJson(MANUAL_VISIBILITY_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function rememberManualVisibility(key) {
  const name = clean(key);
  if (!name) return false;
  const current = manualVisibilityChoices();
  if (current[name] === true) return false;
  writeJsonIfChanged(MANUAL_VISIBILITY_KEY, { ...current, [name]: true });
  return true;
}

/* Il magazzino visto da qui.
 *
 * `readJson` restituisce il ripiego quando il valore non e' JSON, e una delle
 * chiavi che contano — la foto dell'auto — e' una stringa e basta: senza
 * questa riga la sezione Auto risultava vuota a chi ha solo caricato la foto. */
function magazzino(chiave) {
  const grezzo = root.localStorage?.getItem?.(chiave);
  if (grezzo === null || grezzo === undefined || grezzo === "") return null;
  try {
    return JSON.parse(grezzo);
  } catch (_error) {
    return grezzo;
  }
}

/* Le sezioni che hanno qualcosa dentro. Il giudizio sta tutto in
 * `core/contenuto-delle-sezioni.js`; qui si aggiunge la sola cosa che quella
 * regola non governa, e cioe' la Home — che non si spegne mai, ma si accende
 * quando ci si mette qualcosa. */
export function legacyVisibilityTargets() {
  const { piene } = contenutoDelleSezioni(magazzino);
  const targets = new Set(piene);

  const luci = magazzino("cd_luci");
  if (luci && typeof luci === "object" && Object.keys(luci).length) targets.add("home");

  /* Una casella dell'editor che non appartiene a nessuna sezione disegnata sta
   * in Home: e' li' che il guscio mette quello che non ha una pagina sua. */
  const caselle = magazzino("cd_entity_overrides");
  for (const [slot, value] of Object.entries(caselle || {})) {
    if (!clean(value).includes(".")) continue;
    if (!sectionForEditorSlot(String(slot))) targets.add("home");
  }
  return [...targets];
}

/* Una sezione vuota non sta nella barra.
 *
 * «tutte le sezioni devono nascere come nascoste, solo se si inserisce entita'
 * in una sezione diventa visibile.» Il verso dell'accensione c'era gia'; questo
 * e' l'altro, e ha due freni.
 *
 * Il primo: **su un magazzino che sembra vuoto non si spegne niente.** Se
 * nessuna delle sezioni governate ha contenuto, o siamo su una plancia appena
 * installata — e li' ha gia' fatto tutto la semina del guscio, che le nasce
 * spente — oppure la configurazione condivisa non e' ancora arrivata da Home
 * Assistant. Nel secondo caso spegnere vorrebbe dire scrivere «tutto nascosto»
 * nella configurazione di tutti i dispositivi, per un magazzino che di li' a
 * un secondo si riempie. Non si spegne: al massimo si perde un giro.
 *
 * Il secondo: **una scelta fatta a mano non si tocca.** Chi ha premuto la
 * fascia verde su una sezione ha detto la sua, e questa regola non risponde. */
function sezioniDaSpegnere() {
  const { piene, vuote } = contenutoDelleSezioni(magazzino);
  if (!piene.size) return [];
  const manual = manualVisibilityChoices();
  return [...vuote].filter((chiave) => manual[chiave] !== true);
}

/* La chiave di sezione della scheda aperta adesso, se ne governa una.
 * Le schede nate dai moduli senza riga nella mappa condivisa (le Prese col
 * loro banner inline) si aggiungono qui. */
function chiaveDellaSchedaAperta() {
  const extra = { prese: "prese" };
  const tab = schedaAttiva();
  return TAB_SECTION_KEYS[tab] || extra[tab] || "";
}

export function ensureConfiguredSectionsVisible({ sync = true, render = true, espressa = "" } = {}) {
  let changed = false;
  const store = dashboardStore();
  if (store?.getState && store?.ensureSectionVisibleForData) {
    const sections = Object.keys(store.getState()?.sections || {});
    for (const name of sections)
      if (store.ensureSectionVisibleForData(name)) changed = true;
    if (changed) store.persist?.();
  }

  const visibility = readJson("cd_sections", {});
  const next = visibility && typeof visibility === "object" && !Array.isArray(visibility)
    ? { ...visibility }
    : {};
  const manual = manualVisibilityChoices();
  for (const key of legacyVisibilityTargets()) {
    /* Su una sezione decisa a mano non si torna — tranne quando il gesto
     * nuovo e' piu' fresco del veto: salvare contenuto in una scheda E'
     * esprimersi su quella sezione («dopo aver fatto salva la sezione non
     * passa in visibile»). Vale per la sola sezione salvata; le altre
     * scelte manuali restano sacre. */
    if (manual[key] === true && key !== espressa) continue;
    if (next[key] === true) continue;
    next[key] = true;
    changed = true;
  }
  /* E l'altro verso: quella che non ha niente dentro esce dalla barra. La
   * sezione appena salvata non si spegne mai in questo giro — salvare e'
   * esprimersi, e la scheda puo' aver scritto in un posto che questa regola
   * legge un istante dopo. */
  for (const key of sezioniDaSpegnere()) {
    if (key === espressa) continue;
    if (next[key] === false) continue;
    next[key] = false;
    changed = true;
  }
  if (changed) {
    writeJsonIfChanged("cd_sections", next, { sync });
    root.cdApplyNavVis?.();
    if (render) root.render?.();
  }
  return changed;
}

/* L'esordio: ogni sezione nasce spenta se non ha niente dentro.
 *
 * Il guscio semina le sue undici voci, ma quelle nate dai moduli (Stanze,
 * Luci, Prese, Aspirapolvere) non le conosce: senza questa semina, dopo un
 * reset totale la barra le teneva accese su una plancia completamente vuota.
 * Adesso la semina copre tutte le sezioni governate, le undici comprese: se il
 * guscio le ha gia' scritte non cambia niente, e se un domani ne aggiunge una
 * che il guscio non conosce nasce spenta come tutte le altre.
 *
 * Semina e basta: una voce gia' scritta — a mano o da un giro precedente — non
 * si tocca. Accenderla e spegnerla al cambio di contenuto e' il mestiere della
 * riparazione qui sopra. */
export function seedModernSectionVisibility() {
  const visibility = readJson("cd_sections", {});
  const next = visibility && typeof visibility === "object" && !Array.isArray(visibility)
    ? { ...visibility }
    : {};
  const targets = legacyVisibilityTargets();
  let changed = false;
  for (const key of sezioniGovernate()) {
    if (key in next) continue;
    next[key] = targets.includes(key);
    changed = true;
  }
  if (changed) {
    writeJsonIfChanged("cd_sections", next);
    root.cdApplyNavVis?.();
  }
  return changed;
}

function scheduleVisibilityRepair(delay = 80, espressa = "") {
  /* Il clic sul bottone Salva e il submit della stessa forma arrivano in
   * coppia: il secondo non deve cancellare la sezione che il primo ha
   * dichiarato. */
  if (state.visibilityTimer && !espressa) espressa = clean(state.visibilityEspressa);
  state.visibilityEspressa = espressa;
  root.clearTimeout?.(state.visibilityTimer);
  state.visibilityTimer = root.setTimeout?.(() => {
    state.visibilityTimer = 0;
    state.visibilityEspressa = "";
    ensureConfiguredSectionsVisible({ espressa });
  }, delay);
}

function customGroups() {
  const values = readJson("cd_subload_groups", []);
  return Array.isArray(values) ? values.filter((group) => clean(group?.id)) : [];
}

export function loadGroupsModel() {
  const custom = customGroups();
  const byId = new Map(custom.map((group) => [clean(group.id), group]));
  const builtins = BUILTIN_LOAD_GROUPS.map((group) => ({
    ...group,
    ...(byId.get(group.id) || {}),
    id: group.id,
    builtin: true,
  }));
  const extras = custom
    .filter((group) => !BUILTIN_LOAD_GROUPS.some((builtin) => builtin.id === clean(group.id)))
    .map((group) => ({
      id: clean(group.id),
      name: clean(group.name) || clean(group.id),
      icon: clean(group.icon) || "🔌",
      color: clean(group.color) || "#64748b",
      builtin: false,
    }));
  return [...builtins, ...extras];
}

export function normalizeFlowNodesForEditor(value = readJson("cd_flow_nodes", {})) {
  const current = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(FLOW_NODE_DEFAULTS).map(([key, defaults]) => {
      const saved = current[key] || {};
      return [
        key,
        {
          ...defaults,
          ...saved,
          key,
          enabled: saved.enabled !== false,
          name: clean(saved.name) || defaults.name,
          icon: clean(saved.icon) || defaults.icon,
          group: Object.prototype.hasOwnProperty.call(saved, "group")
            ? clean(saved.group)
            : defaults.group,
          pwr: clean(saved.pwr),
          color: clean(saved.color) || defaults.color,
        },
      ];
    }),
  );
}

function loadExtras() {
  const value = readJson("cd_subloads_extra", {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function groupChildren(groupId) {
  const values = loadExtras()[clean(groupId)];
  return Array.isArray(values) ? values : [];
}

function childIdentity(groupId, child = {}) {
  const explicit = clean(child.id);
  if (explicit) return explicit;
  const source = [
    clean(groupId),
    clean(child.pwrLive || child.pwr),
    clean(child.name),
    clean(child.daily),
    clean(child.total),
  ].join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `subload-${clean(groupId) || "group"}-${(hash >>> 0).toString(36)}`;
}

function childIndexByIdentity(groupId, identity, children = groupChildren(groupId)) {
  const wanted = clean(identity);
  return children.findIndex((child) => childIdentity(groupId, child) === wanted);
}

function canonicalChildPatch(groupId, child) {
  const id = childIdentity(groupId, child);
  const icon = clean(child.icon) || "🔌";
  return {
    id,
    name: clean(child.name),
    icon: icon.startsWith("mdi:") ? icon : "",
    emoji_icon: icon.startsWith("mdi:") ? "" : icon,
    power_entity: clean(child.pwrLive || child.pwr),
    daily_energy_entity: clean(child.daily),
    monthly_energy_entity: clean(child.monthly),
    total_energy_entity: clean(child.total),
    state_entity: clean(child.bin),
    history_entity: clean(child.pwrLive || child.pwr),
    category: "secondary",
    device_type: "secondary",
    show_in_dashboard: false,
    show_in_report: true,
    metadata: {
      beta27_subload_id: id,
      beta27_subload_group: clean(groupId),
    },
  };
}

async function upsertCanonicalChild(groupId, child) {
  const store = dashboardStore();
  if (!store?.getState || !store?.addItem || !store?.updateItem) return false;
  const patch = canonicalChildPatch(groupId, child);
  const loads = store.getState()?.sections?.loads || [];
  const existing = loads.find(
    (item) =>
      clean(item?.metadata?.beta27_subload_id) === patch.metadata.beta27_subload_id ||
      clean(item?.id) === patch.id,
  );
  if (existing) await store.updateItem("loads", existing.id, { ...patch, id: existing.id });
  else await store.addItem("loads", patch);
  return true;
}

async function removeCanonicalChild(groupId, child) {
  const store = dashboardStore();
  if (!store?.getState || !store?.removeItem) return false;
  const identity = childIdentity(groupId, child);
  const existing = (store.getState()?.sections?.loads || []).find(
    (item) =>
      clean(item?.metadata?.beta27_subload_id) === identity || clean(item?.id) === identity,
  );
  if (!existing) return false;
  await store.removeItem("loads", existing.id);
  return true;
}

async function removeCanonicalGroup(groupId) {
  const store = dashboardStore();
  if (!store?.getState || !store?.removeItem) return false;
  const matches = (store.getState()?.sections?.loads || []).filter(
    (item) => clean(item?.metadata?.beta27_subload_group) === clean(groupId),
  );
  for (const item of matches) await store.removeItem("loads", item.id);
  return matches.length > 0;
}

function legacySubloadsConfig() {
  try {
    const value = root.eval?.(
      "typeof SUBLOADS_CONFIG !== 'undefined' ? SUBLOADS_CONFIG : null",
    );
    return value && typeof value === "object" ? value : null;
  } catch (_error) {
    return null;
  }
}

function synchronizeLegacySubloadRuntime() {
  const runtime = legacySubloadsConfig();
  if (!runtime) return false;
  const extras = loadExtras();
  const groups = loadGroupsModel();
  const activeIds = new Set(groups.map((group) => group.id));
  for (const groupId of state.managedRuntimeGroups) {
    if (!activeIds.has(groupId)) {
      delete runtime[groupId];
      state.managedRuntimeGroups.delete(groupId);
    }
  }
  for (const group of groups) {
    runtime[group.id] ||= {
      title: group.name,
      icon: group.icon || "🔌",
      items: [],
      custom: !group.builtin,
    };
    runtime[group.id].title = group.name;
    runtime[group.id].icon = group.icon || "🔌";
    runtime[group.id].items = Array.isArray(extras[group.id]) ? [...extras[group.id]] : [];
    if (!group.builtin) state.managedRuntimeGroups.add(group.id);
  }
  return true;
}

function groupOptions(selected = "") {
  return [
    `<option value="">— ${t("Nessun gruppo", "No group")} —</option>`,
    ...loadGroupsModel().map(
      (group) =>
        `<option value="${esc(group.id)}"${clean(selected) === group.id ? " selected" : ""}>${esc(group.icon)} ${esc(group.name)}</option>`,
    ),
  ].join("");
}

function entityEditorField(id, label, value = "", placeholder = "sensor.entity") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${esc(label)}</span><span class="ed-form-row"><input id="${esc(id)}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="${esc(placeholder)}"><button type="button" class="dm-entity-picker" data-beta27-entity-target="${esc(id)}" aria-label="${t("Seleziona", "Select")} ${esc(label)}">🔍</button></span></label>`;
}

function flowNodeMarkup(node) {
  return `<details class="ed-acc dm-beta27-flow-node" data-beta27-flow-node="${esc(node.key)}" open><summary class="ed-acc-head"><span>${esc(node.icon)} ${esc(node.label)} · ${esc(node.name)}</span><small>${node.group ? `${t("gruppo", "group")}: ${esc(node.group)}` : clean(node.pwr) ? "sensore" : t("automatico", "automatic")}</small></summary><div class="ed-acc-body"><label class="dm-beta27-switch"><input type="checkbox" data-flow-enabled${node.enabled ? " checked" : ""}><span>${t("Mostra il cerchio quando configurato", "Show node when configured")}</span></label><div class="ed-form-row"><input class="ed-input" data-flow-name placeholder="${t("Nome visualizzato", "Displayed name")}" value="${esc(node.name)}"><input class="ed-input ed-icon-input" data-flow-icon placeholder="🍳 / mdi:power-plug" value="${esc(node.icon)}"><input class="dm-beta27-color" data-flow-color type="color" value="${esc(node.color)}" title="${t("Colore", "Color")}"></div><label class="ed-slot"><span class="ed-slot-lbl">${t("Gruppo carichi collegato", "Linked load group")}</span><select class="ed-input" data-flow-group>${groupOptions(node.group)}</select></label>${entityEditorField(`dm-beta27-flow-power-${node.key}`, t("Entità potenza diretta (facoltativa)", "Direct power entity (optional)"), node.pwr, "sensor.cucina_power")}</div></details>`;
}

function childSummary(child = {}) {
  const power = clean(child.pwrLive || child.pwr);
  return [power, clean(child.daily), clean(child.monthly), clean(child.total)].filter(Boolean).join(" · ");
}

function groupMarkup(group) {
  const children = groupChildren(group.id);
  const rows = children
    .map(
      (child, index) =>
        `<article class="ed-row dm-beta27-child-row" data-beta27-child-group="${esc(group.id)}" data-beta27-child-id="${esc(childIdentity(group.id, child))}" data-beta27-child-index="${index}"><div class="ed-row-main"><div class="ed-row-new">${esc(child.icon || "🔌")} ${esc(child.name || (t("Carico", "Load")))}</div><div class="ed-row-old mono">${esc(childSummary(child))}</div></div><button type="button" class="ed-del" data-beta27-child-up title="${t("Sposta su", "Move up")}">▲</button><button type="button" class="ed-del" data-beta27-child-down title="${t("Sposta giù", "Move down")}">▼</button><button type="button" class="ed-del" data-beta27-child-edit title="${t("Modifica", "Edit")}">✏️</button><button type="button" class="ed-del" data-beta27-child-delete title="${t("Elimina", "Delete")}">🗑️</button></article>`,
    )
    .join("");
  return `<details class="ed-acc dm-beta27-load-group" data-beta27-group="${esc(group.id)}" open><summary class="ed-acc-head"><span>${esc(group.icon || "🔌")} ${esc(group.name)}</span><small>${children.length} ${t("carichi", "loads")}</small></summary><div class="ed-acc-body"><div class="ed-form-row dm-beta27-group-meta"><input class="ed-input" data-group-name value="${esc(group.name)}" aria-label="${t("Nome gruppo", "Group name")}"><input class="ed-input ed-icon-input" data-group-icon value="${esc(group.icon || "🔌")}" aria-label="${t("Icona gruppo", "Group icon")}"><input class="dm-beta27-color" data-group-color type="color" value="${esc(group.color || "#64748b")}" title="${t("Colore", "Color")}"><button type="button" class="ed-btn-secondary" data-beta27-group-save>💾</button>${group.builtin ? "" : `<button type="button" class="ed-del" data-beta27-group-delete>🗑️</button>`}</div><div class="ed-list dm-beta27-child-list">${rows || `<div class="ed-empty">${t("Nessun carico in questo gruppo.", "No loads in this group.")}</div>`}</div><button type="button" class="ed-btn-add" data-beta27-child-add>＋ ${t("Aggiungi carico", "Add load")}</button></div></details>`;
}

function childFormMarkup() {
  const editing = state.editingChild;
  if (!editing) return "";
  const children = groupChildren(editing.groupId);
  const index = editing.id ? childIndexByIdentity(editing.groupId, editing.id, children) : -1;
  const child = index >= 0 ? children[index] || {} : {};
  const title = index >= 0
    ? t("Modifica carico", "Edit load")
    : t("Nuovo carico", "New load");
  return `<div class="ed-form dm-beta27-child-form" data-beta27-child-form><div class="ed-sec-title">🔌 ${title}</div><label class="ed-slot"><span class="ed-slot-lbl">${t("Gruppo", "Group")}</span><select class="ed-input" data-child-group>${groupOptions(editing.groupId)}</select></label><div class="ed-form-row"><input class="ed-input" data-child-name placeholder="${t("Nome", "Name")}" value="${esc(child.name)}"><input class="ed-input ed-icon-input" data-child-icon placeholder="🔥 / mdi:stove" value="${esc(child.icon)}"></div>${entityEditorField("dm-beta27-child-power", t("Potenza istantanea", "Instant power"), child.pwrLive || child.pwr, "sensor.forno_power")}${entityEditorField("dm-beta27-child-state", t("Stato (facoltativo)", "State (optional)"), child.bin, "binary_sensor.forno")}${entityEditorField("dm-beta27-child-daily", t("Energia giornaliera", "Daily energy"), child.daily, "sensor.forno_oggi")}${entityEditorField("dm-beta27-child-monthly", t("Energia mensile", "Monthly energy"), child.monthly, "sensor.forno_mese")}${entityEditorField("dm-beta27-child-total", t("Energia totale", "Total energy"), child.total, "sensor.forno_totale")}<div class="dm-beta27-form-actions"><button type="button" class="ed-btn-add" data-beta27-child-save>💾 ${t("Salva carico", "Save load")}</button><button type="button" class="ed-btn-secondary" data-beta27-child-cancel>${t("Annulla", "Cancel")}</button></div></div>`;
}

function newGroupMarkup() {
  return `<div class="ed-form dm-beta27-new-group"><div class="ed-sec-title">＋ ${t("Nuovo gruppo", "New group")}</div><div class="ed-form-row"><input id="dm-beta27-new-group-name" class="ed-input" placeholder="${t("Nome, es. Cucina", "Name, e.g. Kitchen")}"><input id="dm-beta27-new-group-icon" class="ed-input ed-icon-input" value="🔌" placeholder="🔌"><input id="dm-beta27-new-group-color" class="dm-beta27-color" type="color" value="#64748b"></div><button type="button" class="ed-btn-add" data-beta27-group-add>＋ ${t("Crea gruppo", "Create group")}</button></div>`;
}

/* The Loads panel now belongs to the single-list editor, which configures the
 * dynamic stage directly. This two-section hierarchy — five fixed circles plus
 * separately bound groups — stands down rather than rendering underneath it.
 * The group and flow-node models below stay exported: the new editor reads the
 * same legacy keys once, to carry an existing configuration across. */
function loadsPanelOwnedElsewhere() {
  return root.__DM_20260817B__ === true;
}

export function renderBeta27LoadsEditor(target) {
  if (!target || state.loadsRendering || loadsPanelOwnedElsewhere()) return false;
  if (!target.matches?.('[data-energy-panel="loads"]')) return false;
  state.loadsRendering = true;
  try {
    const nodes = normalizeFlowNodesForEditor();
    const groups = loadGroupsModel();
    target.dataset.dmBeta27LoadsEditor = "true";
    let host = target.querySelector(":scope > [data-beta27-load-hierarchy]");
    if (!host) {
      host = doc.createElement("section");
      host.dataset.beta27LoadHierarchy = "true";
      target.append(host);
    }
    host.innerHTML = `<div class="dm-beta27-load-editor"><div class="ed-intro dm-beta27-load-intro"><b>${t("Flow carichi Energia", "Energy load flow")}</b><br>${t("Prima configura i cerchi collegati a Casa. Ogni cerchio può usare un sensore di potenza diretto oppure sommare automaticamente tutti i carichi del gruppo collegato. Poi inserisci forno, frigo, lavastoviglie e gli altri dispositivi dentro il gruppo. I nodi vuoti o disabilitati non vengono forzati nel flow.", "First configure the circles connected to Home. Each circle can use a direct power sensor or automatically sum every child of a load group. Then create the appliances inside each group. Empty or disabled nodes are not forced into the flow.")}</div><section class="dm-beta27-load-section"><div class="ed-sec-title">① ${t("CERCHI SOTTO CASA", "CIRCLES UNDER HOME")}</div><div class="ed-intro">${t("Nome, icona, colore, visibilità, gruppo e potenza diretta sono indipendenti per ogni nodo del flow.", "Name, icon, color, visibility, group and direct power are independent for every flow node.")}</div>${Object.values(nodes).map(flowNodeMarkup).join("")}<button type="button" class="ed-save-btn" data-beta27-flow-save>💾 ${t("Salva cerchi flow", "Save flow circles")}</button></section><section class="dm-beta27-load-section"><div class="ed-sec-title">② ${t("GRUPPI E CARICHI INTERNI", "GROUPS AND CHILD LOADS")}</div><div class="ed-intro">${t("Il gruppo è il popup aperto dal cerchio del flow. I figli sono le card interne, per esempio Forno, Frigorifero o Lavastoviglie.", "Groups are the popup opened from a flow circle. Their children are the cards shown inside, such as Oven, Fridge or Dishwasher.")}</div>${groups.map(groupMarkup).join("")}${newGroupMarkup()}${childFormMarkup()}</section></div>`;
    mountBeta27LoadsEditor(host, target);
  } finally {
    state.loadsRendering = false;
  }
  return true;
}

function pickEntity(input) {
  if (!input) return;
  root.wzPickEntity?.(input);
}

function persistGroup(groupId, patch) {
  const values = customGroups();
  const index = values.findIndex((group) => clean(group.id) === clean(groupId));
  const builtin = BUILTIN_LOAD_GROUPS.find((group) => group.id === clean(groupId));
  const current = index >= 0 ? values[index] : builtin || { id: clean(groupId) };
  const next = {
    ...current,
    ...patch,
    id: clean(groupId),
    name: clean(patch.name || current.name || groupId),
    icon: clean(patch.icon || current.icon) || "🔌",
    color: clean(patch.color || current.color) || "#64748b",
  };
  if (index >= 0) values[index] = next;
  else values.push(next);
  writeJsonIfChanged("cd_subload_groups", values);
  synchronizeLegacySubloadRuntime();
  return next;
}

function deleteGroup(groupId) {
  if (BUILTIN_LOAD_GROUPS.some((group) => group.id === clean(groupId))) return false;
  const groups = customGroups().filter((group) => clean(group.id) !== clean(groupId));
  const extras = loadExtras();
  delete extras[clean(groupId)];
  writeJsonIfChanged("cd_subload_groups", groups, { sync: false });
  writeJsonIfChanged("cd_subloads_extra", extras);
  const nodes = readJson("cd_flow_nodes", {});
  for (const value of Object.values(nodes || {}))
    if (clean(value?.group) === clean(groupId)) value.group = "";
  writeJsonIfChanged("cd_flow_nodes", nodes);
  const runtime = legacySubloadsConfig();
  if (runtime) delete runtime[clean(groupId)];
  state.managedRuntimeGroups.delete(clean(groupId));
  synchronizeLegacySubloadRuntime();
  void removeCanonicalGroup(groupId).catch((error) =>
    console.error("[DashboardModern] unable to remove canonical load group", error),
  );
  root.render?.();
  root.queueMicrotask?.(applyFlowNodeCustomization);
  return true;
}

function saveChild(groupId, identity, child) {
  const extras = loadExtras();
  const values = Array.isArray(extras[groupId]) ? [...extras[groupId]] : [];
  const index = identity ? childIndexByIdentity(groupId, identity, values) : -1;
  const next = { ...child, id: clean(identity) || childIdentity(groupId, child) };
  if (index >= 0) values[index] = next;
  else values.push(next);
  extras[groupId] = values;
  writeJsonIfChanged("cd_subloads_extra", extras);
  synchronizeLegacySubloadRuntime();
  void upsertCanonicalChild(groupId, next).catch((error) =>
    console.error("[DashboardModern] unable to synchronize canonical load", error),
  );
  return next;
}

function mutateChild(groupId, identity, operation, { removeCanonical = true } = {}) {
  const extras = loadExtras();
  const values = Array.isArray(extras[groupId]) ? [...extras[groupId]] : [];
  const index = childIndexByIdentity(groupId, identity, values);
  if (index < 0 || index >= values.length) return false;
  const child = values[index];
  if (operation === "delete") {
    values.splice(index, 1);
    if (removeCanonical)
      void removeCanonicalChild(groupId, child).catch((error) =>
        console.error("[DashboardModern] unable to remove canonical load", error),
      );
  }
  if (operation === "up" && index > 0)
    [values[index - 1], values[index]] = [values[index], values[index - 1]];
  if (operation === "down" && index < values.length - 1)
    [values[index + 1], values[index]] = [values[index], values[index + 1]];
  extras[groupId] = values;
  writeJsonIfChanged("cd_subloads_extra", extras);
  synchronizeLegacySubloadRuntime();
  return true;
}

function saveFlowNodes(target) {
  const next = {};
  target.querySelectorAll("[data-beta27-flow-node]").forEach((block) => {
    const key = clean(block.dataset.beta27FlowNode);
    if (!FLOW_NODE_DEFAULTS[key]) return;
    next[key] = {
      enabled: Boolean(block.querySelector("[data-flow-enabled]")?.checked),
      name: clean(block.querySelector("[data-flow-name]")?.value),
      icon: clean(block.querySelector("[data-flow-icon]")?.value),
      color: clean(block.querySelector("[data-flow-color]")?.value),
      group: clean(block.querySelector("[data-flow-group]")?.value),
      pwr: clean(block.querySelector(`#dm-beta27-flow-power-${key}`)?.value),
    };
  });
  writeJsonIfChanged("cd_flow_nodes", next);
  synchronizeLegacySubloadRuntime();
  ensureConfiguredSectionsVisible({ render: false });
  applyFlowNodeCustomization();
}

function groupIdFromName(name) {
  const token = clean(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `cl_${token || Date.now().toString(36)}`;
}

function mountBeta27LoadsEditor(target, panel = target) {
  target.querySelectorAll("[data-beta27-entity-target]").forEach((button) => {
    button.addEventListener("click", () =>
      pickEntity(target.querySelector(`#${button.dataset.beta27EntityTarget}`)),
    );
  });
  target.querySelector("[data-beta27-flow-save]")?.addEventListener("click", () => {
    saveFlowNodes(target);
    renderBeta27LoadsEditor(panel);
  });
  target.querySelectorAll("[data-beta27-group-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const block = button.closest("[data-beta27-group]");
      persistGroup(block.dataset.beta27Group, {
        name: block.querySelector("[data-group-name]")?.value,
        icon: block.querySelector("[data-group-icon]")?.value,
        color: block.querySelector("[data-group-color]")?.value,
      });
      renderBeta27LoadsEditor(panel);
    });
  });
  target.querySelectorAll("[data-beta27-group-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const block = button.closest("[data-beta27-group]");
      deleteGroup(block.dataset.beta27Group);
      state.editingChild = null;
      renderBeta27LoadsEditor(panel);
    });
  });
  target.querySelector("[data-beta27-group-add]")?.addEventListener("click", () => {
    const name = clean(target.querySelector("#dm-beta27-new-group-name")?.value);
    if (!name) return root.alert?.(t("Inserisci il nome del gruppo.", "Enter the group name."));
    const id = groupIdFromName(name);
    if (loadGroupsModel().some((group) => group.id === id))
      return root.alert?.(t("Esiste già un gruppo con questo nome.", "A group with this name already exists."));
    persistGroup(id, {
      name,
      icon: clean(target.querySelector("#dm-beta27-new-group-icon")?.value) || "🔌",
      color: clean(target.querySelector("#dm-beta27-new-group-color")?.value) || "#64748b",
    });
    synchronizeLegacySubloadRuntime();
    renderBeta27LoadsEditor(panel);
  });
  target.querySelectorAll("[data-beta27-child-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupId = button.closest("[data-beta27-group]").dataset.beta27Group;
      state.editingChild = { groupId, id: null };
      renderBeta27LoadsEditor(panel);
      panel.querySelector("[data-beta27-child-form]")?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    });
  });
  target.querySelectorAll("[data-beta27-child-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("[data-beta27-child-group]");
      state.editingChild = {
        groupId: clean(row.dataset.beta27ChildGroup),
        id: clean(row.dataset.beta27ChildId),
      };
      renderBeta27LoadsEditor(panel);
    });
  });
  for (const [selector, operation] of [
    ["[data-beta27-child-delete]", "delete"],
    ["[data-beta27-child-up]", "up"],
    ["[data-beta27-child-down]", "down"],
  ]) {
    target.querySelectorAll(selector).forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest("[data-beta27-child-group]");
        mutateChild(
          clean(row.dataset.beta27ChildGroup),
          clean(row.dataset.beta27ChildId),
          operation,
        );
        renderBeta27LoadsEditor(panel);
      });
    });
  }
  target.querySelector("[data-beta27-child-cancel]")?.addEventListener("click", () => {
    state.editingChild = null;
    renderBeta27LoadsEditor(panel);
  });
  target.querySelector("[data-beta27-child-save]")?.addEventListener("click", () => {
    const form = target.querySelector("[data-beta27-child-form]");
    const groupId = clean(form?.querySelector("[data-child-group]")?.value);
    const name = clean(form?.querySelector("[data-child-name]")?.value);
    const power = clean(form?.querySelector("#dm-beta27-child-power")?.value);
    if (!groupId || !name)
      return root.alert?.(t("Scegli il gruppo e inserisci il nome del carico.", "Choose a group and enter the load name."));
    if (!power.includes("."))
      return root.alert?.(t("Configura una entità valida per la potenza istantanea.", "Configure a valid instant power entity."));
    const editingId = clean(state.editingChild?.id);
    const child = {
      id: editingId,
      name,
      icon: clean(form.querySelector("[data-child-icon]")?.value) || "🔌",
      pwr: power,
      pwrLive: power,
      bin: clean(form.querySelector("#dm-beta27-child-state")?.value),
      daily: clean(form.querySelector("#dm-beta27-child-daily")?.value),
      monthly: clean(form.querySelector("#dm-beta27-child-monthly")?.value),
      total: clean(form.querySelector("#dm-beta27-child-total")?.value),
    };
    if (
      state.editingChild?.groupId &&
      state.editingChild.groupId !== groupId &&
      editingId
    ) {
      mutateChild(state.editingChild.groupId, editingId, "delete", {
        removeCanonical: false,
      });
    }
    saveChild(groupId, editingId, child);
    state.editingChild = null;
    ensureConfiguredSectionsVisible({ render: false });
    renderBeta27LoadsEditor(panel);
  });
}

function scheduleLoadsEditor() {
  root.queueMicrotask?.(() => {
    const panel = doc?.querySelector?.('[data-energy-panel="loads"]');
    // Preserve unsaved hierarchy input while slower mobile runtimes finish
    // unrelated readiness/store work. Explicit add/edit/save handlers render
    // synchronously; background reconciliation must not blank an open form.
    if (panel && !panel.querySelector("[data-beta27-child-form]"))
      renderBeta27LoadsEditor(panel);
  });
}

function applyFlowColor(node, color) {
  if (!node || !clean(color)) return;
  node.dataset.dmBeta27Color = color;
  node.style.setProperty("--dm-flow-color", color);
  node.style.setProperty("--primary-color", color);
  node.style.setProperty("border-color", color);
  node.querySelectorAll?.("circle,.flow-ring,.energy-ring,.node-ring").forEach((part) => {
    part.style.setProperty("stroke", color);
    part.style.setProperty("border-color", color);
  });
}

/* Le bolle del flusso Energia hanno un padrone solo.
 *
 * Nel guscio ci sono cinque bolle a posto fisso — Boiler, Wallbox, Clima,
 * Lavanderia, Cucina — disegnate quando i carichi erano quei cinque e basta.
 * Oggi i carichi li disegna il flusso nuovo, in numero e posizione decisi dalla
 * configurazione, e le cinque vecchie le ritira: le marchia
 * `data-dm-legacy-energy-load="replaced"` e le nasconde.
 *
 * Qui sotto si decide se una bolla e' spenta in configurazione. La domanda e'
 * legittima, ma non su una bolla gia' ritirata: rimettendole `display` a posto
 * («riacceso, dunque tornaci visibile») si cancellava proprio il `none` con cui
 * il flusso l'aveva ritirata, e la bolla vecchia ricompariva al suo posto fisso
 * — un cerchio in piu' in fondo, e uno sopra il Wallbox nuovo. Due padroni per
 * la stessa bolla, ed e' sempre il secondo a rovinare il lavoro del primo.
 *
 * Quindi: su una bolla ritirata dal flusso non si tocca niente, ne' per
 * nasconderla ne' per riaccenderla. E dove si tocca, si rimette il valore che
 * c'era prima invece di cancellare la proprieta', perche' cancellarla non
 * ripristina: scopre quello che ci stava sotto. */
const RITIRATA_DAL_FLUSSO = (element) => element?.dataset?.dmLegacyEnergyLoad === "replaced";

export function nascondiPerConfigurazione(element) {
  if (!element || RITIRATA_DAL_FLUSSO(element)) return;
  if (element.dataset.dmBeta27ForcedHidden !== "true") {
    /* Cosa c'era prima, per poterlo rimettere identico. La stringa vuota e'
     * «non c'era niente», ed e' un valore, non un'assenza. */
    element.dataset.dmBeta27DisplayPrima = element.style.getPropertyValue("display") || "";
    element.dataset.dmBeta27ForcedHidden = "true";
  }
  element.style.setProperty("display", "none", "important");
}

export function rimettiComeStava(element) {
  if (!element || element.dataset.dmBeta27ForcedHidden !== "true") return;
  const prima = element.dataset.dmBeta27DisplayPrima || "";
  delete element.dataset.dmBeta27ForcedHidden;
  delete element.dataset.dmBeta27DisplayPrima;
  if (prima) element.style.setProperty("display", prima);
  else element.style.removeProperty("display");
}

export function applyFlowNodeCustomization() {
  const raw = readJson("cd_flow_nodes", {});
  const nodes = normalizeFlowNodesForEditor(raw);
  for (const [key, node] of Object.entries(nodes)) {
    const target = doc?.getElementById?.(node.nodeId);
    const line = doc?.getElementById?.(node.lineId);
    const explicit = raw && Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : null;
    if (explicit?.enabled === false) {
      nascondiPerConfigurazione(target);
      nascondiPerConfigurazione(line);
      continue;
    }
    for (const element of [target, line]) {
      if (RITIRATA_DAL_FLUSSO(element)) continue;
      rimettiComeStava(element);
    }
    if (target && explicit?.color && !RITIRATA_DAL_FLUSSO(target)) applyFlowColor(target, node.color);
  }
  return true;
}

function patchSubloadPopup(groupId = state.popupGroup) {
  const id = clean(groupId);
  if (!id) return false;
  /* L'intestazione ha un proprietario solo.
   *
   * La finestra moderna se la scrive da se' — nome, icona e periodo in tre
   * pezzi, con l'icona `mdi:` risolta — e questa e' la mano di prima, che
   * scriveva la stessa cosa in un pezzo solo e di un altro colore. Le due si
   * sovrascrivevano: due schermate dello stesso minuto mostravano due
   * intestazioni diverse. Quando la finestra e' sua, qui non si scrive; per i
   * gruppi che lei non sa disegnare questa resta l'unica intestazione decente,
   * ed e' per quelli che serve ancora. */
  if (doc?.getElementById?.("subloads-list")?.dataset?.dmSubloadOwner === "beta30") return false;
  const group = loadGroupsModel().find((item) => item.id === id);
  const title = doc?.getElementById?.("subloads-title");
  const modal = doc?.getElementById?.("subloads-modal");
  if (!group || !title) return false;
  title.innerHTML = `<span style="font-size:24px;">${esc(group.icon || "🔌")}</span> ${esc(group.name)} ${t("ISTANTANEO", "INSTANT")}`;
  const color = group.color || "#0ea5e9";
  title.style.setProperty("--dm-beta27-group-color", color);
  modal?.style?.setProperty("--dm-beta27-group-color", color);
  return true;
}

function installPopupOwner() {
  let installed = false;
  for (const name of ["apriSubLoads", "openSubLoads"]) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmBeta27PopupOwner) continue;
    function beta27OpenSubLoads(type, ...args) {
      state.popupGroup = clean(type);
      const result = current.call(this, type, ...args);
      root.queueMicrotask?.(() => patchSubloadPopup(type));
      return result;
    }
    /* I segni di chi ha avvolto prima si portano avanti, altrimenti questo e
     * l'avvolgimento del popup moderno si riavvolgono a vicenda a ogni giro di
     * stati e la catena cresce senza fine. */
    Object.assign(beta27OpenSubLoads, current);
    beta27OpenSubLoads.__dmBeta27PopupOwner = true;
    beta27OpenSubLoads.__dmPrevious = current;
    root[name] = beta27OpenSubLoads;
    installed = true;
  }
  return installed;
}

function subscribeStore() {
  if (state.storeUnsubscribe) return true;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return false;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.status !== "optimistic" && change?.status !== "success") return;
    if (change?.section === "rooms" || change?.section === "snapshot") {
      state.temperatureSignature = "";
      renderStableBeta27Temperature();
    }
    if (change?.section === "loads" || change?.section === "energy") scheduleLoadsEditor();
  });
  return true;
}

function installStyles() {
  installStyle(
    "dm-beta27-real-device-stability-style",
    `
      #dm-beta16-temperature-tabs{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;width:100%!important;margin:8px 0 0!important;padding:8px 18px 12px!important;overflow-x:auto!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important}
      #dm-beta16-temperature-tabs[hidden]{display:none!important}
      #dm-beta16-temperature-tabs::-webkit-scrollbar{display:none!important}
      /* La veste tipografica e' quella delle pillole .sub-tab-btn di tutta la
       * plancia — 12px maiuscolo spaziato, raggio a capsula: qui si aggiunge
       * solo il layout (icona, conteggio, scorrimento), non un font diverso. */
      #dm-beta16-temperature-tabs .dm-beta27-temperature-tab{--dm-tab-surface:var(--ha-card-background,var(--card-bg,#fff));font-family:inherit!important;display:inline-flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important;min-height:44px!important;padding:9px 16px!important;border:1.5px solid var(--card-border,var(--divider-color,#dbe4ee))!important;border-radius:100px!important;background:var(--dm-tab-surface)!important;color:var(--text-dim,var(--secondary-text-color,#64748b))!important;font-size:12px!important;font-weight:800!important;letter-spacing:1.2px!important;text-transform:uppercase!important;box-shadow:0 8px 20px -12px rgba(15,23,42,.28)!important;transition:background .14s ease,border-color .14s ease,color .14s ease,transform .14s ease!important}
      #dm-beta16-temperature-tabs .dm-beta27-temperature-tab.active{border-color:color-mix(in srgb,var(--primary-color,#0ea5e9) 46%,transparent)!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 12%,var(--dm-tab-surface))!important;color:var(--primary-color,#0284c7)!important;box-shadow:0 10px 22px -12px color-mix(in srgb,var(--primary-color,#0ea5e9) 55%,transparent)!important}
      /* Il nome della stanza ci deve stare. La striscia scorre gia' di lato,
         quindi il taglio a 148px non serviva a proteggere niente: serviva solo
         a far finire «Camera matrimoniale» in tre puntini. Adesso il tetto e'
         largo quanto la maggior parte dello schermo, e le lettere spaziate
         quel tanto che basta a leggersi senza rubare posto. */
      #dm-beta16-temperature-tabs .dm-beta27-temperature-tab{letter-spacing:.6px!important}
      #dm-beta16-temperature-tabs .dm-beta27-temperature-tab>span:not(.dm-beta27-temperature-tab-icon){display:block!important;max-width:min(240px,64vw)!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #dm-beta16-temperature-tabs .dm-beta27-temperature-tab-icon{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;font-size:20px!important;line-height:1!important}
      #dm-beta16-temperature-tabs small{display:grid!important;place-items:center!important;min-width:19px!important;height:19px!important;padding:0 5px!important;border-radius:999px!important;background:color-mix(in srgb,currentColor 15%,transparent)!important;color:inherit!important;font-size:9px!important;font-weight:900!important}
      #temp-grid .temp-card[hidden]{display:none!important}
      #temp-grid .temp-room-icon,#temp-grid .temp-room-icon *,#editor-modal .dm-temperature-card-icon,#editor-modal .dm-temperature-card-icon *{animation:none!important;transition:none!important;transform:none!important;will-change:auto!important}
      [data-energy-panel="loads"][data-dm-beta27-loads-editor="true"]{display:block!important}
      .dm-beta27-load-editor{display:grid!important;gap:18px!important;padding-bottom:22px!important}
      .dm-beta27-load-section{display:grid!important;gap:10px!important;padding:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 2%,var(--ha-card-background,#fff))!important}
      .dm-beta27-load-intro{margin:0!important;padding:14px 16px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 18%,transparent)!important;border-radius:18px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 6%,var(--ha-card-background,#fff))!important}
      .dm-beta27-flow-node,.dm-beta27-load-group{margin:0!important;border-radius:16px!important;overflow:hidden!important}
      .dm-beta27-switch{display:flex!important;align-items:center!important;gap:9px!important;min-height:38px!important;font-size:12px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-beta27-switch input{width:20px!important;height:20px!important}
      .dm-beta27-color{flex:0 0 52px!important;width:52px!important;min-width:52px!important;height:46px!important;padding:4px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;background:var(--ha-card-background,#fff)!important}
      .dm-beta27-group-meta{align-items:center!important}
      .dm-beta27-child-list{display:grid!important;gap:8px!important;margin:8px 0!important}
      .dm-beta27-child-row{grid-template-columns:minmax(0,1fr) repeat(4,42px)!important;gap:6px!important}
      .dm-beta27-child-row>.ed-del{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;margin:0!important}
      .dm-beta27-child-form{margin-top:12px!important;padding:14px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 24%,transparent)!important;border-radius:18px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;box-shadow:0 12px 28px rgba(15,23,42,.08)!important}
      .dm-beta27-form-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important}
      .dm-beta27-form-actions>*{flex:1 1 180px!important}
      #subloads-modal .ev-waw-card{border-color:color-mix(in srgb,var(--dm-beta27-group-color,#0ea5e9) 42%,transparent)!important;box-shadow:0 24px 70px color-mix(in srgb,var(--dm-beta27-group-color,#0ea5e9) 18%,rgba(15,23,42,.28))!important}
      #subloads-title{color:var(--dm-beta27-group-color,var(--primary-color,#0ea5e9))!important}
      @media(min-width:900px){#dm-beta16-temperature-tabs .dm-beta27-temperature-tab>span:not(.dm-beta27-temperature-tab-icon){max-width:320px!important}}
      @media(max-width:640px){#dm-beta16-temperature-tabs{padding:8px 14px 12px!important}.dm-beta27-load-section{padding:11px!important}.dm-beta27-flow-node .ed-form-row,.dm-beta27-group-meta,.dm-beta27-new-group>.ed-form-row{display:grid!important;grid-template-columns:minmax(0,1fr) 70px!important}.dm-beta27-flow-node .ed-form-row>.dm-beta27-color,.dm-beta27-group-meta>.dm-beta27-color,.dm-beta27-new-group .dm-beta27-color{width:100%!important;min-width:0!important}.dm-beta27-child-row{grid-template-columns:minmax(0,1fr) repeat(2,42px)!important}.dm-beta27-child-row>.ed-del:nth-of-type(1),.dm-beta27-child-row>.ed-del:nth-of-type(2){display:none!important}}
    `,
  );
}

export function installBeta26RealDeviceStability() {
  if (!doc) return false;
  installStyles();
  installCanonicalApplianceArtworkBridge();
  installStableTemperatureOwners();
  installPopupOwner();
  subscribeStore();
  synchronizeLegacySubloadRuntime();
  renderStableBeta27Temperature();
  scheduleLoadsEditor();
  root.queueMicrotask?.(applyFlowNodeCustomization);

  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:temperature-editor-rendered",
    ])
      root.addEventListener?.(eventName, () => {
        installCanonicalApplianceArtworkBridge();
        installStableTemperatureOwners();
        installPopupOwner();
        subscribeStore();
        synchronizeLegacySubloadRuntime();
        renderStableBeta27Temperature();
        scheduleLoadsEditor();
        root.queueMicrotask?.(applyFlowNodeCustomization);
      });

    root.addEventListener?.("dashboardmodern:state-changed", () => {
      renderStableBeta27Temperature();
      applyFlowNodeCustomization();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            "#page-temp,[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7']",
          )
        )
          root.queueMicrotask?.(renderStableBeta27Temperature);
        if (
          event.target?.closest?.(
            "[data-energy-panel='loads'],.ed-inner-tab,.ed-tab[data-tab='sez1'],[data-tab='energy']",
          )
        )
          scheduleLoadsEditor();
        const button = event.target?.closest?.("button");
        const text = clean(button?.textContent).toLowerCase();
        const manualVisibility =
          button?.matches?.("[data-key]") ||
          /sezione visibile|sezione nascosta|section visible|section hidden/.test(text);
        if (manualVisibility && clean(button?.getAttribute?.("data-key")))
          rememberManualVisibility(button.getAttribute("data-key"));
        if (
          button &&
          !manualVisibility &&
          /salva|save|aggiungi|add|crea|create/.test(text)
        )
          scheduleVisibilityRepair(120, chiaveDellaSchedaAperta());
      },
      true,
    );
    /* Un submit che risale il documento e' anonimo: non dice quale forma sia
     * stata salvata, e in un editor pieno di forme puo' partire da ovunque —
     * anche subito dopo che la persona ha appena nascosto una sezione dalla
     * fascia. Qui la riparazione corre senza `espressa`: accende le sezioni
     * configurate mai decise, ma non tocca i veti manuali. Esprimersi su una
     * sezione resta il mestiere del clic sul suo vero bottone di salvataggio,
     * gestito qui sopra. */
    doc.addEventListener(
      "submit",
      () => {
        scheduleVisibilityRepair(120);
      },
      true,
    );
  }
  /* La semina corre all'avvio (e ai giri successivi di cdApplyNavVis non
   * serve: le chiavi ormai esistono). Un solo ritardo breve: prima deve
   * passare la proiezione del magazzino sulle chiavi legacy. */
  root.setTimeout?.(() => {
    try {
      seedModernSectionVisibility();
      /* Le sezioni svuotate — o accese da una versione che accendeva tutto —
       * escono dalla barra qui: la semina guarda solo le chiavi che ancora non
       * esistono, e da sola non le avrebbe mai riguardate. */
      ensureConfiguredSectionsVisible({ render: false });
    } catch (_error) {}
  }, 400);
  /* La configurazione condivisa arriva da Home Assistant dopo l'avvio: prima
   * che arrivi il magazzino e' vuoto e la regola sta ferma di proposito. Al
   * suo arrivo si guarda di nuovo, adesso che c'e' qualcosa da guardare. */
  root.addEventListener?.("dashboardmodern:persistence-restored", () => {
    try {
      seedModernSectionVisibility();
      ensureConfiguredSectionsVisible({ render: false });
    } catch (_error) {}
  });
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta26RealDeviceStability, { once: true });
else installBeta26RealDeviceStability();

export const beta26RealDeviceStability = Object.freeze({
  installCanonicalApplianceArtworkBridge,
  syncBeta26TemperatureLabels,
  renderStableBeta27Temperature,
  temperatureRoomTabsModel,
  legacyVisibilityTargets,
  ensureConfiguredSectionsVisible,
  loadGroupsModel,
  normalizeFlowNodesForEditor,
  renderBeta27LoadsEditor,
  applyFlowNodeCustomization,
  installBeta26RealDeviceStability,
});
