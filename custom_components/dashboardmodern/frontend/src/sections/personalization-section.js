import { ACTION_ICON_CATALOG, CAR_BRANDS, CAR_ICON_CATALOG, ROOM_CATALOG, actionVisual, carBrandVisual, carIconVisual, roomVisual } from "../core/personalization-catalog.js";
import { clean, doc, esc, installStyle, readJson, root, t, writeJsonIfChanged, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_PERSONALIZATION_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0, actionEditIndex: -1, subscribed: false });

function actualVersion() {
  const info = root.DashboardModernModules?.diagnostics?.BUILD_INFO;
  return clean(info?.dashboardVersion || info?.integrationVersion || "");
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
  if (!input) return;
  closePicker();
  const modal = doc.createElement("div");
  modal.id = "dm-visual-picker";
  modal.className = "dm-section-modal dm-visual-picker";
  modal.dataset.kind = kind;
  const english = doc.documentElement.lang === "en";
  const title = kind === "car" ? t("Scegli il brand auto", "Choose car brand") : kind === "car-icon" ? t("Scegli l'icona auto", "Choose car icon") : kind === "action" ? t("Scegli l'icona azione", "Choose action icon") : t("Scegli l'icona stanza", "Choose room icon");
  const titleIcon = kind === "car" || kind === "car-icon" ? "🚘" : kind === "action" ? "⚡" : "🏠";
  const rows = kind === "car"
    ? CAR_BRANDS.map((item) => ({ value: item.name, label: item.name, visual: carBrandVisual(item.name, 48), search: item.name }))
    : kind === "car-icon"
      ? CAR_ICON_CATALOG.map((item) => ({ value: item.mdi, label: english ? item.en : item.it, visual: carIconVisual(item.mdi, 46), search: `${item.it} ${item.en} ${item.id} ${item.mdi}` }))
      : kind === "action"
        ? ACTION_ICON_CATALOG.map((item) => ({ value: item.mdi, label: english ? item.en : item.it, visual: actionVisual(item.mdi, 46), search: `${item.it} ${item.en} ${item.id} ${item.mdi}` }))
        : ROOM_CATALOG.map((item) => ({ value: item.mdi, label: english ? item.en : item.it, visual: roomVisual(item.mdi, 46), search: `${item.it} ${item.en} ${item.keywords}` }));
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>${titleIcon} ${title}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${t("Cerca…", "Search…")}" data-search></div><div class="dm-picker-grid">${rows.map((item, index) => `<button type="button" class="dm-picker-option" data-index="${index}" data-search-text="${esc(item.search.toLowerCase())}"><span class="dm-picker-visual">${item.visual}</span><b>${esc(item.label)}</b></button>`).join("")}</div></section>`;
  doc.body.append(modal);
  modal.querySelector("[data-close]")?.addEventListener("click", closePicker);
  modal.addEventListener("click", (event) => { if (event.target === modal) closePicker(); });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const q = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-picker-option").forEach((button) => { button.hidden = Boolean(q) && !button.dataset.searchText.includes(q); });
  });
  modal.querySelectorAll(".dm-picker-option").forEach((button) => button.addEventListener("click", () => {
    const item = rows[Number(button.dataset.index)];
    if (!item) return;
    input.value = item.value;
    emitChange(input);
    closePicker();
  }));
  root.setTimeout?.(() => modal.querySelector("[data-search]")?.focus(), 30);
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
  const rooms = store.getSection?.("rooms") || [];
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

function decorateLegacyIconPickers() {
  doc?.querySelectorAll?.("button.dm-icon-picker").forEach((button) => {
    const targetId = clean(button.dataset.iconTarget || button.dataset.entityTarget);
    const input = (targetId && doc.getElementById(targetId)) || button.closest(".dm-icon-field,.ed-form-row")?.querySelector("input.ed-icon-input,input");
    if (!input) return;
    const explicitCategory = clean(button.dataset.iconCategory || input.dataset.iconCategory);
    const looksLikeRoom = explicitCategory === "rooms" || /room|stanza|ed-st|floor/i.test(`${input.id || ""} ${button.title || ""} ${button.getAttribute("onclick") || ""}`);
    const category = looksLikeRoom ? "rooms" : explicitCategory;
    button.classList.add("dm-icon-preview-button");
    button.setAttribute("aria-label", category === "rooms" ? t("Scegli icona stanza", "Choose room icon") : t("Scegli icona", "Choose icon"));
    const refresh = () => {
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
        const current = clean(labelNode?.textContent).replace(/^\S+\s*/, "") || key;
        renameSection(key, current);
      });
      main.append(button);
    }
    row = row.nextElementSibling;
  }
}

function evVisual() {
  const storeCars = root.DashboardModernModules?.store?.getSection?.("ev");
  const legacyCars = readJson("cd_ev_cars", []);
  const cars = Array.isArray(storeCars) && storeCars.length
    ? storeCars
    : Array.isArray(legacyCars)
      ? legacyCars
      : [];
  const requested = Number(root.localStorage?.getItem("cd_ev_car_active") ?? -1);
  const active = cars.length
    ? Math.max(0, Math.min(cars.length - 1, Number.isFinite(requested) ? requested : 0))
    : -1;
  const current = active >= 0 ? cars[active] : null;
  return { cars, active, current, fallback: readJson("cd_ev_visual", {}) };
}

async function saveEvAppearance(brand, icon) {
  const { cars, active, current } = evVisual();
  const store = root.DashboardModernModules?.store;
  if (current?.id && typeof store?.updateItem === "function") {
    await store.updateItem("ev", current.id, { brand, icon });
  } else if (Array.isArray(cars) && active >= 0 && cars[active]) {
    cars[active] = { ...cars[active], brand, icon };
    writeJsonIfChanged("cd_ev_cars", cars);
  } else {
    writeJsonIfChanged("cd_ev_visual", { brand, icon });
  }
  root.cdEvCarsRefresh?.();
  root.dmRenderVehicleSelector?.();
  applyEvAppearance();
  schedule();
}

function applyEvAppearance() {
  const { current, fallback } = evVisual();
  const visual = current || fallback || {};
  const brand = clean(visual.brand);
  const icon = clean(visual.icon || "mdi:car-electric");
  const picker = doc?.getElementById("ev-car-picker");
  if (picker && brand) {
    let badge = picker.querySelector(".dm-ev-brand-badge");
    if (!badge) { badge = doc.createElement("span"); badge.className = "dm-ev-brand-badge"; picker.prepend(badge); }
    badge.innerHTML = `${carBrandVisual(brand, 38)}<b>${esc(brand)}</b>`;
  }
  const page = doc?.getElementById("page-ev");
  if (page) page.dataset.dmEvBrand = brand;
  const heroIcon = page?.querySelector?.("[data-dm-car-icon],.ev-car-icon");
  if (heroIcon && icon) heroIcon.innerHTML = iconMarkup(icon, 40);
}

function ensureEvAppearanceEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body) return;
  const activeTab = clean(doc.querySelector(".ed-tab.active")?.dataset?.tab);
  if (activeTab !== "sez2") {
    body.querySelectorAll("[data-ev-appearance]").forEach((node) => node.remove());
    return;
  }
  if (body.querySelector("[data-ev-appearance]")) return;
  const { current, fallback } = evVisual();
  const visual = current || fallback || {};
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-ev-appearance";
  panel.dataset.evAppearance = "true";
  const brand = clean(visual.brand || "Leapmotor");
  const icon = clean(visual.icon || "mdi:car-electric");
  panel.innerHTML = `<div class="ed-sec-title">🚘 ${t("Aspetto auto", "Car appearance")}</div><div class="ed-intro">${t("Aspetto del profilo auto selezionato.", "Appearance of the selected vehicle profile.")}</div><div class="dm-ev-appearance-grid"><button type="button" class="dm-brand-preview dm-visual-trigger" data-brand-preview aria-label="${t("Scegli brand auto", "Choose car brand")}">${carBrandVisual(brand, 56)}<b>${esc(brand)}</b></button><select class="ed-input" data-brand>${CAR_BRANDS.map((item) => `<option value="${esc(item.name)}" ${item.name === brand ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><button type="button" class="dm-action-icon-preview dm-visual-trigger" data-icon-preview aria-label="${t("Scegli icona auto", "Choose car icon")}">${carIconVisual(icon, 48) || iconMarkup(icon, 42)}</button><input class="ed-input" data-icon value="${esc(icon)}"></div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva aspetto auto", "Save car appearance")}</button>`;
  const visibleEvBlock = [...body.querySelectorAll("details,.ed-acc,.ed-form")].find((node) => node !== panel && /auto elettric|electric car|profilo auto|car profile|vettur|vehicle/i.test(clean(node.textContent)));
  if (visibleEvBlock?.parentElement) visibleEvBlock.insertAdjacentElement("afterend", panel);
  else body.prepend(panel);
  const brandSelect = panel.querySelector("[data-brand]");
  const iconInput = panel.querySelector("[data-icon]");
  brandSelect.addEventListener("change", () => { panel.querySelector("[data-brand-preview]").innerHTML = `${carBrandVisual(brandSelect.value, 56)}<b>${esc(brandSelect.value)}</b>`; });
  panel.querySelector("[data-brand-preview]").addEventListener("click", () => openVisualPicker(brandSelect, "car"));
  panel.querySelector("[data-icon-preview]").addEventListener("click", () => openVisualPicker(iconInput, "car-icon"));
  iconInput.addEventListener("input", () => { panel.querySelector("[data-icon-preview]").innerHTML = carIconVisual(iconInput.value, 48) || iconMarkup(iconInput.value, 42); });
  panel.querySelector("[data-save]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    panel.dataset.saved = "saving";
    try {
      const livePanel = button.closest("[data-ev-appearance]") || panel;
      const liveBrand = clean(livePanel?.querySelector("select[data-brand]")?.value);
      const liveIcon = clean(livePanel?.querySelector("input[data-icon]")?.value) || "mdi:car-electric";
      if (!liveBrand) throw new Error(t("Seleziona un brand auto.", "Choose a car brand."));
      await saveEvAppearance(liveBrand, liveIcon);
      panel.dataset.saved = "true";
    } catch (error) {
      panel.dataset.saved = "error";
      console.error("[DashboardModern] EV appearance save failed", error);
    } finally {
      button.disabled = false;
    }
  });
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
    ensureSectionRenamer();
    ensureEvAppearanceEditor();
    applySectionNames();
    applyEvAppearance();
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
    .dm-visual-picker{z-index:100020!important}.dm-picker-dialog{width:min(760px,calc(100vw - 24px))!important;max-height:min(82vh,760px)!important}.dm-picker-search{padding:14px 18px 6px}.dm-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;padding:12px 18px 20px;overflow:auto}.dm-picker-option{display:grid;place-items:center;gap:7px;min-height:108px;padding:10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#0f172a);cursor:pointer}.dm-picker-option:hover{border-color:var(--primary-color,#0ea5e9);transform:translateY(-1px)}.dm-picker-option b{font-size:12px;line-height:1.2;text-align:center}.dm-picker-option[hidden]{display:none!important}.dm-picker-visual{display:grid;place-items:center;min-width:52px;min-height:52px}.dm-room-art,.dm-car-brand{display:inline-grid;place-items:center;color:var(--primary-color,#0ea5e9)}.dm-action-glyph,.dm-car-icon-glyph{display:inline-grid;place-items:center;border-radius:14px;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,var(--card-background-color,#fff));line-height:1}
    .dm-unified-icon-row{grid-template-columns:72px minmax(0,1fr)!important}.dm-visual-pick-btn{display:none!important}.dm-visual-trigger,.dm-icon-preview-button{cursor:pointer!important;transition:transform .15s ease,box-shadow .15s ease!important}.dm-visual-trigger:hover,.dm-icon-preview-button:hover{transform:translateY(-1px)!important}.dm-unified-icon-preview.dm-visual-trigger,.dm-action-icon-preview.dm-visual-trigger{display:grid!important;place-items:center!important;width:72px!important;height:72px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important}.dm-icon-picker.dm-icon-preview-button{display:grid!important;place-items:center!important;min-width:54px!important;width:54px!important;height:54px!important;padding:0!important;border-radius:14px!important;font-size:0!important}.dm-temperature-card-icon{display:grid!important;place-items:center!important;width:52px!important;height:52px!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important;overflow:hidden!important}.dm-temperature-form{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;padding:18px!important;background:var(--card-background-color,#fff)!important;display:grid!important;gap:14px!important}.dm-temperature-form>.ed-slot{margin:0!important}.dm-temperature-actions{display:flex!important;gap:10px!important;justify-content:flex-end!important}
    .dm-inline-rename{display:grid;place-items:center;position:absolute;right:8px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 28%,var(--divider-color,#dbe4ee));border-radius:12px;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,var(--card-background-color,#fff));cursor:pointer}.ed-row[data-section-key] .ed-row-main{position:relative;padding-right:48px!important}
    .dm-ev-appearance{margin:12px 0 18px!important}.dm-ev-appearance-grid{display:grid;grid-template-columns:auto minmax(170px,1fr) auto minmax(170px,1fr);gap:10px;align-items:center;margin:12px 0}.dm-brand-preview{display:flex;align-items:center;gap:8px;border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;background:var(--secondary-background-color,#eef3f8);padding:6px 10px;cursor:pointer;color:var(--primary-text-color,#0f172a)}.dm-ev-brand-badge{display:inline-flex;align-items:center;gap:6px;margin-right:10px}.dm-action-icon-preview{display:grid;place-items:center;width:58px;height:58px;border:1px solid var(--divider-color,#dbe4ee);border-radius:15px;background:var(--secondary-background-color,#eef3f8)}
    #page-clima .clima-dashboard{max-width:1180px!important;margin-inline:auto!important}#page-clima .clima-premium-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))!important;gap:16px!important;align-items:start!important}#page-clima .clima-premium-grid>:not([style*="grid-column"]){box-sizing:border-box!important;min-height:300px!important;height:clamp(300px,38vw,390px)!important;max-height:390px!important;border-radius:24px!important;padding:18px!important;overflow:hidden!important}#page-clima [class*="clima-controls"],#page-clima [class*="clima-ctl"]{margin-top:auto!important}
    #ed-body [data-dm-edit-kind="action"]{border-radius:14px!important}#ed-body [data-dm-edit-kind="action"]+button{border-radius:12px!important}
    @media(max-width:760px){.dm-ev-appearance-grid{grid-template-columns:1fr auto}.dm-brand-preview{grid-column:1/-1}.dm-ev-appearance-grid select{grid-column:1/-1}.dm-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dm-picker-option{min-height:102px;padding:8px}.dm-unified-icon-row{grid-template-columns:64px minmax(0,1fr)!important}.dm-unified-icon-preview.dm-visual-trigger,.dm-action-icon-preview.dm-visual-trigger{width:64px!important;height:64px!important}.dm-inline-rename{right:5px;width:36px;height:36px}#page-clima .clima-premium-grid{grid-template-columns:1fr!important;gap:12px!important}#page-clima .cp-card,#page-clima .clima-premium-grid>:not([style*="grid-column"]){aspect-ratio:auto!important;min-height:270px!important;height:auto!important;max-height:none!important;padding:14px!important}}
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
