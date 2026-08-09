import { ACTION_ICON_CATALOG, CAR_BRANDS, ROOM_CATALOG, carBrandVisual, roomVisual } from "../core/personalization-catalog.js";
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
  const english = doc.documentElement.lang === "en";
  const title = kind === "car" ? t("Scegli il brand auto", "Choose car brand") : kind === "action" ? t("Scegli l'icona azione", "Choose action icon") : t("Scegli l'icona stanza", "Choose room icon");
  const rows = kind === "car"
    ? CAR_BRANDS.map((item) => ({ value: item.name, label: item.name, visual: carBrandVisual(item.name, 42), search: item.name }))
    : kind === "action"
      ? ACTION_ICON_CATALOG.map((item) => ({ value: item.mdi, label: english ? item.en : item.it, visual: iconMarkup(item.mdi, 38), search: `${item.it} ${item.en} ${item.id}` }))
      : ROOM_CATALOG.map((item) => ({ value: item.mdi, label: english ? item.en : item.it, visual: roomVisual(item.mdi, 42), search: `${item.it} ${item.en} ${item.keywords}` }));
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>🎨 ${title}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${t("Cerca…", "Search…")}" data-search></div><div class="dm-picker-grid">${rows.map((item, index) => `<button type="button" class="dm-picker-option" data-index="${index}" data-search-text="${esc(item.search.toLowerCase())}"><span>${item.visual}</span><b>${esc(item.label)}</b></button>`).join("")}</div></section>`;
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
  if (!input || !row) return;
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "dm-visual-pick-btn";
  button.textContent = "🎨";
  button.setAttribute("aria-label", t("Scegli icona stanza", "Choose room icon"));
  button.addEventListener("click", () => openVisualPicker(input, "room"));
  row.append(button);
  const refresh = () => {
    const preview = modal.querySelector("[data-room-icon-preview]");
    if (!preview) return;
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
  if (!input || !row) return;
  const unlock = () => {
    input.readOnly = false;
    input.closest("label")?.classList.remove("dm-canonical-icon");
  };
  unlock();
  form.elements.type?.addEventListener("change", () => root.queueMicrotask?.(unlock));
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "dm-visual-pick-btn";
  button.textContent = "🎨";
  button.setAttribute("aria-label", t("Scegli icona azione", "Choose action icon"));
  button.addEventListener("click", () => openVisualPicker(input, "action"));
  row.append(button);
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

export function applySectionNames() {
  const names = sectionNames();
  Object.entries(names).forEach(([rawKey, name]) => {
    const value = clean(name);
    if (!value) return;
    const key = PAGE_ALIASES[rawKey] || rawKey;
    doc?.querySelectorAll?.(`.tab[data-tab="${CSS.escape(key)}"] .text`).forEach((node) => { node.textContent = value; });
    if (rawKey === "appliances") doc?.querySelectorAll?.('.tab[data-tab="appliances-main"] .text').forEach((node) => { node.textContent = value; });
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
  if (!body || body.querySelector("[data-section-renamer]")) return;
  const text = clean(body.textContent).toLowerCase();
  if (!/ordine navbar|navbar order|rilevamento e manutenzione|detection and maintenance/.test(text)) return;
  const tabs = [...doc.querySelectorAll(".bottom-nav-bar .tab[data-tab]")];
  if (!tabs.length) return;
  const names = sectionNames();
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-section-renamer";
  panel.dataset.sectionRenamer = "true";
  panel.innerHTML = `<div class="ed-sec-title">✏️ ${t("Nomi sezioni", "Section names")}</div><div class="ed-intro">${t("Rinomina una sezione: il nome cambia sia nella navbar sia nel titolo della pagina.", "Rename a section: the name changes in both the navbar and page title.")}</div><div class="ed-list">${tabs.map((tab) => {
    const key = clean(tab.dataset.tab);
    const icon = clean(tab.querySelector(".icon")?.textContent);
    const current = clean(names[key] || names[key === "appliances-main" ? "appliances" : key] || tab.querySelector(".text")?.textContent || key);
    return `<div class="ed-row" data-section-key="${esc(key)}"><div class="ed-row-main"><div class="ed-row-new">${esc(icon)} ${esc(current)}</div><div class="ed-row-old mono">${esc(key)}</div></div><button type="button" class="ed-del" data-rename aria-label="${t("Rinomina", "Rename")}">✏️</button></div>`;
  }).join("")}</div>`;
  const anchor = body.querySelector(".ed-intro") || body.firstChild;
  body.insertBefore(panel, anchor || null);
  panel.querySelectorAll("[data-rename]").forEach((button) => button.addEventListener("click", () => {
    const row = button.closest("[data-section-key]");
    renameSection(row.dataset.sectionKey, clean(row.querySelector(".ed-row-new").textContent).replace(/^\S+\s*/, ""));
  }));
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
  if (!body || body.querySelector("[data-ev-appearance]")) return;
  const activeTab = clean(doc.querySelector(".ed-tab.active")?.dataset?.tab);
  const text = clean(body.textContent).toLowerCase();
  if (activeTab !== "sez2" && !/auto elettric|electric car|profilo auto|car profile/.test(text)) return;
  const { current, fallback } = evVisual();
  const visual = current || fallback || {};
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-ev-appearance";
  panel.dataset.evAppearance = "true";
  const brand = clean(visual.brand || "Leapmotor");
  const icon = clean(visual.icon || "mdi:car-electric");
  panel.innerHTML = `<div class="ed-sec-title">🚘 ${t("Aspetto auto", "Car appearance")}</div><div class="ed-intro">${t("Scegli brand e icona del profilo attivo. I badge sono grafica neutra integrata e non dipendono da CDN.", "Choose the brand and icon for the active profile. Badges are built-in neutral artwork with no CDN dependency.")}</div><div class="dm-ev-appearance-grid"><button type="button" class="dm-brand-preview" data-brand-preview>${carBrandVisual(brand, 54)}<b>${esc(brand)}</b></button><select class="ed-input" data-brand>${CAR_BRANDS.map((item) => `<option value="${esc(item.name)}" ${item.name === brand ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><span class="dm-action-icon-preview" data-icon-preview>${iconMarkup(icon, 42)}</span><input class="ed-input" data-icon value="${esc(icon)}"><button type="button" class="dm-visual-pick-btn" data-icon-pick>🎨</button></div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva aspetto auto", "Save car appearance")}</button>`;
  body.prepend(panel);
  const brandSelect = panel.querySelector("[data-brand]");
  const iconInput = panel.querySelector("[data-icon]");
  brandSelect.addEventListener("change", () => { panel.querySelector("[data-brand-preview]").innerHTML = `${carBrandVisual(brandSelect.value, 54)}<b>${esc(brandSelect.value)}</b>`; });
  panel.querySelector("[data-brand-preview]").addEventListener("click", () => openVisualPicker(brandSelect, "car"));
  panel.querySelector("[data-icon-pick]").addEventListener("click", () => openVisualPicker(iconInput, "action"));
  iconInput.addEventListener("input", () => { panel.querySelector("[data-icon-preview]").innerHTML = iconMarkup(iconInput.value, 42); });
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
    .dm-visual-picker{z-index:100020!important}.dm-picker-dialog{width:min(760px,calc(100vw - 24px))!important;max-height:min(82vh,760px)!important}.dm-picker-search{padding:14px 18px 6px}.dm-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;padding:12px 18px 20px;overflow:auto}.dm-picker-option{display:grid;place-items:center;gap:7px;min-height:98px;padding:10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:16px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#0f172a);cursor:pointer}.dm-picker-option:hover{border-color:var(--primary-color,#0ea5e9);transform:translateY(-1px)}.dm-picker-option b{font-size:11px;line-height:1.2;text-align:center}.dm-picker-option[hidden]{display:none!important}.dm-room-art,.dm-car-brand{display:inline-grid;place-items:center;color:var(--primary-color,#0ea5e9)}
    .dm-unified-icon-row{grid-template-columns:72px minmax(0,1fr) 52px!important}.dm-visual-pick-btn{display:grid;place-items:center;width:52px;height:52px;border:0;border-radius:13px;background:linear-gradient(145deg,#dff4ff,#b9e6fb);color:#0369a1;font-size:18px;cursor:pointer}.dm-temperature-card-icon{display:grid!important;place-items:center!important;width:52px!important;height:52px!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important;overflow:hidden!important}.dm-temperature-form{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;padding:18px!important;background:var(--card-background-color,#fff)!important;display:grid!important;gap:14px!important}.dm-temperature-form>.ed-slot{margin:0!important}.dm-temperature-actions{display:flex!important;gap:10px!important;justify-content:flex-end!important}
    .dm-section-renamer{margin:0 0 18px!important}.dm-section-renamer .ed-list{display:grid!important;gap:8px!important}.dm-section-renamer .ed-row{min-height:64px!important}.dm-ev-appearance{margin:0 0 18px!important}.dm-ev-appearance-grid{display:grid;grid-template-columns:auto minmax(170px,1fr) auto minmax(170px,1fr) auto;gap:10px;align-items:center;margin:12px 0}.dm-brand-preview{display:flex;align-items:center;gap:8px;border:0;border-radius:14px;background:var(--secondary-background-color,#eef3f8);padding:6px 10px;cursor:pointer;color:var(--primary-text-color,#0f172a)}.dm-ev-brand-badge{display:inline-flex;align-items:center;gap:6px;margin-right:10px}.dm-action-icon-preview{display:grid;place-items:center;width:52px;height:52px;border-radius:13px;background:var(--secondary-background-color,#eef3f8)}
    #page-clima .clima-premium-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))!important;gap:18px!important;align-items:start!important}#page-clima .clima-premium-grid>:not([style*="grid-column"]){min-height:280px!important;height:auto!important;max-width:none!important;border-radius:26px!important;padding:20px!important;box-sizing:border-box!important}#page-clima .clima-dashboard{max-width:1500px!important;margin-inline:auto!important}#page-clima [class*="clima-controls"],#page-clima [class*="clima-ctl"]{margin-top:22px!important}
    #ed-body [data-dm-edit-kind="action"]{border-radius:14px!important}#ed-body [data-dm-edit-kind="action"]+button{border-radius:12px!important}
    @media(max-width:760px){.dm-ev-appearance-grid{grid-template-columns:1fr auto}.dm-brand-preview{grid-column:1/-1}.dm-ev-appearance-grid select{grid-column:1/-1}.dm-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.dm-unified-icon-row{grid-template-columns:64px minmax(0,1fr) 48px!important}}
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
