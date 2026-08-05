import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALERTS_SECTION__";
const state = (root[KEY] ||= { installed: false, listeners: false });

const GROUPS = Object.freeze([
  ["luci", "💡", "Luci", "Lights"],
  ["tapparelle", "🪟", "Tapparelle", "Shutters"],
  ["sicurezza", "🛡️", "Sicurezza", "Security"],
  ["clima", "❄️", "Clima", "Climate"],
  ["elettrodomestici", "🔌", "Elettrodomestici", "Appliances"],
  ["altro", "🔔", "Altro", "Other"],
]);

function configuredGroups() {
  const extras = readJson("cd_gruppi_extra", {});
  const removed = readJson("cd_gruppi_removed", {});
  const lights = Object.keys(readJson("cd_luci", {})).filter((id) => id.includes("."));
  extras.luci = [...new Set([...(extras.luci || []), ...lights])].filter(
    (id) => !(removed.luci || []).includes(id),
  );
  writeJsonIfChanged("cd_gruppi_extra", extras, { sync: false });
  return { extras, removed, names: readJson("cd_avvisi_names_extra", {}) };
}

function groupFromRow(row) {
  const stored = clean(row.dataset.alertGroup);
  if (stored) return stored;
  const summary = clean(row.closest("details")?.querySelector("summary")?.textContent).toLowerCase();
  const found = GROUPS.find(([, , it, en]) =>
    [it, en].some((label) => summary.includes(label.toLowerCase())),
  );
  return found?.[0] || "altro";
}

function rowEntity(row) {
  return clean(row.dataset.alertEntity || row.querySelector(".ed-row-old")?.textContent);
}

function rowName(row, entity) {
  return (
    clean(row.querySelector(".ed-row-new")?.textContent).replace(/^[^\p{L}\p{N}]+/u, "") ||
    clean(readJson("cd_avvisi_names_extra", {})[entity]) ||
    clean(allStates()[entity]?.attributes?.friendly_name) ||
    entity
  );
}

function groupOptions(selected) {
  return GROUPS.map(
    ([key, icon, it, en]) =>
      `<option value="${key}" ${key === selected ? "selected" : ""}>${icon} ${t(it, en)}</option>`,
  ).join("");
}

function persistAlert({ oldEntity, oldGroup, entity, group, name }) {
  const { extras, removed, names } = configuredGroups();
  for (const key of Object.keys(extras))
    extras[key] = (Array.isArray(extras[key]) ? extras[key] : []).filter(
      (item) => item !== oldEntity && item !== entity,
    );
  for (const key of Object.keys(removed))
    removed[key] = (Array.isArray(removed[key]) ? removed[key] : []).filter(
      (item) => item !== entity,
    );
  extras[group] = [...new Set([...(extras[group] || []), entity])];
  if (oldGroup && oldGroup !== group)
    removed[oldGroup] = [...new Set([...(removed[oldGroup] || []), oldEntity])];
  if (oldEntity !== entity) delete names[oldEntity];
  names[entity] = name;
  let changed = false;
  changed = writeJsonIfChanged("cd_gruppi_extra", extras, { sync: false }) || changed;
  changed = writeJsonIfChanged("cd_gruppi_removed", removed, { sync: false }) || changed;
  changed = writeJsonIfChanged("cd_avvisi_names_extra", names, { sync: false }) || changed;
  if (changed) {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
}

export function openAlertEditor(row) {
  const oldEntity = rowEntity(row);
  if (!oldEntity) return;
  const oldGroup = groupFromRow(row);
  doc?.getElementById("dm-alert-editor-modal")?.remove();
  const modal = doc.createElement("div");
  modal.id = "dm-alert-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-alert-editor-title">
    <header><strong id="dm-alert-editor-title">🔔 ${t("Modifica avviso", "Edit alert")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(rowName(row, oldEntity))}" required></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità Home Assistant", "Home Assistant entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(oldEntity)}" required><button type="button" class="dm-entity-picker" data-pick>🔍</button></span></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Gruppo avviso", "Alert group")}</span><select class="ed-input" name="group">${groupOptions(oldGroup)}</select></label>
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close],[data-cancel]").forEach((button) => button.addEventListener("click", close));
  modal.querySelector("[data-pick]").addEventListener("click", () => root.wzPickEntity?.(form.elements.entity));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = clean(form.elements.name.value);
    const entity = clean(form.elements.entity.value);
    const group = clean(form.elements.group.value) || "altro";
    const error = form.querySelector("[data-error]");
    if (!name || !/^[a-z_]+\.[a-z0-9_]+$/i.test(entity)) {
      error.textContent = t("Inserisci un nome e un'entità valida.", "Enter a name and a valid entity.");
      return;
    }
    persistAlert({ oldEntity, oldGroup, entity, group, name });
    close();
    root.editorSwitch?.("avvisi");
    root.queueMicrotask?.(normalizeAlertsEditor);
  });
}

export function normalizeAlertsEditor() {
  if (doc?.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
  const body = doc.getElementById("ed-body");
  if (!body) return false;
  body.querySelectorAll(".ed-row").forEach((row) => {
    const entity = rowEntity(row);
    if (!entity) {
      const label = clean(row.querySelector(".ed-row-new")?.textContent);
      if (!label) row.remove();
      return;
    }
    row.dataset.alertEntity = entity;
    row.dataset.alertGroup = groupFromRow(row);
    if (row.querySelector("[data-dm-alert-edit]")) return;
    const edit = doc.createElement("button");
    edit.type = "button";
    edit.className = "ed-del dm-alert-edit";
    edit.dataset.dmAlertEdit = "true";
    edit.textContent = "✏️";
    edit.setAttribute("aria-label", t("Modifica avviso", "Edit alert"));
    const remove = [...row.querySelectorAll(".ed-del")].at(-1);
    remove?.before(edit);
  });
  return true;
}

function installStyles() {
  installStyle(
    "dm-alerts-section-style",
    `
      #editor-modal .dm-alert-edit{background:color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important;color:var(--info-color,#0369a1)!important}
      #editor-modal .dm-alert-row,#editor-modal .ed-tab[data-tab="avvisi"]~#ed-body .ed-row{min-width:0!important}
    `,
  );
}

export function installAlertsSection() {
  if (!doc) return;
  installStyles();
  wrapFunction("editorSwitch", "__dmAlertsSection", normalizeAlertsEditor);
  normalizeAlertsEditor();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const edit = event.target?.closest?.("[data-dm-alert-edit]");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          openAlertEditor(edit.closest(".ed-row"));
          return;
        }
        if (event.target?.closest?.(".ed-tab[data-tab='avvisi']"))
          root.queueMicrotask?.(normalizeAlertsEditor);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", normalizeAlertsEditor);
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installAlertsSection, { once: true });
else installAlertsSection();