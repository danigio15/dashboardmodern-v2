import { clean, doc, esc, installStyle, readJson, root, t, writeJsonIfChanged, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_POLISH__";
const state = (root[KEY] ||= { installed: false, observer: null, frame: 0 });

function rooms() {
  const list = readJson("cd_stanze", []);
  return Array.isArray(list) ? list : [];
}

function roomOptions(selected = "") {
  return [`<option value="">— ${t("Altre zone", "Other areas")} —</option>`, ...rooms().map((room) => {
    const value = clean(room.name || room.id);
    return `<option value="${esc(value)}" ${value === clean(selected) ? "selected" : ""}>${esc(room.name || value)}</option>`;
  })].join("");
}

function sync() {
  try { root.cdMarkDirty?.(); root.cdSyncPush?.(); } catch (_error) {}
}

function lightsData() {
  const names = readJson("cd_luci", {});
  const roomMap = readJson("cd_luci_rooms", {});
  return {
    names: names && typeof names === "object" && !Array.isArray(names) ? names : {},
    rooms: roomMap && typeof roomMap === "object" && !Array.isArray(roomMap) ? roomMap : {},
  };
}

function renderLightsEditor(body) {
  if (!body) return;
  const { names, rooms: roomMap } = lightsData();
  const entries = Object.entries(names);
  body.dataset.dmLightsEditor = "true";
  body.innerHTML = `<div class="ed-intro dm-editor-intro">💡 ${t("Ogni riga mostra chiaramente nome, entity_id e stanza. Puoi modificare tutto senza perdere di vista l'entità Home Assistant.", "Each row clearly shows name, entity_id and room. Everything can be edited without hiding the Home Assistant entity.")}</div>
    <section class="ed-form dm-lights-card"><div class="ed-sec-title">💡 ${t("Luci configurate", "Configured lights")} <span class="ed-acc-n">${entries.length}</span></div><div class="ed-list" data-light-list>${entries.length ? entries.map(([entity, name]) => `<article class="ed-row dm-light-row" data-light-entity="${esc(entity)}"><span class="dm-light-bulb">💡</span><div class="ed-row-main"><input class="ed-input" data-name value="${esc(name || entity.split(".")[1])}" aria-label="${t("Nome luce", "Light name")}"><div class="ed-row-old mono dm-light-entity">${esc(entity)}</div></div><select class="ed-input dm-light-room" data-room>${roomOptions(roomMap[entity])}</select><button type="button" class="ed-del" data-delete aria-label="${t("Elimina", "Delete")}">🗑️</button></article>`).join("") : `<div class="ed-empty">${t("Nessuna luce configurata.", "No lights configured.")}</div>`}</div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva luci", "Save lights")}</button></section>
    <section class="ed-form dm-light-add"><div class="ed-sec-title">＋ ${t("Aggiungi luce", "Add light")}</div><label class="ed-slot"><span class="ed-slot-lbl">entity_id</span><span class="ed-form-row"><input id="dm-light-add-entity" class="ed-input mono" data-entity-input="true" placeholder="light.salone"></span></label><div class="ed-form-row"><label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input id="dm-light-add-name" class="ed-input" placeholder="${t("Lampada salone", "Living room lamp")}"></label><label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select id="dm-light-add-room" class="ed-input">${roomOptions("")}</select></label></div><button type="button" class="ed-btn-add" data-add>＋ ${t("Aggiungi luce", "Add light")}</button></section>`;

  body.querySelector("[data-save]")?.addEventListener("click", () => {
    const nextNames = {};
    const nextRooms = {};
    body.querySelectorAll("[data-light-entity]").forEach((row) => {
      const entity = clean(row.dataset.lightEntity);
      if (!entity) return;
      nextNames[entity] = clean(row.querySelector("[data-name]")?.value) || entity.split(".")[1] || entity;
      const room = clean(row.querySelector("[data-room]")?.value);
      if (room) nextRooms[entity] = room;
    });
    writeJsonIfChanged("cd_luci", nextNames);
    writeJsonIfChanged("cd_luci_rooms", nextRooms);
    sync();
    root.updateGestioneLuci?.();
    root.buildQuickActions?.();
    renderLightsEditor(body);
  });
  body.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
    const entity = button.closest("[data-light-entity]")?.dataset.lightEntity;
    const current = lightsData();
    delete current.names[entity];
    delete current.rooms[entity];
    writeJsonIfChanged("cd_luci", current.names);
    writeJsonIfChanged("cd_luci_rooms", current.rooms);
    sync();
    root.updateGestioneLuci?.();
    renderLightsEditor(body);
  }));
  body.querySelector("[data-add]")?.addEventListener("click", () => {
    const entity = clean(body.querySelector("#dm-light-add-entity")?.value);
    if (!/^(?:light|switch)\.[a-z0-9_]+$/i.test(entity)) {
      root.alert?.(t("Seleziona una entità light.* o switch.* valida.", "Select a valid light.* or switch.* entity."));
      return;
    }
    const current = lightsData();
    current.names[entity] = clean(body.querySelector("#dm-light-add-name")?.value) || entity.split(".")[1];
    const room = clean(body.querySelector("#dm-light-add-room")?.value);
    if (room) current.rooms[entity] = room; else delete current.rooms[entity];
    writeJsonIfChanged("cd_luci", current.names);
    writeJsonIfChanged("cd_luci_rooms", current.rooms);
    sync();
    root.updateGestioneLuci?.();
    renderLightsEditor(body);
  });
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ensureLightsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "luci") return false;
  if (body.dataset.dmLightsEditor === "true") return true;
  renderLightsEditor(body);
  return true;
}

function serverSlots(body) {
  return [...body.querySelectorAll('input.ed-slot-in[data-ref^="dm.server_"]')].map((input, index) => {
    const slot = input.closest(".ed-slot") || input.parentElement;
    const label = clean(slot?.querySelector?.(".ed-slot-lbl")?.textContent).replace(/✏️/g, "") || clean(input.dataset.ref).replace(/^dm\.server_/, "").replace(/_/g, " ");
    return { ref: clean(input.dataset.ref), label, value: clean(input.value), input, index };
  }).filter((item) => item.ref);
}

function storeServerValue(item, value) {
  item.input.value = value;
  try {
    root.edSetSlot?.(item.input);
    return;
  } catch (_error) {}
  const overrides = readJson("cd_entity_overrides", {});
  if (value) overrides[item.ref] = value; else delete overrides[item.ref];
  writeJsonIfChanged("cd_entity_overrides", overrides);
  if (root.ENTITY_OVERRIDES) {
    if (value) root.ENTITY_OVERRIDES[item.ref] = value; else delete root.ENTITY_OVERRIDES[item.ref];
  }
  sync();
}

function renderServerCards(panel, slots, visibleRefs) {
  const list = panel.querySelector("[data-server-list]");
  if (!list) return;
  const visible = slots.filter((slot) => visibleRefs.has(slot.ref));
  list.innerHTML = visible.length ? visible.map((slot) => `<article class="ed-row dm-server-row" data-ref="${esc(slot.ref)}"><span class="dm-server-icon">🖥️</span><div class="ed-row-main"><div class="ed-row-new">${esc(slot.label)}</div><div class="ed-row-old mono">${esc(slot.ref)}</div><span class="ed-form-row"><input class="ed-input mono" data-server-value data-entity-input="true" value="${esc(slot.value)}" placeholder="sensor.entity"></span></div><button type="button" class="ed-del" data-remove aria-label="${t("Rimuovi", "Remove")}">🗑️</button></article>`).join("") : `<div class="ed-empty">${t("Nessun campo aggiunto. Scegli un tipo dal menu e premi Aggiungi.", "No fields added. Choose a type from the menu and press Add.")}</div>`;
  list.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    const ref = button.closest("[data-ref]")?.dataset.ref;
    const slot = slots.find((item) => item.ref === ref);
    if (slot) { slot.value = ""; storeServerValue(slot, ""); }
    visibleRefs.delete(ref);
    renderServerCards(panel, slots, visibleRefs);
  }));
}

function ensureServerEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || !["sez6", "server"].includes(activeTab()) || body.querySelector("[data-server-compact]")) return false;
  const slots = serverSlots(body);
  if (!slots.length) return false;
  body.querySelectorAll("details.ed-acc").forEach((details) => { details.hidden = true; details.dataset.dmServerLegacy = "true"; });
  const visibleRefs = new Set(slots.filter((slot) => slot.value).map((slot) => slot.ref));
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-server-compact";
  panel.dataset.serverCompact = "true";
  panel.innerHTML = `<div class="ed-sec-title">🖥️ ${t("Monitoraggio server", "Server monitoring")}</div><div class="ed-intro">${t("Aggiungi solo i parametri che vuoi visualizzare. I campi configurati popolano automaticamente la card della dashboard.", "Add only the parameters you want to display. Configured fields automatically populate the dashboard card.")}</div><div class="dm-server-add"><select class="ed-input" data-slot-select><option value="">— ${t("Scegli parametro", "Choose parameter")} —</option>${slots.map((slot) => `<option value="${esc(slot.ref)}">${esc(slot.label)}</option>`).join("")}</select><button type="button" class="ed-btn-add" data-add>＋ ${t("Aggiungi", "Add")}</button></div><div class="ed-list dm-server-list" data-server-list></div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva server", "Save server")}</button>`;
  body.prepend(panel);
  renderServerCards(panel, slots, visibleRefs);
  panel.querySelector("[data-add]")?.addEventListener("click", () => {
    const ref = clean(panel.querySelector("[data-slot-select]")?.value);
    if (!ref) return;
    visibleRefs.add(ref);
    renderServerCards(panel, slots, visibleRefs);
  });
  panel.querySelector("[data-save]")?.addEventListener("click", () => {
    panel.querySelectorAll("[data-ref]").forEach((row) => {
      const slot = slots.find((item) => item.ref === row.dataset.ref);
      if (!slot) return;
      const value = clean(row.querySelector("[data-server-value]")?.value);
      slot.value = value;
      storeServerValue(slot, value);
    });
    sync();
    root.render?.();
    panel.dataset.saved = "true";
  });
  return true;
}

function ensureActionIconPicker() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "sez8") return;
  body.classList.add("dm-actions-editor");
  const input = body.querySelector("#ed-qa-icon");
  if (!input || input.dataset.dmPickerAdded === "true") return;
  input.dataset.dmPickerAdded = "true";
  input.removeAttribute("maxlength");
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "dm-action-picker-button";
  button.textContent = "🎨";
  button.title = t("Scegli icona", "Choose icon");
  button.addEventListener("click", () => {
    try { root.dmIconPicker?.("#ed-qa-icon"); } catch (_error) {}
  });
  input.insertAdjacentElement("afterend", button);
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    ensureLightsEditor();
    ensureServerEditor();
    ensureActionIconPicker();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle("dm-editor-polish-style", `
    .dm-lights-card,.dm-light-add,.dm-server-compact{margin-bottom:18px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;padding:18px!important}.dm-light-row{display:grid!important;grid-template-columns:46px minmax(0,1fr) minmax(180px,280px) 48px!important;gap:12px!important;align-items:center!important;padding:13px!important}.dm-light-bulb,.dm-server-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:color-mix(in srgb,#f59e0b 12%,transparent);font-size:20px}.dm-light-entity{font-size:12px!important;margin-top:5px!important;overflow-wrap:anywhere}.dm-light-room{margin:0!important}.dm-light-add>.ed-form-row{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}.dm-light-add .ed-slot{margin:0!important}.dm-server-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin:12px 0 16px}.dm-server-list{display:grid!important;gap:10px!important}.dm-server-row{display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px!important;gap:12px!important;align-items:start!important}.dm-server-row .ed-form-row{margin-top:9px!important}.dm-server-row .dm-entity-picker{height:48px!important;min-height:48px!important}.dm-actions-editor{display:grid!important;gap:16px!important}.dm-actions-editor .ed-acc,.dm-actions-editor>.ed-form,.dm-actions-editor>.ed-list{border-radius:20px!important}.dm-actions-editor .ed-row{border-radius:14px!important}.dm-action-picker-button{display:grid;place-items:center;flex:0 0 48px;width:48px;height:48px;border:0;border-radius:13px;background:linear-gradient(145deg,#dff4ff,#b9e6fb);color:#0369a1;cursor:pointer;font-size:18px}
    @media(max-width:760px){.dm-light-row{grid-template-columns:42px minmax(0,1fr) 44px!important}.dm-light-room{grid-column:2/3!important}.dm-light-add>.ed-form-row{grid-template-columns:1fr!important}.dm-server-add{grid-template-columns:1fr!important}}
  `);
}

export function installEditorPolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  const observe = () => {
    if (state.observer || !doc.body) return;
    state.observer = new MutationObserver(schedule);
    state.observer.observe(doc.body, { childList: true, subtree: true });
    schedule();
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", observe, { once: true }); else observe();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    wrapFunction("editorSwitch", "__dmEditorPolish_editorSwitch", schedule);
    schedule();
  });
  schedule();
}

installEditorPolishSection();
