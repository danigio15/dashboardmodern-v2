import { clean, doc, esc, installStyle, readJson, root, t, writeJsonIfChanged, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_POLISH__";
const state = (root[KEY] ||= { installed: false, frame: 0, subscribed: false });

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function sync() {
  try { root.cdMarkDirty?.(); root.cdSyncPush?.(); } catch (_error) {}
}

function polishCanonicalLights() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "luci") return false;
  body.dataset.dmLightsEditor = "canonical-polished";
  body.querySelectorAll(".dm-light-row").forEach((row) => {
    const entity = clean(row.dataset.lightEntity);
    const main = row.querySelector(".ed-row-main");
    const idNode = main?.querySelector(".ed-row-old");
    if (idNode && entity) {
      idNode.textContent = entity;
      idNode.classList.add("dm-light-entity-id");
      idNode.setAttribute("title", entity);
    }
    const edit = row.querySelector(".dm-light-edit");
    if (edit) edit.title = t("Modifica tutti i dati della luce", "Edit all light data");
    const deleteButton = [...row.querySelectorAll("button.ed-del")].find((button) => /elimina luce|delete light/i.test(button.getAttribute("aria-label") || ""));
    if (deleteButton) deleteButton.classList.add("dm-light-delete");
  });
  const add = body.querySelector("[data-light-add-form]");
  if (add) {
    add.classList.add("dm-light-add-polished");
    const input = add.querySelector("[data-light-add-entity]");
    if (input) input.setAttribute("aria-label", t("Entità Home Assistant della nuova luce", "Home Assistant entity for the new light"));
  }
  return true;
}

function serverSlots(body) {
  return [...body.querySelectorAll('input.ed-slot-in[data-ref^="dm.server_"]')]
    .map((input) => {
      const slot = input.closest(".ed-slot") || input.parentElement;
      const label = clean(slot?.querySelector?.(".ed-slot-lbl")?.textContent).replace(/✏️/g, "") || clean(input.dataset.ref).replace(/^dm\.server_/, "").replace(/_/g, " ");
      return { ref: clean(input.dataset.ref), label, value: clean(input.value), input };
    })
    .filter((item) => item.ref);
}

function storeServerValue(item, value) {
  item.input.value = value;
  try {
    if (typeof root.edSetSlot === "function") {
      root.edSetSlot(item.input);
      return;
    }
  } catch (_error) {}
  const overrides = readJson("cd_entity_overrides", {});
  if (value) overrides[item.ref] = value;
  else delete overrides[item.ref];
  writeJsonIfChanged("cd_entity_overrides", overrides);
  if (root.ENTITY_OVERRIDES) {
    if (value) root.ENTITY_OVERRIDES[item.ref] = value;
    else delete root.ENTITY_OVERRIDES[item.ref];
  }
  sync();
}

function renderServerCards(panel, slots, visibleRefs) {
  const list = panel.querySelector("[data-server-list]");
  if (!list) return;
  const visible = slots.filter((slot) => visibleRefs.has(slot.ref));
  list.innerHTML = visible.length
    ? visible.map((slot) => `<article class="ed-row dm-server-row" data-ref="${esc(slot.ref)}"><span class="dm-server-icon">🖥️</span><div class="ed-row-main"><div class="ed-row-new">${esc(slot.label)}</div><div class="ed-row-old mono">${esc(slot.ref)}</div><span class="ed-form-row"><input class="ed-input mono" data-server-value data-entity-input="true" value="${esc(slot.value)}" placeholder="sensor.entity"></span></div><button type="button" class="ed-del" data-remove aria-label="${t("Rimuovi", "Remove")}">🗑️</button></article>`).join("")
    : `<div class="ed-empty">${t("Nessun parametro aggiunto. Scegline uno dal menu.", "No parameters added. Choose one from the menu.")}</div>`;
  list.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    const ref = button.closest("[data-ref]")?.dataset.ref;
    const slot = slots.find((item) => item.ref === ref);
    if (slot) {
      slot.value = "";
      storeServerValue(slot, "");
    }
    visibleRefs.delete(ref);
    renderServerCards(panel, slots, visibleRefs);
    root.setTimeout?.(() => root.DashboardModernModules?.render?.mountEntityPickers?.(panel), 0);
  }));
}

function ensureServerEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || !["sez6", "server"].includes(activeTab()) || body.querySelector("[data-server-compact]")) return false;
  const slots = serverSlots(body);
  if (!slots.length) return false;
  body.querySelectorAll("details.ed-acc").forEach((details) => {
    details.hidden = true;
    details.dataset.dmServerLegacy = "true";
  });
  const visibleRefs = new Set(slots.filter((slot) => slot.value).map((slot) => slot.ref));
  const panel = doc.createElement("section");
  panel.className = "ed-form dm-server-compact";
  panel.dataset.serverCompact = "true";
  panel.innerHTML = `<div class="ed-sec-title">🖥️ ${t("Monitoraggio server", "Server monitoring")}</div><div class="ed-intro">${t("Aggiungi solo i parametri che vuoi mostrare: ogni voce configurata popola automaticamente la card.", "Add only the parameters you want to show: each configured item automatically populates the card.")}</div><div class="dm-server-add"><select class="ed-input" data-slot-select><option value="">— ${t("Scegli parametro", "Choose parameter")} —</option>${slots.map((slot) => `<option value="${esc(slot.ref)}">${esc(slot.label)}</option>`).join("")}</select><button type="button" class="ed-btn-add" data-add>＋ ${t("Aggiungi", "Add")}</button></div><div class="ed-list dm-server-list" data-server-list></div><button type="button" class="ed-save-btn" data-save>💾 ${t("Salva server", "Save server")}</button>`;
  body.prepend(panel);
  renderServerCards(panel, slots, visibleRefs);
  panel.querySelector("[data-add]")?.addEventListener("click", () => {
    const ref = clean(panel.querySelector("[data-slot-select]")?.value);
    if (!ref) return;
    visibleRefs.add(ref);
    renderServerCards(panel, slots, visibleRefs);
    root.setTimeout?.(() => root.DashboardModernModules?.render?.mountEntityPickers?.(panel), 0);
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
  root.setTimeout?.(() => root.DashboardModernModules?.render?.mountEntityPickers?.(panel), 0);
  return true;
}

function ensureActionPolish() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "sez8") return false;
  body.classList.add("dm-actions-editor");
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    polishCanonicalLights();
    ensureServerEditor();
    ensureActionPolish();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function subscribeStore() {
  if (state.subscribed) return;
  const store = root.DashboardModernModules?.store;
  if (typeof store?.subscribe !== "function") return;
  state.subscribed = true;
  store.subscribe((change) => {
    if (["lights", "rooms", "entityOverrides", "snapshot"].includes(change?.section)) schedule();
  });
}

function installStyles() {
  installStyle("dm-editor-polish-style", `
    #ed-body[data-dm-lights-editor="canonical-polished"]{display:grid!important;gap:16px!important}
    #ed-body[data-dm-lights-editor="canonical-polished"]>.ed-intro{margin:0!important;padding:14px 16px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 35%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 5%,var(--card-background-color,#fff))!important}
    .dm-light-group{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;padding:12px!important;overflow:hidden!important}.dm-light-group>.ed-acc-head{border-radius:14px!important;margin-bottom:10px!important}.dm-light-group>.ed-list{display:grid!important;gap:10px!important}.dm-light-row{min-width:0!important;background:var(--secondary-background-color,#f6f8fb)!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:15px!important}.dm-light-row .ed-row-main{min-width:0!important}.dm-light-row .ed-row-new{font-weight:800!important;color:var(--primary-text-color,#0f172a)!important;white-space:normal!important}.dm-light-entity-id{display:block!important;visibility:visible!important;opacity:1!important;color:var(--secondary-text-color,#64748b)!important;font-size:12px!important;overflow-wrap:anywhere!important;white-space:normal!important}.dm-light-room{color:var(--primary-text-color,#0f172a)!important;background:var(--card-background-color,#fff)!important}.dm-light-edit,.dm-light-delete{display:grid!important;place-items:center!important;visibility:visible!important;opacity:1!important}.dm-light-add-form{border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;padding:16px!important;background:var(--card-background-color,#fff)!important;display:grid!important;gap:12px!important}.dm-light-add-form>.ed-form-row{display:flex!important;gap:8px!important;min-width:0!important}.dm-light-add-form>.ed-form-row>.ed-input{flex:1 1 auto!important;min-width:0!important}
    .dm-server-compact{margin-bottom:18px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:20px!important;background:var(--card-background-color,#fff)!important;padding:18px!important}.dm-server-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin:12px 0 16px}.dm-server-list{display:grid!important;gap:10px!important}.dm-server-row{display:grid!important;grid-template-columns:48px minmax(0,1fr) 48px!important;gap:12px!important;align-items:start!important}.dm-server-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:color-mix(in srgb,#0ea5e9 12%,transparent);font-size:20px}.dm-server-row .ed-form-row{margin-top:9px!important}
    .dm-actions-editor{display:grid!important;gap:16px!important}.dm-actions-editor .ed-acc,.dm-actions-editor>.ed-form,.dm-actions-editor>.ed-list{border-radius:20px!important}.dm-actions-editor .ed-row{border-radius:14px!important}
    @media(max-width:720px){.dm-light-row{grid-template-areas:"order main edit delete" "room room room room"!important;grid-template-columns:42px minmax(0,1fr) 44px 44px!important;gap:9px!important}.dm-light-row .dm-light-order{grid-area:order!important}.dm-light-row .ed-row-main{grid-area:main!important}.dm-light-row .dm-light-room{grid-area:room!important;width:100%!important}.dm-light-row .dm-light-edit{grid-area:edit!important}.dm-light-row .dm-light-delete{grid-area:delete!important}.dm-server-add{grid-template-columns:1fr!important}}
  `);
}

export function installEditorPolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    for (const name of ["editorSwitch", "editorRenderLuci", "editorRenderServer"]) wrapFunction(name, `__dmEditorPolish_${name}`, schedule);
    subscribeStore();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { subscribeStore(); schedule(); });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.(".ed-tab,[data-tab],.ed-btn-add,.ed-save-btn,.ed-del")) root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installEditorPolishSection();
