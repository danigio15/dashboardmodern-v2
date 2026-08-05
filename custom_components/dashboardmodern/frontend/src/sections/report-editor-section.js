import { clean, doc, esc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_REPORT_EDITOR_SECTION__";
const state = (root[KEY] ||= { installed: false, listeners: false });

function panel() {
  return doc?.querySelector("#editor-modal [data-energy-panel='report']");
}

function rowFields(row) {
  return {
    enabled: row.querySelector("[data-report-toggle]"),
    label: row.querySelector("[data-report-label]"),
    icon: row.querySelector(".dm-icon-field input,.ed-icon-input"),
    entity: row.querySelector("[data-entity-field] input,.dm-entity-field input"),
    actions: row.querySelector("span:has([data-report-up]),.dm-report-actions"),
  };
}

function cumulativeEntity(entity) {
  const id = clean(entity);
  if (!id) return false;
  const current = root.STATES?.[id] || root._RAW_STATES?.[id] || null;
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  return (
    stateClass === "total" ||
    stateClass === "total_increasing" ||
    /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(id)
  );
}

function openReportEditor(row) {
  doc?.getElementById("dm-report-row-editor")?.remove();
  const fields = rowFields(row);
  const modal = doc.createElement("div");
  modal.id = "dm-report-row-editor";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-report-row-title">
    <header><strong id="dm-report-row-title">📊 ${t("Modifica voce Report", "Edit Report entry")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      <label class="dm-modal-check"><input type="checkbox" name="enabled" ${fields.enabled?.checked ? "checked" : ""}> <span>${t("Mostra nel Report", "Show in Report")}</span></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Etichetta", "Label")}</span><input class="ed-input" name="label" value="${esc(fields.label?.value)}" required></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><input class="ed-input" name="icon" value="${esc(fields.icon?.value)}"></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${t("Entità totale per lo storico", "Lifetime total entity")}</span><span class="ed-form-row"><input class="ed-input mono" name="entity" value="${esc(fields.entity?.value)}"><button type="button" class="dm-entity-picker" data-pick>🔍</button></span><small>${t("Contatore cumulativo kWh per mese selezionato, mesi precedenti e anno.", "Cumulative kWh meter for selected month, previous months and year.")}</small></label>
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
    const label = clean(form.elements.label.value);
    const entity = clean(form.elements.entity.value);
    const error = form.querySelector("[data-error]");
    if (!label) {
      error.textContent = t("Inserisci un'etichetta.", "Enter a label.");
      return;
    }
    if (entity && !cumulativeEntity(entity)) {
      error.textContent = t(
        "Seleziona un contatore totale kWh con state_class total o total_increasing.",
        "Select a total kWh meter with state_class total or total_increasing.",
      );
      return;
    }
    if (fields.enabled) fields.enabled.checked = form.elements.enabled.checked;
    if (fields.label) fields.label.value = label;
    if (fields.icon) fields.icon.value = clean(form.elements.icon.value);
    if (fields.entity) fields.entity.value = entity;
    for (const field of [fields.enabled, fields.label, fields.icon, fields.entity]) {
      field?.dispatchEvent(new Event("input", { bubbles: true }));
      field?.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
    panel()?.querySelector("[data-report-save]")?.click();
  });
}

export function normalizeReportEditorSection() {
  const target = panel();
  if (!target) return false;
  target.dataset.dmReportLayout = "cards";
  target.querySelectorAll(".dm-report-row").forEach((row) => {
    const fields = rowFields(row);
    row.dataset.historyValid = String(!fields.entity?.value || cumulativeEntity(fields.entity.value));
    fields.enabled?.closest("label")?.classList.add("dm-report-enabled");
    fields.label?.classList.add("dm-report-label");
    fields.icon?.closest(".dm-icon-field,.ed-form-row")?.classList.add("dm-report-icon");
    fields.entity?.closest("[data-entity-field],.dm-entity-field")?.classList.add("dm-report-history");
    if (fields.actions) {
      fields.actions.classList.add("dm-report-actions");
      if (!fields.actions.querySelector("[data-dm-report-edit]")) {
        const edit = doc.createElement("button");
        edit.type = "button";
        edit.dataset.dmReportEdit = "true";
        edit.textContent = "✏️";
        edit.setAttribute("aria-label", t("Modifica voce Report", "Edit Report entry"));
        fields.actions.prepend(edit);
      }
    }
    let help = row.querySelector(".dm-report-history-help");
    if (!help) {
      help = doc.createElement("small");
      help.className = "dm-report-history-help";
      row.append(help);
    }
    help.textContent = row.dataset.historyValid === "true"
      ? t(
          "Il contatore totale abilita il mese selezionato, i mesi precedenti e il totale anno.",
          "The total meter enables the selected month, previous months and yearly total.",
        )
      : t(
          "Questa entità non sembra cumulativa: scegli il contatore totale lifetime del dispositivo.",
          "This entity does not look cumulative: choose the device lifetime total meter.",
        );
  });
  return true;
}

function installStyles() {
  installStyle(
    "dm-report-editor-section-style",
    `
      #editor-modal [data-energy-panel="report"] [data-report-list]{display:grid!important;gap:12px!important}
      #editor-modal [data-energy-panel="report"] .dm-report-row{display:grid!important;grid-template-columns:124px minmax(150px,1fr) 74px minmax(260px,1.8fr) 132px!important;grid-template-areas:"enabled label icon history actions" "help help help help help"!important;align-items:end!important;gap:10px 12px!important;box-sizing:border-box!important;width:100%!important;margin:0!important;padding:16px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-report-enabled{grid-area:enabled!important;display:flex!important;align-items:center!important;gap:7px!important;min-height:44px!important;margin:0!important;font-weight:850!important;white-space:nowrap!important}
      #editor-modal .dm-report-enabled input{width:18px!important;height:18px!important;margin:0!important}
      #editor-modal .dm-report-label{grid-area:label!important;width:100%!important;min-width:0!important}
      #editor-modal .dm-report-icon{grid-area:icon!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%!important;min-width:0!important}
      #editor-modal .dm-report-icon input{display:none!important}.dm-report-icon button{width:44px!important;height:44px!important;margin:auto!important}
      #editor-modal .dm-report-history{grid-area:history!important;display:grid!important;gap:5px!important;min-width:0!important;margin:0!important}
      #editor-modal .dm-report-history .ed-slot-lbl{display:block!important;min-height:18px!important;font-size:11px!important;font-weight:850!important;color:var(--secondary-text-color,#64748b)!important}
      #editor-modal .dm-report-actions{grid-area:actions!important;display:grid!important;grid-template-columns:repeat(3,38px)!important;justify-content:end!important;align-items:center!important;gap:5px!important;min-width:0!important}
      #editor-modal .dm-report-actions button{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:38px!important;height:38px!important;margin:0!important;padding:0!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:10px!important;background:var(--secondary-background-color,#eef2f7)!important;color:var(--primary-text-color,#0f172a)!important}
      #editor-modal .dm-report-history-help{grid-area:help!important;display:block!important;margin:0!important;color:var(--secondary-text-color,#64748b)!important;font-size:11px!important;line-height:1.4!important}
      #editor-modal .dm-report-row[data-history-valid="false"] .dm-report-history-help{color:var(--warning-color,#b45309)!important;font-weight:850!important}
      .dm-modal-check{display:flex!important;align-items:center!important;gap:9px!important;min-height:44px!important;font-weight:850!important}.dm-modal-check input{width:20px!important;height:20px!important}
      @media(max-width:980px){#editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:110px minmax(0,1fr) 64px 116px!important;grid-template-areas:"enabled label icon actions" "history history history history" "help help help help"!important}}
      @media(max-width:620px){#editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr auto!important;grid-template-areas:"enabled actions" "label label" "icon icon" "history history" "help help"!important;align-items:center!important}.dm-report-actions{grid-template-columns:repeat(3,36px)!important}.dm-report-icon{justify-items:start!important}.dm-report-icon button{margin:0!important}}
    `,
  );
}

export function installReportEditorSection() {
  if (!doc) return;
  installStyles();
  wrapFunction("editorSwitch", "__dmReportEditorSection", normalizeReportEditorSection);
  normalizeReportEditorSection();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const edit = event.target?.closest?.("[data-dm-report-edit]");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          openReportEditor(edit.closest(".dm-report-row"));
          return;
        }
        if (event.target?.closest?.("[data-energy-tab],.ed-tab[data-tab='sez1'],[data-report-add]"))
          root.queueMicrotask?.(normalizeReportEditorSection);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", normalizeReportEditorSection);
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installReportEditorSection, { once: true });
else installReportEditorSection();