/* DashboardModern 0.15.3 — single production entry and real-UI contracts. */
import "./runtime-consolidated.js";
import "../src/core/runtime-startup-coordinator.js";
import "../src/core/alerts-runtime.js";
import "../src/core/energy-total-source.js";
import "../src/core/vehicle-image-runtime.js";
import {
  applianceArtwork,
  canonicalArtworkType,
} from "../src/core/appliance-artwork.js";

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_REAL_UI_CONTRACTS__";
const state = (root[KEY] ||= {
  installed: true,
  version: "0.15.3",
  attempts: 0,
  timer: 0,
  normalizingAppliances: false,
  normalizingTemperature: false,
  normalizingEnergy: false,
  storeUnsubscribe: null,
});

const clean = (value) => String(value ?? "").trim();
const english = () => doc?.documentElement?.lang === "en";
const store = () => root.DashboardModernModules?.store || null;
const dashboardStates = () => ({
  ...(root._RAW_STATES || {}),
  ...(root.STATES || {}),
});

const ROOM_GLYPHS = Object.freeze({
  "mdi:sofa": "🛋️",
  "mdi:balcony": "🌿",
  "mdi:bed": "🛏️",
  "mdi:bed-king-outline": "🛏️",
  "mdi:chef-hat": "🍳",
  "mdi:stove": "🍳",
  "mdi:shower": "🚿",
  "mdi:bathtub-outline": "🛁",
  "mdi:desk": "🖥️",
  "mdi:garage": "🚗",
  "mdi:home": "🏠",
  "mdi:home-outline": "🏠",
  "mdi:thermometer": "🌡️",
});

const ENERGY_TOTAL_FIELDS = Object.freeze([
  ["house", "total_energy", "annual_energy", "Energia totale", "Total energy", "sensor.casa_totale"],
  ["solar", "total_energy", "annual_energy", "Energia totale", "Total energy", "sensor.fv_totale"],
  ["grid", "total_import_energy", "monthly_export_energy", "Energia totale prelevata", "Total imported energy", "sensor.rete_prelievo_totale"],
  ["grid", "total_export_energy", "total_import_energy", "Energia totale immessa", "Total exported energy", "sensor.rete_immissione_totale"],
  ["battery", "daily_discharged_energy", "monthly_charged_energy", "Scaricata oggi", "Discharged today", "sensor.batteria_scaricata_oggi"],
  ["battery", "monthly_discharged_energy", "daily_discharged_energy", "Scaricata questo mese", "Discharged this month", "sensor.batteria_scaricata_mese"],
  ["battery", "total_charged_energy", "monthly_discharged_energy", "Energia totale caricata", "Total charged energy", "sensor.batteria_caricata_totale"],
  ["battery", "total_discharged_energy", "total_charged_energy", "Energia totale scaricata", "Total discharged energy", "sensor.batteria_scaricata_totale"],
]);

function glyph(icon) {
  const value = clean(icon);
  const key = value.toLowerCase();
  if (ROOM_GLYPHS[key]) return ROOM_GLYPHS[key];
  if (!value || key.startsWith("mdi:")) return "🏠";
  return value;
}

function installStyles() {
  if (!doc?.head || doc.getElementById("dm-real-ui-contracts-0153")) return;
  const style = doc.createElement("style");
  style.id = "dm-real-ui-contracts-0153";
  style.textContent = `
    #dm-light-picker-0152{position:fixed!important;inset:0!important;z-index:20000!important;pointer-events:auto!important}
    #dm-light-picker-0152 .modal-content{position:relative!important;z-index:1!important;pointer-events:auto!important}
    #ev-mod-car-img[data-ev-failed="1"],#ev-new-car-img[data-ev-failed="1"],
    #ev-mod-car-img[data-ev-image-error],#ev-new-car-img[data-ev-image-error]{
      display:block!important;visibility:visible!important;opacity:1!important;min-width:1px!important;min-height:1px!important
    }

    html body #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html body #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-visual{
      position:relative!important;display:block!important;box-sizing:border-box!important;
      overflow:hidden!important;padding:0!important;border:0!important;
      background:#e0f2fe!important
    }
    html body #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-ic,
    html body #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-ic,
    html body #page-appliances-main .dm-appliance-art,
    html body #appl-grid-overview .dm-appliance-art,
    html body #page-appliances-main .dm-appliance-art>svg,
    html body #appl-grid-overview .dm-appliance-art>svg,
    html body #page-appliances-main .dm-appliance-image-wrap,
    html body #appl-grid-overview .dm-appliance-image-wrap,
    html body #page-appliances-main img.dm-appliance-image,
    html body #appl-grid-overview img.dm-appliance-image{
      position:absolute!important;inset:0!important;display:block!important;box-sizing:border-box!important;
      width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
      max-width:100%!important;max-height:100%!important;padding:0!important;margin:0!important;
      transform:none!important;overflow:hidden!important
    }
    html body #page-appliances-main img.dm-appliance-image,
    html body #appl-grid-overview img.dm-appliance-image{object-fit:cover!important;object-position:50% 50%!important}

    #temp-grid .cp-icon{display:grid!important;place-items:center!important;color:#0ea5e9!important;
      font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;line-height:1!important}
    #temp-grid .dm-temperature-icon-fallback{display:block!important;font-size:22px!important;line-height:1!important}
    #temp-grid .temp-card{background:var(--card-bg,#fff)!important;color:var(--text,#0f172a)!important}
    #temp-grid .temp-comfort-badge{display:grid!important;place-items:center!important}
    #editor-modal [data-temperature-form] .dm-temperature-actions button,
    #editor-modal [data-temperature-form] [data-temperature-submit],
    #editor-modal [data-temperature-form] [data-temperature-cancel]{min-height:44px!important}
    #editor-modal [data-dm-injected-energy-total="true"]{scroll-margin-top:16px}

    @media (max-width:720px){
      .ed-header-period{align-items:stretch}.ed-yoy-chips{display:flex;flex-wrap:wrap;gap:6px}
      .ed-kpi-banner{grid-template-columns:repeat(3,minmax(0,1fr))}.ed-device-row,.ed-dev-name{min-width:0}
    }
  `;
  doc.head.append(style);
}

function applianceItems() {
  const values = store()?.getSection?.("appliances");
  return Array.isArray(values) ? values : [];
}

function applianceVisual(item) {
  try {
    const visual = root.DashboardModernModules?.data?.getDeviceVisual?.(item);
    if (visual) return visual;
  } catch (_error) {}
  if (clean(item?.image)) return { kind: "image", value: clean(item.image) };
  return {
    kind: "asset",
    value: clean(item?.visual_key || item?.device_type || item?.type || item?.icon || item?.name),
  };
}

function normalizeApplianceCards() {
  if (!doc || state.normalizingAppliances) return false;
  const items = applianceItems();
  const cards = [...doc.querySelectorAll(
    "#appl-grid-overview .appl-wide-card[data-appliance-id],#page-appliances-main .appl-wide-card[data-appliance-id]",
  )];
  if (!cards.length || !items.length) return false;

  state.normalizingAppliances = true;
  try {
    const byId = new Map(items.map((item) => [clean(item.id), item]));
    cards.forEach((card, index) => {
      const item = byId.get(clean(card.dataset.applianceId)) || items[index];
      const viewport = card.querySelector(".appl-visual");
      const media = viewport?.querySelector(".appl-ic");
      if (!item || !viewport || !media) return;
      const visual = applianceVisual(item);
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      viewport.dataset.applianceCover = "true";

      if (visual.kind === "image" && clean(visual.value)) {
        const src = clean(visual.value);
        card.dataset.dmArtwork = "custom";
        card.dataset.dmMediaKind = "image";
        let wrapper = media.querySelector(":scope>.dm-appliance-image-wrap");
        let image = wrapper?.querySelector(":scope>img.dm-appliance-image");
        if (!wrapper || !image || media.children.length !== 1) {
          wrapper = doc.createElement("span");
          wrapper.className = "dm-appliance-image-wrap";
          image = doc.createElement("img");
          image.className = "dm-appliance-image";
          wrapper.append(image);
          media.replaceChildren(wrapper);
        }
        image.src = src;
        image.alt = clean(item.name);
        image.loading = "eager";
        image.decoding = "async";
        return;
      }

      const source = clean(
        visual.value || item.visual_key || item.device_type || item.type || item.icon || item.name,
      );
      const canonical = canonicalArtworkType(source);
      const markup = canonical && applianceArtwork(canonical, 96);
      if (!markup) return;
      const current = media.querySelector(":scope>.dm-appliance-art");
      if (!current || current.dataset.dmArt !== canonical || !current.querySelector(".dm-art-panel")) {
        media.innerHTML = markup;
      }
      card.dataset.dmArtwork = canonical;
      card.dataset.dmMediaKind = "asset";
      card.dataset.dmMediaType = canonical;
    });
    return true;
  } finally {
    state.normalizingAppliances = false;
  }
}

function exactState(entity) {
  return dashboardStates()[clean(entity)] || null;
}

function numericState(entity) {
  const value = Number.parseFloat(exactState(entity)?.state);
  return Number.isFinite(value) ? value : null;
}

function temperatureRooms() {
  const values = store()?.getSection?.("rooms");
  return Array.isArray(values) ? values : [];
}

function roomForTemperatureCard(card, rooms) {
  const title = clean(card.querySelector(".cp-name,.temp-room-name")?.textContent).toLowerCase();
  return rooms.find((room) => clean(room.name).toLowerCase() === title) || null;
}

function normalizeTemperatureCards() {
  if (!doc || state.normalizingTemperature) return false;
  const cards = [...doc.querySelectorAll("#temp-grid .temp-card")];
  if (!cards.length) return false;
  state.normalizingTemperature = true;
  try {
    const rooms = temperatureRooms();
    cards.forEach((card, index) => {
      const room = roomForTemperatureCard(card, rooms) || rooms.filter((item) => item.temp)[index];
      if (!room) return;
      card.dataset.roomId = clean(room.id);
      const icon = card.querySelector(".cp-icon,.temp-room-icon");
      if (icon) {
        icon.dataset.roomIcon = clean(room.icon || "mdi:home");
        icon.replaceChildren();
        const fallback = doc.createElement("span");
        fallback.className = "dm-temperature-icon-fallback";
        fallback.setAttribute("aria-hidden", "true");
        fallback.textContent = glyph(room.icon);
        icon.append(fallback);
      }

      const temperature = numericState(room.temp);
      const humidityEntity = clean(room.hum || clean(room.temp).replace("_temperature", "_humidity"));
      const humidity = numericState(humidityEntity);
      const temperatureId = clean(room.temp).replace(/[.\-]/g, "_");
      const humidityId = humidityEntity.replace(/[.\-]/g, "_");
      const value = doc.getElementById(`tv_${temperatureId}`) || card.querySelector(".temp-value");
      const humidityValue = doc.getElementById(`hv_${humidityId}`) || card.querySelector(".temp-hum-val");
      const comfort = doc.getElementById(`tc_${temperatureId}`) || card.querySelector(".temp-comfort-badge");
      if (value) value.textContent = temperature == null ? "—" : temperature.toFixed(1);
      if (humidityValue) humidityValue.textContent = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
      if (comfort) {
        let badge = "🟢";
        let label = english() ? "Comfort" : "Comfort";
        if (temperature == null) {
          badge = "—";
          label = english() ? "Unavailable" : "Non disponibile";
        } else if (temperature < 16) {
          badge = "❄️";
          label = english() ? "Cold" : "Freddo";
        } else if (temperature < 19) {
          badge = "🔵";
          label = english() ? "Cool" : "Fresco";
        } else if (temperature > 27) {
          badge = "🟠";
          label = english() ? "Hot" : "Caldo";
        } else if (temperature > 24) {
          badge = "🟡";
          label = english() ? "Warm" : "Tiepido";
        }
        comfort.textContent = badge;
        comfort.title = label;
      }
    });
    return true;
  } finally {
    state.normalizingTemperature = false;
  }
}

function syncTemperatureCanonicalIcon(form, iconInput) {
  const roomId = clean(form.querySelector("#dm-temperature-room")?.value);
  const room = temperatureRooms().find((item) => clean(item.id) === roomId);
  iconInput.value = clean(room?.icon || "mdi:thermometer");
}

function normalizeTemperatureEditor() {
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const intro = form.parentElement?.querySelector("[data-temperature-editor]");
  if (intro) {
    intro.textContent = english()
      ? "Select an existing room and associate its temperature and humidity sensors. Name and icon are edited only in Rooms."
      : "Seleziona una stanza già creata e associa i sensori di temperatura e umidità. Nome e icona si modificano solo in Stanze.";
  }
  form.querySelectorAll(".ed-slot-lbl").forEach((label) => {
    [...label.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE)
        node.nodeValue = String(node.nodeValue || "").replace(/[✏️🖉]/gu, "").trimEnd();
    });
  });
  const submit = form.querySelector("[data-temperature-submit]");
  if (submit) submit.textContent = english() ? "ASSOCIATE SENSORS" : "ASSOCIA SENSORI";

  const iconInput = form.querySelector("#dm-temperature-icon");
  if (!iconInput) return true;
  iconInput.type = "hidden";
  iconInput.hidden = true;
  iconInput.tabIndex = -1;
  iconInput.setAttribute("aria-hidden", "true");
  const field = iconInput.closest("label.ed-slot") || iconInput.closest("[data-icon-field]") || iconInput.parentElement;
  if (field && field !== form) {
    iconInput.remove();
    field.remove();
    form.append(iconInput);
  }
  if (form.dataset.dmCanonicalIconBinding !== "true") {
    form.dataset.dmCanonicalIconBinding = "true";
    const sync = () => syncTemperatureCanonicalIcon(form, iconInput);
    form.querySelector("#dm-temperature-room")?.addEventListener("change", sync);
    form.addEventListener("submit", sync, true);
  }
  syncTemperatureCanonicalIcon(form, iconInput);
  return true;
}

function energyFieldMarkup(definition, value) {
  const [group, key, _after, it, en, example] = definition;
  const label = english() ? en : it;
  const wrap = doc.createElement("label");
  wrap.className = "ed-slot";
  wrap.dataset.dmInjectedEnergyTotal = "true";
  wrap.dataset.energyGroup = group;
  wrap.dataset.energyKey = key;
  wrap.innerHTML = `<span class="ed-slot-lbl">${label} <span class="ed-acc-n">kWh</span> <span class="ed-acc-n">${english() ? "Optional" : "Facoltativo"}</span></span><span class="ed-hint">${english() ? "Home Assistant entity, e.g." : "Entità Home Assistant, es."} ${example}</span>`;
  const row = doc.createElement("span");
  row.className = "dm-entity-field";
  row.dataset.entityField = "";
  const formRow = doc.createElement("span");
  formRow.className = "ed-form-row";
  const input = doc.createElement("input");
  input.id = `dm-energy-${group}-${key}`;
  input.name = `${group}.${key}`;
  input.className = "ed-input ed-slot-in mono";
  input.dataset.entityInput = "true";
  input.value = clean(value);
  input.placeholder = example;
  const picker = doc.createElement("button");
  picker.type = "button";
  picker.className = "dm-entity-picker";
  picker.dataset.entityTarget = input.id;
  picker.dataset.pickerMounted = "true";
  picker.textContent = "🔍";
  picker.setAttribute("aria-label", `${english() ? "Select" : "Seleziona"} ${label}`);
  picker.addEventListener("click", () => root.wzPickEntity?.(input));
  formRow.append(input, picker);
  row.append(formRow);
  const current = exactState(input.value);
  if (input.value && current) {
    const preview = doc.createElement("output");
    preview.className = "ed-row-old dm-entity-preview";
    preview.textContent = `${current.state} kWh`;
    row.append(preview);
  }
  wrap.append(row);
  return { wrap, input };
}

async function persistEnergyField(group, key, value) {
  const dashboardStore = store();
  if (!dashboardStore?.getSection || !dashboardStore?.replaceSection) return;
  const model = structuredClone(dashboardStore.getSection("energy") || {});
  model[group] ||= {};
  model[group][key] = clean(value);
  model.metadata = { ...(model.metadata || {}), semantics_version: 3 };
  await dashboardStore.replaceSection("energy", model);
}

function refreshEnergyHeading(body) {
  const details = body?.closest("details.ed-acc");
  const counter = details?.querySelector("summary small");
  if (!counter) return;
  const inputs = [...body.querySelectorAll("input[name]")];
  const count = inputs.filter((input) => clean(input.value)).length;
  counter.textContent = `${count}/${inputs.length} ${english() ? "configured" : "configurati"}`;
}

function normalizeEnergyEditor() {
  if (!doc || state.normalizingEnergy) return false;
  const editor = doc.querySelector('#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]');
  if (!editor) return false;
  const dashboardStore = store();
  if (!dashboardStore?.getSection) return false;
  const model = dashboardStore.getSection("energy") || {};
  state.normalizingEnergy = true;
  try {
    ENERGY_TOTAL_FIELDS.forEach((definition) => {
      const [group, key, afterKey] = definition;
      if (editor.querySelector(`#dm-energy-${group}-${key}`)) return;
      const anchor = editor.querySelector(`#dm-energy-${group}-${afterKey}`);
      const body = anchor?.closest(".ed-acc-body");
      if (!body) return;
      const { wrap, input } = energyFieldMarkup(definition, model[group]?.[key]);
      const anchorField = anchor.closest("label.ed-slot");
      if (anchorField?.parentElement === body) anchorField.after(wrap);
      else body.append(wrap);
      input.addEventListener("change", async () => {
        input.dataset.validation = !input.value || exactState(input.value) ? "valid" : "invalid";
        try {
          await persistEnergyField(group, key, input.value);
        } catch (error) {
          input.dataset.validation = "invalid";
          console.error("[DashboardModern] save total energy field", error);
        }
      });
      input.addEventListener("input", () => {
        const actions = editor.querySelector("[data-energy-actions]");
        const save = actions?.querySelector("[data-energy-save]");
        if (actions) actions.dataset.state = "dirty";
        if (save) save.disabled = false;
        refreshEnergyHeading(body);
      });
      refreshEnergyHeading(body);
    });
    return true;
  } finally {
    state.normalizingEnergy = false;
  }
}

function runContracts() {
  installStyles();
  normalizeApplianceCards();
  normalizeTemperatureEditor();
  normalizeTemperatureCards();
  normalizeEnergyEditor();
}

function wrapRenderer(name, after) {
  const current = root[name];
  if (typeof current !== "function" || current.__dmRealUiContract0153) return false;
  function wrappedRealUiRenderer(...args) {
    const result = current.apply(this, args);
    const finish = () => root.queueMicrotask?.(after);
    if (result && typeof result.finally === "function") return result.finally(finish);
    finish();
    return result;
  }
  wrappedRealUiRenderer.__dmRealUiContract0153 = true;
  wrappedRealUiRenderer.__dmPrevious = current;
  root[name] = wrappedRealUiRenderer;
  return true;
}

function settle() {
  state.timer = 0;
  state.attempts += 1;
  wrapRenderer("renderAppliances", normalizeApplianceCards);
  wrapRenderer("renderApplianceSection", normalizeApplianceCards);
  wrapRenderer("buildTempCards", normalizeTemperatureCards);
  wrapRenderer("renderTemperature", normalizeTemperatureCards);
  runContracts();
  if (state.attempts < 80 && !state.storeUnsubscribe)
    state.timer = root.setTimeout?.(settle, 50);
}

function install() {
  if (!doc) return;
  installStyles();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("click", (event) => {
      const target = event.target?.closest?.(
        '.tab[data-tab="appliances"],.tab[data-tab="temp"],.tab[data-tab="temperature"],.ed-tab[data-tab="sez7"],.ed-tab[data-tab="sez1"],[data-energy-save]',
      );
      if (!target) return;
      root.queueMicrotask?.(runContracts);
      root.setTimeout?.(runContracts, 0);
    }, true);
    root.addEventListener?.("dashboardmodern:legacy-ready", runContracts);
    root.addEventListener?.("dashboardmodern:runtime-ready", runContracts);
    root.addEventListener?.("dashboardmodern:state-changed", runContracts);
    root.addEventListener?.("pageshow", runContracts);
  }
  const dashboardStore = store();
  if (!state.storeUnsubscribe && dashboardStore?.subscribe) {
    state.storeUnsubscribe = dashboardStore.subscribe((change) => {
      if (["appliances", "rooms", "energy"].includes(change.section))
        root.queueMicrotask?.(runContracts);
    });
  }
  settle();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
