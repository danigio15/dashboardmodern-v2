import {
  ACTION_ICON_CATALOG,
  carBrandVisual,
  roomVisual,
} from "../core/personalization-catalog.js";
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

const CAR_MODELS = Object.freeze({
  "Abarth": ["500e", "600e"],
  "Alfa Romeo": ["Junior Elettrica", "Junior Ibrida", "Tonale Plug-In Hybrid Q4"],
  "Audi": ["A3 TFSI e", "A5 e-hybrid", "A6 e-tron", "Q3 e-hybrid", "Q4 e-tron", "Q5 e-hybrid", "Q6 e-tron", "Q8 e-tron", "e-tron GT"],
  "BMW": ["iX1", "iX2", "i4", "i5", "i7", "iX", "iX3", "225e Active Tourer", "230e Active Tourer", "330e", "550e", "750e", "X1 xDrive25e", "X1 xDrive30e", "X3 30e", "X5 xDrive50e", "XM"],
  "BYD": ["Dolphin Surf", "Dolphin", "Atto 2", "Atto 3", "Seal", "Seal U DM-i", "Sealion 7", "Tang", "Han"],
  "Citroën": ["ë-C3", "C3 Hybrid", "ë-C3 Aircross", "C3 Aircross Hybrid", "ë-C4", "C4 Hybrid", "ë-C5 Aircross", "C5 Aircross Plug-In Hybrid", "ë-Berlingo", "ë-SpaceTourer"],
  "Cupra": ["Born", "Tavascan", "Terramar e-Hybrid", "Formentor e-Hybrid", "Leon e-Hybrid"],
  "Dacia": ["Spring", "Duster Hybrid", "Bigster Hybrid", "Jogger Hybrid"],
  "DS": ["DS 3 E-Tense", "N°4 E-Tense", "N°4 Plug-In Hybrid", "DS 7 E-Tense", "N°8"],
  "Fiat": ["500e", "Grande Panda Electric", "Grande Panda Hybrid", "600e", "600 Hybrid"],
  "Ford": ["Puma Gen-E", "Explorer EV", "Capri EV", "Mustang Mach-E", "Kuga Hybrid", "Kuga Plug-In Hybrid", "E-Tourneo Courier", "E-Tourneo Custom"],
  "Honda": ["e:Ny1", "Civic e:HEV", "HR-V e:HEV", "ZR-V e:HEV", "CR-V e:HEV", "CR-V e:PHEV", "Prelude e:HEV"],
  "Hyundai": ["Inster", "Kona Electric", "Kona Hybrid", "IONIQ 5", "IONIQ 6", "IONIQ 9", "Tucson Hybrid", "Tucson Plug-In Hybrid", "Santa Fe Hybrid", "Santa Fe Plug-In Hybrid"],
  "Jeep": ["Avenger Electric", "Avenger e-Hybrid", "Avenger 4xe", "Compass e-Hybrid", "Compass 4xe", "Renegade 4xe", "Grand Cherokee 4xe", "Wagoneer S"],
  "Kia": ["Niro EV", "Niro Hybrid", "Niro Plug-In Hybrid", "EV3", "EV4", "EV5", "EV6", "EV9", "PV5 Passenger", "Sportage Hybrid", "Sportage Plug-In Hybrid", "Sorento Hybrid", "Sorento Plug-In Hybrid"],
  "Lancia": ["Ypsilon Electric", "Ypsilon Hybrid"],
  "Leapmotor": ["T03", "B10", "C10", "C10 REEV"],
  "Lexus": ["LBX Hybrid", "UX 300e", "UX Hybrid", "NX 350h", "NX 450h+", "RZ", "RX 350h", "RX 450h+", "RX 500h", "ES 300h", "LM 350h"],
  "Mazda": ["Mazda6e", "MX-30", "CX-60 Plug-In Hybrid", "CX-80 Plug-In Hybrid"],
  "Mercedes-Benz": ["EQA", "EQB", "CLA Electric", "CLA Hybrid", "EQE", "EQS", "EQE SUV", "EQS SUV", "G 580 EQ", "C-Class Plug-In Hybrid", "E-Class Plug-In Hybrid", "GLA 250 e", "GLC Plug-In Hybrid", "GLE Plug-In Hybrid"],
  "MG": ["MG4 Electric", "MG5 Electric", "MGS5 EV", "ZS Hybrid+", "HS Hybrid+", "HS Plug-In Hybrid", "Cyberster"],
  "MINI": ["Cooper Electric", "Aceman", "Countryman Electric"],
  "Nissan": ["Micra EV", "Leaf", "Ariya", "Juke Hybrid", "Qashqai e-POWER", "X-Trail e-POWER"],
  "Opel": ["Corsa Electric", "Corsa Hybrid", "Mokka Electric", "Mokka Hybrid", "Astra Electric", "Astra Plug-In Hybrid", "Astra Hybrid", "Frontera Electric", "Frontera Hybrid", "Grandland Electric", "Grandland Plug-In Hybrid", "Grandland Hybrid", "Combo Electric", "Zafira Electric"],
  "Peugeot": ["e-208", "208 Hybrid", "e-2008", "2008 Hybrid", "e-308", "308 Plug-In Hybrid", "308 Hybrid", "e-3008", "3008 Plug-In Hybrid", "3008 Hybrid", "e-5008", "5008 Plug-In Hybrid", "5008 Hybrid", "e-Rifter"],
  "Polestar": ["Polestar 2", "Polestar 3", "Polestar 4", "Polestar 5"],
  "Porsche": ["Macan Electric", "Taycan", "Cayenne E-Hybrid", "Panamera E-Hybrid"],
  "Renault": ["5 E-Tech electric", "4 E-Tech electric", "Megane E-Tech electric", "Scenic E-Tech electric", "Captur E-Tech full hybrid", "Symbioz E-Tech full hybrid", "Austral E-Tech full hybrid", "Espace E-Tech full hybrid", "Rafale E-Tech full hybrid", "Rafale E-Tech 4x4 Plug-In Hybrid"],
  "SEAT": ["Leon e-HYBRID", "Leon Sportstourer e-HYBRID", "Ibiza Mild Hybrid", "Arona Mild Hybrid"],
  "Škoda": ["Elroq", "Enyaq", "Epiq", "Superb iV", "Kodiaq iV", "Octavia e-TEC"],
  "Smart": ["#1", "#3", "#5"],
  "Subaru": ["Solterra", "Uncharted", "E-Outback", "Forester e-BOXER", "Crosstrek e-BOXER"],
  "Suzuki": ["e VITARA", "Swift Hybrid", "Vitara Hybrid", "S-Cross Hybrid", "Across Plug-In Hybrid"],
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X"],
  "Toyota": ["Aygo X Hybrid", "Yaris Hybrid", "Yaris Cross Hybrid", "Corolla Hybrid", "C-HR Hybrid", "C-HR Plug-In Hybrid", "Prius Plug-In Hybrid", "bZ4X", "C-HR+", "Urban Cruiser", "RAV4 Hybrid", "RAV4 Plug-In Hybrid", "Highlander Hybrid"],
  "Volkswagen": ["ID.3", "ID.4", "ID.5", "ID.7", "ID.7 Tourer", "ID. Buzz", "Golf eHybrid", "Golf GTE", "Passat eHybrid", "Tiguan eHybrid", "Tayron eHybrid"],
  "Volvo": ["EX30", "EX40", "EC40", "EX60", "EX90", "XC40 Mild Hybrid", "XC60 Plug-In Hybrid", "XC90 Plug-In Hybrid"],
  "XPeng": ["G6", "G9", "P7", "P7+", "L03"],
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
  const grid = doc?.getElementById("qa-grid");
  if (!grid) return false;
  const actions = configuredActions();
  grid.querySelectorAll(".qa-btn").forEach((card, index) => {
    const icon = card.querySelector(".icon");
    if (!icon) return;
    const visual = actionVisual(actions[index] || {});
    icon.innerHTML = `<span class="dm-v01525-action-glyph" aria-hidden="true">${esc(visual.glyph)}</span>`;
    icon.style.setProperty("filter", `drop-shadow(0 6px 12px ${visual.color}66)`, "important");
    icon.style.setProperty("color", visual.color, "important");
    icon.dataset.dmActionStyle = "v01525";
  });

  [...doc.querySelectorAll("#page-home h1,#page-home h2,#page-home h3,#page-home .section-title,#page-home .section-heading")]
    .forEach((heading) => {
      const value = clean(heading.textContent);
      if (/azioni\s+rapide\s+premium/i.test(value))
        heading.textContent = value.replace(/\s+premium/i, "");
      if (/premium\s+quick\s+actions/i.test(value))
        heading.textContent = value.replace(/premium\s+/i, "");
    });
  return true;
}

function polishActionPicker() {
  const picker = doc?.getElementById("dm-beta9-action-picker") || doc?.querySelector('#dm-visual-picker[data-kind="action"]');
  if (!picker) return false;
  picker.querySelectorAll(".dm-picker-option").forEach((button) => {
    const index = Number.parseInt(button.dataset.index || "-1", 10);
    const item = ACTION_ICON_CATALOG[index];
    if (!item) return;
    const visual = button.querySelector(".dm-picker-visual");
    if (visual) visual.innerHTML = `<span class="dm-v01525-picker-glyph" aria-hidden="true">${esc(item.glyph)}</span>`;
  });
  picker.dataset.dmActionStyle = "v01525";
  return true;
}

function modelBelongsToBrand(brand, model) {
  const token = normalize(model);
  return Boolean(token) && (CAR_MODELS[clean(brand)] || []).some((candidate) => {
    const normalizedCandidate = normalize(candidate);
    return token === normalizedCandidate || token.includes(normalizedCandidate) || normalizedCandidate.includes(token);
  });
}

function modelOptions(brand, selected = "") {
  const current = clean(selected);
  const values = [...(CAR_MODELS[clean(brand)] || [])];
  if (current && !values.includes(current)) values.unshift(current);
  const placeholder = english() ? "— Choose model —" : "— Seleziona modello —";
  return [
    `<option value="">${placeholder}</option>`,
    ...values.map((model) => `<option value="${esc(model)}" ${model === current ? "selected" : ""}>${esc(model)}</option>`),
  ].join("");
}

function refreshEvPreview(panel) {
  const brandSelect = panel?.querySelector("select[data-brand]");
  const modelSelect = panel?.querySelector("select[data-model]");
  const preview = panel?.querySelector("[data-brand-preview]");
  if (!brandSelect || !modelSelect || !preview) return false;
  const brand = clean(brandSelect.value);
  const model = clean(modelSelect.value);
  preview.innerHTML = `${carBrandVisual(brand, 54)}<span class="dm-ev-brand-copy"><b>${esc(brand)}</b>${model ? `<small>${esc(model)}</small>` : ""}</span>`;
  preview.dataset.dmCurrentBrand = brand;
  return true;
}

function onEvBrandChanged(panel) {
  const brandSelect = panel?.querySelector("select[data-brand]");
  const modelSelect = panel?.querySelector("select[data-model]");
  if (!brandSelect || !modelSelect) return;
  const brand = clean(brandSelect.value);
  const previous = clean(modelSelect.value);
  const keep = modelBelongsToBrand(brand, previous) ? previous : "";
  modelSelect.innerHTML = modelOptions(brand, keep);
  modelSelect.disabled = false;
  modelSelect.removeAttribute("disabled");
  refreshEvPreview(panel);
}

function bindEvAppearance() {
  const body = doc?.getElementById("ed-body");
  const panel = body?.querySelector("[data-ev-appearance]");
  if (!body || !panel) return false;

  if (body.firstElementChild !== panel) body.prepend(panel);
  panel.dataset.dmEvTop = "true";

  const brandSelect = panel.querySelector("select[data-brand]");
  const modelSelect = panel.querySelector("select[data-model]");
  if (!brandSelect || !modelSelect) return false;

  if (brandSelect.dataset.dmRealDeviceBound !== "true") {
    brandSelect.dataset.dmRealDeviceBound = "true";
    const syncBrand = () => onEvBrandChanged(panel);
    brandSelect.addEventListener("input", syncBrand);
    brandSelect.addEventListener("change", syncBrand);
  }
  if (modelSelect.dataset.dmRealDeviceBound !== "true") {
    modelSelect.dataset.dmRealDeviceBound = "true";
    modelSelect.addEventListener("input", () => refreshEvPreview(panel));
    modelSelect.addEventListener("change", () => refreshEvPreview(panel));
  }

  const selectedBrand = clean(brandSelect.value);
  const selectedModel = clean(modelSelect.value);
  const expected = CAR_MODELS[selectedBrand] || [];
  const optionValues = [...modelSelect.options].map((option) => option.value).filter(Boolean);
  const optionsAreStale =
    expected.length &&
    (optionValues.length !== expected.length || expected.some((model) => !optionValues.includes(model)));
  if (optionsAreStale) {
    modelSelect.innerHTML = modelOptions(
      selectedBrand,
      modelBelongsToBrand(selectedBrand, selectedModel) ? selectedModel : "",
    );
  }
  modelSelect.disabled = false;
  modelSelect.removeAttribute("disabled");
  refreshEvPreview(panel);
  return true;
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
    visual.innerHTML = roomMarkup(room, 34);
    visual.dataset.roomIcon = clean(room.icon || "mdi:home");
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
      ? (english() ? " — configured" : " — configurata")
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
  page.querySelectorAll(".tapp-btn").forEach((button) => {
    button.style.setProperty("height", "40px", "important");
    button.style.setProperty("min-height", "40px", "important");
    button.style.setProperty("font-size", "12px", "important");
    button.style.setProperty("border-radius", "12px", "important");
  });
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

function classifyAlert(card) {
  const name = clean(card.querySelector(".g-name")?.textContent || card.textContent).toLowerCase();
  if (/tapparell|shutter/.test(name)) return shutterMoving() ? "shutter-moving" : "static";
  if (/apertur|porta|finestr|door|window/.test(name)) return "opening";
  if (/batt|battery/.test(name)) return "battery";
  if (/antifurto|allarme|alarm|security|sicurezza/.test(name)) return "security";
  if (/luce|light/.test(name)) return "light";
  return "static";
}

function polishAlertAnimations() {
  doc?.querySelectorAll?.("#page-home .glance-card").forEach((card) => {
    const icon = card.querySelector(".g-icon-wrap");
    if (!icon) return;
    icon.classList.remove(
      "anim-ping",
      "dm-alert-opening",
      "dm-alert-battery",
      "dm-alert-security",
      "dm-alert-light",
      "dm-alert-shutter-moving",
      "dm-alert-static",
    );
    const kind = classifyAlert(card);
    icon.classList.add(`dm-alert-${kind}`);
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
  bindEvAppearance();
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

    #ed-body>[data-ev-appearance][data-dm-ev-top="true"]{order:-1000!important;margin-top:0!important}
    [data-ev-appearance] .dm-brand-preview,
    #dm-visual-picker[data-kind="car"] .dm-picker-visual{
      background:#fff!important;color:#111827!important
    }
    [data-ev-appearance] .dm-car-brand,
    #dm-visual-picker[data-kind="car"] .dm-car-brand,
    #ev-car-picker .dm-car-brand{
      color:#111827!important
    }
    [data-ev-appearance] img[data-dm-brand-image],
    #dm-visual-picker[data-kind="car"] img[data-dm-brand-image],
    #ev-car-picker img[data-dm-brand-image]{
      display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;
      object-fit:contain!important;object-position:center!important;filter:grayscale(1) brightness(0)!important;opacity:1!important
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

    #page-home .g-icon-wrap.dm-alert-static{animation:none!important;transform:none!important}
    #page-home .g-icon-wrap.dm-alert-opening{animation:dmAlertOpening 1.8s ease-in-out infinite!important}
    #page-home .g-icon-wrap.dm-alert-battery{animation:dmAlertBattery 2.4s ease-in-out infinite!important}
    #page-home .g-icon-wrap.dm-alert-security{animation:dmAlertSecurity 1.6s ease-in-out infinite!important}
    #page-home .g-icon-wrap.dm-alert-light{animation:dmAlertLight 2.2s ease-in-out infinite!important}
    #page-home .g-icon-wrap.dm-alert-shutter-moving{animation:dmAlertShutterMove 1.25s ease-in-out infinite!important}
    @keyframes dmAlertOpening{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
    @keyframes dmAlertBattery{0%,100%{opacity:1}50%{opacity:.72}}
    @keyframes dmAlertSecurity{0%,100%{transform:scale(1)}50%{transform:scale(1.055)}}
    @keyframes dmAlertLight{0%,100%{filter:drop-shadow(0 0 0 transparent)}50%{filter:drop-shadow(0 0 7px rgba(245,158,11,.38))}}
    @keyframes dmAlertShutterMove{0%,100%{transform:translateY(-2px)}50%{transform:translateY(2px)}}

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
    @media(prefers-reduced-motion:reduce){
      #page-home .g-icon-wrap[class*="dm-alert-"]{animation:none!important}
    }
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

  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(
      '.ed-tab[data-tab="sez2"],.ed-tab[data-tab="stanze"],.ed-tab[data-tab="sez7"],.ed-tab[data-tab="luci"],.tab[data-tab="tapparelle"],.dm-beta6-qa-icon-trigger,[data-brand-preview]',
    )) scheduleAfterLegacyWork();
  }, true);

  doc.addEventListener("error", (event) => {
    if (event.target?.matches?.("img[data-dm-brand-image]")) scheduleAfterLegacyWork();
  }, true);

  scheduleAfterLegacyWork();
}

installBeta9RealDevicePolishSection();
