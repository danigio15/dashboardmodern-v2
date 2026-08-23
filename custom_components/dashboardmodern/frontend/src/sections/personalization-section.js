import { ACTION_ICON_CATALOG, CAR_BRANDS, ROOM_CATALOG, actionVisual, carBrandVisual, roomVisual } from "../core/personalization-catalog.js";
import { clean, doc, esc, installStyle, readJson, root, t, writeJsonIfChanged, wrapFunction } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_PERSONALIZATION_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0, actionEditIndex: -1, subscribed: false, evHomeAttempts: 0 });

// Model families sold in Europe with a battery-electric, full-hybrid,
// range-extender or plug-in-hybrid powertrain. The selector also preserves an
// already configured model that is not in this built-in list, so updates never
// make an existing profile uneditable.
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

function actualVersion() {
  const info = root.DashboardModernModules?.diagnostics?.BUILD_INFO;
  return clean(info?.dashboardVersion || info?.integrationVersion || "");
}

function normalizedModel(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9+#]+/g, " ").trim();
}

function modelsForBrand(brand) {
  return CAR_MODELS[clean(brand)] || [];
}

function modelBelongsToBrand(brand, value) {
  const token = normalizedModel(value);
  if (!token) return false;
  return modelsForBrand(brand).some((model) => {
    const candidate = normalizedModel(model);
    return token === candidate || token.includes(candidate) || candidate.includes(token);
  });
}

function brandForModel(value) {
  const token = normalizedModel(value);
  if (!token) return "";
  for (const [brand, models] of Object.entries(CAR_MODELS)) {
    if (models.some((model) => {
      const candidate = normalizedModel(model);
      return token === candidate || token.includes(candidate) || candidate.includes(token);
    })) return brand;
  }
  return "";
}

function effectiveBrand(vehicle = {}) {
  const explicit = clean(vehicle.brand);
  return explicit || brandForModel(vehicle.model || vehicle.name);
}

function effectiveModel(vehicle = {}) {
  const explicit = clean(vehicle.model);
  if (explicit) return explicit;
  const byName = brandForModel(vehicle.name);
  return byName ? clean(vehicle.name) : "";
}

function modelOptions(brand, selected = "") {
  const current = clean(selected);
  const values = [...modelsForBrand(brand)];
  if (current && !values.includes(current)) values.unshift(current);
  return [`<option value="">— ${t("Seleziona modello", "Choose model")} —</option>`, ...values.map((model) => `<option value="${esc(model)}" ${model === current ? "selected" : ""}>${esc(model)}</option>`)].join("");
}

function emitChange(input) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function closePicker() {
  doc?.getElementById("dm-visual-picker")?.remove();
}

function iconMarkup(value, size = 38) {
  try { return root.cdIconMarkup?.(value, size) || esc(value); } catch (_error) { return esc(value); }
}

function openVisualPicker(input, kind = "room") {
  return Boolean(
    root.DashboardModernIconEngine?.openPicker?.(input, kind, { autofocus: false }),
  );
}

function decorateRoomModal() {
  const modal = doc?.getElementById("dm-room-editor-modal");
  if (!modal || modal.dataset.dmPersonalized === "true") return;
  modal.dataset.dmPersonalized = "true";
  const input = modal.querySelector('input[name="icon"]');
  const row = input?.closest(".dm-unified-icon-row");
  const preview = modal.querySelector("[data-room-icon-preview]");
  if (!input || !row || !preview) return;
  row.querySelectorAll(".dm-visual-pick-btn").forEach((node) => node.remove());
  preview.classList.add("dm-visual-trigger");
  preview.setAttribute("role", "button");
  preview.setAttribute("tabindex", "0");
  preview.setAttribute("aria-label", t("Scegli icona stanza", "Choose room icon"));
  const open = () => openVisualPicker(input, "room");
  preview.addEventListener("click", open);
  preview.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  const refresh = () => {
    preview.innerHTML = roomVisual(input.value, 52) || iconMarkup(input.value || "mdi:home", 42);
  };
  input.addEventListener("input", refresh);
  refresh();
}

function decorateActionModal() {
  const modal = doc?.getElementById("dm-action-editor-modal");
  if (!modal || modal.dataset.dmPersonalized === "true") return;
  modal.dataset.dmPersonalized = "true";
  const form = modal.querySelector("form");
  const input = form?.elements?.icon;
  const row = input?.closest(".dm-unified-icon-row");
  const preview = form?.querySelector?.("[data-action-icon-preview]");
  if (!input || !row || !preview) return;
  const unlock = () => {
    input.readOnly = false;
    input.closest("label")?.classList.remove("dm-canonical-icon");
  };
  unlock();
  form.elements.type?.addEventListener("change", () => root.queueMicrotask?.(unlock));
  row.querySelectorAll(".dm-visual-pick-btn").forEach((node) => node.remove());
  preview.classList.add("dm-visual-trigger");
  preview.setAttribute("role", "button");
  preview.setAttribute("tabindex", "0");
  preview.setAttribute("aria-label", t("Scegli icona azione", "Choose action icon"));
  const open = () => openVisualPicker(input, "action");
  preview.addEventListener("click", open);
  preview.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  const refresh = () => { preview.innerHTML = actionVisual(input.value, 46) || iconMarkup(input.value, 40); };
  input.addEventListener("input", refresh);
  input.addEventListener("change", refresh);
  refresh();
}

function temperatureRoomVisuals() {
  const store = root.DashboardModernModules?.store;
  if (!store) return;
  // Read-only: the shared view instead of a fresh deep copy on every pass.
  const rooms = (store.peekSection ? store.peekSection("rooms") : store.getSection?.("rooms")) || [];
  doc?.querySelectorAll?.(".dm-temperature-card[data-room-id]").forEach((card) => {
    const room = rooms.find((item) => clean(item.id) === clean(card.dataset.roomId));
    const target = card.querySelector(".dm-temperature-card-icon");
    if (!room || !target) return;
    const visual = roomVisual(room.icon || room.name, 42);
    if (visual) target.innerHTML = visual;
  });
  const formInput = doc?.getElementById("dm-temperature-icon");
  if (formInput) {
    const row = formInput.closest(".dm-icon-field");
    const old = row?.querySelector(".dm-icon-picker");
    if (old) old.dataset.dmRoomCatalog = "true";
  }
}

function decorateRoomEditorRows() {
  if (clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab) !== "stanze") return false;
  const rooms = root.DashboardModernModules?.store?.getSection?.("rooms") || readJson("cd_stanze", []);
  let changed = false;
  doc?.querySelectorAll?.('[data-dm-edit-kind="room"][data-dm-edit-index]').forEach((edit) => {
    const room = rooms[Number(edit.dataset.dmEditIndex)];
    const row = edit.closest(".ed-row");
    const main = row?.querySelector(".ed-row-main");
    if (!room || !main) return;
    let visual = row.querySelector(".dm-room-list-icon");
    if (!visual) {
      visual = doc.createElement("span");
      visual.className = "dm-room-list-icon";
      row.prepend(visual);
      changed = true;
    }
    const markup = roomVisual(room.icon || room.name, 34) || iconMarkup(room.icon || "mdi:home", 30);
    if (visual.innerHTML !== markup) visual.innerHTML = markup;
    const label = main.querySelector(".ed-row-new");
    if (label) label.textContent = clean(room.name) || t("Stanza", "Room");
    main.dataset.dmRoomIconVisible = "true";
  });
  return changed;
}

/* Una casella che ha gia' un padrone non ne prende un secondo.
 *
 * Questo decoratore ridipinge ogni selettore d'icona della configurazione con
 * il carattere scritto nel campo accanto. Va bene quasi ovunque, ma alcune
 * righe — quelle del Report — il loro quadratino se lo disegnano da sole con
 * il disegno stilizzato del catalogo elettrodomestici, lo stesso che si vede
 * sulla plancia. Ridipingerle qui voleva dire cancellare quel disegno un
 * istante dopo averlo messo, e ritrovarsi l'emoji. Chi si dichiara padrone
 * della propria casella la tiene. */
function ownedElsewhere(button) {
  return Boolean(button?.closest?.("[data-dm-icon-owner]"));
}

function decorateLegacyIconPickers() {
  doc?.querySelectorAll?.("button.dm-icon-picker").forEach((button) => {
    if (ownedElsewhere(button)) return;
    const targetId = clean(button.dataset.iconTarget || button.dataset.entityTarget);
    const input = (targetId && doc.getElementById(targetId)) || button.closest(".dm-icon-field,.ed-form-row")?.querySelector("input.ed-icon-input,input");
    if (!input) return;
    const explicitCategory = clean(button.dataset.iconCategory || input.dataset.iconCategory);
    const looksLikeRoom = explicitCategory === "rooms" || /room|stanza|ed-st|floor/i.test(`${input.id || ""} ${button.title || ""} ${button.getAttribute("onclick") || ""}`);
    const category = looksLikeRoom ? "rooms" : explicitCategory;
    button.classList.add("dm-icon-preview-button");
    button.setAttribute("aria-label", category === "rooms" ? t("Scegli icona stanza", "Choose room icon") : t("Scegli icona", "Choose icon"));
    const refresh = () => {
      // Anche qui: il segno puo' arrivare dopo che l'ascolto e' stato legato.
      if (ownedElsewhere(button)) return;
      const value = clean(input.value);
      button.innerHTML = category === "rooms" ? (roomVisual(value, 34) || iconMarkup(value || "mdi:home", 30)) : (actionVisual(value, 34) || iconMarkup(value || "mdi:star", 30));
    };
    if (button.dataset.dmVisualBound !== "true") {
      button.dataset.dmVisualBound = "true";
      input.addEventListener("input", refresh);
      input.addEventListener("change", refresh);
    }
    refresh();
  });
}

function sectionNames() {
  const value = readJson("cd_section_names", {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const PAGE_ALIASES = Object.freeze({ appliances: "appliances-main", "appliances-main": "appliances-main", temp: "temp", clima: "clima", boiler: "boiler", server: "server" });

function setTitleText(node, value) {
  if (!node || !value) return;
  const icon = node.querySelector?.(".icon,.ed-icon,.appl-icon");
  if (!icon && !node.children.length) { node.textContent = value; return; }
  const textNode = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && clean(child.textContent));
  if (textNode) textNode.textContent = ` ${value}`;
  else if (!node.querySelector?.("[data-dm-section-name]")) node.insertAdjacentHTML("beforeend", `<span data-dm-section-name>${esc(value)}</span>`);
}

const EDITOR_TABS_FOR_SECTION = Object.freeze({
  home: ["sez0"], energy: ["sez1"], ev: ["sez2"], solar: ["sez3"], security: ["sez4"],
  server: ["sez6"], temp: ["sez7"], actions: ["sez8"], clima: ["sez9"],
  "appliances-main": ["appliances"], tapparelle: ["tapp"], irrigazione: ["irr"], piscina: ["pool"],
});

function replaceButtonLabel(button, value) {
  if (!button || !value) return;
  const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && clean(node.textContent));
  const target = textNodes.at(-1);
  if (target) target.textContent = ` ${value}`;
  else {
    const label = button.querySelector("[data-dm-config-name]") || doc.createElement("span");
    label.dataset.dmConfigName = "true";
    label.textContent = value;
    if (!label.isConnected) button.append(label);
  }
}

export function applySectionNames() {
  const names = sectionNames();
  Object.entries(names).forEach(([rawKey, name]) => {
    const value = clean(name);
    if (!value) return;
    const key = PAGE_ALIASES[rawKey] || rawKey;
    doc?.querySelectorAll?.(`.tab[data-tab="${CSS.escape(key)}"] .text`).forEach((node) => { node.textContent = value; });
    if (rawKey === "appliances") doc?.querySelectorAll?.('.tab[data-tab="appliances-main"] .text').forEach((node) => { node.textContent = value; });
    for (const editorTab of EDITOR_TABS_FOR_SECTION[key] || []) {
      doc?.querySelectorAll?.(`.ed-tab[data-tab="${CSS.escape(editorTab)}"]`).forEach((button) => replaceButtonLabel(button, value));
    }
    doc?.querySelectorAll?.(`.ed-row[data-section-key="${CSS.escape(key)}"] .ed-row-new`).forEach((node) => {
      const raw = clean(node.textContent);
      const icon = raw.match(/^[^\p{L}\p{N}]+/u)?.[0] || "";
      node.textContent = `${icon}${value}`;
    });
    const page = doc?.getElementById?.(`page-${key}`);
    const selectors = key === "energy"
      ? [".ed-title-text h2"]
      : key === "appliances-main"
        ? [".appl-main-title"]
        : [".sec-header h1", ".sec-header h2", ".page-title", "h2.section-title"];
    for (const selector of selectors) {
      const target = page?.querySelector?.(selector);
      if (target) { setTitleText(target, value); break; }
    }
  });
}

function renameSection(key, current) {
  const modal = doc.createElement("div");
  modal.className = "dm-section-modal";
  modal.id = "dm-section-rename-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true"><header><strong>✏️ ${t("Rinomina sezione", "Rename section")}</strong><button type="button" data-close>✕</button></header><form data-form><label class="ed-slot"><span class="ed-slot-lbl">${t("Nome sezione", "Section name")}</span><input class="ed-input" name="name" value="${esc(current)}" required></label><footer><button type="button" class="ed-btn-add" data-close>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva", "Save")}</button></footer></form></section>`;
  doc.body.append(modal);
  modal.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => modal.remove()));
  modal.querySelector("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = clean(event.currentTarget.elements.name.value);
    if (!value) return;
    const names = sectionNames();
    names[key] = value;
    if (key === "appliances-main") names.appliances = value;
    writeJsonIfChanged("cd_section_names", names);
    applySectionNames();
    modal.remove();
    schedule();
  });
  root.setTimeout?.(() => modal.querySelector("input")?.select(), 30);
}

function ensureSectionRenamer() {
  const body = doc?.getElementById("ed-body");
  if (!body) return;
  body.querySelectorAll("[data-section-renamer]").forEach((node) => node.remove());
  const intro = [...body.querySelectorAll(".ed-intro")].find((node) => /ordine navbar|navbar order/i.test(clean(node.textContent)));
  if (!intro) return;
  const keys = typeof root.cdNavKeys === "function" ? root.cdNavKeys() : [];
  if (!Array.isArray(keys) || !keys.length) return;
  let row = intro.nextElementSibling;
  for (const key of keys) {
    while (row && !row.classList.contains("ed-row")) row = row.nextElementSibling;
    if (!row) break;
    row.dataset.sectionKey = key;
    const main = row.querySelector(".ed-row-main");
    const labelNode = main?.querySelector(".ed-row-new");
    if (main && !main.querySelector("[data-rename]")) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "dm-inline-rename";
      button.dataset.rename = "true";
      button.setAttribute("aria-label", t("Rinomina sezione", "Rename section"));
      button.textContent = "✏️";
      button.addEventListener("click", () => {
        const currentNames = sectionNames();
        const persisted = clean(currentNames[key] || (key === "appliances-main" ? currentNames.appliances : ""));
        const rendered = clean(labelNode?.textContent).replace(/^\S+\s*/, "");
        renameSection(key, persisted || rendered || key);
      });
      main.append(button);
    }
    row = row.nextElementSibling;
  }
}

function evVisual() {
  const evStore = root.DashboardModernModules?.store;
  const storeCars = evStore?.peekSection ? evStore.peekSection("ev") : evStore?.getSection?.("ev");
  const legacyCars = readJson("cd_ev_cars", []);
  /* La stessa precedenza della sezione EV: prima la lista legacy, poi il
   * negozio. Qui era il contrario, e quando le due copie divergevano questa
   * sezione salvava marca e modello sulla lista vecchia, risovrascrivendo
   * quella appena aggiornata: due letture opposte sono un altro modo di avere
   * due padroni. */
  const cars = Array.isArray(legacyCars) && legacyCars.length
    ? legacyCars
    : Array.isArray(storeCars)
      ? storeCars
      : [];
  const requested = Number(root.localStorage?.getItem("cd_ev_car_active") ?? -1);
  const active = cars.length
    ? Math.max(0, Math.min(cars.length - 1, Number.isFinite(requested) ? requested : 0))
    : -1;
  const current = active >= 0 ? cars[active] : null;
  return { cars, active, current, fallback: readJson("cd_ev_visual", {}) };
}

async function saveEvAppearance(brand, model) {
  const { cars, active, current } = evVisual();
  const store = root.DashboardModernModules?.store;
  if (current?.id && typeof store?.updateItem === "function") {
    await store.updateItem("ev", current.id, { brand, model });
  } else if (Array.isArray(cars) && active >= 0 && cars[active]) {
    cars[active] = { ...cars[active], brand, model };
    writeJsonIfChanged("cd_ev_cars", cars);
  } else {
    writeJsonIfChanged("cd_ev_visual", { brand, model });
  }
  root.cdEvCarsRefresh?.();
  root.dmRenderVehicleSelector?.();
  applyEvAppearance();
  schedule();
}

function applyEvAppearance() {
  const { cars, current, fallback } = evVisual();
  const visual = current || fallback || {};
  const brand = effectiveBrand(visual) || "Leapmotor";
  const model = effectiveModel(visual);
  const picker = doc?.getElementById("ev-car-picker");
  if (picker && brand) {
    let badge = picker.querySelector(".dm-ev-brand-badge");
    if (!badge) { badge = doc.createElement("span"); badge.className = "dm-ev-brand-badge"; picker.prepend(badge); }
    badge.innerHTML = `${carBrandVisual(brand, 38)}<span class="dm-ev-brand-copy"><b>${esc(brand)}</b>${model ? `<small>${esc(model)}</small>` : ""}</span>`;
  }
  doc?.querySelectorAll?.(".dm-vehicle-profile-card[data-vehicle-index]").forEach((card) => {
    const index = Number(card.dataset.vehicleIndex);
    const vehicle = cars[index];
    if (!vehicle) return;
    const inferredBrand = effectiveBrand(vehicle);
    const inferredModel = effectiveModel(vehicle);
    const icon = card.querySelector(".dm-vehicle-profile-icon");
    const name = card.querySelector(".dm-vehicle-profile-copy strong");
    if (inferredBrand && icon) icon.innerHTML = carBrandVisual(inferredBrand, 28);
    if (inferredModel && name) name.textContent = inferredModel;
    card.dataset.dmVehicleBrand = inferredBrand;
    card.dataset.dmVehicleModel = inferredModel;
  });
  const page = doc?.getElementById("page-ev");
  if (page) {
    page.dataset.dmEvBrand = brand;
    page.dataset.dmEvModel = model;
  }
}

function ensureEvAppearanceEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body) return;
  const activeTab = clean(doc.querySelector(".ed-tab.active")?.dataset?.tab);
  if (activeTab !== "sez2") {
    body.querySelectorAll("[data-ev-appearance]").forEach((node) => node.remove());
    return;
  }
  const evAccordionBody = () =>
    [...body.querySelectorAll(".ed-acc-body")].find((node) =>
      node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
    );
  const existing = body.querySelector("[data-ev-appearance]");
  if (existing) {
    // The editor repaints #ed-body while the tab settles, so the vehicle
    // accordion can appear after the panel was built. Bring the panel home as
    // soon as its own section exists, retrying a bounded number of times rather
    // than polling for a section that may simply not be configured.
    const home = evAccordionBody();
    if (home) {
      if (existing.parentElement !== home) home.prepend(existing);
      state.evHomeAttempts = 0;
    } else if ((state.evHomeAttempts || 0) < 20) {
      state.evHomeAttempts = (state.evHomeAttempts || 0) + 1;
      root.setTimeout?.(schedule, 120);
    }
    return;
  }
  /* One place, every time.
   *
   * Brand and model belong to the vehicle, so the panel belongs inside the
   * vehicle accordion, above that car's entities. It used to fall back to the
   * top of the tab whenever the accordion had not been printed yet — and since
   * that depends on how fast the editor paints, reopening the EV tab gave two
   * different pages: the same panel above the visibility banner one time and
   * inside the accordion the next. The panel is now built only once its own
   * section exists; until then this comes back for it. */
  if (!evAccordionBody()) {
    if ((state.evHomeAttempts || 0) < 20) {
      state.evHomeAttempts = (state.evHomeAttempts || 0) + 1;
      root.setTimeout?.(schedule, 120);
    }
    return;
  }
  state.evHomeAttempts = 0;
  const { current, fallback } = evVisual();
  const visual = current || fallback || {};
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-ev-appearance";
  panel.dataset.evAppearance = "true";
  const brand = effectiveBrand(visual) || clean(visual.brand) || "Leapmotor";
  const model = effectiveModel(visual);
  panel.innerHTML = `<div class="ed-sec-title">🚘 ${t("Brand e modello auto", "Vehicle brand and model")}</div><div class="ed-intro">${t("Il logo viene associato automaticamente al marchio. Il modello sostituisce la vecchia icona auto generica.", "The logo is automatically associated with the brand. The model replaces the old generic car icon.")}</div><div class="dm-ev-appearance-grid"><button type="button" class="dm-brand-preview dm-visual-trigger" data-brand-preview aria-label="${t("Scegli brand auto", "Choose car brand")}">${carBrandVisual(brand, 56)}<span class="dm-ev-brand-copy"><b>${esc(brand)}</b>${model ? `<small>${esc(model)}</small>` : ""}</span></button><label class="dm-ev-appearance-field"><span>${t("Marchio", "Brand")}</span><select class="ed-input" data-brand>${CAR_BRANDS.map((item) => `<option value="${esc(item.name)}" ${item.name === brand ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label><label class="dm-ev-appearance-field"><span>${t("Modello elettrico / ibrido", "Electric / hybrid model")}</span><select class="ed-input" data-model>${modelOptions(brand, model)}</select></label></div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva brand e modello", "Save brand and model")}</button>`;
  // The accordion is found by its own EV slots rather than by its wording, so a
  // renamed section still gets the panel. It exists: the guard above returned
  // early otherwise, which is what keeps this placement the only one.
  evAccordionBody().prepend(panel);
  const brandSelect = panel.querySelector("[data-brand]");
  const modelSelect = panel.querySelector("[data-model]");
  const refreshPreview = () => {
    const selectedBrand = clean(brandSelect.value);
    const selectedModel = clean(modelSelect.value);
    panel.querySelector("[data-brand-preview]").innerHTML = `${carBrandVisual(selectedBrand, 56)}<span class="dm-ev-brand-copy"><b>${esc(selectedBrand)}</b>${selectedModel ? `<small>${esc(selectedModel)}</small>` : ""}</span>`;
  };
  brandSelect.addEventListener("change", () => {
    const previous = clean(modelSelect.value);
    modelSelect.innerHTML = modelOptions(brandSelect.value, modelBelongsToBrand(brandSelect.value, previous) ? previous : "");
    refreshPreview();
  });
  modelSelect.addEventListener("change", refreshPreview);
  panel.querySelector("[data-brand-preview]").addEventListener("click", () => openVisualPicker(brandSelect, "car"));
  panel.querySelector("[data-save]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    panel.dataset.saved = "saving";
    try {
      const livePanel = button.closest("[data-ev-appearance]") || panel;
      const liveBrand = clean(livePanel?.querySelector("select[data-brand]")?.value);
      const liveModel = clean(livePanel?.querySelector("select[data-model]")?.value);
      if (!liveBrand) throw new Error(t("Seleziona un brand auto.", "Choose a car brand."));
      if (!liveModel) throw new Error(t("Seleziona un modello elettrico o ibrido.", "Choose an electric or hybrid model."));
      if (!modelBelongsToBrand(liveBrand, liveModel)) throw new Error(t("Il modello selezionato non appartiene al marchio scelto.", "The selected model does not belong to the chosen brand."));
      await saveEvAppearance(liveBrand, liveModel);
      panel.dataset.saved = "true";
    } catch (error) {
      panel.dataset.saved = "error";
      console.error("[DashboardModern] EV appearance save failed", error);
    } finally {
      button.disabled = false;
    }
  });
}

function normalizeQuickActionsTitle() {
  const page = doc?.getElementById("page-home") || doc?.getElementById("home");
  if (!page) return false;
  const walker = doc.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let changed = false;
  nodes.forEach((node) => {
    const text = node.nodeValue || "";
    let next = text.replace(/AZIONI\s+RAPIDE\s+PREMIUM/gi, "AZIONI RAPIDE");
    next = next.replace(/PREMIUM\s+QUICK\s+ACTIONS/gi, "QUICK ACTIONS");
    if (next !== text) { node.nodeValue = next; changed = true; }
  });
  return changed;
}

function correctDisplayedVersion() {
  const version = actualVersion();
  if (!version) return;
  const scopes = [doc?.getElementById("page-config"), doc?.getElementById("ed-body"), doc?.getElementById("editor-modal")].filter(Boolean);
  scopes.forEach((scope) => {
    const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const text = node.nodeValue || "";
      if (/v0\.14\.0\b/.test(text)) node.nodeValue = text.replace(/v0\.14\.0\b/g, `v${version}`);
    });
  });
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    decorateRoomModal();
    decorateActionModal();
    decorateLegacyIconPickers();
    temperatureRoomVisuals();
    decorateRoomEditorRows();
    ensureSectionRenamer();
    ensureEvAppearanceEditor();
    applySectionNames();
    applyEvAppearance();
    normalizeQuickActionsTitle();
    correctDisplayedVersion();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function subscribeStore() {
  if (state.subscribed) return;
  const store = root.DashboardModernModules?.store;
  if (typeof store?.subscribe !== "function") return;
  state.subscribed = true;
  store.subscribe(() => schedule());
}

function installStyles() {
  installStyle("dm-personalization-style", `
    .dm-visual-picker{z-index:100020!important}.dm-picker-dialog{width:min(760px,calc(100vw - 24px))!important;max-height:min(82vh,760px)!important}.dm-picker-search{padding:14px 18px 6px}.dm-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;padding:12px 18px 20px;overflow:auto}.dm-picker-option{display:grid;place-items:center;gap:7px;min-height:108px;padding:10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:16px;background:var(--card-background-color,#fff);color:var(--text,#0f172a);cursor:pointer}.dm-picker-option:hover{border-color:var(--primary-color,#0ea5e9);transform:translateY(-1px)}.dm-picker-option b{font-size:12px;line-height:1.2;text-align:center}.dm-picker-option[hidden]{display:none!important}.dm-picker-visual{display:grid;place-items:center;min-width:52px;min-height:52px}.dm-room-art,.dm-car-brand{display:inline-grid;place-items:center;color:var(--primary-color,#0ea5e9)}.dm-action-glyph{display:inline-grid;place-items:center;color:var(--primary-color,#0ea5e9);line-height:1}.dm-action-glyph svg{display:block!important;max-width:100%!important;max-height:100%!important}
    #dm-visual-picker[data-kind="car"] .dm-picker-visual{width:94px!important;height:58px!important;overflow:hidden!important}#dm-visual-picker[data-kind="car"] .dm-picker-visual .dm-car-brand{width:88px!important;max-width:88px!important;height:54px!important;max-height:54px!important;overflow:hidden!important}#dm-visual-picker[data-kind="car"] .dm-picker-visual .dm-car-brand img,#dm-visual-picker[data-kind="car"] .dm-picker-visual .dm-car-brand svg{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
    .dm-unified-icon-row{grid-template-columns:72px minmax(0,1fr)!important}.dm-visual-pick-btn{display:none!important}.dm-visual-trigger,.dm-icon-preview-button{cursor:pointer!important;transition:transform .15s ease,box-shadow .15s ease!important}.dm-visual-trigger:hover,.dm-icon-preview-button:hover{transform:translateY(-1px)!important}.dm-unified-icon-preview.dm-visual-trigger,.dm-action-icon-preview.dm-visual-trigger{display:grid!important;place-items:center!important;width:72px!important;height:72px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important}/* Il quadratino dell'icona era l'unico controllo della configurazione vestito
       dal browser. Gli si diceva quanto grande e quanto arrotondato, mai di che
       colore: senza una regola sul bordo restava quello di serie — due pixel neri
       in rilievo su un grigio che non e' di nessun tema — mentre ogni cosa
       intorno ha il filo chiaro del tema e il fondo della plancia. Nel Report,
       dove i quadratini stanno in fila accanto ai pulsanti che spostano la voce,
       si vedeva benissimo: stessa riga, due stili diversi. Il vestito e' quello
       del riquadro grande qui accanto, in piccolo, e vale per ogni casella
       dell'icona — non solo per quelle che arrivano a disegnare l'anteprima. */
    .dm-icon-picker{border:1px solid var(--divider-color,#dbe4ee)!important;background:var(--secondary-background-color,#eef3f8)!important;color:var(--text,#0f172a)!important;cursor:pointer!important}
    #editor-modal[data-dm-editor-theme="dark"] .dm-icon-picker{border-color:var(--dm-editor-border,#31405f)!important;background:var(--dm-editor-control,#212d4c)!important;color:var(--dm-editor-text,#edf4ff)!important}
    .dm-icon-picker.dm-icon-preview-button{display:grid!important;place-items:center!important;min-width:54px!important;width:54px!important;height:54px!important;padding:0!important;border-radius:14px!important;font-size:0!important}.dm-temperature-card-icon{display:grid!important;place-items:center!important;width:52px!important;height:52px!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important;overflow:hidden!important}.dm-temperature-form{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;padding:18px!important;background:var(--card-background-color,#fff)!important;display:grid!important;gap:14px!important}.dm-temperature-form>.ed-slot{margin:0!important}.dm-temperature-actions{display:flex!important;gap:10px!important;justify-content:flex-end!important}
    .dm-room-list-icon{display:grid!important;place-items:center!important;align-self:center!important;width:48px!important;height:48px!important;min-width:48px!important;border-radius:14px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important;color:var(--primary-color,#0ea5e9)!important}.ed-row:has(>.dm-room-list-icon){display:grid!important;grid-template-columns:52px minmax(0,1fr) 48px 48px!important;gap:10px!important;align-items:center!important}.ed-row:has(>.dm-room-list-icon)>.ed-row-main{display:block!important;min-width:0!important}
    .dm-inline-rename{display:grid;place-items:center;position:absolute;right:8px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 28%,var(--divider-color,#dbe4ee));border-radius:12px;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,var(--card-background-color,#fff));cursor:pointer}.ed-row[data-section-key] .ed-row-main{position:relative;padding-right:48px!important}
    .dm-ev-appearance{margin:12px 0 18px!important}.dm-ev-appearance-grid{display:grid;grid-template-columns:auto minmax(190px,1fr) minmax(220px,1fr);gap:12px;align-items:end;margin:12px 0}.dm-ev-appearance-field{display:grid!important;gap:6px!important;min-width:0!important}.dm-ev-appearance-field>span{font-size:12px!important;font-weight:850!important;color:var(--secondary-text-color,#64748b)!important}.dm-brand-preview{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:5px;min-height:82px;border:1px solid var(--divider-color,#dbe4ee);border-radius:16px;background:var(--secondary-background-color,#eef3f8);padding:10px 12px;cursor:pointer;color:var(--text,#0f172a);overflow:hidden}.dm-brand-preview>.dm-car-brand{order:-1;flex:0 0 auto!important;width:min(108px,100%)!important;max-width:108px!important;height:48px!important;margin:0!important}.dm-brand-preview>.dm-car-brand img,.dm-brand-preview>.dm-car-brand svg{width:100%!important;height:100%!important;object-fit:contain!important}.dm-ev-brand-copy{display:grid!important;gap:2px!important;min-width:0!important}.dm-ev-brand-copy b,.dm-ev-brand-copy small{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-ev-brand-copy small{font-size:10px!important;color:var(--secondary-text-color,#64748b)!important}.dm-ev-brand-badge{display:inline-flex;align-items:center;gap:7px;margin-right:10px}.dm-ev-brand-badge>.dm-car-brand{width:58px!important;max-width:58px!important;height:34px!important}.dm-ev-brand-badge>.dm-car-brand img,.dm-ev-brand-badge>.dm-car-brand svg{width:100%!important;height:100%!important;object-fit:contain!important}
    #page-clima .clima-dashboard{max-width:1180px!important;margin-inline:auto!important}#page-clima .clima-premium-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))!important;gap:16px!important;align-items:start!important}#page-clima .clima-premium-grid>:not([style*="grid-column"]){box-sizing:border-box!important;min-height:300px!important;height:clamp(300px,38vw,390px)!important;max-height:390px!important;border-radius:24px!important;padding:18px!important;overflow:hidden!important}#page-clima [class*="clima-controls"],#page-clima [class*="clima-ctl"]{margin-top:auto!important}
    #ed-body [data-dm-edit-kind="action"]{border-radius:14px!important}#ed-body [data-dm-edit-kind="action"]+button{border-radius:12px!important}
    @media(max-width:760px){.dm-ev-appearance-grid{grid-template-columns:1fr}.dm-brand-preview{grid-column:1}.dm-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dm-picker-option{min-height:102px;padding:8px}.dm-unified-icon-row{grid-template-columns:64px minmax(0,1fr)!important}.dm-unified-icon-preview.dm-visual-trigger,.dm-action-icon-preview.dm-visual-trigger{width:64px!important;height:64px!important}.dm-inline-rename{right:5px;width:36px;height:36px}.ed-row:has(>.dm-room-list-icon){grid-template-columns:48px minmax(0,1fr) 44px 44px!important}#page-clima .clima-premium-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}#page-clima .cp-card,#page-clima .clima-premium-grid>:not([style*="grid-column"]){aspect-ratio:auto!important;min-height:270px!important;height:auto!important;max-height:none!important;padding:14px!important}}
  `);
}

export function installPersonalizationSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", (event) => {
    const edit = event.target?.closest?.('[data-dm-edit-kind="action"]');
    if (edit) state.actionEditIndex = Number(edit.dataset.dmEditIndex);
    const roomPicker = event.target?.closest?.('.dm-icon-picker[data-icon-category="rooms"],.dm-icon-picker[data-dm-room-catalog="true"],button[onclick*="dmIconPicker"][onclick*="rooms"]');
    if (roomPicker) {
      const targetId = roomPicker.dataset.iconTarget || roomPicker.closest(".dm-icon-field")?.querySelector("input")?.id || "ed-room-icon";
      const input = doc.getElementById(targetId) || roomPicker.previousElementSibling;
      if (input) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openVisualPicker(input, "room");
      }
    }
    if (event.target?.closest?.(".ed-tab,[data-tab],[data-dm-edit-kind],.ed-btn-add,.ed-save-btn,.ed-del")) root.setTimeout?.(schedule, 0);
  }, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    for (const name of ["editorSwitch", "buildTempCards", "buildClimaCards", "cdApplyNavOrder", "cdApplyNavVis", "cdEvCarsRefresh", "editorRenderStanze"]) wrapFunction(name, `__dmPersonal_${name}`, schedule);
    subscribeStore();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { subscribeStore(); schedule(); });
  root.addEventListener?.("dashboardmodern:period-bundle", schedule);
  doc.addEventListener("change", (event) => {
    if (event.target?.closest?.("#editor-modal,#ed-body,.dm-section-modal")) root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installPersonalizationSection();