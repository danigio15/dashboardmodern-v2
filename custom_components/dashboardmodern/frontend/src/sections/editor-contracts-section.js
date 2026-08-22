import { applianceArtwork } from "../core/appliance-artwork.js";
import { clean, doc, english, installStyle, onEditorRedraw, root, t, wrapFunction } from "./shared.js";

root.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_EDITOR_CONTRACTS_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
});

function installExplicitReportSaveContract() {
  const store = root.DashboardModernModules?.store;
  const current = store?.saveReport;
  if (!store || typeof current !== "function" || current.__dmExplicitReportSave) return false;

  function explicitReportSave(items) {
    const existingById = new Map(
      [...(this.getSection?.("appliances") || []), ...(this.getSection?.("loads") || [])].map(
        (item) => [item.id, item],
      ),
    );
    const marked = (Array.isArray(items) ? items : []).map((item) => {
      const existing = existingById.get(item.id);
      const selected = clean(item.report_entity);
      const previous = clean(existing?.report_entity);
      const metadata = {
        ...(existing?.metadata || {}),
        ...(item.metadata || {}),
      };
      if (
        selected &&
        (existing?.metadata?.report_entity_explicit === true || !existing || selected !== previous)
      ) {
        metadata.report_entity_explicit = true;
      } else if (!selected) {
        delete metadata.report_entity_explicit;
      }
      return { ...item, metadata };
    });
    return current.call(this, marked);
  }

  explicitReportSave.__dmExplicitReportSave = true;
  explicitReportSave.__dmPrevious = current;
  store.saveReport = explicitReportSave;
  return true;
}

function normalizeReportManualPanel() {
  const panel = doc?.querySelector('#editor-modal [data-energy-panel="report"]');
  const button = panel?.querySelector("[data-report-add]");
  const form = panel?.querySelector("[data-report-manual]");
  if (!button || !form) return false;

  if (!form.id) form.id = `dm-report-manual-${Math.random().toString(36).slice(2, 9)}`;
  button.setAttribute("aria-controls", form.id);
  button.dataset.dmClosedLabel ||= clean(button.textContent);

  if (button.dataset.dmReportToggleBound !== "true") {
    button.dataset.dmReportToggleBound = "true";
    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.hidden = !form.hidden;
        const open = !form.hidden;
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open
          ? t("− Chiudi voce manuale", "− Close manual entry")
          : button.dataset.dmClosedLabel;
        if (open) panel.querySelector("[data-manual-name]")?.focus();
      },
      true,
    );
  }

  if (!button.hasAttribute("aria-expanded")) {
    form.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
  const open = button.getAttribute("aria-expanded") === "true";
  form.hidden = !open;
  button.textContent = open
    ? t("− Chiudi voce manuale", "− Close manual entry")
    : button.dataset.dmClosedLabel;
  return true;
}

function synchronizeReportFields() {
  doc
    ?.querySelectorAll('#editor-modal [data-energy-panel="report"] .dm-report-row')
    .forEach((row) => {
      row.querySelectorAll("input,select,textarea").forEach((field) => {
        if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)) {
          field.toggleAttribute("checked", field.checked);
        } else {
          field.setAttribute("value", field.value);
        }
        field.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
}

function normalizeLightEditCompatibility() {
  let changed = false;
  doc
    ?.querySelectorAll('#editor-modal [data-light-entity] button[onclick^="dmOpenLightEditor"]')
    .forEach((button) => {
      const entity = clean(button.closest("[data-light-entity]")?.dataset?.lightEntity);
      if (!entity) return;
      button.setAttribute("onclick", `cdLuceRen(${JSON.stringify(entity)})`);
      changed = true;
    });
  return changed;
}

function normalizeLightsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || clean(doc.querySelector(".ed-tab.active")?.dataset?.tab) !== "luci") return false;
  body.querySelectorAll(".dm-light-group").forEach((group) => {
    group.dataset.dmCompactEditor = "true";
  });
  body.querySelectorAll(".dm-light-row").forEach((row) => {
    row.dataset.dmCompactEditor = "true";
    const deleteButton = [...row.children].find((node) =>
      node.matches?.("button.ed-del:not(.dm-light-edit)"),
    );
    if (deleteButton) deleteButton.classList.add("dm-light-delete");
  });
  return true;
}

function normalizeAlertsEditor() {
  if (doc?.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
  root.__DASHBOARDMODERN_ALERTS_RUNTIME__?.apply?.();
  return true;
}

function temperatureEditMode(form) {
  const cancel = form?.querySelector("[data-temperature-cancel]");
  if (cancel && !cancel.hidden) return true;
  const title = clean(
    form?.querySelector("[data-temperature-form-title]")?.textContent,
  ).toLowerCase();
  return /^(modifica|edit)\b/.test(title);
}

function normalizeTemperatureEditor() {
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const editing = temperatureEditMode(form);
  form.dataset.dmTemperatureMode = editing ? "edit" : "add";
  const submit = form.querySelector("[data-temperature-submit]");
  if (submit) {
    submit.classList.add("dm-temperature-submit");
    submit.textContent = editing
      ? t("SALVA MODIFICHE", "SAVE CHANGES")
      : t("ASSOCIA SENSORI", "ASSOCIATE SENSORS");
  }
  const title = form.querySelector("[data-temperature-form-title]");
  if (title) title.dataset.dmTemperatureMode = editing ? "edit" : "add";
  return true;
}

function selectedOptionGlyph(select) {
  const option = select?.selectedOptions?.[0] || select?.options?.[select?.selectedIndex];
  const text = clean(option?.textContent || option?.label);
  if (!text) return "🔌";
  return text.split(/\s+/)[0] || "🔌";
}

export function syncApplianceEditorPreview(
  modal = doc?.getElementById("dm-appliance-editor-modal"),
) {
  const select = modal?.querySelector('select[name="icon"]');
  const preview = modal?.querySelector("[data-icon-preview]");
  if (!select || !preview) return false;

  const value = clean(select.value).toLowerCase();
  const artwork = applianceArtwork(value, 72);
  if (artwork) {
    if (preview.innerHTML !== artwork) preview.innerHTML = artwork;
  } else {
    const glyph = selectedOptionGlyph(select);
    preview.innerHTML = `<span class="dm-appliance-menu-glyph">${glyph}</span>`;
  }
  preview.dataset.dmPreviewSource = "artwork";
  preview.setAttribute("aria-label", clean(select.selectedOptions?.[0]?.textContent) || value);

  const field = select.closest(".dm-appliance-icon-field");
  const help = field?.querySelector("small");
  if (help) {
    help.textContent = t(
      "L’anteprima usa la stessa illustrazione della card per il tipo selezionato.",
      "The preview uses the same card artwork for the selected appliance type.",
    );
  }
  return true;
}

function energyEditorActive() {
  const tab = clean(doc?.querySelector("#editor-modal .ed-tab.active")?.dataset?.tab).toLowerCase();
  return tab === "sez1" || tab === "energy";
}

function readSectionsVisibility() {
  try {
    const parsed = JSON.parse(root.localStorage?.getItem("cd_sections") || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function updateEnergyVisibilityButton(button) {
  if (!button) return;
  const visible = readSectionsVisibility().energy !== false;
  button.dataset.visible = String(visible);
  button.textContent = visible
    ? t(
        "🟢 Sezione visibile in dashboard — tocca per nascondere",
        "🟢 Section visible — tap to hide",
      )
    : t("⚪ Sezione nascosta — tocca per mostrare", "⚪ Section hidden — tap to show");
  button.setAttribute("aria-pressed", String(visible));
}

function normalizeEnergyVisibility() {
  if (!energyEditorActive()) return false;
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  let host = body.querySelector(".dm-energy-visibility-contract");
  if (!host) {
    host = doc.createElement("div");
    host.className = "dm-energy-visibility-contract";
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "ed-btn-add dm-energy-visibility-toggle";
    button.dataset.key = "energy";
    button.dataset.dmEnergyVisibility = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (typeof root.edSecTog === "function") {
        root.edSecTog(button);
        root.queueMicrotask?.(schedule);
        return;
      }
      const current = readSectionsVisibility();
      current.energy = current.energy === false;
      root.localStorage?.setItem("cd_sections", JSON.stringify(current));
      root.cdMarkDirty?.();
      root.cdSyncPush?.();
      root.cdApplyNavVis?.();
      updateEnergyVisibilityButton(button);
    });
    host.append(button);
    body.prepend(host);
  }
  updateEnergyVisibilityButton(host.querySelector("[data-dm-energy-visibility]"));
  return true;
}

function normalizeEnergyGuide() {
  const guide = doc?.querySelector("#editor-modal .dm-energy-source-guide");
  if (!guide) return false;
  const intro = guide.querySelector(".dm-energy-source-guide-intro");
  if (intro && intro.dataset.dmPolished !== "true") {
    intro.dataset.dmPolished = "true";
    intro.innerHTML = `<strong>⚡ ${t("Come leggere la configurazione Energia", "How to read the Energy configuration")}</strong>
      <div class="dm-energy-guide-steps">
        <span><b>1 · ${t("Storico e mesi precedenti", "History and previous months")}</b><small>${t("usa il contatore totale kWh tramite Recorder", "use the total kWh meter through Recorder")}</small></span>
        <span><b>2 · ${t("Giorno / Mese / Anno", "Day / Month / Year")}</b><small>${t("servono solo se non c'è un contatore totale: quando c'è, comanda lui", "only used when there is no total meter: when there is one, it wins")}</small></span>
        <span><b>3 · ${t("Consumo Casa", "Home consumption")}</b><small>${t("usa il bilancio Home Assistant quando Fotovoltaico e Rete sono completi; Casa resta fallback", "uses the Home Assistant balance when Solar and Grid are complete; Home remains the fallback")}</small></span>
      </div>`;
  }

  guide.querySelectorAll(".dm-energy-source-contract").forEach((card) => {
    const group = clean(card.dataset.energySourceGroup);
    card.dataset.dmPolished = "true";
    const header = card.querySelector("header");
    let note = header?.querySelector(".dm-energy-contract-note");
    if (!note && header) {
      note = doc.createElement("small");
      note.className = "dm-energy-contract-note";
      header.append(note);
    }
    if (note) {
      note.textContent =
        group === "house" ? t("Fallback", "Fallback") : t("Storico + periodo", "History + period");
    }
  });
  return true;
}

function normalizeEnergyHelp() {
  const active = energyEditorActive();
  doc?.querySelectorAll("#editor-modal .dm-energy-help-compact").forEach((overview) => {
    overview.hidden = !active;
  });
  if (!active) return false;
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  body.classList.add("dm-energy-editor-body");
  body.querySelectorAll(":scope > details.ed-acc").forEach((group, index) => {
    group.classList.add("dm-energy-config-group");
    group.dataset.energyGroupIndex = String(index);
  });

  let overview = body.querySelector(".dm-energy-help-compact");
  if (!overview) {
    overview = doc.createElement("div");
    overview.className = "dm-energy-help-compact";
    const visibility = body.querySelector(".dm-energy-visibility-contract");
    visibility?.after(overview);
    if (!visibility) body.prepend(overview);
  }
  const markup = t(
    "<strong>⚡ Configurazione Energia</strong><span><b>Periodo corrente:</b> usa i sensori Giorno / Mese / Anno configurati. <b>Mesi precedenti:</b> usa i contatori Totali kWh tramite Recorder. Casa viene calcolata con lo stesso bilancio dei flussi di Home Assistant.</span>",
    "<strong>⚡ Energy configuration</strong><span><b>Current period:</b> uses configured Day / Month / Year sensors. <b>Previous months/years:</b> uses Total kWh counters through Recorder. Home is calculated with the same Home Assistant flow balance.</span>",
  );
  if (overview.innerHTML !== markup) overview.innerHTML = markup;
  doc?.querySelectorAll("#editor-modal .dm-energy-total-note").forEach((note) => {
    const label = t(
      "Storico · contatore totale kWh (total / total_increasing)",
      "History · total kWh counter (total / total_increasing)",
    );
    if (clean(note.textContent) !== label) note.textContent = label;
  });
  normalizeEnergyGuide();
  return true;
}

function hasEntityPicker(container) {
  return [...(container?.querySelectorAll?.("button") || [])].some(
    (button) =>
      button.classList.contains("dm-entity-picker") ||
      button.dataset.dmEntityPicker === "true" ||
      clean(button.textContent).includes("🔍"),
  );
}

function normalizeEntityPickers() {
  const modal = doc?.getElementById("editor-modal");
  if (!modal) return false;
  let changed = false;
  modal.querySelectorAll("input.ed-slot-in[data-ref],input[data-ref].ed-input").forEach((input) => {
    if (input.type === "hidden" || input.disabled) return;
    const row = input.parentElement;
    if (!row || hasEntityPicker(row)) return;
    const picker = doc.createElement("button");
    picker.type = "button";
    picker.className = "dm-entity-picker dm-contract-entity-picker";
    picker.dataset.dmEntityPicker = "true";
    picker.setAttribute("aria-label", t("Cerca entità", "Search entity"));
    picker.textContent = "🔍";
    picker.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const ref = clean(input.dataset.ref);
      root.wzPickEntity?.(ref || input);
    });
    row.classList.add("dm-editor-entity-row");
    input.insertAdjacentElement("afterend", picker);
    changed = true;
  });
  return changed;
}

export function applyEditorContracts() {
  installExplicitReportSaveContract();
  if (!doc?.querySelector("#editor-modal,.dm-section-modal")) return false;
  normalizeReportManualPanel();
  normalizeLightEditCompatibility();
  normalizeLightsEditor();
  normalizeAlertsEditor();
  normalizeTemperatureEditor();
  syncApplianceEditorPreview();
  normalizeEnergyVisibility();
  normalizeEnergyHelp();
  normalizeEntityPickers();
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    applyEditorContracts();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installWrappers() {
  onEditorRedraw("__dmEditorContractsSection", schedule);
  wrapFunction("apriConfigEntita", "__dmEditorContractsOpen", schedule);
}

function installStyles() {
  installStyle(
    "dm-editor-contracts-style",
    `
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell{
        background:var(--card-bg,#161f36)!important;color:var(--text,#e6edf7)!important
      }
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .dm-report-row{
        background:var(--surface-2,#1b2540)!important
      }
      #editor-modal[data-dm-editor-theme="dark"] .ed-input,
      #editor-modal[data-dm-editor-theme="dark"] input,
      #editor-modal[data-dm-editor-theme="dark"] select,
      #editor-modal[data-dm-editor-theme="dark"] textarea{
        background:var(--surface-3,#212d4c)!important;color:var(--text,#e6edf7)!important;
        border-color:var(--card-border,#263453)!important
      }
      #editor-modal[data-dm-editor-theme="dark"] .ed-slot-lbl{color:var(--text-dim,#92a4c2)!important}
      #editor-modal [data-energy-panel="report"] [data-report-manual][hidden]{display:none!important}
      #editor-modal [data-energy-panel="report"] [data-report-manual]:not([hidden]){display:grid!important;gap:10px!important;margin-top:10px!important}
      #editor-modal .dm-energy-visibility-contract{display:block!important;margin:0 0 12px!important}
      #editor-modal .dm-energy-visibility-toggle{box-sizing:border-box!important;width:100%!important;min-height:52px!important;margin:0!important;padding:11px 14px!important;border:0!important;border-radius:15px!important;color:#fff!important;font-size:13px!important;font-weight:900!important;line-height:1.3!important;white-space:normal!important}
      #editor-modal .dm-energy-visibility-toggle[data-visible="true"]{background:linear-gradient(135deg,#10b981,#047857)!important}
      #editor-modal .dm-energy-visibility-toggle[data-visible="false"]{background:linear-gradient(135deg,#94a3b8,#64748b)!important}
      #editor-modal .dm-energy-help-compact[hidden]{display:none!important}
      #editor-modal .dm-energy-help-compact{display:grid!important;grid-template-columns:1fr!important;gap:6px!important;margin:0 0 14px!important;padding:13px 14px!important;border:1px solid color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 18%,transparent)!important;border-radius:15px!important;background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 8%,transparent)!important;color:var(--text,#0f172a)!important}
      #editor-modal .dm-energy-help-compact strong{font-size:13px!important;font-weight:900!important}
      #editor-modal .dm-energy-help-compact span{color:var(--secondary-text-color,var(--text-dim,#64748b))!important;font-size:11.5px!important;line-height:1.5!important}
      #editor-modal .dm-energy-total-note{display:block!important;margin-top:5px!important;font-size:10px!important;line-height:1.3!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      #editor-modal .dm-energy-editor-body{display:grid!important;align-content:start!important;gap:11px!important}
      #editor-modal .dm-energy-editor-body>.dm-energy-visibility-contract,#editor-modal .dm-energy-editor-body>.dm-energy-help-compact{margin-bottom:0!important}
      #editor-modal .dm-energy-config-group{box-sizing:border-box!important;margin:0!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:16px!important;overflow:hidden!important;background:color-mix(in srgb,var(--ha-card-background,var(--card-bg,#fff)) 95%,var(--secondary-background-color,#f8fafc))!important}
      #editor-modal .dm-energy-config-group>summary{min-height:48px!important;padding:12px 14px!important;font-size:13px!important;font-weight:900!important}
      #editor-modal .dm-energy-config-group>.ed-acc-body{display:grid!important;gap:10px!important;padding:12px 14px 14px!important;border-top:1px solid var(--divider-color,var(--card-border,#e2e8f0))!important}
      #editor-modal .dm-energy-config-group .ed-slot{margin:0!important;padding:0!important}
      #editor-modal .dm-editor-entity-row{display:flex!important;align-items:stretch!important;gap:7px!important;min-width:0!important}
      #editor-modal .dm-editor-entity-row>input{min-width:0!important;flex:1 1 auto!important}
      #editor-modal .dm-contract-entity-picker{display:grid!important;place-items:center!important;flex:0 0 42px!important;width:42px!important;min-width:42px!important;height:42px!important;margin:0!important;padding:0!important;border:0!important;border-radius:11px!important;background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;color:#fff!important;font-size:15px!important;cursor:pointer!important}

      /* Energy source guide: readable visual hierarchy on desktop and mobile. */
      #editor-modal .dm-energy-source-guide{gap:14px!important}
      #editor-modal .dm-energy-source-guide-intro{padding:16px!important;gap:10px!important}
      #editor-modal .dm-energy-source-guide-intro>strong{font-size:15px!important}
      #editor-modal .dm-energy-guide-steps{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #editor-modal .dm-energy-guide-steps>span{display:grid!important;align-content:start!important;gap:4px!important;padding:10px 11px!important;border-radius:12px!important;background:color-mix(in srgb,var(--ha-card-background,var(--card-bg,#fff)) 78%,transparent)!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 14%,transparent)!important}
      #editor-modal .dm-energy-guide-steps b{font-size:11px!important;color:var(--text,#0f172a)!important}
      #editor-modal .dm-energy-guide-steps small{font-size:10.5px!important;line-height:1.4!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      #editor-modal .dm-energy-source-guide-grid{gap:12px!important}
      #editor-modal .dm-energy-source-contract{padding:14px!important;border-radius:16px!important}
      #editor-modal .dm-energy-source-contract header{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;margin-bottom:10px!important}
      #editor-modal .dm-energy-source-contract header>strong{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #editor-modal .dm-energy-contract-note{padding:4px 7px!important;border-radius:999px!important;background:var(--secondary-background-color,#f1f5f9)!important;color:var(--secondary-text-color,#64748b)!important;font-size:9px!important;font-weight:900!important;white-space:nowrap!important}
      #editor-modal .dm-energy-source-contract dl{gap:0!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:12px!important;overflow:hidden!important}
      #editor-modal .dm-energy-source-contract dl>div{display:grid!important;grid-template-columns:96px minmax(0,1fr)!important;align-items:start!important;gap:10px!important;padding:9px 10px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important}
      #editor-modal .dm-energy-source-contract dl>div:last-child{border-bottom:0!important}
      #editor-modal .dm-energy-source-contract dt{padding-top:1px!important;font-size:9.5px!important;line-height:1.3!important}
      #editor-modal .dm-energy-source-contract dd{overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;font-size:10.5px!important;line-height:1.45!important}

      /* Appliance editor: preview mirrors the native select glyph exactly. */
      #dm-appliance-editor-modal .dm-appliance-icon-preview[data-dm-preview-source="artwork"]{background:linear-gradient(145deg,color-mix(in srgb,var(--info-color,#0ea5e9) 10%,var(--ha-card-background,#fff)),var(--ha-card-background,var(--card-bg,#fff)))!important}
      #dm-appliance-editor-modal .dm-appliance-menu-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:38px!important;line-height:1!important}
      #dm-appliance-editor-modal .dm-appliance-icon-field>small{font-size:11px!important;line-height:1.4!important;color:var(--secondary-text-color,#64748b)!important}

      /* Lights: compact cards instead of floating controls and empty mobile space. */
      #editor-modal .dm-light-group{display:grid!important;gap:10px!important;margin:0 0 12px!important;padding:12px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:16px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-light-group>.ed-acc-head{min-height:40px!important;margin:0!important;padding:2px 4px 8px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important}
      #editor-modal .dm-light-group>.ed-list{display:grid!important;gap:8px!important}
      #editor-modal .dm-light-row{box-sizing:border-box!important;width:100%!important;margin:0!important;padding:10px!important;border:1px solid color-mix(in srgb,var(--divider-color,#e2e8f0) 84%,transparent)!important;border-radius:13px!important;background:var(--secondary-background-color,#f8fafc)!important}
      #editor-modal .dm-light-add-form{box-sizing:border-box!important;margin-top:14px!important;padding:14px!important;border:1px dashed color-mix(in srgb,var(--info-color,#0ea5e9) 42%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 5%,transparent)!important}
      #editor-modal .dm-light-row>.ed-row-main{min-width:0!important}
      #editor-modal .dm-light-row>.ed-row-main .ed-row-new,#editor-modal .dm-light-row>.ed-row-main .ed-row-old{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #editor-modal .dm-light-row>.dm-light-edit,#editor-modal .dm-light-row>.dm-light-delete{width:40px!important;height:40px!important;min-width:40px!important;margin:0!important;padding:0!important;border-radius:12px!important}

      /* Temperature: same card/form language as the other canonical editors. */
      #editor-modal [data-temperature-editor]{box-sizing:border-box!important;margin:0!important;padding:12px 14px!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 22%,var(--divider-color,#dbe4ee))!important;border-radius:14px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 6%,transparent)!important;font-size:12px!important;line-height:1.45!important}
      #editor-modal [data-temperature-list]{display:grid!important;gap:8px!important;margin:0!important}
      #editor-modal .dm-temperature-card{display:grid!important;grid-template-columns:44px minmax(0,1fr) 40px 40px!important;align-items:center!important;gap:10px!important;box-sizing:border-box!important;width:100%!important;margin:0!important;padding:10px 11px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:14px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-temperature-card-icon{display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border-radius:12px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,transparent)!important;font-size:21px!important}
      #editor-modal .dm-temperature-card .ed-row-main{min-width:0!important}
      #editor-modal .dm-temperature-card .ed-row-new{font-weight:900!important}
      #editor-modal .dm-temperature-card .ed-row-old{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #editor-modal .dm-temperature-card>.ed-del{width:40px!important;height:40px!important;margin:0!important;padding:0!important;border-radius:12px!important}
      #editor-modal .dm-temperature-form{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;box-sizing:border-box!important;margin-top:4px!important;padding:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:17px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-temperature-form>.ed-sec-title{grid-column:1/-1!important;margin:0!important;padding:0 0 9px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important;font-size:15px!important;font-weight:900!important}
      #editor-modal .dm-temperature-form>.ed-slot{margin:0!important;min-width:0!important}
      #editor-modal .dm-temperature-form>.dm-temperature-floor{grid-column:1/-1!important;min-height:0!important;margin:-3px 0 0!important}
      #editor-modal .dm-temperature-form>.dm-entity-field{min-width:0!important}
      #editor-modal .dm-temperature-actions{grid-column:1/-1!important;display:flex!important;justify-content:flex-end!important;gap:9px!important;padding-top:2px!important}
      #editor-modal .dm-temperature-actions>button{min-height:42px!important;margin:0!important;padding:9px 14px!important;border-radius:12px!important;font-weight:900!important}
      #editor-modal .dm-temperature-form[data-dm-temperature-mode="edit"]{border-color:color-mix(in srgb,var(--info-color,#0ea5e9) 58%,var(--divider-color,#dbe4ee))!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--info-color,#0ea5e9) 7%,transparent)!important}
      #editor-modal .dm-temperature-form[data-dm-temperature-mode="edit"]>[data-temperature-form-title]{color:var(--info-color,#0369a1)!important}
      #editor-modal .dm-temperature-submit{background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;color:#fff!important;border:0!important}

      /* Canonical geometry for every section editor. */
      .dm-section-modal{position:fixed!important;inset:0!important;z-index:100040!important;display:grid!important;place-items:center!important;padding:16px!important;background:rgba(15,23,42,.58)!important;backdrop-filter:blur(5px)!important}
      .dm-section-modal .dm-section-dialog{box-sizing:border-box!important;width:min(880px,calc(100vw - 24px))!important;height:min(760px,calc(100dvh - 32px))!important;max-height:min(760px,calc(100dvh - 32px))!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;overflow:hidden!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:26px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--text,#0f172a)!important;box-shadow:0 28px 80px rgba(15,23,42,.3)!important}
      .dm-section-modal .dm-section-dialog>header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;padding:18px 22px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important;font-size:18px!important}
      .dm-section-modal .dm-section-dialog>header [data-close]{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;border:0!important;border-radius:50%!important;background:var(--secondary-background-color,#f1f5f9)!important;color:var(--secondary-text-color,#64748b)!important;font-size:20px!important;cursor:pointer!important}
      .dm-section-modal .dm-section-dialog>form{box-sizing:border-box!important;min-height:0!important;overflow:auto!important;display:grid!important;align-content:start!important;gap:14px!important;padding:20px 22px 0!important}
      .dm-section-modal .dm-section-dialog .ed-slot{display:grid!important;gap:6px!important;min-width:0!important}
      .dm-section-modal .dm-section-dialog .ed-slot-lbl{font-size:12px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-section-modal .dm-section-dialog .ed-form-row{display:grid!important;grid-template-columns:minmax(0,1fr) 48px!important;gap:10px!important;align-items:center!important}
      .dm-section-modal .dm-section-dialog .ed-input{box-sizing:border-box!important;width:100%!important;min-height:48px!important;padding:10px 14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:13px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:inherit!important}
      .dm-section-modal .dm-section-dialog .dm-entity-picker{min-width:48px!important;height:48px!important;border:0!important;border-radius:13px!important;background:var(--primary-color,#0284c7)!important;color:#fff!important;cursor:pointer!important}
      .dm-section-modal .dm-section-dialog>form>footer{position:sticky!important;bottom:0!important;z-index:2!important;display:flex!important;justify-content:flex-end!important;gap:10px!important;margin:2px -22px 0!important;padding:14px 22px 18px!important;border-top:1px solid var(--divider-color,#e2e8f0)!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      .dm-section-modal .dm-section-dialog>form>footer button{min-height:44px!important;padding:10px 16px!important;border:0!important;border-radius:12px!important;font-weight:900!important;cursor:pointer!important}
      .dm-section-modal .dm-section-dialog>form>footer .ed-save-btn{background:var(--success-color,#059669)!important;color:#fff!important}
      #dm-appliance-editor-modal .dm-appliance-editor-dialog{overflow:hidden!important}

      #page-appliances-main .appl-wide-card .appl-wide-stat,#appl-grid-overview .appl-wide-card .appl-wide-stat,
      #page-appliances-main .appl-wide-card .appl-energy,#appl-grid-overview .appl-wide-card .appl-energy,
      #page-appliances-main .appl-wide-card .appl-kwh,#appl-grid-overview .appl-wide-card .appl-kwh{color:var(--text,#0f172a)!important;opacity:1!important}
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,#page-appliances-main .appl-status,#appl-grid-overview .appl-status{align-self:center!important;vertical-align:middle!important}

      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-guide-steps>span,
      #editor-modal[data-dm-editor-theme="dark"] .dm-light-group,
      #editor-modal[data-dm-editor-theme="dark"] .dm-temperature-card,
      #editor-modal[data-dm-editor-theme="dark"] .dm-temperature-form{background:var(--dm-editor-panel,#1b2540)!important;border-color:var(--dm-editor-border,#31405f)!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-light-row{background:var(--surface-3,#212d4c)!important;border-color:var(--dm-editor-border,#31405f)!important}

      @media(max-width:820px){
        #editor-modal .dm-energy-guide-steps{grid-template-columns:1fr!important}
        #editor-modal .dm-energy-source-contract dl>div{grid-template-columns:112px minmax(0,1fr)!important}
      }
      @media(max-width:720px){
        #editor-modal .dm-light-row{display:grid!important;grid-template-columns:minmax(0,1fr) 40px 40px!important;grid-template-areas:"main edit delete" "room room room" "order order order"!important;gap:9px!important;min-height:0!important}
        #editor-modal .dm-light-row>.ed-row-main{grid-area:main!important;align-self:center!important}
        #editor-modal .dm-light-row>.dm-light-edit{grid-area:edit!important}
        #editor-modal .dm-light-row>.dm-light-delete{grid-area:delete!important}
        #editor-modal .dm-light-row>.dm-light-room{grid-area:room!important;width:100%!important;min-width:0!important;grid-column:auto!important;grid-row:auto!important}
        #editor-modal .dm-light-row>.dm-light-order{grid-area:order!important;display:flex!important;justify-content:flex-end!important;gap:6px!important}
        #editor-modal .dm-light-row>.dm-light-order>.ed-del{width:36px!important;height:32px!important;margin:0!important;padding:0!important;border-radius:10px!important}
        #editor-modal .dm-temperature-form{grid-template-columns:1fr!important;padding:12px!important}
        #editor-modal .dm-temperature-form>*{grid-column:1!important}
        #editor-modal .dm-temperature-actions{grid-column:1!important;justify-content:stretch!important}
        #editor-modal .dm-temperature-actions>button{flex:1 1 0!important}
      }
      @media(max-width:620px){
        #editor-modal .dm-energy-help-compact{grid-template-columns:1fr!important}
        #editor-modal .dm-energy-editor-body{gap:9px!important}
        #editor-modal .dm-energy-config-group>summary{padding:11px 12px!important}
        #editor-modal .dm-energy-config-group>.ed-acc-body{padding:11px 12px 13px!important}
        .dm-section-modal{padding:0!important;place-items:stretch!important}
        .dm-section-modal .dm-section-dialog{width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
        .dm-section-modal .dm-section-dialog>form{padding-left:16px!important;padding-right:16px!important}
        .dm-section-modal .dm-section-dialog>form>footer{margin-left:-16px!important;margin-right:-16px!important;padding-left:16px!important;padding-right:16px!important}
      }
      @media(max-width:520px){
        #editor-modal .dm-energy-source-contract dl>div{grid-template-columns:1fr!important;gap:4px!important}
        #editor-modal .dm-energy-contract-note{display:none!important}
        #editor-modal .dm-temperature-card{grid-template-columns:40px minmax(0,1fr) 38px 38px!important;gap:8px!important;padding:9px!important}
        #editor-modal .dm-temperature-card-icon{width:36px!important;height:36px!important}
        #editor-modal .dm-temperature-card>.ed-del{width:38px!important;height:38px!important}
      }
    `,
  );
}

export function installEditorContractsSection() {
  if (!doc) return;
  installStyles();
  installExplicitReportSaveContract();
  installWrappers();
  schedule();
  if (!state.installed) {
    state.installed = true;
    for (const event of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "pageshow",
    ]) {
      root.addEventListener?.(event, () => {
        installWrappers();
        schedule();
      });
    }
    doc.addEventListener(
      "input",
      (event) => {
        if (event.target?.matches?.('#dm-appliance-editor-modal select[name="icon"]')) schedule();
      },
      false,
    );
    doc.addEventListener(
      "change",
      (event) => {
        if (event.target?.matches?.('#dm-appliance-editor-modal select[name="icon"]')) {
          root.queueMicrotask?.(schedule);
        }
      },
      false,
    );
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("[data-report-save]")) synchronizeReportFields();
        schedule();
      },
      true,
    );
  }
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installEditorContractsSection, { once: true });
} else {
  installEditorContractsSection();
}
