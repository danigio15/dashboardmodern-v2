import { SIGNED_GROUPS, SIGNED_MEASURES, signedSource } from "./signed-energy.js";
// DM-FIX-20260812B
import { getDeviceDisplayName, getDeviceVisual } from "./device-model.js";
import { pick } from "./i18n.js";
import { runtimeMetrics } from "./runtime-metrics.js";

function metric(states, entity, expectedUnit) {
  const state = entity && states[entity];
  const value = Number(state?.state);
  return {
    entity: entity || "",
    value: Number.isFinite(value) ? value : null,
    unit: state?.attributes?.unit_of_measurement || expectedUnit,
  };
}

export function createEnergyReportRows(
  appliances = [],
  states = {},
  rooms = [],
  costPerKwh = 0,
  locale = "it",
) {
  return appliances.map((device) => {
    const daily = metric(states, device.daily_energy_entity, "kWh");
    const monthly = metric(states, device.monthly_energy_entity, "kWh");
    return {
      id: device.id,
      name: getDeviceDisplayName(device, states, locale),
      visual: getDeviceVisual(device),
      category: device.device_type || pick("Elettrodomestico", "Appliance", locale),
      room: rooms.find((room) => room.id === device.room_id) || null,
      power: metric(states, device.power_entity, "W"),
      daily,
      monthly,
      total: metric(states, device.total_energy_entity || device.energy_entity, "kWh"),
      cost: monthly.value == null ? null : monthly.value * Number(costPerKwh || 0),
      state:
        metric(states, device.control_entity, "").value ??
        states[device.control_entity]?.state ??
        "unknown",
      historyEntity: device.history_entity || device.energy_entity || device.power_entity || "",
    };
  });
}

export function createRenderCoordinator(store, renderers = {}) {
  const call = (name, ...args) => typeof renderers[name] === "function" && renderers[name](...args);
  return store.subscribe((change) => {
    if (change.status !== "optimistic" && change.status !== "rollback") return;
    call("renderSection", change.section, change);
    const names = {
      appliances: "renderAppliances",
      cameras: "renderCameras",
      lights: "renderLights",
      climate: "renderClimate",
      covers: "renderCovers",
      pool: "renderPool",
      irrigation: "renderIrrigation",
      rooms: "renderRooms",
      ev: "renderEvProfiles",
      energy: "renderEnergy",
    };
    call(names[change.section], change);
    if (["appliances", "loads", "energy", "report"].includes(change.section))
      call("renderEnergyReport", change);
    if (change.section === "rooms") {
      call("renderRoomSelectors", change);
      call("renderLights", change);
      call("renderAppliances", change);
    }
    // Keep the open editor in step with the optimistic model (and with a
    // rollback).  Previously only dashboard renderers were called here, so
    // the stale editor DOM survived until editorSwitch() happened to rebuild it.
    call("renderCurrentEditor", change.section, change);
    call("renderDropdowns", change.section, change);
    runtimeMetrics.increment("globalRenders");
    call("renderDashboard", change.section, change);
    if (change.visibilityChanged) call("renderNavbar", change);
  });
}

export function renderDeviceCard(document, target, device, states = {}, rooms = [], locale = "it") {
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return null;
  const visual = getDeviceVisual(device);
  const card = document.createElement("article");
  card.className = "ed-row";
  card.dataset.deviceId = device.id;
  const room = rooms.find((value) => value.id === device.room_id);
  const media = document.createElement(visual.kind === "image" ? "img" : "span");
  media.className = "appl-ic";
  if (visual.kind === "image") {
    media.src = visual.value;
    media.alt = "";
  } else if (visual.kind === "asset") {
    media.dataset.asset = visual.value;
    media.innerHTML = globalThis.cdApplianceIcon?.(visual.value, 28) || visual.value;
  } else media.dataset.icon = visual.value;
  const title = document.createElement("strong");
  title.textContent = getDeviceDisplayName(device, states, locale);
  const category = document.createElement("small");
  category.textContent = device.device_type || device.section;
  const roomLabel = document.createElement("small");
  roomLabel.textContent = room?.name || "";
  card.append(media, title, category, roomLabel);
  root.append(card);
  return card;
}

const ENERGY_GROUPS = [
  [
    "house",
    "Casa",
    [
      ["power", "Potenza istantanea", "W", "sensor.casa_power"],
      ["daily_energy", "Energia giornaliera", "kWh", "sensor.casa_oggi"],
      ["monthly_energy", "Energia mensile", "kWh", "sensor.casa_mese"],
      ["annual_energy", "Energia annuale", "kWh", "sensor.casa_anno"],
      ["total_energy", "Contatore energia totale", "kWh", "sensor.casa_totale"],
    ],
  ],
  [
    "grid",
    "Rete · prelievo",
    [
      ["power", "Potenza rete", "W", "sensor.rete_power"],
      ["daily_import_energy", "Energia prelevata giornaliera", "kWh", "sensor.rete_prelievo_oggi"],
      ["monthly_import_energy", "Energia prelevata mensile", "kWh", "sensor.rete_prelievo_mese"],
      ["annual_import_energy", "Energia prelevata annuale", "kWh", "sensor.rete_prelievo_anno"],
      ["total_import_energy", "Contatore energia totale", "kWh", "sensor.rete_prelievo_totale"],
    ],
  ],
  [
    "grid",
    "Rete · immissione",
    [
      ["power", "Potenza", "W", "sensor.rete_power"],
      ["daily_export_energy", "Energia immessa giornaliera", "kWh", "sensor.rete_immissione_oggi"],
      ["monthly_export_energy", "Energia immessa mensile", "kWh", "sensor.rete_immissione_mese"],
      ["annual_export_energy", "Energia immessa annuale", "kWh", "sensor.rete_immissione_anno"],
      ["total_export_energy", "Contatore energia totale", "kWh", "sensor.rete_immissione_totale"],
    ],
  ],
  [
    "solar",
    "Fotovoltaico",
    [
      ["power", "Potenza", "W", "sensor.fv_power"],
      ["daily_energy", "Energia giornaliera", "kWh", "sensor.fv_oggi"],
      ["monthly_energy", "Energia mensile", "kWh", "sensor.fv_mese"],
      ["annual_energy", "Energia annuale", "kWh", "sensor.fv_anno"],
      ["total_energy", "Contatore energia totale", "kWh", "sensor.fv_totale"],
    ],
  ],
  [
    "battery",
    "Batteria · carica",
    [
      ["power", "Potenza", "W", "sensor.batteria_power"],
      ["soc", "Stato di carica", "%", "sensor.batteria_soc"],
      ["daily_charged_energy", "Caricata oggi", "kWh", "sensor.batteria_caricata_oggi"],
      ["monthly_charged_energy", "Caricata questo mese", "kWh", "sensor.batteria_caricata_mese"],
      ["annual_charged_energy", "Caricata questo anno", "kWh", "sensor.batteria_caricata_anno"],
      [
        "total_charged_energy",
        "Contatore energia totale",
        "kWh",
        "sensor.batteria_caricata_totale",
      ],
    ],
  ],
  [
    "battery",
    "Batteria · scarica",
    [
      ["power", "Potenza", "W", "sensor.batteria_power"],
      ["daily_discharged_energy", "Scaricata oggi", "kWh", "sensor.batteria_scaricata_oggi"],
      [
        "monthly_discharged_energy",
        "Scaricata questo mese",
        "kWh",
        "sensor.batteria_scaricata_mese",
      ],
      [
        "annual_discharged_energy",
        "Scaricata questo anno",
        "kWh",
        "sensor.batteria_scaricata_anno",
      ],
      [
        "total_discharged_energy",
        "Contatore energia totale",
        "kWh",
        "sensor.batteria_scaricata_totale",
      ],
    ],
  ],
];

const ENERGY_ICONS = { house: "🏠", grid: "🔌", solar: "☀️", battery: "🔋" };
const ENERGY_EN = Object.freeze({
  // Il collante del rimando: il nome del campo e quello del riquadro arrivano
  // gia' tradotti, questa e' l'unica parte che va detta anche in inglese.
  "è una sola, si imposta in": "there is only one, set it under",
  Casa: "Home",
  Rete: "Grid",
  "Rete · prelievo": "Grid · import",
  "Rete · immissione": "Grid · export",
  Fotovoltaico: "Solar",
  Batteria: "Battery",
  "Batteria · carica": "Battery · charge",
  "Batteria · scarica": "Battery · discharge",
  "Potenza istantanea": "Instant power",
  "Energia giornaliera": "Daily energy",
  "Energia mensile": "Monthly energy",
  "Energia annuale": "Annual energy",
  "Energia totale": "Total energy",
  "Contatore energia totale": "Total energy meter",
  "Energia prelevata annuale": "Annual imported energy",
  "Energia immessa annuale": "Annual exported energy",
  "Caricata oggi": "Charged today",
  "Caricata questo mese": "Charged this month",
  "Caricata questo anno": "Charged this year",
  "Scaricata oggi": "Discharged today",
  "Scaricata questo mese": "Discharged this month",
  "Scaricata questo anno": "Discharged this year",
  "Potenza rete": "Grid power",
  "Potenza prelevata": "Import power",
  "Potenza immessa": "Export power",
  "Energia prelevata giornaliera": "Daily imported energy",
  "Energia immessa giornaliera": "Daily exported energy",
  "Energia prelevata mensile": "Monthly imported energy",
  "Energia immessa mensile": "Monthly exported energy",
  "Energia totale prelevata": "Total imported energy",
  "Energia totale immessa": "Total exported energy",
  Potenza: "Power",
  SOC: "State of charge",
  "Stato di carica": "State of charge",
  "Energia caricata": "Charged energy",
  "Energia scaricata": "Discharged energy",
});

/* Authored as it/en pairs so any locale resolves through the shared catalog
 * instead of picking one of two hard-coded columns. */
const ENERGY_UI_SOURCE = Object.freeze({
  select: ["Seleziona", "Select"],
  optional: ["Facoltativo", "Optional"],
  entityHint: ["Entità Home Assistant, es.", "Home Assistant entity, e.g."],
  configured: ["configurati", "configured"],
  save: ["💾 Salva Energia", "💾 Save Energy"],
  clean: ["Nessuna modifica non salvata", "No unsaved changes"],
  dirty: ["Modifiche non salvate", "Unsaved changes"],
});

function energyCopy(locale) {
  const copy = {};
  for (const [key, [it, en]] of Object.entries(ENERGY_UI_SOURCE)) copy[key] = pick(it, en, locale);
  return copy;
}

/* An Energy source label is authored in Italian; `ENERGY_EN` is its English
 * pivot, which is what the catalogs are keyed by. */
function energyLabel(italian, locale) {
  return pick(italian, ENERGY_EN[italian] || italian, locale);
}

export function createEntityPickerField(
  document,
  {
    id = "dm-energy-entity",
    value = "",
    placeholder = "",
    label = "Entità",
    locale = "it",
    state,
    unit = "",
    onPick,
    onChange,
  } = {},
) {
  const copy = energyCopy(locale);
  const field = document.createElement("span");
  field.className = "dm-entity-field";
  field.dataset.entityField = "";
  const row = document.createElement("span");
  row.className = "ed-form-row";
  const input = document.createElement("input");
  input.id = id;
  input.className = "ed-input ed-slot-in mono";
  input.dataset.entityInput = "true";
  input.value = value;
  input.placeholder = placeholder;
  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.dataset.entityTarget = input.id;
  picker.dataset.pickerMounted = "true";
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `${copy.select} ${label}`);
  picker.addEventListener("click", () => onPick?.(input));
  input.addEventListener("change", () => onChange?.(input.value, input));
  row.append(input, picker);
  field.append(row);
  if (value && state != null) {
    const preview = document.createElement("output");
    preview.className = "ed-row-old dm-entity-preview";
    preview.textContent = `${state}${unit ? ` ${unit}` : ""}`;
    field.append(preview);
  }
  return { field, input, picker };
}

/* La sorgente unica, dichiarata una volta sola.
 *
 * Rete e batteria si configurano in due pagine, una per verso. Chi ha un solo
 * sensore che diventa negativo quando il verso si inverte non aveva modo di
 * dirlo, e finiva per mettere la stessa entita' nelle due caselle: la mappa
 * sommava il prelievo all'immissione. Qui l'entita' si dichiara una volta,
 * insieme a cosa vogliono dire i valori positivi, e le caselle dei due versi
 * si spengono perche' non c'e' piu' niente da riempire a mano. */
const SIGNED_UI = Object.freeze({
  it: {
    grid: {
      title: "🔀 Una sola entità con segno",
      hint: "Se il tuo inverter pubblica un solo sensore che diventa negativo quando il verso si inverte, dichiaralo qui: prelievo e immissione vengono ricavati dal segno e le caselle dei due versi si spengono.",
      toggle: "Ho una sola entità con segno per la rete",
      positive: "I valori positivi sono",
      directions: { import: "Prelievo dalla rete", export: "Immissione in rete" },
      measures: {
        power: ["Potenza rete con segno", "W", "sensor.rete_potenza"],
        daily: ["Energia rete di oggi con segno", "kWh", "sensor.rete_oggi"],
        monthly: ["Energia rete del mese con segno", "kWh", "sensor.rete_mese"],
        annual: ["Energia rete dell'anno con segno", "kWh", "sensor.rete_anno"],
      },
      managed: "Ricavato dalla sorgente unica con segno.",
    },
    battery: {
      title: "🔀 Una sola entità con segno",
      hint: "Se la batteria pubblica un solo sensore che diventa negativo quando passa da carica a scarica, dichiaralo qui: carica e scarica vengono ricavate dal segno e le caselle dei due versi si spengono.",
      toggle: "Ho una sola entità con segno per la batteria",
      positive: "I valori positivi sono",
      directions: { discharge: "Scarica (batteria → casa)", charge: "Carica (→ batteria)" },
      measures: {
        power: ["Potenza batteria con segno", "W", "sensor.batteria_potenza"],
        daily: ["Energia batteria di oggi con segno", "kWh", "sensor.batteria_oggi"],
        monthly: ["Energia batteria del mese con segno", "kWh", "sensor.batteria_mese"],
        annual: ["Energia batteria dell'anno con segno", "kWh", "sensor.batteria_anno"],
      },
      managed: "Ricavato dalla sorgente unica con segno.",
    },
  },
  en: {
    grid: {
      title: "🔀 A single signed entity",
      hint: "If your inverter publishes one sensor that goes negative when the direction flips, declare it here: import and export are derived from the sign and the per-direction fields switch off.",
      toggle: "I have a single signed entity for the grid",
      positive: "Positive values mean",
      directions: { import: "Import from grid", export: "Export to grid" },
      measures: {
        power: ["Signed grid power", "W", "sensor.grid_power"],
        daily: ["Signed grid energy today", "kWh", "sensor.grid_today"],
        monthly: ["Signed grid energy this month", "kWh", "sensor.grid_month"],
        annual: ["Signed grid energy this year", "kWh", "sensor.grid_year"],
      },
      managed: "Derived from the single signed entity.",
    },
    battery: {
      title: "🔀 A single signed entity",
      hint: "If the battery publishes one sensor that goes negative when it switches between charge and discharge, declare it here: charge and discharge are derived from the sign and the per-direction fields switch off.",
      toggle: "I have a single signed entity for the battery",
      positive: "Positive values mean",
      directions: { discharge: "Discharge (battery → home)", charge: "Charge (→ battery)" },
      measures: {
        power: ["Signed battery power", "W", "sensor.battery_power"],
        daily: ["Signed battery energy today", "kWh", "sensor.battery_today"],
        monthly: ["Signed battery energy this month", "kWh", "sensor.battery_month"],
        annual: ["Signed battery energy this year", "kWh", "sensor.battery_year"],
      },
      managed: "Derived from the single signed entity.",
    },
  },
});

/** I campi del gruppo che la sorgente unica riempie da sola. */
export function signedManagedFields(model = {}, group = "") {
  const definition = SIGNED_GROUPS[group];
  const source = signedSource(model, group);
  if (!definition || !source) return new Set();
  const fields = new Set();
  if (source.entities.power) fields.add(definition.powerField);
  for (const period of definition.periods) {
    if (!source.entities[period.key]) continue;
    fields.add(period.positive);
    fields.add(period.negative);
  }
  return fields;
}

function createSignedCard(document, group, model, states, locale, handlers) {
  const definition = SIGNED_GROUPS[group];
  const copy = (SIGNED_UI[locale] || SIGNED_UI.it)[group];
  const source = signedSource(model, group);
  const declared = { ...(model?.[group]?.signed || {}) };
  const positive = source?.positive || definition.positiveDefault;
  const card = document.createElement("div");
  card.className = "dm-energy-signed";
  card.dataset.energySigned = group;
  card.dataset.state = source ? "on" : "off";

  const head = document.createElement("label");
  head.className = "dm-energy-signed-head";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = Boolean(source);
  toggle.dataset.energySignedToggle = group;
  const title = document.createElement("span");
  title.innerHTML = `<strong>${copy.title}</strong><small>${copy.toggle}</small>`;
  head.append(toggle, title);

  const body = document.createElement("div");
  body.className = "dm-energy-signed-body";
  body.hidden = !source;
  const hint = document.createElement("p");
  hint.className = "ed-hint dm-energy-signed-hint";
  hint.textContent = copy.hint;
  body.append(hint);

  const emit = () => handlers.onSignedChange?.(group, { ...declared, positive });
  const readDeclared = () => ({ ...declared, positive });

  const direction = document.createElement("div");
  direction.className = "dm-energy-signed-direction";
  direction.innerHTML = `<span class="ed-slot-lbl">${copy.positive}</span>`;
  const name = `dm-energy-signed-${group}-positive`;
  for (const value of definition.directions) {
    const option = document.createElement("label");
    option.className = "dm-energy-signed-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = name;
    radio.value = value;
    radio.checked = positive === value;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      handlers.onSignedChange?.(group, { ...readDeclared(), positive: value });
      handlers.onSignedRerender?.(group);
    });
    const text = document.createElement("span");
    text.textContent = copy.directions[value];
    option.append(radio, text);
    direction.append(option);
  }
  body.append(direction);

  for (const measure of SIGNED_MEASURES) {
    const [label, unit, example] = copy.measures[measure];
    const field = document.createElement("label");
    field.className = "ed-slot dm-energy-signed-field";
    field.dataset.energySignedMeasure = measure;
    field.innerHTML = `<span class="ed-slot-lbl">${label} <span class="ed-acc-n">${unit}</span></span>`;
    const value = String(declared[measure] || "").trim();
    const { field: entity, input } = createEntityPickerField(document, {
      id: `dm-energy-signed-${group}-${measure}`,
      value,
      placeholder: example,
      label,
      locale,
      state: states?.[value]?.state,
      unit,
      onPick: handlers.onPick,
      onChange: (next) => {
        declared[measure] = String(next || "").trim();
        emit();
        handlers.onSignedRerender?.(group);
      },
    });
    input.name = `${group}.signed.${measure}`;
    field.append(entity);
    body.append(field);
  }

  toggle.addEventListener("change", () => {
    card.dataset.state = toggle.checked ? "on" : "off";
    body.hidden = !toggle.checked;
    if (toggle.checked) {
      /* Accendere la spunta e' gia' una dichiarazione: si salva subito, cosi'
       * il primo ridisegno che passa non trova il vuoto e non la rispegne.
       * Non si ridisegna, pero': aprire il corpo non cambia nient'altro. */
      handlers.onSignedChange?.(group, { ...declared, positive });
      return;
    }
    for (const measure of SIGNED_MEASURES) delete declared[measure];
    // Spegnendola non resta niente, verso compreso: e' cosi' che si cancella.
    handlers.onSignedChange?.(group, {});
    handlers.onSignedRerender?.(group);
  });

  card.append(head, body);
  return card;
}

export function renderEnergyEditor(
  document,
  target,
  model = {},
  appliances = [],
  states = {},
  locale = "it",
  handlers = {},
) {
  const copy = energyCopy(locale);
  const root = typeof target === "string" ? document.querySelector(target) : target;
  if (!root) return;
  root.replaceChildren();
  root.classList.add("ed-list");
  root.dataset.editor = "energy";
  const tabs = document.createElement("div");
  tabs.className = "ed-inner-tabs";
  const flowsButton = document.createElement("button");
  flowsButton.className = "ed-inner-tab active";
  flowsButton.type = "button";
  flowsButton.textContent = pick("FLUSSI ED ENTITÀ", "FLOWS & ENTITIES", locale);
  const settingsButton = document.createElement("button");
  settingsButton.className = "ed-inner-tab";
  settingsButton.type = "button";
  settingsButton.textContent = pick("IMPOSTAZIONI", "SETTINGS", locale);
  const loadsButton = document.createElement("button");
  loadsButton.className = "ed-inner-tab";
  loadsButton.type = "button";
  // The panel configures the circles under Home and the devices inside each
  // one, so it is named after both rather than after the internal word "loads".
  loadsButton.textContent = pick("CARICHI E DISPOSITIVI", "LOADS & DEVICES", locale);
  const reportButton = document.createElement("button");
  reportButton.className = "ed-inner-tab";
  reportButton.type = "button";
  reportButton.textContent = "REPORT";
  const flows = document.createElement("section");
  flows.dataset.energyPanel = "flows";
  const intro = document.createElement("p");
  intro.className = "ed-intro dm-energy-recorder-explanation";
  intro.textContent = pick(
    "Per ogni sorgente, Contatore energia totale è il sensore cumulativo Recorder (normalmente state_class: total_increasing). Non è un valore di periodo: giorno, mese e anno sono calcolati come somma Recorder finale meno somma Recorder iniziale, preservando i reset. I sensori di periodo sono override facoltativi del periodo corrente.",
    "For every source, Total energy meter is the cumulative Recorder source (normally state_class: total_increasing). It is not a period value: day, month and year are calculated as final Recorder sum minus initial Recorder sum, so meter resets are preserved. Period sensors are optional current-period overrides.",
    locale,
  );
  flows.append(intro);
  const settings = document.createElement("section");
  settings.dataset.energyPanel = "settings";
  settings.hidden = true;
  const loads = document.createElement("section");
  loads.dataset.energyPanel = "loads";
  loads.hidden = true;
  const report = document.createElement("section");
  report.dataset.energyPanel = "report";
  report.hidden = true;
  const selectTab = (name) => {
    flows.hidden = name !== "flows";
    settings.hidden = name !== "settings";
    loads.hidden = name !== "loads";
    report.hidden = name !== "report";
    flowsButton.classList.toggle("active", name === "flows");
    settingsButton.classList.toggle("active", name === "settings");
    loadsButton.classList.toggle("active", name === "loads");
    reportButton.classList.toggle("active", name === "report");
    handlers.onTabChange?.(name);
  };
  flowsButton.addEventListener("click", () => selectTab("flows"));
  settingsButton.addEventListener("click", () => selectTab("settings"));
  loadsButton.addEventListener("click", () => selectTab("loads"));
  reportButton.addEventListener("click", () => selectTab("report"));
  tabs.append(flowsButton, loadsButton, reportButton, settingsButton);
  root.append(tabs, flows, loads, report, settings);
  /* La sorgente unica sta nella prima delle due pagine del gruppo: dichiararla
   * due volte vorrebbe dire due padroni sullo stesso dato. */
  const signedHome = new Map();
  ENERGY_GROUPS.forEach(([group], groupIndex) => {
    if (SIGNED_GROUPS[group] && !signedHome.has(group)) signedHome.set(group, groupIndex);
  });
  /* Una casella per campo, non una per riquadro.
   *
   * Rete e batteria si configurano in due riquadri, uno per verso, e la
   * potenza compariva in tutti e due — ma il modello ne ha una sola:
   * `grid.power` e' la potenza scambiata con la rete, col segno a dire da che
   * parte va. Le due caselle erano quindi la stessa casella disegnata due
   * volte: si scriveva il sensore sotto «Rete · prelievo» e lo si vedeva
   * comparire sotto «Rete · immissione», e sembrava che l'uno scrivesse
   * nell'altro. Segnalato proprio cosi', su rete e su batteria — e non si
   * vedeva con la sorgente unica con segno, perche' li' quella casella e'
   * spenta.
   *
   * Adesso si stampa dove compare la prima volta, e il secondo riquadro dice
   * dov'e' andata invece di ripeterla. */
  const gia = new Set();
  const casaDelCampo = new Map();
  ENERGY_GROUPS.forEach(([group, title, fields]) => {
    for (const [key] of fields) {
      const chiave = `${group}.${key}`;
      if (!casaDelCampo.has(chiave)) casaDelCampo.set(chiave, title);
    }
  });
  ENERGY_GROUPS.forEach(([group, title, fields], groupIndex) => {
    const block = document.createElement("details");
    block.className = "ed-acc";
    block.open = groupIndex === 0;
    const heading = document.createElement("summary");
    heading.className = "ed-acc-head";
    const configured = fields.filter(([key]) => Boolean(model[group]?.[key])).length;
    heading.innerHTML = `<span>${ENERGY_ICONS[group]} ${energyLabel(title, locale)}</span><small>${configured}/${fields.length} ${copy.configured}</small>`;
    block.append(heading);
    const body = document.createElement("div");
    body.className = "ed-acc-body";
    if (signedHome.get(group) === groupIndex)
      body.append(createSignedCard(document, group, model, states, locale, handlers));
    const managed = signedManagedFields(model, group);
    for (const [key, sourceLabel, unit, example] of fields) {
      const chiave = `${group}.${key}`;
      if (gia.has(chiave)) {
        /* Gia' stampata altrove: qui si dice dov'e', perche' sparire e basta
         * farebbe sembrare che quel campo non si possa configurare. */
        const rimando = document.createElement("p");
        rimando.className = "ed-hint dm-energy-elsewhere";
        rimando.dataset.energyElsewhere = chiave;
        /* La frase si compone di pezzi gia' tradotti, non si traduce intera.
         *
         * Costruirla e poi passarla al traduttore voleva dire cercare nel
         * vocabolario una frase che nel vocabolario non c'e' — il nome del
         * campo e quello del riquadro cambiano da riga a riga — e riceverla
         * indietro tale e quale: in inglese, in tedesco e in tutte le altre si
         * sarebbe letto «Potenza: e' una sola, si imposta in «Rete ·
         * prelievo».». Il nome del campo e quello del riquadro sono gia'
         * tradotti ciascuno per conto suo; qui si traduce solo il collante. */
        rimando.textContent = `${energyLabel(sourceLabel, locale)}: ${energyLabel(
          "è una sola, si imposta in",
          locale,
        )} «${energyLabel(casaDelCampo.get(chiave), locale)}».`;
        body.append(rimando);
        continue;
      }
      gia.add(chiave);
      const label = energyLabel(sourceLabel, locale);
      const field = document.createElement("label");
      field.className = "ed-slot";
      field.innerHTML = `<span class="ed-slot-lbl">${label} <span class="ed-acc-n">${unit}</span> <span class="ed-acc-n">${copy.optional}</span></span><span class="ed-hint">${copy.entityHint} ${example}</span>`;
      if (key.startsWith("total_") || key === "total_energy")
        field.dataset.energyTotalField = "true";
      const { field: entity, input } = createEntityPickerField(document, {
        /* Un campo, una casella, un identificativo: la scappatoia che dava un
         * suffisso alla potenza del secondo riquadro serviva solo finche' la
         * stessa casella veniva disegnata due volte. */
        id: `dm-energy-${group}-${key}`,
        value: model[group]?.[key] || "",
        placeholder: example,
        label,
        locale,
        state: states[model[group]?.[key] || ""]?.state,
        unit,
        onPick: handlers.onPick,
        onChange: (value) => handlers.onChange?.(group, key, value),
      });
      input.name = `${group}.${key}`;
      input.dataset.validation = !input.value || states[input.value] ? "valid" : "invalid";
      if (managed.has(key)) {
        /* Il campo resta visibile, spento, e dice chi lo riempie: sparire
         * lascerebbe credere che quel verso non si possa configurare. */
        field.dataset.energySignedManaged = "true";
        input.disabled = true;
        input.value = "";
        input.placeholder = (SIGNED_UI[locale] || SIGNED_UI.it)[group].managed;
        const note = document.createElement("small");
        note.className = "dm-energy-signed-note";
        note.textContent = (SIGNED_UI[locale] || SIGNED_UI.it)[group].managed;
        field.append(entity, note);
        body.append(field);
        continue;
      }
      field.append(entity);
      body.append(field);
    }
    block.append(body);
    flows.append(block);
  });
  const actions = document.createElement("div");
  actions.className = "ed-action-bar";
  actions.dataset.energyActions = "";
  actions.dataset.state = "clean";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "ed-save-btn";
  save.dataset.energySave = "";
  save.disabled = true;
  save.textContent = copy.save;
  const status = document.createElement("output");
  status.dataset.energyStatus = "";
  status.textContent = copy.clean;
  actions.append(save, status);
  flows.append(actions);
  const dirty = () => {
    actions.dataset.state = "dirty";
    save.disabled = false;
    status.textContent = copy.dirty;
  };
  flows.addEventListener("input", dirty);
  flows.addEventListener("change", dirty);
  save.addEventListener("click", () => handlers.onSave?.({ actions, save, status }));
  handlers.renderLoads?.(loads);
  handlers.renderReport?.(report);
  handlers.renderSettings?.(settings);
  selectTab(handlers.initialTab || "flows");
}

export function loadPopupMetrics(load, states = {}, costPerKwh = 0) {
  const definitions = [
    ["power", load.power_entity, "W"],
    ["daily", load.daily_energy_entity, "kWh"],
    ["monthly", load.monthly_energy_entity, "kWh"],
    ["total", load.total_energy_entity, "kWh"],
  ];
  const values = definitions
    .filter(([, entity]) => entity)
    .map(([key, entity, unit]) => ({ key, ...metric(states, entity, unit) }));
  const monthly = values.find((value) => value.key === "monthly")?.value;
  if (monthly != null)
    values.push({ key: "cost", entity: "", value: monthly * Number(costPerKwh || 0), unit: "€" });
  return values;
}
